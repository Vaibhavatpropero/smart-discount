// app/utils/discount-usage.server.js
import prisma from "../db.server.js";
import { buildWebhookApplicationIdentity } from "./discount-identity.server.js";
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
    // numeric REST id or plain string id
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

        // Important: ORDERS_UPDATED can arrive after ORDERS_CANCELLED.
        // Never let an update webhook revive a cancelled usage record.
        cancelled: Boolean(order.cancelled_at),
    };
}

// Sums per-application discount amounts by matching discount_allocations
// (on line items / shipping lines) back to discount_application_index.
function computeApplicationAmounts(order) {
    const amounts = new Map(); // application_index -> total amount

    for (const lineItem of order.line_items ?? []) {
        for (const allocation of lineItem.discount_allocations ?? []) {
            const idx = allocation.discount_application_index;
            const prev = amounts.get(idx) ?? 0;
            amounts.set(idx, prev + Number(allocation.amount ?? 0));
        }
    }

    // Free shipping discounts allocate against shipping lines, not line_items.
    for (const shippingLine of order.shipping_lines ?? []) {
        for (const allocation of shippingLine.discount_allocations ?? []) {
            const idx = allocation.discount_application_index;
            const prev = amounts.get(idx) ?? 0;
            amounts.set(idx, prev + Number(allocation.amount ?? 0));
        }
    }

    return amounts;
}

async function matchDiscountForApplication({ shopId, application }) {
    const identity = buildWebhookApplicationIdentity(application);

    if (!identity.ok) {
        if (identity.reason === "UNSUPPORTED_APPLICATION_TYPE") {
            logger.info(SRC, "Skipping non-app application type", {
                shopId,
                type: application?.type ?? null,
            });
        } else {
            logger.warn(SRC, "Could not build application identity", {
                shopId,
                reason: identity.reason,
                type: application?.type ?? null,
                code: application?.code ?? null,
                title: application?.title ?? null,
            });
        }
        return null;
    }

    const match = await prisma.discount.findFirst({
        where: {
            shopId,
            matchType: identity.matchType,
            matchKey: identity.matchKey,
            isMatchable: true,
        },
    });

    if (!match) {
        logger.warn(SRC, "No matchable discount", {
            shopId,
            matchType: identity.matchType,
            matchKey: identity.matchKey,
            type: application?.type ?? null,
            code: application?.code ?? null,
            title: application?.title ?? null,
        });
    }

    return match;
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
        const discount = await matchDiscountForApplication({ shopId, application });
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
                            discountAmount,
                            orderSubtotal: totals.orderSubtotal,
                            orderTotal: totals.orderTotal,
                            currency: totals.currency,
                            // Never write false here. ORDERS_CANCELLED is authoritative, and a
                            // delayed ORDERS_UPDATED event must not restore a cancelled usage.
                            ...(totals.cancelled ? { cancelled: true } : {}),
                        },
                    });

                    const agg = await tx.discountUsage.aggregate({
                        where: {
                            discountId: discount.id,
                            cancelled: false,
                        },
                        _count: { id: true },
                        _sum: { discountAmount: true },
                    });

                    await tx.discount.update({
                        where: { id: discount.id },
                        data: {
                            totalUsageCount: agg._count.id,
                            totalSavings: agg._sum.discountAmount ?? 0,
                        },
                    });

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
 * REFUNDS_CREATE
 * Marks refunded flag + amount on usage rows for the order.
 * Totals still exclude only cancelled rows (refund does not remove usage count).
 */
export async function markUsageRefunded({
    shopId,
    shopifyOrderId,
    refundPayload,
}) {
    const ids = orderIdVariants(shopifyOrderId);
    if (ids.length === 0) return;

    const refundedTotal = (refundPayload?.refund_line_items ?? []).reduce(
        (sum, item) => sum + Number(item.subtotal ?? 0),
        0
    );

    await prisma.discountUsage.updateMany({
        where: { shopId, shopifyOrderId: { in: ids } },
        data: {
            refunded: true,
            refundedAmount: refundedTotal,
        },
    });

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