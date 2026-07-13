// app/utils/billing.server.js
import prisma from "../db.server.js";
import { PLANS } from "./plans.js";
import { invalidateAccessCache } from "./access-cache.server.js";
import { logger } from "./logger.server.js";

export { PLANS };

const APP_SUBSCRIPTION_CREATE = `#graphql
  mutation AppSubscriptionCreate(
    $name: String!
    $lineItems: [AppSubscriptionLineItemInput!]!
    $returnUrl: URL!
    $test: Boolean
  ) {
    appSubscriptionCreate(
      name: $name
      lineItems: $lineItems
      returnUrl: $returnUrl
      test: $test
    ) {
      appSubscription {
        id
        status
      }
      confirmationUrl
      userErrors {
        field
        message
      }
    }
  }
`;

export async function createAppSubscription({
    admin,
    planName,
    returnUrl,
    isTest = false,
}) {
    const plan = PLANS[ planName ];

    if (!plan || plan.price === 0) {
        throw new Error(`Cannot create paid subscription for plan: ${planName}`);
    }

    logger.info("billing.server", "Creating Shopify app subscription", {
        planName,
        returnUrl,
        isTest,
    });

    const response = await admin.graphql(APP_SUBSCRIPTION_CREATE, {
        variables: {
            name: `Smart Discount – ${plan.displayName}`,
            returnUrl,
            test: isTest,
            lineItems: [
                {
                    plan: {
                        appRecurringPricingDetails: {
                            price: {
                                amount: plan.price,
                                currencyCode: "USD",
                            },
                            interval: "EVERY_30_DAYS",
                        },
                    },
                },
            ],
        },
    });

    const { data, errors } = await response.json();

    if (errors?.length) {
        logger.error("billing.server", "Shopify GraphQL errors during subscription create", {
            planName,
            errors,
        });
        throw new Error(errors.map((e) => e.message).join(", "));
    }

    const result = data?.appSubscriptionCreate;

    if (result?.userErrors?.length) {
        logger.error("billing.server", "Shopify userErrors during subscription create", {
            planName,
            userErrors: result.userErrors,
        });
        throw new Error(result.userErrors.map((e) => e.message).join(", "));
    }

    return {
        shopifySubscriptionId: result.appSubscription.id,
        confirmationUrl: result.confirmationUrl,
        shopifyStatus: result.appSubscription.status,
    };
}

/**
 * Save only the pending billing intent.
 * Do NOT mutate Shop.planName / Shop.planStatus here.
 * Webhook will finalize the real plan state.
 */
export async function savePendingSubscriptionChange({
    shopId,
    shop,
    targetPlanName,
    shopifySubscriptionId,
    confirmationUrl,
}) {
    await prisma.$transaction([
        prisma.subscription.upsert({
            where: { shopId },
            create: {
                shopId,
                planName: targetPlanName,
                planStatus: "TRIALING",
                shopifySubscriptionId,
                shopifyConfirmationUrl: confirmationUrl,
                price: PLANS[ targetPlanName ].price,
                currency: "USD",
                billingPeriod: "EVERY_30_DAYS",
            },
            update: {
                planName: targetPlanName,
                planStatus: "TRIALING",
                shopifySubscriptionId,
                shopifyConfirmationUrl: confirmationUrl,
                price: PLANS[ targetPlanName ].price,
                currency: "USD",
                billingPeriod: "EVERY_30_DAYS",
                cancelledAt: null,
                expiresAt: null,
                updatedAt: new Date(),
            },
        }),

        prisma.shop.update({
            where: { id: shopId },
            data: {
                billingId: shopifySubscriptionId,
                billingConfirmedAt: null,
            },
        }),

        prisma.billingEvent.create({
            data: {
                shopId,
                eventType: "SUBSCRIPTION_CREATED",
                planName: targetPlanName,
                description: `Pending subscription change initiated to ${targetPlanName}`,
                metadata: {
                    shopifySubscriptionId,
                    confirmationUrl,
                    targetPlanName,
                    pending: true,
                },
            },
        }),
    ]);

    invalidateAccessCache(shop.shopDomain);

    logger.info("billing.server", "Saved pending subscription change", {
        shopId,
        targetPlanName,
        shopifySubscriptionId,
    });
}

export function getTrialDaysRemaining(trialEndsAt) {
    if (!trialEndsAt) return 0;
    const msLeft = new Date(trialEndsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
}

export function normalizeShopifySubscriptionStatus(status) {
    const normalized = String(status || "").toUpperCase();

    switch (normalized) {
        case "ACTIVE":
            return {
                subscriptionStatus: "ACTIVE",
                shopStatus: "ACTIVE",
                billingEventType: "SUBSCRIPTION_UPDATED",
            };

        case "CANCELLED":
        case "CANCELED":
            return {
                subscriptionStatus: "CANCELLED",
                shopStatus: "CANCELLED",
                billingEventType: "SUBSCRIPTION_CANCELLED",
            };

        case "EXPIRED":
            return {
                subscriptionStatus: "EXPIRED",
                shopStatus: "EXPIRED",
                billingEventType: "SUBSCRIPTION_EXPIRED",
            };

        case "DECLINED":
        case "FROZEN":
            return {
                subscriptionStatus: "EXPIRED",
                shopStatus: "EXPIRED",
                billingEventType: "PAYMENT_FAILED",
            };

        case "ACCEPTED":
        case "PENDING":
        case "PENDING_APPROVAL":
        default:
            return {
                subscriptionStatus: "TRIALING",
                shopStatus: null,
                billingEventType: "SUBSCRIPTION_UPDATED",
            };
    }
}