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
import {
    assertAdvancedFeatureAccess,
    assertCanCreateDiscount,
    canUseDiscountType,
    canUseTemplate,
    requireCreateDiscountAccess,
} from "../utils/plan-gate.server.js";
import { authenticate } from "../shopify.server.js";
import BasicsStep from "../components/discount-wizard/steps/BasicsStep.jsx";
import ValueStep from "../components/discount-wizard/steps/ValueStep.jsx";
import ConditionsStep from "../components/discount-wizard/steps/ConditionsStep.jsx";
import ScheduleStep from "../components/discount-wizard/steps/ScheduleStep.jsx";
import ReviewStep from "../components/discount-wizard/steps/ReviewStep.jsx";
import { StepProgress, StickyActionBar, STEPS } from "../components/discount-wizard/WizardShell.jsx";
import { useDiscountWizardState } from "../components/discount-wizard/useDiscountWizardState.js";
import { RouteErrorFallback } from "../components";

const GROUP_CONFIG = {
    order: {
        key: "order",
        family: "PERCENTAGE_OR_FIXED",
        discountType: "ORDER_PERCENTAGE",
        method: "AUTOMATIC",
        supportedMethods: [ "AUTOMATIC", "CODE" ],
        title: "Order discount",
        shortTitle: "Order",
        description: "Percentage or fixed discounts for the full cart.",
        helper: "Apply a discount across the full order total.",
        supportsTargets: false,
        supportsValueTypeToggle: true,
    },
    product: {
        key: "product",
        family: "PERCENTAGE_OR_FIXED",
        discountType: "PRODUCT_PERCENTAGE",
        method: "AUTOMATIC",
        supportedMethods: [ "AUTOMATIC", "CODE" ],
        title: "Product / collection discount",
        shortTitle: "Products",
        description: "Discount selected products or collections.",
        helper: "Target specific products or collections instead of the full cart.",
        supportsTargets: true,
        supportsValueTypeToggle: true,
    },
    bxgy: {
        key: "bxgy",
        family: "BXGY",
        discountType: "BXGY",
        method: "AUTOMATIC",
        supportedMethods: [ "AUTOMATIC" ],
        title: "Buy X get Y",
        shortTitle: "BXGY",
        description: "Create a BOGO or multi-buy promotion.",
        helper: "Build a reward flow where qualifying purchases unlock free or discounted items.",
        supportsTargets: false,
        supportsValueTypeToggle: false,
    },
    shipping: {
        key: "shipping",
        family: "FREE_SHIPPING",
        discountType: "FREE_SHIPPING",
        method: "AUTOMATIC",
        supportedMethods: [ "AUTOMATIC" ],
        title: "Free shipping discount",
        shortTitle: "Shipping",
        description: "Create a shipping incentive for checkout conversion.",
        helper: "Use shipping offers to improve conversion at checkout.",
        supportsTargets: false,
        supportsValueTypeToggle: false,
    },
    app: {
        key: "app",
        family: "APP_FUNCTION",
        discountType: "APP_VOLUME",
        method: "AUTOMATIC",
        supportedMethods: [ "AUTOMATIC" ],
        title: "Smart app discount",
        shortTitle: "App discount",
        description: "Advanced Functions-based logic for premium plans.",
        helper: "Reserved for advanced app-owned discount logic.",
        supportsTargets: false,
        supportsValueTypeToggle: false,
    },
};

function getGroupConfig(group) {
    return GROUP_CONFIG[ group ] || GROUP_CONFIG.order;
}

function getGroupKeyFromDiscountType(discountType) {
    switch (discountType) {
        case "PRODUCT_PERCENTAGE":
        case "PRODUCT_FIXED":
            return "product";
        case "BXGY":
            return "bxgy";
        case "FREE_SHIPPING":
            return "shipping";
        case "APP_VOLUME":
        case "APP_BUNDLE":
        case "APP_CAPPED":
            return "app";
        case "ORDER_FIXED":
        case "ORDER_PERCENTAGE":
        default:
            return "order";
    }
}

