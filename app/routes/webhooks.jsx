// app/routes/webhooks.jsx
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";
import { logger } from "../utils/logger.server.js";
import { normalizeShopifySubscriptionStatus } from "../utils/billing.server.js";

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
                await handleAppSubscriptionsUpdate({ shop, payload, webhookId });
                break;

            case "APP_UNINSTALLED":
                await handleAppUninstalled({ shop, session, webhookId });
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

async function handleAppSubscriptionsUpdate({ shop, payload, webhookId }) {
    const appSubscription = payload?.app_subscription ?? payload ?? {};
    const shopifySubscriptionId =
        appSubscription.admin_graphql_api_id || appSubscription.id || null;
    const shopifyStatus = appSubscription.status || null;

    logger.info("webhooks", "Processing APP_SUBSCRIPTIONS_UPDATE", {
        shop,
        webhookId,
        shopifySubscriptionId,
        shopifyStatus,
    });

    const shopRecord = await prisma.shop.findUnique({
        where: { shopDomain: shop },
        include: { subscription: true },
    });

    if (!shopRecord) {
        logger.warn("webhooks", "Shop not found for subscription webhook", {
            shop,
            webhookId,
        });
        return;
    }

    let subscription = null;

    if (shopifySubscriptionId) {
        subscription = await prisma.subscription.findFirst({
            where: {
                shopId: shopRecord.id,
                shopifySubscriptionId,
            },
        });
    }

    if (!subscription && shopRecord.subscription) {
        subscription = shopRecord.subscription;
    }

    if (!subscription) {
        logger.warn("webhooks", "No matching local subscription found", {
            shop,
            webhookId,
            shopifySubscriptionId,
            payload,
        });

        await prisma.billingEvent.create({
            data: {
                shopId: shopRecord.id,
                eventType: "SUBSCRIPTION_UPDATED",
                planName: shopRecord.planName,
                description: "Subscription webhook received but no local subscription matched",
                metadata: {
                    webhookId,
                    payload,
                    shopifySubscriptionId,
                },
            },
        });

        return;
    }

    const normalized = normalizeShopifySubscriptionStatus(shopifyStatus);

    const subscriptionUpdateData = {
        planStatus: normalized.subscriptionStatus,
        lastSyncedAt: new Date(),
    };

    if (normalized.subscriptionStatus === "ACTIVE" && !subscription.activatedAt) {
        subscriptionUpdateData.activatedAt = new Date();
    }

    if (normalized.subscriptionStatus === "CANCELLED") {
        subscriptionUpdateData.cancelledAt = new Date();
    }

    if (normalized.subscriptionStatus === "EXPIRED") {
        subscriptionUpdateData.expiresAt = new Date();
    }

    const operations = [
        prisma.subscription.update({
            where: { id: subscription.id },
            data: subscriptionUpdateData,
        }),
        prisma.billingEvent.create({
            data: {
                shopId: shopRecord.id,
                eventType: normalized.billingEventType,
                planName: subscription.planName,
                description: `Shopify subscription status changed to ${shopifyStatus}`,
                metadata: {
                    webhookId,
                    payload,
                    shopifySubscriptionId,
                    localSubscriptionId: subscription.id,
                },
            },
        }),
    ];

    if (normalized.shopStatus) {
        operations.push(
            prisma.shop.update({
                where: { id: shopRecord.id },
                data: {
                    planName: subscription.planName,
                    planStatus: normalized.shopStatus,
                    billingConfirmedAt:
                        normalized.subscriptionStatus === "ACTIVE"
                            ? new Date()
                            : shopRecord.billingConfirmedAt,
                },
            })
        );
    }

    await prisma.$transaction(operations);

    logger.info("webhooks", "Subscription webhook applied successfully", {
        shop,
        webhookId,
        finalPlanName: normalized.shopStatus ? subscription.planName : shopRecord.planName,
        finalPlanStatus: normalized.shopStatus ?? shopRecord.planStatus,
        subscriptionStatus: normalized.subscriptionStatus,
    });
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

    logger.info("webhooks", "APP_UNINSTALLED processed", {
        shop,
        webhookId,
    });
}