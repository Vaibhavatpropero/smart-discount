// app/routes/app.discounts-new.jsx
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
    data,
    Form,
    Link,
    redirect,
    useActionData,
    useLoaderData,
    useNavigation,
} from "react-router";
import prisma from "../db.server.js";
import { authenticate } from "../shopify.server.js";
import {
    assertAdvancedFeatureAccess,
    assertCanCreateDiscount,
    canUseDiscountType,
    canUseTemplate,
    requireCreateDiscountAccess,
} from "../utils/plan-gate.server.js";
import {
    resolveDiscountIdentityForSave,
    computeIsMatchable,
} from "../utils/discount-identity.server.js";
import {
    getGroupConfig,
    getGroupKeyFromDiscountType,
    parseJsonArray,
    buildDraftPayload,
    buildBxgyConfigPayload,
} from "../helpers/NativeDiscountsPayloadHelper.js";
import {
    getDiscountTemplateBySlug,
    getTemplateInitialConfig,
} from "../configs/discount-templates.js";
import BasicsStep from "../components/discount-wizard/steps/BasicsStep.jsx";
import ValueStep from "../components/discount-wizard/steps/ValueStep.jsx";
import ConditionsStep from "../components/discount-wizard/steps/ConditionsStep.jsx";
import ScheduleStep from "../components/discount-wizard/steps/ScheduleStep.jsx";
import ReviewStep from "../components/discount-wizard/steps/ReviewStep.jsx";
import { StepProgress, StickyActionBar, STEPS } from "../components/discount-wizard/WizardShell.jsx";
import { useDiscountWizardState } from "../components/discount-wizard/useDiscountWizardState.js";
import { RouteErrorFallback } from "../components";
import { logger } from "../utils/logger.server.js";
import { useEffect } from "react";

const SRC = "discounts-new";

const ERROR_STEP_BY_FIELD = {
    title: 0,
    discountCode: 0,

    discountValue: 1,
    cappedAmount: 1,

    targetProducts: 2,
    targetCollections: 2,
    minimumSubtotal: 2,
    minimumQuantity: 2,
    shippingDestinationCountries: 2,
    maximumShippingPrice: 2,
    bxgyBuyQuantity: 2,
    bxgyBuyAmount: 2,
    bxgyBuyProducts: 2,
    bxgyBuyCollections: 2,
    bxgyGetQuantity: 2,
    bxgyGetPercentage: 2,
    bxgyGetAmount: 2,
    bxgyGetProducts: 2,
    bxgyGetCollections: 2,
    bxgyUsesPerOrderLimit: 2,

    startsAt: 3,
    endsAt: 3,
    usageLimit: 3,
};

export const loader = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const { shop, access, trialDaysRemaining } = await requireCreateDiscountAccess(request);

    const url = new URL(request.url);
    const currencyResponse = await admin.graphql(`#graphql
      query ShopCurrency {
        shop {
          currencyCode
          currencyFormats {
            moneyFormat
            moneyWithCurrencyFormat
          }
        }
      }
    `);
    const currencyJson = await currencyResponse.json();
    const shopCurrency = currencyJson?.data?.shop?.currencyCode ?? "USD";

    const templateSlug = url.searchParams.get("template");
    let template = null;

    if (templateSlug) {
        template = getDiscountTemplateBySlug(templateSlug);
    }

    const requestedGroup = url.searchParams.get("group");

    const derivedGroup =
        requestedGroup ||
        (template?.discountType === "APP_CAPPED"
            ? "app"
            : template
                ? template.family
                : "order");

    const group = String(derivedGroup).toLowerCase();

    const groupConfig = getGroupConfig(group);

    if (templateSlug && (!template || !canUseTemplate(access, template))) {
        throw redirect("/app/billing?reason=templatelocked");
    }

    if (!canUseDiscountType(access, groupConfig.discountType)) {
        throw redirect("/app/billing?reason=planlocked");
    }

    return data({
        shop: {
            id: shop.id,
            planName: shop.planName,
            planStatus: shop.planStatus,
        },
        access,
        trialDaysRemaining,
        group,
        groupConfig,
        template,
        shopCurrency,
    });
};

