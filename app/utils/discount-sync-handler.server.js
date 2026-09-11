// app/utils/discount-sync-handler.server.js
/**
 * Shared Shopify sync handler for discount create/edit routes.
 * Centralizes the discount publishing logic including collision detection,
 * Shopify API calls, and error handling.
 */

import { buildDiscountMatchKey } from "./discount-identity.server.js";
import { logger } from "./logger.server.js";

const SRC = "discount-sync-handler";

/**
 * Handles the full discount publishing flow to Shopify
 * @param {object} params
 * @param {object} params.admin - Authenticated Shopify admin client
 * @param {object} params.discount - Discount object from database
 * @param {string} params.group - Discount group (order, product, bxgy, shipping, app)
 * @param {string} params.scopeMode - Scope mode for product discounts
 * @param {string} params.shopId - Shop ID
 * @param {object} params.prisma - Prisma client
 * @param {string} params.src - Source identifier for logging
 * @returns {Promise<{ shopifyDiscountId: string, nextStatus: string }>} Result of sync
 */
export async function publishDiscountToShopify({
    admin,
    discount,
    group,
    scopeMode,
    shopId,
    prisma,
    src = SRC,
}) {
    const syncDiscount = {
        ...discount,
        group,
        scopeMode,
    };

    logger.info(src, "Discount payload for Discount-sync", {
        shopId,
        discountId: discount.id,
        discountType: discount.discountType,
        method: discount.method,
        group,
        scopeMode,
        startsAt: discount.startsAt,
        status: discount.status,
    });

    const nextStatus =
        new Date(discount.startsAt) > new Date() ? "SCHEDULED" : "ACTIVE";

    const { matchKey, isMatchable } = buildDiscountMatchKey(
        discount.title,
        nextStatus,
        discount.method,
        discount.shopifyDiscountCode
    );

    const matchType = discount.method === "CODE" ? "CODE" : "AUTOMATIC";

    let shopifyDiscountId;

    if (syncDiscount.discountType === "APP_CAPPED") {
        const {
            pushCustomDiscountToShopify,
            resolveCappedOrderFunctionId,
        } = await import("./discount-custom-sync.server.js");

        const functionId = await resolveCappedOrderFunctionId(admin);

        const result = await pushCustomDiscountToShopify({
            admin,
            discount: syncDiscount,
            functionId,
        });

        shopifyDiscountId = result.shopifyDiscountId;
    } else {
        const { pushDiscountToShopify } = await import("./discount-sync.server.js");

        const result = await pushDiscountToShopify({
            admin,
            discount: syncDiscount,
        });

        shopifyDiscountId = result.shopifyDiscountId;
    }

    const updatedDiscount = await prisma.discount.update({
        where: { id: discount.id },
        data: {
            status: nextStatus,
            shopifyDiscountId,
            lastSyncedAt: new Date(),
            lastError: null,
            matchType,
            matchKey,
            isMatchable,
            shopifyDeletedAt: null,
        },
    });

    logger.info(src, "Shopify discount published", {
        shopId,
        discountId: updatedDiscount.id,
        shopifyDiscountId,
        nextStatus,
        matchType: updatedDiscount.matchType,
        matchKey: updatedDiscount.matchKey,
        isMatchable: updatedDiscount.isMatchable,
    });

    return { shopifyDiscountId, nextStatus, discount: updatedDiscount };
}

/**
 * Handles sync failure - updates discount status to FAILED
 * @param {object} params
 * @param {object} params.prisma - Prisma client
 * @param {string} params.discountId - Discount ID
 * @param {Error} params.error - Error that occurred
 * @param {string} params.src - Source identifier for logging
 */
export async function handleSyncFailure({ prisma, discountId, error, src = SRC }) {
    logger.error(src, "Shopify discount publish failed", {
        discountId,
        error: logger.serializeError(error),
    });

    await prisma.discount.update({
        where: { id: discountId },
        data: {
            status: "FAILED",
            lastError: String(error?.message || error),
            isMatchable: false,
        },
    });
}

/**
 * Validates plan limits before publishing (for create route)
 * @param {object} params
 * @param {object} params.request - Request object
 * @param {number} params.activeDiscountCount - Current active discount count
 * @param {string} params.discountType - Discount type being created
 * @param {object} params.template - Template (optional)
 * @param {object} params.access - User access info
 * @param {string} params.shopId - Shop ID
 * @param {string} params.src - Source identifier for logging
 */
export async function validatePublishLimits({
    request,
    activeDiscountCount,
    discountType,
    template,
    access,
    shopId,
    src = SRC,
}) {
    const { assertCanCreateDiscount } = await import("./plan-gate.server.js");

    logger.info(src, "Checking active-discount creation limit", {
        shopId,
        discountType,
    });

    await assertCanCreateDiscount({
        request,
        activeDiscountCount,
        discountType,
        template,
    });

    logger.info(src, "Active-discount creation limit allowed", {
        shopId,
        activeDiscountCount,
    });
}