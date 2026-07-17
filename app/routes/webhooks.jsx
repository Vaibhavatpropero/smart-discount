// app/routes/webhooks.jsx
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";
import { handleAppSubscriptionUpdateWebhook } from "../services/subscription.server.js";
import {
    handleOrdersCreateWebhook,
    handleOrdersUpdatedWebhook,
    handleOrdersCancelledWebhook,
    handleRefundsCreateWebhook,
} from "../services/orders.server.js";
import { invalidateAccessCache } from "../utils/access-cache.server.js";
import { logger } from "../utils/logger.server.js";

export async function action({ request }) {
    let webhookContext;

    try {
        webhookContext = await authenticate.webhook(request);
    } catch (error) {
        logger.error("webhooks", "Webhook authentication failed", {
            message: error?.message,
        });
        return new Response("Unauthorized", { status: 401 });
    }

    const { topic, shop, payload, session, webhookId } = webhookContext;

    logger.info("webhooks", "Webhook received", {
        topic,
        shop,
        webhookId,
    });

    try {
        switch (topic) {
            case "APP_SUBSCRIPTIONS_UPDATE":
                await handleAppSubscriptionUpdateWebhook({ shop, payload, webhookId });
                break;

            case "APP_UNINSTALLED":
                await handleAppUninstalled({ shop, session, webhookId });
                break;

            case "ORDERS_CREATE":
                await handleOrdersCreateWebhook({ shop, payload, webhookId });
                break;

            case "ORDERS_UPDATED":
                await handleOrdersUpdatedWebhook({ shop, payload, webhookId });
                break;

            case "ORDERS_CANCELLED":
                await handleOrdersCancelledWebhook({ shop, payload, webhookId });
                break;

            case "REFUNDS_CREATE":
                await handleRefundsCreateWebhook({ shop, payload, webhookId });
                break;

            case "CUSTOMERS_DATA_REQUEST":
                logger.info("webhooks", "Handled CUSTOMERS_DATA_REQUEST", { shop, webhookId });
                break;

            case "CUSTOMERS_REDACT":
                logger.info("webhooks", "Handled CUSTOMERS_REDACT", { shop, webhookId });
                break;

            case "SHOP_REDACT":
                logger.info("webhooks", "Handled SHOP_REDACT", { shop, webhookId });
                break;

            default:
                logger.warn("webhooks", "Unhandled webhook topic", {
                    topic,
                    shop,
                    webhookId,
                });
                return new Response("Unhandled webhook topic", { status: 404 });
        }

        return new Response(null, { status: 200 });
    } catch (error) {
        logger.error("webhooks", "Webhook processing failed", {
            topic,
            shop,
            webhookId,
            message: error?.message,
            stack: error?.stack,
        });

        return new Response("Webhook handler error", { status: 500 });
    }
}

async function handleAppUninstalled({ shop, session, webhookId }) {
    logger.info("webhooks", "Processing APP_UNINSTALLED", {
        shop,
        webhookId,
        hasSession: Boolean(session),
    });

    const shopRecord = await prisma.shop.findUnique({
        where: { shopDomain: shop },
        include: { subscription: true },
    });

    const tx = [];

    if (shopRecord) {
        tx.push(
            prisma.shop.update({
                where: { id: shopRecord.id },
                data: {
                    uninstalledAt: new Date(),
                    planStatus: "CANCELLED",
                },
            })
        );

        if (shopRecord.subscription) {
            tx.push(
                prisma.subscription.update({
                    where: { id: shopRecord.subscription.id },
                    data: {
                        planStatus: "CANCELLED",
                        cancelledAt: new Date(),
                        lastSyncedAt: new Date(),
                    },
                })
            );
        }

        tx.push(
            prisma.billingEvent.create({
                data: {
                    shopId: shopRecord.id,
                    eventType: "SUBSCRIPTION_CANCELLED",
                    planName: shopRecord.planName,
                    description: "App uninstalled by merchant",
                    metadata: {
                        webhookId,
                        shop,
                    },
                },
            })
        );
    }

    tx.push(
        prisma.session.deleteMany({
            where: { shop },
        })
    );

    if (tx.length) {
        await prisma.$transaction(tx);
    }

    invalidateAccessCache(shop);

    logger.info("webhooks", "APP_UNINSTALLED processed", {
        shop,
        webhookId,
    });
}