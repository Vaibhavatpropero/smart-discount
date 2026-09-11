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
    canUseDiscountType,
    canUseTemplate,
    requireCreateDiscountAccess,
} from "../utils/plan-gate.server.js";
import {
    getGroupConfig,
    getGroupKeyFromDiscountType,
    buildDraftPayload,
    buildBxgyConfigPayload,
} from "../helpers/NativeDiscountsPayloadHelper.js";
import {
    getDiscountTemplateBySlug,
    getTemplateInitialConfig,
} from "../configs/discount-templates.js";
import {
    buildDiscountMatchKey,
    resolveDiscountCollision,
} from "../utils/discount-identity.server.js";
import { useDiscountWizardState } from "../components/discount-wizard/useDiscountWizardState.js";
import { RouteErrorFallback } from "../components";
import { logger } from "../utils/logger.server.js";
import { useEffect } from "react";

// Import shared components and utilities
import {
    ERROR_STEP_BY_FIELD,
    StepContent,
    HiddenFields,
    computeDiscountType,
    useWizardNavigation,
    getVisibleSteps,
} from "../components/discount-wizard/DiscountWizardComponents.jsx";
import { validateDiscountForm } from "../utils/discount-validation.server.js";
import { handleSyncFailure, publishDiscountToShopify, validatePublishLimits } from "../utils/discount-sync-handler.server.js";
import { StepProgress } from "../components/discount-wizard/WizardShell.jsx";

const SRC = "discounts-new";

export const loader = async ({ request }) => {
    // ============================================
    // STEP 1: Authentication & Authorization
    // ============================================
    const { admin } = await authenticate.admin(request);
    const { shop, access, trialDaysRemaining } = await requireCreateDiscountAccess(request);

    // ============================================
    // STEP 2: Fetch Shop Currency
    // ============================================
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

    // ============================================
    // STEP 3: Parse URL Parameters
    // ============================================
    const url = new URL(request.url);
    const templateSlug = url.searchParams.get("template");
    const requestedGroup = url.searchParams.get("group");

    // ============================================
    // STEP 4: Resolve Template (if provided)
    // ============================================
    let template = null;
    if (templateSlug) {
        template = getDiscountTemplateBySlug(templateSlug);
    }

    // ============================================
    // STEP 5: Determine Discount Group
    // Priority: URL group param > template type > default (order)
    // ============================================
    const derivedGroup =
        requestedGroup ||
        (template?.discountType === "APP_CAPPED"
            ? "app"
            : template
                ? template.family
                : "order");

    const group = String(derivedGroup).toLowerCase();
    const groupConfig = getGroupConfig(group);
    const groupValue = getGroupKeyFromDiscountType(groupConfig.discountType) || group;

    // ============================================
    // STEP 6: Validate Template Access
    // ============================================
    if (templateSlug && (!template || !canUseTemplate(access, template))) {
        throw redirect("/app/billing?reason=templatelocked");
    }

    // ============================================
    // STEP 7: Validate Discount Type Access
    // ============================================
    if (!canUseDiscountType(access, groupConfig.discountType)) {
        throw redirect("/app/billing?reason=planlocked");
    }

    // ============================================
    // STEP 8: Return Loader Data
    // ============================================
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
        groupValue,
        template,
        shopCurrency,
    });
};