export const action = async ({ request }) => {
    let shopId = null;
    let discountId = null;

    try {
        logger.info(SRC, "Create action entered", {
            requestMethod: request.method,
            requestUrl: request.url,
        });

        logger.info(SRC, "Authenticating admin");
        const { admin } = await authenticate.admin(request);
        logger.info(SRC, "Admin authenticated");

        logger.info(SRC, "Resolving create-discount access");
        const context = await requireCreateDiscountAccess(request);
        const { shop, access } = context;
        shopId = shop.id;

        logger.info(SRC, "Create-discount access resolved", {
            shopId,
            planName: access.planName,
        });

        logger.info(SRC, "Parsing request form data");
        const formData = await request.formData();
        const requestedGroup = String(formData.get("group") || "").trim() || null;

        logger.info(SRC, "Request form parsed", {
            shopId,
            intent: formData.get("intent") || null,
            group: formData.get("group") || null,
            method: formData.get("method") || null,
            hasTitle: Boolean(formData.get("title")),
            hasDiscountCode: Boolean(formData.get("discountCode")),
        });

        const intent = String(formData.get("intent") || "draft");
        const derivedGroup =
            requestedGroup ||
            (template?.discountType === "APP_CAPPED"
                ? "app"
                : template
                    ? template.family
                    : "order");

        const group = String(derivedGroup).toLowerCase();
        const templateSlug = String(formData.get("templateSlug") || "").trim() || null;
        const groupConfig = getGroupConfig(group);

        const template = templateSlug ? getDiscountTemplateBySlug(templateSlug) : null;

        if (templateSlug && (!template || !canUseTemplate(access, template))) {
            return data(
                {
                    errors: {
                        form: "This template requires a higher plan.",
                    },
                },
                { status: 403 }
            );
        }

        if (!canUseDiscountType(access, groupConfig.discountType)) {
            return data(
                {
                    errors: {
                        form: "This discount type requires a higher plan.",
                    },
                },
                { status: 403 }
            );
        }

        if (intent === "publish") {
            logger.info(SRC, "Checking active-discount creation limit", {
                shopId,
                discountType: groupConfig.discountType,
            });

            const activeDiscountCount = await prisma.discount.count({
                where: {
                    shopId,
                    status: { in: [ "ACTIVE", "SCHEDULED" ] },
                },
            });

            await assertCanCreateDiscount({
                request,
                activeDiscountCount,
                discountType: groupConfig.discountType,
                template,
            });

            logger.info(SRC, "Active-discount creation limit allowed", {
                shopId,
                activeDiscountCount,
            });
        }

        logger.info(SRC, "Checking advanced feature access", {
            shopId,
            group,
        });

        try {
            assertAdvancedFeatureAccess(access, {
                group,
                formData,
            });

            logger.info(SRC, "Advanced feature access allowed", {
                shopId,
                group,
            });
        } catch (err) {
            logger.warn(SRC, "Advanced feature access rejected request", {
                shopId,
                group,
                error: logger.serializeError(err),
            });

            return data(
                {
                    errors: {
                        form:
                            err?.message ||
                            "This feature is not available on your current plan.",
                    },
                },
                { status: 403 }
            );
        }

        const title = String(formData.get("title") || "").trim();
        const method = String(formData.get("method") || groupConfig.method);

        if (!groupConfig.supportedMethods.includes(method)) {
            return data(
                {
                    errors: {
                        form: `${groupConfig.title} currently supports ${groupConfig.supportedMethods
                            .map((item) => item.toLowerCase())
                            .join(" or ")} method only.`,
                    },
                },
                { status: 400 }
            );
        }

        const discountCode = String(formData.get("discountCode") || "").trim();

        const discountValueRaw = formData.get("discountValue");
        const discountValue =
            discountValueRaw === "" || discountValueRaw == null
                ? null
                : Number(discountValueRaw);

        const cappedAmountRaw = formData.get("cappedAmount");
        const cappedAmount =
            cappedAmountRaw === "" || cappedAmountRaw == null
                ? null
                : Number(cappedAmountRaw);

        const scopeMode = String(formData.get("scopeMode") || "");
        const targetProducts = parseJsonArray(formData.get("targetProducts"));
        const targetCollections = parseJsonArray(formData.get("targetCollections"));

        if (group === "product") {
            if (scopeMode === "SPECIFIC_PRODUCTS" && targetProducts.length === 0) {
                return data(
                    { errors: { targetProducts: "Add at least one product target." } },
                    { status: 400 }
                );
            }

            if (
                scopeMode === "SPECIFIC_COLLECTIONS" &&
                targetCollections.length === 0
            ) {
                return data(
                    {
                        errors: {
                            targetCollections: "Add at least one collection target.",
                        },
                    },
                    { status: 400 }
                );
            }
        }

        const minimumType = String(formData.get("minimumType") || "NONE");
        const minimumSubtotal = formData.get("minimumSubtotal");
        const minimumQuantity = formData.get("minimumQuantity");
        const startsAt = formData.get("startsAt");
        const endsAt = formData.get("endsAt");
        const usageLimit = formData.get("usageLimit");

        const shippingDestinationMode = String(
            formData.get("shippingDestinationMode") || "ALL"
        );
        const shippingDestinationCountries = parseJsonArray(
            formData.get("shippingDestinationCountries")
        );
        const maximumShippingPriceRaw = formData.get("maximumShippingPrice");
        const maximumShippingPrice =
            maximumShippingPriceRaw === "" || maximumShippingPriceRaw == null
                ? null
                : Number(maximumShippingPriceRaw);

        const errors = {};

        const postedDiscountType = String(
            formData.get("discountType") || groupConfig.discountType
        );

        const isBxgy = postedDiscountType === "BXGY";
        const isFreeShipping = postedDiscountType === "FREE_SHIPPING";
        const isAppCapped = postedDiscountType === "APP_CAPPED";

        if (!title) {
            errors.title = "Title is required.";
        }

        if (method === "CODE" && !discountCode) {
            errors.discountCode =
                "Discount code is required when code method is selected.";
        }

        if (
            !isBxgy &&
            !isFreeShipping &&
            !isAppCapped &&
            (discountValue == null ||
                !Number.isFinite(discountValue) ||
                discountValue <= 0)
        ) {
            errors.discountValue = "Enter a valid discount value.";
        }

        if (
            !isBxgy &&
            !isFreeShipping &&
            !isAppCapped &&
            String(formData.get("isPercentage") || "true") === "true" &&
            discountValue > 100
        ) {
            errors.discountValue = "Percentage value cannot be more than 100.";
        }

        if (isFreeShipping) {
            if (
                shippingDestinationMode === "SPECIFIC_COUNTRIES" &&
                shippingDestinationCountries.length === 0
            ) {
                errors.shippingDestinationCountries =
                    "Add at least one destination country.";
            }

            if (
                maximumShippingPriceRaw &&
                (!Number.isFinite(maximumShippingPrice) ||
                    maximumShippingPrice <= 0)
            ) {
                errors.maximumShippingPrice =
                    "Maximum shipping price must be greater than 0.";
            }
        }

        if (isBxgy) {
            const buyRequirementType = String(
                formData.get("bxgyBuyRequirementType") || "QUANTITY"
            );
            const buyQuantity = Number(formData.get("bxgyBuyQuantity"));
            const buyAmount = Number(formData.get("bxgyBuyAmount"));
            const buyTargetType = String(
                formData.get("bxgyBuyTargetType") || "PRODUCTS"
            );
            const buyProducts = parseJsonArray(formData.get("bxgyBuyProducts"));
            const buyCollections = parseJsonArray(
                formData.get("bxgyBuyCollections")
            );

            const getQuantity = Number(formData.get("bxgyGetQuantity"));
            const getEffect = String(formData.get("bxgyGetEffect") || "FREE");
            const getPercentage = Number(formData.get("bxgyGetPercentage"));
            const getAmount = Number(formData.get("bxgyGetAmount"));
            const getTargetType = String(
                formData.get("bxgyGetTargetType") || "PRODUCTS"
            );
            const getProducts = parseJsonArray(formData.get("bxgyGetProducts"));
            const getCollections = parseJsonArray(
                formData.get("bxgyGetCollections")
            );
            const usesPerOrderLimitRaw = formData.get("bxgyUsesPerOrderLimit");

            if (
                buyRequirementType === "QUANTITY" &&
                (!Number.isInteger(buyQuantity) || buyQuantity <= 0)
            ) {
                errors.bxgyBuyQuantity = "Enter a valid buy quantity.";
            }

            if (
                buyRequirementType === "AMOUNT" &&
                (!Number.isFinite(buyAmount) || buyAmount <= 0)
            ) {
                errors.bxgyBuyAmount = "Enter a valid spend amount.";
            }

            if (buyTargetType === "PRODUCTS" && buyProducts.length === 0) {
                errors.bxgyBuyProducts =
                    "Add at least one product customers must buy.";
            }

            if (buyTargetType === "COLLECTIONS" && buyCollections.length === 0) {
                errors.bxgyBuyCollections =
                    "Add at least one collection customers must buy from.";
            }

            if (!Number.isInteger(getQuantity) || getQuantity <= 0) {
                errors.bxgyGetQuantity = "Enter a valid reward quantity.";
            }

            if (
                getEffect === "PERCENTAGE" &&
                (!Number.isFinite(getPercentage) ||
                    getPercentage <= 0 ||
                    getPercentage > 100)
            ) {
                errors.bxgyGetPercentage = "Enter a valid reward percentage.";
            }

            if (
                getEffect === "AMOUNT_OFF_EACH" &&
                (!Number.isFinite(getAmount) || getAmount <= 0)
            ) {
                errors.bxgyGetAmount = "Enter a valid amount off per reward item.";
            }

            if (getTargetType === "PRODUCTS" && getProducts.length === 0) {
                errors.bxgyGetProducts = "Add at least one reward product.";
            }

            if (getTargetType === "COLLECTIONS" && getCollections.length === 0) {
                errors.bxgyGetCollections =
                    "Add at least one reward collection.";
            }

            if (
                usesPerOrderLimitRaw &&
                (!Number.isInteger(Number(usesPerOrderLimitRaw)) ||
                    Number(usesPerOrderLimitRaw) <= 0)
            ) {
                errors.bxgyUsesPerOrderLimit = "Uses per order must be a positive whole number.";
            }
        }

        if (isAppCapped) {
            if (
                discountValue == null ||
                !Number.isFinite(discountValue) ||
                discountValue <= 0 ||
                discountValue > 100
            ) {
                errors.discountValue = "Enter a valid percentage value between 0 and 100.";
            }

            if (
                cappedAmount == null ||
                !Number.isFinite(cappedAmount) ||
                cappedAmount <= 0
            ) {
                errors.cappedAmount = "Enter a valid capped amount.";
            }
        }

        if (!isAppCapped) {
            if (minimumType === "SUBTOTAL" && (!minimumSubtotal || Number(minimumSubtotal) <= 0)) {
                errors.minimumSubtotal = "Enter a valid minimum subtotal.";
            }

            if (minimumType === "QUANTITY" && (!minimumQuantity || Number(minimumQuantity) <= 0)) {
                errors.minimumQuantity = "Enter a valid minimum quantity.";
            }

            if (usageLimit && (!Number.isInteger(Number(usageLimit)) || Number(usageLimit) <= 0)) {
                errors.usageLimit = "Usage limit must be a positive whole number.";
            }
        }

        if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
            errors.endsAt = "End date must be after the start date.";
        }

        if (Object.keys(errors).length > 0) {
            logger.warn(SRC, "Create validation rejected request", {
                shopId,
                errorFields: Object.keys(errors),
            });

            return data({ errors }, { status: 400 });
        }

        logger.info(SRC, "Building draft payload", {
            shopId,
            group,
        });

        const payload = buildDraftPayload({
            shopId,
            formData,
            access,
            template,
        });

        logger.info(SRC, "Draft payload built", {
            shopId,
            method: payload.method,
            discountType: payload.discountType,
            status: payload.status,
        });

        if (!canUseDiscountType(access, payload.discountType)) {
            return data(
                {
                    errors: {
                        form: "This discount type requires a higher plan.",
                    },
                },
                { status: 403 }
            );
        }

        logger.info(SRC, "Building discount identity", {
            shopId,
            method: payload.method,
            discountType: payload.discountType,
            status: payload.status,
            hasTitle: Boolean(payload.title),
            hasDiscountCode: Boolean(payload.shopifyDiscountCode),
        });

        const identityResult = await resolveDiscountIdentityForSave({
            shopId,
            method: payload.method,
            title: payload.title,
            shopifyDiscountCode: payload.shopifyDiscountCode,
            status: payload.status,
        });

        logger.info(SRC, "Discount identity resolved", {
            shopId,
            ok: identityResult.ok,
            matchType: identityResult.identity?.matchType || null,
            matchKey: identityResult.identity?.matchKey || null,
            collisionId: identityResult.collision?.id || null,
            errorFields: identityResult.errors
                ? Object.keys(identityResult.errors)
                : [],
        });

        if (!identityResult.ok) {
            return data(
                { errors: identityResult.errors },
                { status: 400 }
            );
        }

        logger.info(SRC, "Creating discount draft", {
            shopId,
            intent,
            method: payload.method,
            discountType: payload.discountType,
            matchType: identityResult.identity.matchType,
            isMatchable: identityResult.identity.isMatchable,
        });

        const discount = await prisma.discount.create({
            data: {
                ...payload,
                matchType: identityResult.identity.matchType,
                matchKey: identityResult.identity.matchKey,
                isMatchable: identityResult.identity.isMatchable,
                identityVersion: identityResult.identity.identityVersion,
                ...(payload.discountType === "BXGY"
                    ? {
                        bxgyConfig: {
                            create: buildBxgyConfigPayload(formData),
                        },
                    }
                    : {}),
            },
            include: {
                bxgyConfig: true,
            },
        });

        discountId = discount.id;

        logger.info(SRC, "Discount draft created", {
            shopId,
            discountId,
            status: discount.status,
            matchType: discount.matchType,
            isMatchable: discount.isMatchable,
        });

        const syncDiscount = {
            ...discount,
            group,
            scopeMode,
        };

        if (intent === "draft") {
            logger.info(SRC, "Redirecting to discounts", {
                shopId,
                discountId,
            });

            return redirect(`/app/discounts`);
        }

        try {
            logger.info(SRC, "Starting Shopify discount publish", {
                shopId,
                discountId,
                discountType: discount.discountType,
                method: discount.method,
                status: discount.status,
                hasBxgyConfig: Boolean(discount.bxgyConfig),
            });

            let shopifyDiscountId;

            if (syncDiscount.discountType === "APP_CAPPED") {
                const {
                    pushCustomDiscountToShopify,
                    resolveCappedOrderFunctionId,
                } = await import("../utils/discount-custom-sync.server.js");

                const functionId = await resolveCappedOrderFunctionId(admin);

                const result = await pushCustomDiscountToShopify({
                    admin,
                    discount: syncDiscount,
                    functionId,
                });

                shopifyDiscountId = result.shopifyDiscountId;
            } else {
                const { pushDiscountToShopify } = await import(
                    "../utils/discount-sync.server.js"
                );

                const result = await pushDiscountToShopify({
                    admin,
                    discount: syncDiscount,
                    currencyCode: "USD",
                });

                shopifyDiscountId = result.shopifyDiscountId;
            }

            const nextStatus =
                new Date(discount.startsAt) > new Date()
                    ? "SCHEDULED"
                    : "ACTIVE";

            await prisma.discount.update({
                where: { id: discountId },
                data: {
                    status: nextStatus,
                    shopifyDiscountId,
                    lastSyncedAt: new Date(),
                    isMatchable: computeIsMatchable(nextStatus),
                },
            });

            logger.info(SRC, "Shopify discount published", {
                shopId,
                discountId,
                shopifyDiscountId,
                nextStatus,
            });

            return redirect("/app/discounts");
        } catch (err) {
            logger.error(SRC, "Shopify discount publish failed", {
                shopId,
                discountId,
                error: logger.serializeError(err),
            });

            await prisma.discount.update({
                where: { id: discountId },
                data: {
                    status: "FAILED",
                    lastError: String(err?.message || err),
                    isMatchable: false,
                },
            });

            return data(
                {
                    errors: {
                        form: `Saved as draft, but publishing to Shopify failed: ${err?.message || err
                            }`,
                    },
                },
                { status: 422 }
            );
        }
    } catch (err) {
        logger.error(SRC, "Unexpected create-discount action failure", {
            shopId,
            discountId,
            error: logger.serializeError(err),
        });

        return data(
            {
                errors: {
                    form: `Unable to save discount draft: ${err?.message || "Unknown error"
                        }`,
                },
            },
            { status: 500 }
        );
    }
};

