// app/routes/app.discounts-edit.jsx
import { useEffect } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { data, Form, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import prisma from "../db.server.js";
import { authenticate } from "../shopify.server.js";
import {
    canUseDiscountType,
    getDiscountAccessState,
    requireCreateDiscountAccess,
} from "../utils/plan-gate.server.js";
import {
    getDiscountTemplateByDiscount,
    getDiscountTemplateBySlug
} from "../configs/discount-templates.js";
import {
    buildDiscountMatchKey,
    resolveDiscountCollision,
} from "../utils/discount-identity.server.js";
import {
    getGroupConfig,
    getGroupKeyFromDiscountType,
    buildDraftPayload,
    buildBxgyConfigPayload,
    buildInitialState,
    normalizeJson,
} from "../helpers/NativeDiscountsPayloadHelper.js";
import { useDiscountWizardState } from "../components/discount-wizard/useDiscountWizardState.js";
import { RouteErrorFallback } from "../components";
import hydrateSelectedResource from "../utils/hydrateSelectedResource.server.js";
import { logger } from "../utils/logger.server.js";

// Import shared components and utilities
import {
    ERROR_STEP_BY_FIELD,
    StepContent,
    HiddenFields,
    computeDiscountType,
    getVisibleSteps,
    useWizardNavigation,
} from "../components/discount-wizard/DiscountWizardComponents.jsx";
import { validateDiscountForm } from "../utils/discount-validation.server.js";
import { handleSyncFailure, publishDiscountToShopify, validatePublishLimits } from "../utils/discount-sync-handler.server.js";
import { StepProgress } from "../components/discount-wizard/WizardShell.jsx";

const SRC = "discounts-edit";

export async function loader({ request }) {
    // ============================================
    // STEP 1: Authentication & Authorization
    // ============================================
    const { admin } = await authenticate.admin(request);
    const { shop, access, trialDaysRemaining } = await requireCreateDiscountAccess(request);

    // ============================================
    // STEP 2: Parse URL Parameters
    // ============================================
    const url = new URL(request.url);
    const id = String(url.searchParams.get("id") || "").trim();

    if (!id) {
        throw data({ message: "Draft id is required." }, { status: 400 });
    }

    // ============================================
    // STEP 3: Fetch Discount from Database
    // ============================================
    const discount = await prisma.discount.findFirst({
        where: {
            id,
            shopId: shop.id,
        },
        include: {
            bxgyConfig: true,
        },
    });

    if (!discount) {
        throw data({ message: "Draft not found." }, { status: 404 });
    }

    // ============================================
    // STEP 4: Validate Discount Status (only draft/failed can be edited)
    // ============================================
    if (discount.status !== "DRAFT" && discount.status !== "FAILED") {
        throw data({ message: "Only draft discounts can be edited here." }, { status: 400 });
    }

    // ============================================
    // STEP 5: Validate Plan Access for This Discount
    // ============================================
    const accessState = getDiscountAccessState(access, discount);

    if (!accessState.canEdit) {
        throw data(
            {
                message:
                    accessState.reason === "trial_expired"
                        ? "Your trial has expired. Upgrade to edit this discount."
                        : "Your current plan cannot edit this discount.",
            },
            { status: 403 }
        );
    }

    // ============================================
    // STEP 6: Determine Discount Group & Config
    // ============================================
    const group = getGroupKeyFromDiscountType(discount.discountType);
    const groupConfig = getGroupConfig(group);

    // ============================================
    // STEP 7: Hydrate Related Resources (Products/Collections)
    // Fetch full resource details for UI display
    // ============================================
    const hydratedTargetProducts =
        group === "product" && Array.isArray(discount.targetProducts) && discount.targetProducts.length > 0
            ? await hydrateSelectedResource({
                admin,
                type: "product",
                ids: discount.targetProducts,
            })
            : [];

    const hydratedTargetCollections =
        group === "product" && Array.isArray(discount.targetCollections) && discount.targetCollections.length > 0
            ? await hydrateSelectedResource({
                admin,
                type: "collection",
                ids: discount.targetCollections,
            })
            : [];

    const hydratedBxgyBuyProducts =
        group === "bxgy" &&
            Array.isArray(discount.bxgyConfig?.customerBuysProducts) &&
            discount.bxgyConfig.customerBuysProducts.length > 0
            ? await hydrateSelectedResource({
                admin,
                type: "product",
                ids: discount.bxgyConfig.customerBuysProducts,
            })
            : [];

    const hydratedBxgyBuyCollections =
        group === "bxgy" &&
            Array.isArray(discount.bxgyConfig?.customerBuysCollections) &&
            discount.bxgyConfig.customerBuysCollections.length > 0
            ? await hydrateSelectedResource({
                admin,
                type: "collection",
                ids: discount.bxgyConfig.customerBuysCollections,
            })
            : [];

    const hydratedBxgyGetProducts =
        group === "bxgy" &&
            Array.isArray(discount.bxgyConfig?.customerGetsProducts) &&
            discount.bxgyConfig.customerGetsProducts.length > 0
            ? await hydrateSelectedResource({
                admin,
                type: "product",
                ids: discount.bxgyConfig.customerGetsProducts,
            })
            : [];

    const hydratedBxgyGetCollections =
        group === "bxgy" &&
            Array.isArray(discount.bxgyConfig?.customerGetsCollections) &&
            discount.bxgyConfig.customerGetsCollections.length > 0
            ? await hydrateSelectedResource({
                admin,
                type: "collection",
                ids: discount.bxgyConfig.customerGetsCollections,
            })
            : [];

    // Free-gift hydration: gift variant + trigger products (product or variant GIDs)
    let hydratedGiftProduct = null;
    let hydratedProductTriggerProducts = [];
    try {
        if (group === "free_gift" && discount.freeGiftConfig) {
            const fgConfig = typeof discount.freeGiftConfig === "string"
                ? normalizeJson(discount.freeGiftConfig)
                : discount.freeGiftConfig;

            if (fgConfig) {
                const giftVariantId = fgConfig.giftVariantId;
                const triggerIds = Array.isArray(fgConfig.productTrigger?.productIds)
                    ? fgConfig.productTrigger.productIds
                    : [];

                const allIds = [...new Set([giftVariantId, ...triggerIds].filter(Boolean))];

                if (allIds.length > 0) {
                    // Split by GID type so each is resolved with the right GraphQL fragment
                    const productIds = allIds.filter(
                        (id) => id.startsWith("gid://shopify/Product/") && !id.includes("/ProductVariant/"),
                    );
                    const variantIds = allIds.filter((id) =>
                        id.startsWith("gid://shopify/ProductVariant/"),
                    );

                    const hydratedProducts = productIds.length > 0
                        ? await hydrateSelectedResource({ admin, type: "product", ids: productIds })
                        : [];
                    const hydratedVariants = variantIds.length > 0
                        ? await hydrateSelectedResource({ admin, type: "variant", ids: variantIds })
                        : [];

                    const byId = new Map(
                        [...hydratedProducts, ...hydratedVariants].map((item) => [item.id, item]),
                    );

                    hydratedGiftProduct =
                        byId.get(giftVariantId) ?? {
                            id: giftVariantId,
                            type: "product",
                            title: giftVariantId,
                        };
                    hydratedProductTriggerProducts = triggerIds.map(
                        (id) => byId.get(id) ?? { id, type: "product", title: id },
                    );
                }
            }
        }
    } catch (err) {
        logger.warn(SRC, "Free gift resource hydration failed", {
            discountId: discount.id,
            error: logger.serializeError ? logger.serializeError(err) : String(err),
        });
    }

    // ============================================
    // STEP 8: Build Initial Wizard State from Database
    // ============================================
    const initialState = buildInitialState(
        {
            ...discount,
            targetProducts: hydratedTargetProducts,
            targetCollections: hydratedTargetCollections,
            giftProduct: hydratedGiftProduct,
            productTriggerProducts: hydratedProductTriggerProducts,
            bxgyConfig: discount.bxgyConfig
                ? {
                    ...discount.bxgyConfig,
                    customerBuysProducts: hydratedBxgyBuyProducts,
                    customerBuysCollections: hydratedBxgyBuyCollections,
                    customerGetsProducts: hydratedBxgyGetProducts,
                    customerGetsCollections: hydratedBxgyGetCollections,
                }
                : null,
        },
        group
    );

    // ============================================
    // STEP 9: Resolve Template for This Discount
    // ============================================
    const template = getDiscountTemplateByDiscount({
        ...discount,
        bxgyConfig: discount.bxgyConfig,
    });

    // ============================================
    // STEP 10: Return Loader Data
    // ============================================
    return data({
        shop,
        access,
        trialDaysRemaining,
        discountId: discount.id,
        discount,
        group,
        groupConfig,
        template,
        initialState,
        shopCurrency: shop.currency || "USD",
        canPublish: true,
        adminReady: Boolean(admin),
    });
}

export const action = async ({ request }) => {
    let shopId = null;
    let discountId = null;

    // ============================================
    // STEP 1: Authentication & Authorization
    // ============================================
    const { admin } = await authenticate.admin(request);
    const { shop, access } = await requireCreateDiscountAccess(request);
    shopId = shop.id;

    // ============================================
    // STEP 2: Parse Form Data & Validate Discount Exists
    // ============================================
    const formData = await request.formData();
    const id = String(formData.get("id") || "").trim();

    if (!id) {
        return data(
            { errors: { form: "Draft id is required." } },
            { status: 400 }
        );
    }

    const existingDiscount = await prisma.discount.findFirst({
        where: {
            id,
            shopId,
        },
        include: {
            bxgyConfig: true,
        },
    });

    if (!existingDiscount) {
        return data(
            { errors: { form: "Draft not found." } },
            { status: 404 }
        );
    }

    logger.info(SRC, "Request form parsed", {
        shopId,
        intent: formData.get("intent") || null,
        group: formData.get("group") || null,
        method: formData.get("method") || null,
        hasTitle: Boolean(formData.get("title")),
        hasDiscountCode: Boolean(formData.get("discountCode")),
    });

    const intent = String(formData.get("intent") || "draft");
    const templateSlug = String(formData.get("templateSlug") || "").trim() || null;
    const template = templateSlug ? getDiscountTemplateBySlug(templateSlug) : null;

    // ============================================
    // STEP 3: Validate Plan Access for This Discount
    // ============================================
    const accessState = getDiscountAccessState(access, existingDiscount);

    if (!accessState.canEdit) {
        return data(
            {
                errors: {
                    form:
                        accessState.reason === "trial_expired"
                            ? "Your trial has expired. Upgrade to edit this discount."
                            : "Your current plan cannot edit this discount.",
                },
            },
            { status: 403 }
        );
    }

    // ============================================
    // STEP 4: Validate Discount Status
    // ============================================
    if (
        existingDiscount.status !== "DRAFT" &&
        existingDiscount.status !== "FAILED"
    ) {
        return data(
            {
                errors: {
                    form: "Only draft discounts can be edited or published here.",
                },
            },
            { status: 400 }
        );
    }

    // ============================================
    // STEP 5: Determine Discount Group & Config
    // ============================================
    const group = String(
        formData.get("group") ||
        getGroupKeyFromDiscountType(existingDiscount.discountType)
    ).toLowerCase();

    const groupConfig = getGroupConfig(group);


    // ============================================
    // STEP 5: Validate Publish Limits (for publish intent)
    // ============================================
    if (intent === "publish") {
        const activeDiscountCount = await prisma.discount.count({
            where: {
                shopId,
                status: { in: [ "ACTIVE", "SCHEDULED" ] },
            },
        });

        await validatePublishLimits({
            request,
            activeDiscountCount,
            discountType: groupConfig.discountType,
            template,
            access,
            shopId,
            src: SRC,
        });
    }

    // ============================================
    // STEP 6: Validate Form Data
    // ============================================
    const { errors, parsedData } = await validateDiscountForm({
        formData,
        access,
        groupConfig,
        existingDiscount,
    });

    if (Object.keys(errors).length > 0) {
        return data({ errors }, { status: 400 });
    }

    // ============================================
    // STEP 7: Build Draft Payload for Update
    // ============================================
    const payload = buildDraftPayload({
        shopId: shop.id,
        formData,
        access,
        template: null,
        existingDiscount,
    });

    logger.info(SRC, "Draft payload built", { ...payload });

    const discountMethod = payload.method || "AUTOMATIC";
    const discountCode = payload.shopifyDiscountCode || null;

    const { matchKey, isMatchable } = buildDiscountMatchKey(
        payload.title,
        "DRAFT",
        discountMethod,
        discountCode
    );

    payload.matchKey = matchKey;
    payload.isMatchable = isMatchable;
    payload.matchType = discountMethod === "CODE" ? "CODE" : "AUTOMATIC";

    if (intent === "publish") {
        const collision = await resolveDiscountCollision({
            shopId,
            discountTitle: payload.title,
            discountMethod,
            discountCode,
            excludeDiscountId: existingDiscount.id,
        });

        if (collision.isCollided) {
            logger.warn(SRC, "Edit publish blocked by identity collision", {
                shopId,
                discountId: existingDiscount.id,
                matchType: collision.matchType,
                matchedDiscountId: collision.matchedDiscountId,
                matchKey: collision.matchKey,
            });

            return data(
                {
                    errors: {
                        form:
                            collision.matchType === "CODE"
                                ? "Another active or scheduled discount already uses this code."
                                : "Another active or scheduled automatic discount already uses this title.",
                        ...(collision.matchType === "CODE"
                            ? {
                                discountCode:
                                    "Another active or scheduled discount already uses this code.",
                            }
                            : {
                                title:
                                    "Another active or scheduled automatic discount already uses this title.",
                            }),
                    },
                    collision: {
                        matchType: collision.matchType,
                        matchedDiscountId: collision.matchedDiscountId,
                        matchedTitle: collision.matchedDiscount?.title || null,
                        matchedCode:
                            collision.matchedDiscount?.shopifyDiscountCode || null,
                    },
                },
                { status: 409 }
            );
        }
    }

    // ============================================
    // STEP 8: Final Plan Checks
    // ============================================
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

    // ============================================
    // STEP 9: Update Discount in Database
    // ============================================
    logger.info(SRC, "Update discount draft", {
        shopId,
        intent,
        title: payload.title,
    });

    const bxgyConfigPayload = buildBxgyConfigPayload(formData);

    // Exclude fields that shouldn't be updated directly
    const {
        shopId: _payloadShopId,
        scopeMode: _payloadScopeMode,
        shippingDestinationMode: _payloadShippingDestinationMode,
        ...updateData
    } = payload;

    const updatedDiscount = await prisma.discount.update({
        where: { id: existingDiscount.id },
        data: {
            ...updateData,
            bxgyConfig:
                payload.discountType === "BXGY"
                    ? {
                        upsert: {
                            create: bxgyConfigPayload,
                            update: bxgyConfigPayload,
                        },
                    }
                    : existingDiscount.bxgyConfig
                        ? {
                            delete: true,
                        }
                        : undefined,
        },
        include: {
            bxgyConfig: true,
        },
    });

    logger.info(SRC, "Update-Discount draft created", {
        shopId,
        discountId: updatedDiscount.id,
        status: updatedDiscount.status,
        matchType: updatedDiscount.matchType,
        isMatchable: updatedDiscount.isMatchable,
    });

    // ============================================
    // STEP 10: Handle Draft Intent (save only)
    // ============================================
    if (intent === "draft") {
        return redirect("/app/discounts");
    }

    // ============================================
    // STEP 11: Publish to Shopify (publish intent)
    // ============================================
    try {
        await publishDiscountToShopify({
            admin,
            discount: updatedDiscount,
            group,
            scopeMode: parsedData.scopeMode,
            shopId,
            prisma,
            src: SRC,
        });

        return redirect(`/app/discounts`);
    } catch (syncError) {
        // Sync failed - discount remains as draft with error
        await handleSyncFailure({
            prisma,
            discountId: updatedDiscount.id,
            error: syncError,
            src: SRC,
        });

        logger.error(SRC, "Shopify discount publish failed", {
            shopId: shop.id,
            discountId: updatedDiscount.id,
            error: logger.serializeError(syncError),
        });

        return data(
            {
                errors: {
                    form: `Saved draft changes, but publishing to Shopify failed: ${syncError?.message || syncError}`,
                },
            },
            { status: 422 }
        );
    }
};

// ============================================
// UI Components
// ============================================

export default function DiscountEditRoute() {
    const {
        discountId,
        group,
        groupConfig,
        template,
        initialState,
        shopCurrency,
    } = useLoaderData();
    const actionData = useActionData();
    const navigation = useNavigation();

    const errors = actionData?.errors || {};
    const busy = navigation.state !== "idle";

    const state = useDiscountWizardState({
        groupConfig,
        template,
        groupValue: group,
        initialState,
    });

    useEffect(() => {
        if (!errors) return;

        const firstFieldWithError = Object.keys(errors).find(
            (field) => ERROR_STEP_BY_FIELD[ field ] !== undefined
        );

        if (firstFieldWithError) {
            state.setCurrentStep(ERROR_STEP_BY_FIELD[ firstFieldWithError ]);
        }
    }, [ errors, state.setCurrentStep ]);

    const stepItems = getVisibleSteps(group);
    const { visibleStepIndex, isLastStep, goNext, goBack } = useWizardNavigation({ state, stepItems });

    const discountType = computeDiscountType({ group, groupConfig, state, template });

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-sm text-gray-500">Discount editor</p>
                        <h1 className="mt-1 text-2xl font-semibold text-gray-900">Edit discount</h1>
                        <p className="mt-2 max-w-2xl text-sm text-gray-500">
                            {groupConfig.description}
                        </p>
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

                <Form method="post" className="flex flex-col items-center justify-center">
                    <HiddenFields
                        state={state}
                        group={group}
                        template={template}
                        discountId={discountId}
                        discountType={discountType}
                    />

                    <StepProgress
                        currentIndex={visibleStepIndex}
                        canGoToStep={state.canGoToStep}
                        onStepClick={(index) => {
                            if (state.canGoToStep(index)) {
                                state.setCurrentStep(index);
                            }
                        }}
                    />

                    <div className="mt-6 w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <StepContent
                            state={state}
                            errors={errors}
                            groupConfig={groupConfig}
                            shopCurrency={shopCurrency}
                        />
                    </div>

                    <div className="flex w-full m-3 px-3 justify-between">
                        <button
                            type="button"
                            onClick={goBack}
                            disabled={state.currentStep === 0}
                            className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                        >
                            Back
                        </button>

                        {!isLastStep ? (
                            <button
                                type="button"
                                onClick={goNext}
                                disabled={!state.canGoToStep(state.currentStep + 1)}
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
                                    Save draft changes
                                </button>

                                <button
                                    type="submit"
                                    name="intent"
                                    value="publish"
                                    disabled={busy}
                                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                    Publish to Shopify
                                </button>
                            </div>
                        )}
                    </div>
                </Form>
            </div>
        </div>
    );
}

export function ErrorBoundary() {
    return <RouteErrorFallback />;
}

export const headers = (headersArgs) => boundary.headers(headersArgs);