export const action = async ({ request }) => {
    let shopId = null;
    let discountId = null;

    try {
        // ============================================
        // STEP 1: Authentication & Authorization
        // ============================================
        logger.info(SRC, "Create action entered", {
            requestMethod: request.method,
            requestUrl: request.url,
        });

        const { admin } = await authenticate.admin(request);
        const { shop, access } = await requireCreateDiscountAccess(request);
        shopId = shop.id;

        logger.info(SRC, "Create-discount access resolved", {
            shopId,
            planName: access.planName,
        });

        // ============================================
        // STEP 2: Parse Form Data
        // ============================================
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
        const templateSlug = String(formData.get("templateSlug") || "").trim() || null;
        const template = templateSlug ? getDiscountTemplateBySlug(templateSlug) : null;

        // ============================================
        // STEP 3: Determine Discount Group
        // ============================================
        const derivedGroup =
            requestedGroup ||
            (template?.discountType === "APP_CAPPED"
                ? "app"
                : template
                    ? template.family
                    : "order");

        const group = String(derivedGroup).toLowerCase();
        const groupConfig = getGroupConfig(group);

        // ============================================
        // STEP 4: Validate Template & Plan Access
        // ============================================
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
            template,
        });

        if (Object.keys(errors).length > 0) {
            logger.warn(SRC, "Create validation rejected request", {
                shopId,
                errorFields: Object.keys(errors),
            });
            return data({ errors }, { status: 400 });
        }

        // ============================================
        // STEP 7: Build Draft Payload
        // ============================================
        const payload = buildDraftPayload({
            shopId,
            formData,
            access,
            template,
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
            });

            if (collision.isCollided) {
                const collisionErrors =
                    collision.matchType === "CODE"
                        ? {
                            discountCode:
                                "Another active or scheduled discount already uses this code.",
                        }
                        : {
                            title:
                                "Another active or scheduled automatic discount already uses this title.",
                        };

                logger.warn(SRC, "Create publish blocked by identity collision", {
                    shopId,
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
                            ...collisionErrors,
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

        // Final plan check after payload built
        if (!canUseDiscountType(access, payload.discountType)) {
            return data(
                { errors: { form: "This discount type requires a higher plan." } },
                { status: 403 }
            );
        }

        // ============================================
        // STEP 8: Create Discount Draft in Database
        // ============================================
        logger.info(SRC, "Creating discount draft", {
            shopId,
            intent,
            title: payload.title,
        });

        const createdDiscount = await prisma.discount.create({
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

        discountId = createdDiscount.id;

        logger.info(SRC, "New-Discount draft created", {
            shopId,
            discountId,
            status: createdDiscount.status,
            matchType: createdDiscount.matchType,
            isMatchable: createdDiscount.isMatchable,
        });

        // ============================================
        // STEP 9: Handle Draft Intent (save only)
        // ============================================
        if (intent === "draft") {
            return redirect(`/app/discounts`);
        }

        // ============================================
        // STEP 10: Publish to Shopify (publish intent)
        // ============================================
        try {
            await publishDiscountToShopify({
                admin,
                discount: createdDiscount,
                group,
                scopeMode: parsedData.scopeMode,
                shopId,
                prisma,
                src: SRC,
            });

            return redirect("/app/discounts");
        } catch (syncError) {
            // Sync failed - discount remains as draft with error
            await handleSyncFailure({
                prisma,
                discountId: createdDiscount.id,
                error: syncError,
                src: SRC,
            });

            logger.error(SRC, "Shopify discount publish failed", {
                shopId,
                discountId,
                error: logger.serializeError(syncError),
            });

            return data(
                {
                    errors: {
                        form: `Saved as draft, but publishing to Shopify failed: ${syncError?.message || syncError}`,
                    },
                },
                { status: 422 }
            );
        }
    } catch (err) {
        // ============================================
        // STEP 11: Handle Unexpected Errors
        // ============================================
        logger.error(SRC, "Unexpected create-discount action failure", {
            shopId,
            discountId,
            error: logger.serializeError(err),
        });

        return data(
            {
                errors: {
                    form: `Unable to save discount draft: ${err?.message || "Unknown error"}`,
                },
            },
            { status: 500 }
        );
    }
};

// ============================================
// UI Components
// ============================================

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

export default function DiscountCreatePage() {
    const {
        access,
        trialDaysRemaining,
        group,
        groupConfig,
        groupValue,
        template,
        shopCurrency,
    } = useLoaderData();

    const templateInitialConfig = getTemplateInitialConfig(template);
    const actionData = useActionData();
    const navigation = useNavigation();
    const busy = navigation.state !== "idle";
    const errors = actionData?.errors || {};

    const state = useDiscountWizardState({
        groupConfig,
        template,
        groupValue,
        initialState: templateInitialConfig,
    });

    // Navigate to step with first error on validation failure
    useEffect(() => {
        if (!errors) return;

        const firstFieldWithError = Object.keys(errors).find(
            (field) => ERROR_STEP_BY_FIELD[ field ] !== undefined
        );

        if (firstFieldWithError) {
            state.setCurrentStep(ERROR_STEP_BY_FIELD[ firstFieldWithError ]);
        }
    }, [ errors, state.setCurrentStep ]);

    const discountType = computeDiscountType({ group, groupConfig, state, template });
    const stepItems = getVisibleSteps(group);
    const { visibleStepIndex, isLastStep, goNext, goBack } = useWizardNavigation({ state, stepItems });

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
                        discountType={discountType}
                    />

                    <StepProgress
                        currentIndex={visibleStepIndex}
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

                    <div className="flex w-full m-3 px-3 justify-between">
                        <button
                            type="button"
                            disabled={state.currentStep === 0}
                            onClick={goBack}
                            className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                        >
                            Back
                        </button>

                        {!isLastStep ? (
                            <button
                                type="button"
                                disabled={!state.canGoToStep(state.currentStep + 1)}
                                onClick={goNext}
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
                </Form>
            </div>
        </div>
    );
}

export function ErrorBoundary() {
    return <RouteErrorFallback />;
}

export const headers = (headersArgs) => boundary.headers(headersArgs);