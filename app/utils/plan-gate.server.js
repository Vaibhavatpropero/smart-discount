// app/utils/plan-gate.server.js
import { data } from "react-router";
import prisma from "../db.server.js";
import { authenticate } from "../shopify.server.js";
import { getTrialDaysRemaining } from "./billing.server.js";
import { getCachedAccess, setCachedAccess } from "./access-cache.server.js";
import { logger } from "./logger.server.js";

const PLAN_RANK = {
    FREE: 0,
    BASIC: 1,
    ADVANCE: 2,
};

const BASIC_ALLOWED_DISCOUNT_TYPES = new Set([
    "ORDER_PERCENTAGE",
    "ORDER_FIXED",
    "PRODUCT_PERCENTAGE",
    "PRODUCT_FIXED",
    "BXGY",
    "FREE_SHIPPING",
]);

const ADVANCE_ONLY_DISCOUNT_TYPES = new Set([
    "APP_VOLUME",
    "APP_BUNDLE",
    "APP_CAPPED",
]);

function hasPlanAtLeast(currentPlanName, requiredPlanName) {
    return (PLAN_RANK[ currentPlanName ] ?? -1) >= (PLAN_RANK[ requiredPlanName ] ?? 999);
}

function buildLimitations({ shop, trialDaysRemaining }) {
    const items = [];

    if (shop.planName === "FREE" && shop.planStatus === "TRIALING") {
        items.push(`Free trial active — ${trialDaysRemaining} day${trialDaysRemaining === 1 ? "" : "s"} remaining`);
        items.push("Maximum 3 active discounts at a time");
        items.push("Advanced targeting, premium templates, and Shopify Functions are locked");
    }

    if (shop.planName === "FREE" && shop.planStatus === "EXPIRED") {
        items.push("Trial expired — discount creation and editing are locked");
        items.push("Existing discounts are read-only until upgrade");
    }

    if (shop.planName === "BASIC") {
        items.push("Basic plan active");
        items.push("Advanced targeting, premium templates, and Shopify Functions are locked");
    }

    if (shop.planName === "ADVANCE") {
        items.push("Advance plan active");
        items.push("All discount capabilities unlocked");
    }

    return items;
}

function buildCapabilities({ shop, trialDaysRemaining }) {
    const isTrialing = shop.planName === "FREE" && shop.planStatus === "TRIALING";
    const isExpired = shop.planName === "FREE" && shop.planStatus === "EXPIRED";
    const isBasic = shop.planName === "BASIC" && shop.planStatus === "ACTIVE";
    const isAdvance = shop.planName === "ADVANCE" && shop.planStatus === "ACTIVE";

    const canOpenCreateDiscount = !isExpired;
    const canCreateDiscount = !isExpired;

    return {
        planName: shop.planName,
        planStatus: shop.planStatus,
        trialDaysRemaining,

        isTrialing,
        isExpired,
        isBasic,
        isAdvance,
        isPaid: isBasic || isAdvance,

        canOpenCreateDiscount,
        canCreateDiscount,

        maxActiveDiscounts: isTrialing ? 3 : null,

        canUseAdvancedTargeting: isAdvance,
        canUseMarketTargeting: isAdvance,
        canUsePremiumTemplates: isAdvance,
        canUseAdvancedAnalytics: isAdvance,
        canUseFunctionsDiscounts: isAdvance,
        canUseAdvancedCombinability: isAdvance,

        limitations: buildLimitations({ shop, trialDaysRemaining }),
    };
}

export function canUseDiscountType(access, discountType) {
    if (!discountType) return true;

    if (access.isExpired) return false;
    if (access.isAdvance) return true;

    if (access.isTrialing || access.isBasic) {
        return BASIC_ALLOWED_DISCOUNT_TYPES.has(discountType);
    }

    return false;
}

export function canUseTemplate(access, template) {
    if (!template) return true;
    if (access.isExpired) return false;

    const requiredPlan = template.requiredPlan ?? "FREE";

    if (requiredPlan === "FREE") return true;
    if (requiredPlan === "BASIC") return access.isBasic || access.isAdvance;
    if (requiredPlan === "ADVANCE") return access.isAdvance;

    return false;
}

export function isDiscountLockedByPlan(access, discount) {
    if (!discount) return false;
    if (access.isAdvance) return false;

    const createdOnAdvance = discount.createdOnPlan === "ADVANCE";
    if (!createdOnAdvance) return false;

    const usesAdvanceTargeting =
        Boolean(discount.customerSegments) ||
        Boolean(discount.shippingDestinationCountries);

    const usesAdvanceDiscountType = ADVANCE_ONLY_DISCOUNT_TYPES.has(discount.discountType);

    return usesAdvanceTargeting || usesAdvanceDiscountType;
}

