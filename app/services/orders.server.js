// app/services/orders.server.js
import prisma from "../db.server.js";
import { logger } from "../utils/logger.server.js";
import {
    upsertUsageFromOrder,
    markUsageCancelledForOrder,
    markUsageRefunded,
} from "../utils/discount-usage.server.js";

const SRC = "orders.server"

export async function handleOrdersCreateWebhook({ shop, payload, webhookId }) {
    const shopRecord = await prisma.shop.findUnique({ where: { shopDomain: shop } });
    if (!shopRecord) {
        logger.warn(SRC, "Shop not found for ORDERS_CREATE", { shop, webhookId });
        return;
    }
    logger.info(SRC, "recived ordersUpdate payload", { payload })
    // await upsertUsageFromOrder({ shopId: shopRecord.id, order: payload, webhookId });
}

export async function handleOrdersUpdatedWebhook({ shop, payload, webhookId }) {
    const shopRecord = await prisma.shop.findUnique({ where: { shopDomain: shop } });
    if (!shopRecord) return;
    // orders/updated fires on many changes (fulfillment, edits) — re-run the same
    // upsert so DiscountUsage totals correct themselves if line items changed.
    await upsertUsageFromOrder({ shopId: shopRecord.id, order: payload, webhookId });
}

export async function handleOrdersCancelledWebhook({ shop, payload, webhookId }) {
    const shopRecord = await prisma.shop.findUnique({ where: { shopDomain: shop } });
    if (!shopRecord) return;
    await markUsageCancelledForOrder({
        shopId: shopRecord.id,
        shopifyOrderId: String(payload.admin_graphql_api_id ?? payload.id),
    });
}

export async function handleRefundsCreateWebhook({ shop, payload, webhookId }) {
    const shopRecord = await prisma.shop.findUnique({ where: { shopDomain: shop } });
    if (!shopRecord) return;
    await markUsageRefunded({
        shopId: shopRecord.id,
        shopifyOrderId: String(payload.order_id),
        refundPayload: payload,
    });
}