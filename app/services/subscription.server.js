// app/services/subscription.server.js
import prisma from "../db.server.js";
import { normalizeShopifySubscriptionStatus } from "../utils/billing.server.js";
import { invalidateAccessCache } from "../utils/access-cache.server.js";
import { logger } from "../utils/logger.server.js";

export async function handleAppSubscriptionUpdateWebhook({ shop, payload, webhookId }) {
    const appSubscription = payload?.app_subscription ?? payload ?? {};
    const shopifySubscriptionId =
        appSubscription.admin_graphql_api_id || appSubscription.id || null;
    const shopifyStatus = appSubscription.status || null;

    logger.info("subscription.service", "Processing APP_SUBSCRIPTIONS_UPDATE", {
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
        logger.warn("subscription.service", "Shop not found for subscription webhook", {
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

    if (!subscription && !shopifySubscriptionId && shopRecord.subscription) {
        subscription = shopRecord.subscription;
    }

    if (!subscription) {
        logger.warn("subscription.service", "No matching local subscription found", {
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

    const isCurrentShopSubscription = shopifySubscriptionId
        ? shopRecord.billingId === shopifySubscriptionId
        : shopRecord.subscription?.id === subscription.id;

    if (normalized.shopStatus) {
        if (!isCurrentShopSubscription) {
            logger.info("subscription.service", "Skipping shop state update for non-current subscription", {
                shop,
                webhookId,
                incomingShopifySubscriptionId: shopifySubscriptionId,
                currentShopBillingId: shopRecord.billingId,
                incomingSubscriptionStatus: normalized.subscriptionStatus,
                incomingPlanName: subscription.planName,
            });
        } else {
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
    }

    await prisma.$transaction(operations);

    invalidateAccessCache(shop);

    logger.info("subscription.service", "Subscription webhook applied successfully", {
        shop,
        webhookId,
        updatedShopState: isCurrentShopSubscription,
        finalPlanName:
            isCurrentShopSubscription && normalized.shopStatus
                ? subscription.planName
                : shopRecord.planName,
        finalPlanStatus:
            isCurrentShopSubscription && normalized.shopStatus
                ? normalized.shopStatus
                : shopRecord.planStatus,
        subscriptionStatus: normalized.subscriptionStatus,
    });
}