function PlanBadge({ access, trialDaysRemaining }) {
    if (access.isTrialing) {
        return (
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                Trial · {trialDaysRemaining}d left
            </span>
        );
    }
    if (access.isExpired) {
        return (
            <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                Trial expired
            </span>
        );
    }
    if (access.isAdvance) {
        return (
            <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
                Advance
            </span>
        );
    }
    return (
        <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            Basic
        </span>
    );
}

function StepContent({ state, errors, groupConfig, shopCurrency, busy }) {
    switch (state.currentStep) {
        case 0:
            return <BasicsStep state={state} errors={errors} groupConfig={groupConfig} />;
        case 1:
            return (
                <ValueStep
                    state={state}
                    errors={errors}
                    shopCurrency={shopCurrency}
                    groupConfig={groupConfig}
                    busy={busy}
                />
            );
        case 2:
            return (
                <ConditionsStep
                    state={state}
                    errors={errors}
                    showTargeting={groupConfig.supportsTargets}
                    groupConfig={groupConfig}
                    shopCurrency={shopCurrency}
                />
            );
        case 3:
            return <ScheduleStep state={state} errors={errors} />;
        case 4:
        default:
            return (
                <ReviewStep
                    state={state}
                    groupConfig={groupConfig}
                    shopCurrency={shopCurrency}
                />
            );
    }
}