export function getDiscountAccessState(access, discount) {
    const lockedByPlan = isDiscountLockedByPlan(access, discount);

    if (access.isExpired) {
        return {
            lockedByPlan: true,
            canView: true,
            canEdit: false,
            canDisable: false,
            canDelete: false,
            canDuplicate: false,
            canReenable: false,
            reason: "trial_expired",
        };
    }

    if (!lockedByPlan) {
        return {
            lockedByPlan: false,
            canView: true,
            canEdit: true,
            canDisable: true,
            canDelete: true,
            canDuplicate: true,
            canReenable: true,
            reason: null,
        };
    }

    return {
        lockedByPlan: true,
        canView: true,
        canEdit: false,
        canDisable: true,
        canDelete: true,
        canDuplicate: false,
        canReenable: false,
        reason: "plan_locked",
    };
}

export async function getPlanContext(request) {
    const { session, redirect } = await authenticate.admin(request);

    const cached = getCachedAccess(session.shop);
    if (cached) {
        return {
            ...cached,
            session,
            redirect,
        };
    }

    const shop = await prisma.shop.findUnique({
        where: { shopDomain: session.shop },
        include: { subscription: true },
    });

    if (!shop) {
        logger.error("plan-gate", "Shop not found while building plan context", {
            shop: session.shop,
        });

        throw data({ error: "Shop not found" }, { status: 404 });
    }

    const trialDaysRemaining = getTrialDaysRemaining(shop.trialEndsAt);
    const access = buildCapabilities({ shop, trialDaysRemaining });

    const result = {
        shop,
        subscription: shop.subscription,
        trialDaysRemaining,
        access,
    };

    setCachedAccess(session.shop, result);

    return {
        ...result,
        session,
        redirect,
    };
}

export async function requireAppAccess(request) {
    return getPlanContext(request);
}

export async function requireCreateDiscountAccess(request) {
    const context = await getPlanContext(request);

    if (context.access.isExpired) {
        logger.info("plan-gate", "Redirecting expired free shop away from create discount", {
            shop: context.shop.shopDomain,
        });

        throw context.redirect("/app/billing?reason=trial_expired", {
            target: "_parent",
        });
    }

    return context;
}

export function assertAdvancedFeatureAccess(access, { group, formData }) {
    if (access.isAdvance) return;

    const violations = [];

    if (group === "app") {
        violations.push("App-powered custom discounts require the Advance plan.");
    }

    const customerSegments = formData.get("customerSegments");
    if (customerSegments && customerSegments !== "[]") {
        violations.push("Customer segment targeting requires the Advance plan.");
    }

    if (violations.length > 0) {
        const error = new Error(violations[ 0 ]);
        error.code = "PLAN_RESTRICTED";
        throw error;
    }
}

export async function assertCanCreateDiscount({
    request,
    activeDiscountCount,
    discountType,
    template = null,
}) {
    const context = await getPlanContext(request);
    const { access, shop } = context;

    if (!access.canCreateDiscount) {
        logger.warn("plan-gate", "Discount create blocked: plan cannot create discounts", {
            shop: shop.shopDomain,
            planName: shop.planName,
            planStatus: shop.planStatus,
        });

        throw data(
            { error: "Your trial has expired. Upgrade to create new discounts." },
            { status: 403 },
        );
    }

    if (
        typeof access.maxActiveDiscounts === "number" &&
        activeDiscountCount >= access.maxActiveDiscounts
    ) {
        logger.warn("plan-gate", "Discount create blocked: active discount limit reached", {
            shop: shop.shopDomain,
            activeDiscountCount,
            maxActiveDiscounts: access.maxActiveDiscounts,
        });

        throw data(
            {
                error: `Free trial allows only ${access.maxActiveDiscounts} active discounts at a time.`,
            },
            { status: 403 },
        );
    }

    if (!canUseDiscountType(access, discountType)) {
        logger.warn("plan-gate", "Discount create blocked: discount type not allowed", {
            shop: shop.shopDomain,
            discountType,
            planName: shop.planName,
            planStatus: shop.planStatus,
        });

        throw data(
            {
                error: "This discount type requires a higher plan.",
            },
            { status: 403 },
        );
    }

    if (!canUseTemplate(access, template)) {
        logger.warn("plan-gate", "Discount create blocked: template not allowed", {
            shop: shop.shopDomain,
            templateSlug: template?.slug ?? null,
            requiredPlan: template?.requiredPlan ?? null,
            planName: shop.planName,
        });

        throw data(
            {
                error: "This template requires a higher plan.",
            },
            { status: 403 },
        );
    }

    return context;
}