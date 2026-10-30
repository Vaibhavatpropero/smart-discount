// app/utils/discount-usage.server.js
import prisma from "../db.server.js";
import { resolveDiscountMatchKey } from "./discount-identity.server.js";
import { logger } from "./logger.server.js";

const SRC = "discount-usage";
const MAX_TRANSACTION_ATTEMPTS = 3;

function isRetryableUsageWriteError(error) {
    return error?.code === "P2002" || error?.code === "P2034";
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runUsageTransactionWithRetry({ operation, context }) {
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            const isLastAttempt = attempt === MAX_TRANSACTION_ATTEMPTS;

            if (!isRetryableUsageWriteError(error) || isLastAttempt) {
                throw error;
            }

            const delayMs = attempt * 100;

            logger.warn(SRC, "Concurrent usage write detected; retrying", {
                ...context,
                attempt,
                delayMs,
                prismaCode: error.code,
            });

            await wait(delayMs);
        }
    }
}

/**
 * Always store / query Order as GraphQL GID so create/update/cancel/refund
 * hit the same DiscountUsage.shopifyOrderId value.
 */
function toOrderGid(value) {
    if (value == null || value === "") return null;
    const s = String(value);
    if (s.startsWith("gid://")) return s;
    if (/^\d+$/.test(s)) return `gid://shopify/Order/${s}`;
    return s;
}

function toCustomerGid(value) {
    if (value == null || value === "") return null;
    const s = String(value);
    if (s.startsWith("gid://")) return s;
    if (/^\d+$/.test(s)) return `gid://shopify/Customer/${s}`;
    return s;
}

/** Expand one order id into the variants we may have stored historically. */
function orderIdVariants(shopifyOrderId) {
    const raw = String(shopifyOrderId ?? "");
    if (!raw) return [];
    const gid = toOrderGid(raw);
    const numeric = raw.startsWith("gid://shopify/Order/")
        ? raw.replace("gid://shopify/Order/", "")
        : /^\d+$/.test(raw)
            ? raw
            : null;
    return [ ...new Set([ raw, gid, numeric ].filter(Boolean)) ];
}

function extractOrderTotals(order) {
    return {
        shopifyOrderId: toOrderGid(order.admin_graphql_api_id ?? order.id),
        orderName: order.name ?? null,
        customerId: toCustomerGid(
            order.customer?.admin_graphql_api_id ?? order.customer?.id
        ),
        // Shopify REST order payload includes customer.orders_count (lifetime count
        // INCLUDING this order). === 1 means this order is their first ever.
        isFirstOrder: order.customer?.orders_count === 1,
        orderSubtotal: Number(order.subtotal_price ?? 0),
        orderTotal: Number(order.total_price ?? 0),
        currency: order.currency ?? order.presentment_currency ?? "USD",
        cancelled: Boolean(order.cancelled_at),
        orderCreatedAt: order.created_at ?? null,
    };
}

// Sums per-application discount amounts by matching discount_allocations
// (on line items / shipping lines) back to discount_application_index.
function computeApplicationAmounts(order) {
    const amounts = new Map();

    for (const lineItem of order.line_items ?? []) {
        for (const allocation of lineItem.discount_allocations ?? []) {
            const idx = allocation.discount_application_index;
            const prev = amounts.get(idx) ?? 0;
            amounts.set(idx, prev + Number(allocation.amount ?? 0));
        }
    }

    for (const shippingLine of order.shipping_lines ?? []) {
        for (const allocation of shippingLine.discount_allocations ?? []) {
            const idx = allocation.discount_application_index;
            const prev = amounts.get(idx) ?? 0;
            amounts.set(idx, prev + Number(allocation.amount ?? 0));
        }
    }

    return amounts;
}

function getApplicationMethod(application) {
    const type = String(application?.type || "").trim().toLowerCase();

    if (type === "discount_code") return "CODE";
    if (type === "automatic") return "AUTOMATIC";

    return null;
}

async function findExistingUsageForOrderDiscount({
    shopId,
    shopifyOrderId,
    application,
}) {
    const ids = orderIdVariants(shopifyOrderId);
    if (!ids.length) return null;

    const method = getApplicationMethod(application);
    if (!method) return null;

    const usages = await prisma.discountUsage.findMany({
        where: {
            shopId,
            shopifyOrderId: { in: ids },
        },
        select: {
            id: true,
            discountId: true,
            discount: {
                select: {
                    id: true,
                    title: true,
                    method: true,
                    status: true,
                    matchType: true,
                    matchKey: true,
                    isMatchable: true,
                    shopifyDiscountCode: true,
                    shopifyDeletedAt: true,
                },
            },
        },
    });

    if (!usages.length) return null;

    if (method === "CODE") {
        const normalizedCode = String(application?.code || "")
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");

        return (
            usages.find(
                (usage) =>
                    usage.discount?.method === "CODE" &&
                    String(usage.discount?.shopifyDiscountCode || "")
                        .trim()
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "") === normalizedCode
            ) || null
        );
    }

    const normalizedTitle = String(application?.title || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");

    return (
        usages.find(
            (usage) =>
                usage.discount?.method === "AUTOMATIC" &&
                usage.discount?.matchKey === `shopify:auto:${normalizedTitle}`
        ) || null
    );
}