function HiddenFields({ state, group, template, discountType }) {
    return (
        <>
            <input type="hidden" name="group" value={group} />
            <input type="hidden" name="templateSlug" value={template?.slug || ""} />
            <input type="hidden" name="discountType" value={discountType} />
            <input type="hidden" name="method" value={state.method} />
            <input type="hidden" name="discountCode" value={state.discountCode} />
            <input type="hidden" name="title" value={state.title} />
            <input type="hidden" name="description" value={state.description} />
            <input type="hidden" name="isPercentage" value={String(state.isPercentage)} />
            <input type="hidden" name="discountValue" value={state.discountValue} />
            <input type="hidden" name="cappedAmount" value={state.cappedAmount} />
            <input type="hidden" name="scopeMode" value={state.scopeMode} />
            <input
                type="hidden"
                name="targetProducts"
                value={JSON.stringify(state.targetProducts.map((i) => i.id))}
            />
            <input
                type="hidden"
                name="targetCollections"
                value={JSON.stringify(state.targetCollections.map((i) => i.id))}
            />
            <input type="hidden" name="minimumType" value={state.minimumType} />
            <input type="hidden" name="minimumSubtotal" value={state.minimumSubtotal} />
            <input type="hidden" name="minimumQuantity" value={state.minimumQuantity} />
            <input type="hidden" name="usageLimit" value={state.usageLimit} />
            <input
                type="hidden"
                name="appliesOncePerCustomer"
                value={String(state.appliesOncePerCustomer)}
            />
            <input
                type="hidden"
                name="combineWithOrderDiscounts"
                value={String(state.combineWithOrderDiscounts)}
            />
            <input
                type="hidden"
                name="combineWithProductDiscounts"
                value={String(state.combineWithProductDiscounts)}
            />
            <input
                type="hidden"
                name="combineWithShippingDiscounts"
                value={String(state.combineWithShippingDiscounts)}
            />
            <input type="hidden" name="startsAt" value={state.startsAt} />
            <input type="hidden" name="endsAt" value={state.endsAt} />

            {group === "shipping" ? (
                <>
                    <input
                        type="hidden"
                        name="shippingDestinationMode"
                        value={state.shippingDestinationMode}
                    />
                    <input
                        type="hidden"
                        name="shippingDestinationCountries"
                        value={JSON.stringify(state.shippingDestinationCountries)}
                    />
                    <input
                        type="hidden"
                        name="maximumShippingPrice"
                        value={state.maximumShippingPrice}
                    />
                </>
            ) : null}

            {group === "bxgy" ? (
                <>
                    <input type="hidden" name="bxgyBuyRequirementType" value={state.bxgyBuyRequirementType} />
                    <input type="hidden" name="bxgyBuyQuantity" value={state.bxgyBuyQuantity} />
                    <input type="hidden" name="bxgyBuyAmount" value={state.bxgyBuyAmount} />
                    <input type="hidden" name="bxgyBuyTargetType" value={state.bxgyBuyTargetType} />
                    <input type="hidden" name="bxgyBuyProducts" value={JSON.stringify(state.bxgyBuyProducts.map((i) => i.id))} />
                    <input type="hidden" name="bxgyBuyCollections" value={JSON.stringify(state.bxgyBuyCollections.map((i) => i.id))} />
                    <input type="hidden" name="bxgyGetQuantity" value={state.bxgyGetQuantity} />
                    <input type="hidden" name="bxgyGetEffect" value={state.bxgyGetEffect} />
                    <input type="hidden" name="bxgyGetPercentage" value={state.bxgyGetPercentage} />
                    <input type="hidden" name="bxgyGetAmount" value={state.bxgyGetAmount} />
                    <input type="hidden" name="bxgyGetTargetType" value={state.bxgyGetTargetType} />
                    <input type="hidden" name="bxgyGetProducts" value={JSON.stringify(state.bxgyGetProducts.map((i) => i.id))} />
                    <input type="hidden" name="bxgyGetCollections" value={JSON.stringify(state.bxgyGetCollections.map((i) => i.id))} />
                    <input type="hidden" name="bxgyUsesPerOrderLimit" value={state.bxgyUsesPerOrderLimit} />
                </>
            ) : null}
        </>
    );
}

