// app/utils/discount-analytics.server.js
import prisma from "../db.server.js";
import { logger } from "./logger.server.js";

const SRC = "discount-analytics";

const DEFAULT_RECENT_LIMIT = 10;
const MAX_RECENT_LIMIT = 50;

function toNumber(value) {
    return Number(value ?? 0);
}

function normalizeRecentLimit(value) {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
        return DEFAULT_RECENT_LIMIT;
    }

    return Math.min(parsed, MAX_RECENT_LIMIT);
}

function buildUsageWhere({ shopId, selectedDiscountId = null, cancelled }) {
    return {
        shopId,
        ...(selectedDiscountId ? { discountId: selectedDiscountId } : {}),
        ...(typeof cancelled === "boolean" ? { cancelled } : {}),
    };
}

function mapUsageForClient(usage) {
    return {
        ...usage,
        discountAmount: toNumber(usage.discountAmount),
        orderSubtotal: toNumber(usage.orderSubtotal),
        orderTotal: toNumber(usage.orderTotal),
        refundedAmount: toNumber(usage.refundedAmount),
    };
}

/**
 * Builds the home-dashboard analytics data.
 *
 * selectedDiscountId:
 * - null -> analytics across all app-managed discounts for this shop
 * - id   -> analytics for exactly that Discount, after ownership validation
 *
 * Headline metrics exclude cancelled usages.
 * Refunded usages remain valid redemptions and are reported separately.
 */
export async function getAnalyticsDashboard({
    shopId,
    selectedDiscountId = null,
    recentLimit = DEFAULT_RECENT_LIMIT,
}) {
    if (!shopId) {
        logger.warn(SRC, "Missing shopId for analytics dashboard", {
            hasSelectedDiscountId: Boolean(selectedDiscountId),
        });

        return null;
    }

    const take = normalizeRecentLimit(recentLimit);

    try {
        const result = await prisma.$transaction(async (tx) => {
            const selectorDiscounts = await tx.discount.findMany({
                where: {
                    shopId,
                },
                orderBy: [
                    { status: "asc" },
                    { updatedAt: "desc" },
                ],
                select: {
                    id: true,
                    title: true,
                    discountType: true,
                    method: true,
                    status: true,
                },
            });

            let selectedDiscount = null;

            if (selectedDiscountId) {
                selectedDiscount = selectorDiscounts.find(
                    (discount) => discount.id === selectedDiscountId
                );

                if (!selectedDiscount) {
                    return {
                        invalidSelectedDiscount: true,
                        selectorDiscounts,
                    };
                }
            }

            const validUsageWhere = buildUsageWhere({
                shopId,
                selectedDiscountId,
                cancelled: false,
            });

            const refundedUsageWhere = {
                ...validUsageWhere,
                refunded: true,
            };

            const cancelledUsageWhere = buildUsageWhere({
                shopId,
                selectedDiscountId,
                cancelled: true,
            });

            const recentUsageWhere = buildUsageWhere({
                shopId,
                selectedDiscountId,
            });

            const [
                validAggregate,
                refundedAggregate,
                cancelledAggregate,
                recentUsages,
            ] = await Promise.all([
                tx.discountUsage.aggregate({
                    where: validUsageWhere,
                    _count: { id: true },
                    _sum: {
                        discountAmount: true,
                        orderTotal: true,
                    },
                }),

                tx.discountUsage.aggregate({
                    where: refundedUsageWhere,
                    _count: { id: true },
                    _sum: {
                        refundedAmount: true,
                    },
                }),

                tx.discountUsage.aggregate({
                    where: cancelledUsageWhere,
                    _count: { id: true },
                }),

                tx.discountUsage.findMany({
                    where: recentUsageWhere,
                    orderBy: {
                        createdAt: "desc",
                    },
                    take,
                    select: {
                        id: true,
                        shopifyOrderId: true,
                        orderName: true,
                        customerId: true,
                        discountAmount: true,
                        orderSubtotal: true,
                        orderTotal: true,
                        currency: true,
                        refunded: true,
                        refundedAmount: true,
                        cancelled: true,
                        createdAt: true,
                        updatedAt: true,
                        discount: {
                            select: {
                                id: true,
                                title: true,
                                discountType: true,
                                method: true,
                            },
                        },
                    },
                }),
            ]);

            const usageCount = validAggregate._count.id;
            const totalSavings = toNumber(validAggregate._sum.discountAmount);

            return {
                invalidSelectedDiscount: false,

                mode: selectedDiscount ? "DISCOUNT" : "OVERALL",

                selectedDiscount,

                selectorDiscounts,

                summary: {
                    usageCount,
                    totalSavings,
                    averageSavings:
                        usageCount > 0 ? totalSavings / usageCount : 0,
                    attributedRevenue: toNumber(validAggregate._sum.orderTotal),

                    refundedUsageCount: refundedAggregate._count.id,
                    refundedAmount: toNumber(
                        refundedAggregate._sum.refundedAmount
                    ),

                    cancelledUsageCount: cancelledAggregate._count.id,
                },

                recentUsages: recentUsages.map(mapUsageForClient),
            };
        });

        if (result.invalidSelectedDiscount) {
            logger.warn(SRC, "Selected discount not found for analytics", {
                shopId,
                selectedDiscountId,
            });

            return {
                mode: "OVERALL",
                selectedDiscount: null,
                selectorDiscounts: result.selectorDiscounts,
                summary: {
                    usageCount: 0,
                    totalSavings: 0,
                    averageSavings: 0,
                    attributedRevenue: 0,
                    refundedUsageCount: 0,
                    refundedAmount: 0,
                    cancelledUsageCount: 0,
                },
                recentUsages: [],
            };
        }

        return result;
    } catch (error) {
        logger.error(SRC, "Failed to load analytics dashboard", {
            shopId,
            selectedDiscountId,
            message: error?.message,
            stack: error?.stack,
        });

        throw error;
    }
}