async function matchDiscountForApplication({
    shopId,
    shopifyOrderId,
    orderCreatedAt,
    application,
}) {
    const method = getApplicationMethod(application);

    if (!method) {
        logger.info(SRC, "Skipping unsupported application type", {
            shopId,
            type: application?.type ?? null,
        });
        return null;
    }

    const existingUsage = await findExistingUsageForOrderDiscount({
        shopId,
        shopifyOrderId,
        application,
    });

    if (existingUsage?.discount) {
        return existingUsage.discount;
    }

    const match = await resolveDiscountMatchKey({
        shopId,
        discountTitle: application?.title ?? null,
        discountMethod: method,
        discountCode: application?.code ?? null,
        orderCreatedAt,
    });

    if (!match?.matchedDiscount) {
        logger.warn(SRC, "No discount matched for webhook application", {
            shopId,
            type: application?.type ?? null,
            code: application?.code ?? null,
            title: application?.title ?? null,
            matchKey: match?.matchKey ?? null,
        });
        return null;
    }

    return match.matchedDiscount;
}

async function recalculateDiscountAggregate(tx, discountId) {
    const agg = await tx.discountUsage.aggregate({
        where: {
            discountId,
            cancelled: false,
        },
        _count: { id: true },
        _sum: { discountAmount: true },
    });

    await tx.discount.update({
        where: { id: discountId },
        data: {
            totalUsageCount: agg._count.id,
            totalSavings: agg._sum.discountAmount ?? 0,
        },
    });
}

/**
 * ORDERS_CREATE / ORDERS_UPDATED
 * Idempotent via @@unique([shopId, shopifyOrderId, discountId]) + aggregate recompute.
 */
export async function upsertUsageFromOrder({ shopId, order, webhookId }) {
    const applications = order.discount_applications ?? [];
    if (applications.length === 0) {
        logger.info(SRC, "No discount_applications on order", {
            shopId,
            webhookId,
        });
        return;
    }

    const totals = extractOrderTotals(order);
    if (!totals.shopifyOrderId) {
        logger.warn(SRC, "Order missing id", { shopId, webhookId });
        return;
    }

    const amountsByIndex = computeApplicationAmounts(order);

    for (let index = 0; index < applications.length; index += 1) {
        const application = applications[ index ];

        const discount = await matchDiscountForApplication({
            shopId,
            shopifyOrderId: totals.shopifyOrderId,
            orderCreatedAt: totals.orderCreatedAt,
            application,
        });

        if (!discount) continue;

        const discountAmount = amountsByIndex.get(index) ?? 0;

        await runUsageTransactionWithRetry({
            context: {
                shopId,
                shopifyOrderId: totals.shopifyOrderId,
                discountId: discount.id,
                webhookId,
            },
            operation: async () =>
                prisma.$transaction(async (tx) => {
                    const usage = await tx.discountUsage.upsert({
                        where: {
                            shopId_shopifyOrderId_discountId: {
                                shopId,
                                shopifyOrderId: totals.shopifyOrderId,
                                discountId: discount.id,
                            },
                        },
                        create: {
                            shopId,
                            discountId: discount.id,
                            shopifyOrderId: totals.shopifyOrderId,
                            orderName: totals.orderName,
                            customerId: totals.customerId,
                            isFirstOrder: totals.isFirstOrder,
                            cancelled: totals.cancelled,
                            discountAmount,
                            orderSubtotal: totals.orderSubtotal,
                            orderTotal: totals.orderTotal,
                            currency: totals.currency,
                        },
                        update: {
                            orderName: totals.orderName,
                            customerId: totals.customerId,
                            isFirstOrder: totals.isFirstOrder,
                            discountAmount,
                            orderSubtotal: totals.orderSubtotal,
                            orderTotal: totals.orderTotal,
                            currency: totals.currency,
                            cancelled: totals.cancelled,
                        },
                    });

                    await recalculateDiscountAggregate(tx, discount.id);

                    logger.info(SRC, "Usage upserted", {
                        shopId,
                        shopifyOrderId: totals.shopifyOrderId,
                        discountId: discount.id,
                        discountAmount,
                        matchType: discount.matchType,
                        matchKey: discount.matchKey,
                        webhookId,
                        usageId: usage.id,
                    });

                    return usage;
                }),
        });
    }
}

/**
 * ORDERS_CANCELLED
 */