export default function DiscountCreatePage() {
    const {
        access,
        trialDaysRemaining,
        group,
        groupConfig,
        template,
        shopCurrency,
    } = useLoaderData();
    const templateInitialConfig = getTemplateInitialConfig(template);
    const actionData = useActionData();
    const navigation = useNavigation();
    const busy = navigation.state !== "idle";
    const errors = actionData?.errors || {};

    const groupValue = getGroupKeyFromDiscountType(groupConfig.discountType) || group;
    const state = useDiscountWizardState({
        groupConfig,
        template,
        groupValue,
        initialState: templateInitialConfig,
        skipConditionsStep: template?.discountType === "APP_CAPPED",
    });

    // useEffect(() => {
    //     console.log(`Loader groupConfig: ${group} : ${JSON.stringify(groupConfig)}`);
    // }, [ groupConfig ])


    useEffect(() => {
        if (!errors) return;

        const firstFieldWithError = Object.keys(errors).find(
            (field) => ERROR_STEP_BY_FIELD[ field ] !== undefined
        );

        if (firstFieldWithError) {
            state.setCurrentStep(ERROR_STEP_BY_FIELD[ firstFieldWithError ]);
        }
    }, [ errors, state.setCurrentStep ]);

    const computedDiscountType =
        template?.discountType === "APP_CAPPED"
            ? "APP_CAPPED"
            : groupValue === "product"
                ? (state.isPercentage ? "PRODUCT_PERCENTAGE" : "PRODUCT_FIXED")
                : groupValue === "order"
                    ? (state.isPercentage ? "ORDER_PERCENTAGE" : "ORDER_FIXED")
                    : groupConfig.discountType;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl font-semibold text-gray-900">Create discount</h1>
                            <PlanBadge access={access} trialDaysRemaining={trialDaysRemaining} />
                        </div>
                        <p className="mt-2 max-w-2xl text-sm text-gray-500">{groupConfig.title}</p>
                    </div>
                    <Link
                        to="/app/discounts"
                        className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Back
                    </Link>
                </div>

                {errors && Object.keys(errors).length > 0 ? (
                    <div
                        role="alert"
                        className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                    >
                        {errors.form ||
                            errors.discountCode ||
                            errors.title ||
                            "Please correct the highlighted fields and try again."}
                    </div>
                ) : null}

                <Form method="post" className="flex flex-col items-center justify-center">
                    <HiddenFields
                        state={state}
                        group={group}
                        template={template}
                        discountType={computedDiscountType}
                    />

                    <StepProgress
                        currentIndex={state.currentStep}
                        canGoToStep={state.canGoToStep}
                        onStepClick={state.setCurrentStep}
                    />

                    <div className="mt-6 w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <StepContent
                            state={state}
                            errors={errors}
                            groupConfig={groupConfig}
                            shopCurrency={shopCurrency}
                            busy={busy}
                        />
                    </div>

                    {/* <StickyActionBar> */}
                    <div className="flex w-full m-3 px-3 justify-between">
                        <button
                            type="button"
                            disabled={state.currentStep === 0}
                            onClick={() => state.setCurrentStep((s) => s - 1)}
                            className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                        >
                            Back
                        </button>

                        {state.currentStep < STEPS.length - 1 ? (
                            <button
                                type="button"
                                disabled={!state.canGoToStep(state.currentStep + 1)}
                                onClick={() => state.setCurrentStep((s) => s + 1)}
                                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                            >
                                Continue
                            </button>
                        ) : (
                            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                                <button
                                    type="submit"
                                    name="intent"
                                    value="draft"
                                    disabled={busy}
                                    className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Save as draft
                                </button>
                                <button
                                    type="submit"
                                    name="intent"
                                    value="publish"
                                    disabled={busy}
                                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                    Publish discount
                                </button>
                            </div>
                        )}
                    </div>
                    {/* </StickyActionBar> */}
                </Form>
            </div>
        </div>
    );
}

export function ErrorBoundary() {
    return <RouteErrorFallback />;
}

export const headers = (headersArgs) => boundary.headers(headersArgs);