function normalizeJson(value) {
    if (!value) return null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function parseJsonArray(value) {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function buildBxgyConfigPayload(formData) {
    const buyRequirementType = String(formData.get("bxgyBuyRequirementType") || "QUANTITY");
    const buyTargetType = String(formData.get("bxgyBuyTargetType") || "PRODUCTS");
    const getTargetType = String(formData.get("bxgyGetTargetType") || "PRODUCTS");
    const getEffect = String(formData.get("bxgyGetEffect") || "FREE");

    const buyProducts = parseJsonArray(formData.get("bxgyBuyProducts"));
    const buyCollections = parseJsonArray(formData.get("bxgyBuyCollections"));
    const getProducts = parseJsonArray(formData.get("bxgyGetProducts"));
    const getCollections = parseJsonArray(formData.get("bxgyGetCollections"));

    const buyQuantityRaw = formData.get("bxgyBuyQuantity");
    const buyAmountRaw = formData.get("bxgyBuyAmount");
    const getQuantityRaw = formData.get("bxgyGetQuantity");
    const getPercentageRaw = formData.get("bxgyGetPercentage");
    const getAmountRaw = formData.get("bxgyGetAmount");

    return {
        customerBuysType: buyRequirementType,
        customerBuysQty:
            buyRequirementType === "QUANTITY" && buyQuantityRaw ? Number(buyQuantityRaw) : null,
        customerBuysAmount:
            buyRequirementType === "AMOUNT" && buyAmountRaw ? Number(buyAmountRaw) : null,
        customerBuysProducts: buyTargetType === "PRODUCTS" ? buyProducts : null,
        customerBuysCollections: buyTargetType === "COLLECTIONS" ? buyCollections : null,
        customerGetsQty: getQuantityRaw ? Number(getQuantityRaw) : 1,
        customerGetsEffect: getEffect,
        customerGetsPercentage:
            getEffect === "PERCENTAGE" && getPercentageRaw ? Number(getPercentageRaw) : null,
        customerGetsAmount:
            getEffect === "AMOUNT_OFF_EACH" && getAmountRaw ? Number(getAmountRaw) : null,
        customerGetsProducts: getTargetType === "PRODUCTS" ? getProducts : null,
        customerGetsCollections: getTargetType === "COLLECTIONS" ? getCollections : null,
    };
}

function buildDraftPayload({ shopId, formData, access, template }) {
    const group = String(formData.get("group") || "order").toLowerCase();
    const config = getGroupConfig(group);

    const discountType = String(formData.get("discountType") || config.discountType);
    const method = String(formData.get("method") || config.method);
    const shopifyDiscountCode =
        method === "CODE"
            ? String(formData.get("discountCode") || "").trim() || null
            : null;

    const title = String(formData.get("title") || `${config.title} draft`).trim();
    const description = String(formData.get("description") || "").trim() || null;
    const isPercentage = String(formData.get("isPercentage") || "true") !== "false";

    const discountValueRaw = formData.get("discountValue");
    const discountValue =
        discountValueRaw === "" || discountValueRaw == null ? null : Number(discountValueRaw);

    const scopeMode = String(formData.get("scopeMode") || "");
    const rawTargetProducts = normalizeJson(formData.get("targetProducts"));
    const rawTargetCollections = normalizeJson(formData.get("targetCollections"));

    let appliesToAll = true;
    let targetProducts = null;
    let targetCollections = null;

    if (group === "order") {
        appliesToAll = true;
    } else if (group === "product") {
        if (scopeMode === "SPECIFIC_PRODUCTS") {
            appliesToAll = false;
            targetProducts = rawTargetProducts;
            targetCollections = null;
        } else if (scopeMode === "SPECIFIC_COLLECTIONS") {
            appliesToAll = false;
            targetProducts = null;
            targetCollections = rawTargetCollections;
        } else {
            appliesToAll = true;
        }
    }

    const minimumType = String(formData.get("minimumType") || "NONE");
    const minimumSubtotalRaw = formData.get("minimumSubtotal");
    const minimumQuantityRaw = formData.get("minimumQuantity");

    const usageLimitRaw = formData.get("usageLimit");
    const appliesOncePerCustomer =
        String(formData.get("appliesOncePerCustomer") || "false") === "true";
    const combineWithOrderDiscounts =
        String(formData.get("combineWithOrderDiscounts") || "false") === "true";
    const combineWithProductDiscounts =
        String(formData.get("combineWithProductDiscounts") || "false") === "true";
    const combineWithShippingDiscounts =
        String(formData.get("combineWithShippingDiscounts") || "false") === "true";

    const startsAtRaw = formData.get("startsAt");
    const endsAtRaw = formData.get("endsAt");

    const shippingDestinationMode = String(
        formData.get("shippingDestinationMode") || "ALL"
    );
    const shippingDestinationCountriesRaw = parseJsonArray(
        formData.get("shippingDestinationCountries")
    );
    const maximumShippingPriceRaw = formData.get("maximumShippingPrice");

    const templateSlug =
        template?.slug || String(formData.get("templateSlug") || "").trim() || null;

    return {
        shopId,
        title,
        description,
        discountType,
        method,
        shopifyDiscountCode,
        status: "DRAFT",
        discountValue:
            discountType === "FREE_SHIPPING"
                ? null
                : Number.isFinite(discountValue)
                    ? discountValue
                    : null,
        isPercentage,
        appliesToAll,
        targetProducts,
        targetCollections,
        minimumType,
        minimumSubtotal: minimumSubtotalRaw ? Number(minimumSubtotalRaw) : null,
        minimumQuantity: minimumQuantityRaw ? Number(minimumQuantityRaw) : null,
        usageLimit: usageLimitRaw ? Number(usageLimitRaw) : null,
        usesPerOrderLimit: (() => {
            const raw = formData.get("bxgyUsesPerOrderLimit");
            return raw ? Number(raw) : null;
        })(),
        appliesOncePerCustomer,
        combineWithOrderDiscounts,
        combineWithProductDiscounts,
        combineWithShippingDiscounts,
        startsAt: startsAtRaw ? new Date(startsAtRaw) : new Date(),
        endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
        shippingDestinationCountries:
            discountType === "FREE_SHIPPING"
                ? shippingDestinationMode === "SPECIFIC_COUNTRIES"
                    ? shippingDestinationCountriesRaw
                    : null
                : null,
        maximumShippingPrice:
            discountType === "FREE_SHIPPING" &&
                maximumShippingPriceRaw !== "" &&
                maximumShippingPriceRaw != null
                ? Number(maximumShippingPriceRaw)
                : null,
        templateSlug,
        createdOnPlan: access.planName,
    };
}

export const loader = async ({ request }) => {
    const admin = await authenticate.admin(request);
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

    const group = String(url.searchParams.get("group") || "order").toLowerCase();
    const templateSlug = url.searchParams.get("template");
    const groupConfig = getGroupConfig(group);

    let template = null;
    if (templateSlug) {
        template = await prisma.discountTemplate.findUnique({
            where: { slug: templateSlug },
        });
    }

    if (templateSlug && (!template || !canUseTemplate(access, template))) {
        throw redirect("app/billing?reason=templatelocked", { target: "parent" });
    }

    if (!canUseDiscountType(access, groupConfig.discountType)) {
        throw redirect("app/billing?reason=planlocked", { target: "parent" });
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
    const { admin } = await authenticate.admin(request);
    const context = await requireCreateDiscountAccess(request);
    const { shop, access } = context;

    const formData = await request.formData();
    const intent = String(formData.get("intent") || "draft");
    const group = String(formData.get("group") || "order").toLowerCase();
    const templateSlug = String(formData.get("templateSlug") || "").trim() || null;
    const groupConfig = getGroupConfig(group);

    const template = templateSlug
        ? await prisma.discountTemplate.findUnique({ where: { slug: templateSlug } })
        : null;

    if (templateSlug && (!template || !canUseTemplate(access, template))) {
        return data(
            { errors: { form: "This template requires a higher plan." } },
            { status: 403 }
        );
    }

    if (!canUseDiscountType(access, groupConfig.discountType)) {
        return data(
            { errors: { form: "This discount type requires a higher plan." } },
            { status: 403 }
        );
    }

    if (intent === "publish") {
        const activeDiscountCount = await prisma.discount.count({
            where: {
                shopId: shop.id,
                status: { in: [ "ACTIVE", "SCHEDULED" ] },
            },
        });

        await assertCanCreateDiscount(
            request,
            activeDiscountCount,
            groupConfig.discountType,
            template
        );
    }

    try {
        assertAdvancedFeatureAccess(access, group, formData);
    } catch (err) {
        return data({ errors: { form: err.message } }, { status: 403 });
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
        discountValueRaw === "" || discountValueRaw == null ? null : Number(discountValueRaw);

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

        if (scopeMode === "SPECIFIC_COLLECTIONS" && targetCollections.length === 0) {
            return data(
                { errors: { targetCollections: "Add at least one collection target." } },
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

    if (!title) {
        errors.title = "Title is required.";
    }

    if (method === "CODE" && !discountCode) {
        errors.discountCode = "Discount code is required when code method is selected.";
    }

    if (
        !isBxgy &&
        !isFreeShipping &&
        (discountValue == null || !Number.isFinite(discountValue) || discountValue <= 0)
    ) {
        errors.discountValue = "Enter a valid discount value.";
    }

    if (
        !isBxgy &&
        !isFreeShipping &&
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
            errors.shippingDestinationCountries = "Add at least one destination country.";
        }

        if (
            maximumShippingPriceRaw &&
            (!Number.isFinite(maximumShippingPrice) || maximumShippingPrice <= 0)
        ) {
            errors.maximumShippingPrice =
                "Maximum shipping price must be greater than 0.";
        }
    }

    if (isBxgy) {
        const buyRequirementType = String(formData.get("bxgyBuyRequirementType") || "QUANTITY");
        const buyQuantity = Number(formData.get("bxgyBuyQuantity"));
        const buyAmount = Number(formData.get("bxgyBuyAmount"));
        const buyTargetType = String(formData.get("bxgyBuyTargetType") || "PRODUCTS");
        const buyProducts = parseJsonArray(formData.get("bxgyBuyProducts"));
        const buyCollections = parseJsonArray(formData.get("bxgyBuyCollections"));

        const getQuantity = Number(formData.get("bxgyGetQuantity"));
        const getEffect = String(formData.get("bxgyGetEffect") || "FREE");
        const getPercentage = Number(formData.get("bxgyGetPercentage"));
        const getAmount = Number(formData.get("bxgyGetAmount"));
        const getTargetType = String(formData.get("bxgyGetTargetType") || "PRODUCTS");
        const getProducts = parseJsonArray(formData.get("bxgyGetProducts"));
        const getCollections = parseJsonArray(formData.get("bxgyGetCollections"));

        const usesPerOrderLimitRaw = formData.get("bxgyUsesPerOrderLimit");

        if (buyRequirementType === "QUANTITY" && (!Number.isInteger(buyQuantity) || buyQuantity <= 0)) {
            errors.bxgyBuyQuantity = "Enter a valid buy quantity.";
        }

        if (buyRequirementType === "AMOUNT" && (!Number.isFinite(buyAmount) || buyAmount <= 0)) {
            errors.bxgyBuyAmount = "Enter a valid spend amount.";
        }

        if (buyTargetType === "PRODUCTS" && buyProducts.length === 0) {
            errors.bxgyBuyProducts = "Add at least one product customers must buy.";
        }

        if (buyTargetType === "COLLECTIONS" && buyCollections.length === 0) {
            errors.bxgyBuyCollections = "Add at least one collection customers must buy from.";
        }

        if (!Number.isInteger(getQuantity) || getQuantity <= 0) {
            errors.bxgyGetQuantity = "Enter a valid reward quantity.";
        }

        if (
            getEffect === "PERCENTAGE" &&
            (!Number.isFinite(getPercentage) || getPercentage <= 0 || getPercentage > 100)
        ) {
            errors.bxgyGetPercentage = "Enter a valid reward percentage.";
        }

        if (getEffect === "AMOUNT_OFF_EACH" && (!Number.isFinite(getAmount) || getAmount <= 0)) {
            errors.bxgyGetAmount = "Enter a valid amount off per reward item.";
        }

        if (getTargetType === "PRODUCTS" && getProducts.length === 0) {
            errors.bxgyGetProducts = "Add at least one reward product.";
        }

        if (getTargetType === "COLLECTIONS" && getCollections.length === 0) {
            errors.bxgyGetCollections = "Add at least one reward collection.";
        }

        if (usesPerOrderLimitRaw && Number(usesPerOrderLimitRaw) <= 0) {
            errors.bxgyUsesPerOrderLimit = "Uses per order must be greater than 0.";
        }
    }

    if (minimumType === "SUBTOTAL" && (!minimumSubtotal || Number(minimumSubtotal) <= 0)) {
        errors.minimumSubtotal = "Enter a valid minimum subtotal.";
    }

    if (minimumType === "QUANTITY" && (!minimumQuantity || Number(minimumQuantity) <= 0)) {
        errors.minimumQuantity = "Enter a valid minimum quantity.";
    }

    if (usageLimit && Number(usageLimit) <= 0) {
        errors.usageLimit = "Usage limit must be greater than 0.";
    }

    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
        errors.endsAt = "End date must be after the start date.";
    }

    if (Object.keys(errors).length > 0) {
        return data({ errors }, { status: 400 });
    }

    const payload = buildDraftPayload({
        shopId: shop.id,
        formData,
        access,
        template,
    });

    if (!canUseDiscountType(access, payload.discountType)) {
        return data(
            { errors: { form: "This discount type requires a higher plan." } },
            { status: 403 }
        );
    }

    const discount = await prisma.discount.create({
        data: {
            ...payload,
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

    const syncDiscount = {
        ...discount,
        group,
        scopeMode,
    };

    if (intent === "draft") {
        return redirect(`/app/discounts?draft=${discount.id}`);
    }

    try {
        const { pushDiscountToShopify } = await import("../utils/discount-sync.server.js");
        const { shopifyDiscountId } = await pushDiscountToShopify({
            admin,
            discount: syncDiscount,
            currencyCode: "USD",
        });

        await prisma.discount.update({
            where: { id: discount.id },
            data: {
                status: new Date(discount.startsAt) > new Date() ? "SCHEDULED" : "ACTIVE",
                shopifyDiscountId,
                lastSyncedAt: new Date(),
            },
        });

        return redirect(`/app/discounts?published=${discount.id}`);
    } catch (err) {
        await prisma.discount.update({
            where: { id: discount.id },
            data: {
                status: "FAILED",
                lastError: String(err?.message || err),
            },
        });

        return data(
            {
                errors: {
                    form: `Saved as draft, but publishing to Shopify failed: ${err?.message || err}`,
                },
            },
            { status: 422 }
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

export default function DiscountCreatePage() {
    const { access, trialDaysRemaining, group, groupConfig, template, shopCurrency } = useLoaderData();
    const actionData = useActionData();
    const navigation = useNavigation();
    const busy = navigation.state !== "idle";
    const errors = actionData?.errors || {};

    const groupValue = getGroupKeyFromDiscountType(groupConfig.discountType) || group;
    const state = useDiscountWizardState({ groupConfig, template, groupValue });

    const computedDiscountType =
        groupValue === "product"
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

                {errors.form ? (
                    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {errors.form}
                    </div>
                ) : null}

                <Form method="post">
                    <input type="hidden" name="group" value={groupValue} />
                    <input type="hidden" name="templateSlug" value={template?.slug || ""} />
                    <input type="hidden" name="discountType" value={computedDiscountType} />
                    <input type="hidden" name="method" value={state.method} />
                    <input type="hidden" name="discountCode" value={state.discountCode} />
                    <input type="hidden" name="title" value={state.title} />
                    <input type="hidden" name="description" value={state.description} />
                    <input type="hidden" name="isPercentage" value={String(state.isPercentage)} />
                    <input type="hidden" name="discountValue" value={state.discountValue} />
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

                    {groupValue === "shipping" ? (
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

                    {groupValue === "bxgy" ? (
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

                    <StepProgress
                        currentIndex={state.currentStep}
                        onStepClick={state.setCurrentStep}
                        canGoToStep={state.canGoToStep}
                    />

                    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <StepContent
                            state={state}
                            errors={errors}
                            groupConfig={groupConfig}
                            shopCurrency={shopCurrency}
                            busy={busy}
                        />
                    </div>

                    <StickyActionBar>
                        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-between">
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
                    </StickyActionBar>
                </Form>
            </div>
        </div>
    );
}

export function ErrorBoundary() {
    return <RouteErrorFallback />;
}

export const headers = (headersArgs) => boundary.headers(headersArgs);