export async function markUsageCancelledForOrder({ shopId, shopifyOrderId }) {
    const ids = orderIdVariants(shopifyOrderId);
    if (ids.length === 0) return;

    await prisma.discountUsage.updateMany({
        where: { shopId, shopifyOrderId: { in: ids } },
        data: { cancelled: true },
    });

    await recalculateAffectedDiscounts({ shopId, shopifyOrderId: ids });
}

/**
 * Prorates a whole-order refund total across the order's DiscountUsage rows,
 * proportional to each row's discountAmount. The sum of prorated shares always
 * equals refundedTotal (rounded to 2dp, residual cent assigned to the largest
 * row). Rows with a zero/missing discountAmount split the total equally.
 *
 * Policy: refunds never reduce totalUsageCount/totalSavings — this helper only
 * attributes refundedAmount per discount. See markUsageRefunded JSDoc.
 *
 * @param {Array<{ id: string, discountAmount: number|string }>} usages
 * @param {number} refundedTotal
 * @returns {Map<string, number>} usageId -> prorated refund amount (2dp)
 */
export function prorateRefundAcrossUsages(usages, refundedTotal) {
    const result = new Map();
    if (usages.length === 0 || refundedTotal <= 0) {
        for (const u of usages) result.set(u.id, 0);
        return result;
    }

    const valid = usages
        .map((u) => ({ id: u.id, amount: Number(u.discountAmount) }))
        .filter((u) => Number.isFinite(u.amount) && u.amount > 0);

    const round2 = (x) => Math.floor(x * 100) / 100;

    if (valid.length === 0) {
        // All rows have zero/invalid amounts → equal split.
        const share = round2(refundedTotal / usages.length);
        let residual = round2(refundedTotal - share * usages.length);
        for (const u of usages) {
            result.set(u.id, share);
            if (residual > 0) {
                result.set(u.id, round2(result.get(u.id) + residual));
                residual = round2(residual - residual);
            }
        }
        return result;
    }

    if (valid.length === 1) {
        result.set(valid[0].id, round2(refundedTotal));
        return result;
    }

    const basis = valid.reduce((sum, u) => sum + u.amount, 0);
    let runningTotal = 0;
    let largest = valid[0];

    for (const u of valid) {
        const share = round2((refundedTotal * u.amount) / basis);
        result.set(u.id, share);
        runningTotal = round2(runningTotal + share);
        if (u.amount > largest.amount) largest = u;
    }

    // Residual cent goes to the largest row so the sum matches exactly.
    const residual = round2(refundedTotal - runningTotal);
    if (residual !== 0) {
        result.set(largest.id, round2(result.get(largest.id) + residual));
    }

    return result;
}

/**
 * REFUNDS_CREATE
 * Marks refunded flag + prorated amount on each usage row for the order.
 * Refund amount is attributed per discount (proportional to discountAmount),
 * not smeared as the whole-order total on every row.
 * Totals still exclude only cancelled rows (refund does not remove usage count).
 */
export async function markUsageRefunded({
    shopId,
    shopifyOrderId,
    refundPayload,
}) {
    const ids = orderIdVariants(shopifyOrderId);
    if (ids.length === 0) return;

    const refundedTotal = Number(
        refundPayload?.transactions?.reduce(
            (sum, tx) => sum + Number(tx.amount ?? 0),
            0
        ) ?? 0
    );

    const usages = await prisma.discountUsage.findMany({
        where: { shopId, shopifyOrderId: { in: ids } },
        select: { id: true, discountAmount: true },
    });

    if (usages.length === 0) return;

    const prorated = prorateRefundAcrossUsages(usages, refundedTotal);

    await prisma.$transaction(
        usages.map((usage) => {
            const amount = prorated.get(usage.id) ?? 0;
            return prisma.discountUsage.update({
                where: { id: usage.id },
                data: {
                    refunded: amount > 0,
                    refundedAmount: amount,
                },
            });
        })
    );

    await recalculateAffectedDiscounts({ shopId, shopifyOrderId: ids });
}

async function recalculateAffectedDiscounts({ shopId, shopifyOrderId }) {
    const ids = Array.isArray(shopifyOrderId)
        ? shopifyOrderId
        : orderIdVariants(shopifyOrderId);

    const usages = await prisma.discountUsage.findMany({
        where: { shopId, shopifyOrderId: { in: ids } },
        select: { discountId: true },
    });

    const discountIds = [ ...new Set(usages.map((u) => u.discountId)) ];

    for (const discountId of discountIds) {
        const agg = await prisma.discountUsage.aggregate({
            where: { discountId, cancelled: false },
            _count: { id: true },
            _sum: { discountAmount: true },
        });

        await prisma.discount.update({
            where: { id: discountId },
            data: {
                totalUsageCount: agg._count.id,
                totalSavings: agg._sum.discountAmount ?? 0,
            },
        });
    }
}