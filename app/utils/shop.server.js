// app/utils/shop.server.js
import { Prisma } from "@prisma/client";
import prisma from "../db.server.js";
import { logger } from "./logger.server.js";

const SHOP_INFO_QUERY = `#graphql
  query ShopInfo {
    shop {
      name
      email
      myshopifyDomain
      contactEmail
      shopOwnerName
      currencyCode
      ianaTimezone
    }
  }
`;

function getTrialEndsAt() {
    return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
}

export async function upsertShopOnInstall({ shopDomain, admin }) {
    logger.info("shop.server", "Ensuring shop exists in DB", { shopDomain });

    const existing = await prisma.shop.findUnique({
        where: { shopDomain },
        select: {
            id: true,
            shopDomain: true,
            uninstalledAt: true,
        },
    });

    if (existing && !existing.uninstalledAt) {
        logger.info("shop.server", "Shop already exists, skipping ensure flow", {
            shopDomain,
            shopId: existing.id,
        });
        return existing;
    }

    let shopInfo = null;

    try {
        logger.info("shop.server", "Fetching shop info from Shopify", { shopDomain });

        const response = await admin.graphql(SHOP_INFO_QUERY);
        const result = await response.json();

        if (result?.errors?.length) {
            logger.warn("shop.server", "GraphQL errors while fetching shop info", {
                shopDomain,
                errors: result.errors,
            });
        } else {
            shopInfo = result?.data?.shop ?? null;

            logger.info("shop.server", "Shop info fetched from Shopify", {
                shopDomain,
                shopInfo,
            });
        }
    } catch (error) {
        logger.warn("shop.server", "Failed to fetch shop info, proceeding with minimal data", {
            shopDomain,
            message: error?.message,
        });
    }

    const trialEndsAt = getTrialEndsAt();

    const shopData = {
        shopDomain,
        name: shopInfo?.name ?? null,
        ownerName: shopInfo?.shopOwnerName ?? null,
        ownerEmail: shopInfo?.contactEmail ?? shopInfo?.email ?? null,
        ownerPhone: shopInfo?.shopAddress?.phone ?? null,
        currency: shopInfo?.currencyCode ?? "USD",
        timezone: shopInfo?.ianaTimezone ?? null,
        countryCode: shopInfo?.shopAddress?.countryCodeV2 ?? null,
        planName: "FREE",
        planStatus: "TRIALING",
        trialEndsAt,
        uninstalledAt: null,
    };

    if (existing?.uninstalledAt) {
        const updated = await prisma.shop.update({
            where: { shopDomain },
            data: {
                name: shopData.name,
                ownerName: shopData.ownerName,
                ownerEmail: shopData.ownerEmail,
                ownerPhone: shopData.ownerPhone,
                currency: shopData.currency,
                timezone: shopData.timezone,
                countryCode: shopData.countryCode,
                planName: "FREE",
                planStatus: "TRIALING",
                trialEndsAt: shopData.trialEndsAt,
                billingId: null,
                billingConfirmedAt: null,
                uninstalledAt: null,
            },
        });

        logger.info("shop.server", "Shop re-installed and reset", {
            shopDomain,
            shopId: updated.id,
            trialEndsAt,
        });

        return updated;
    }

    try {
        const created = await prisma.shop.create({
            data: shopData,
        });

        logger.info("shop.server", "Shop created", {
            shopDomain,
            shopId: created.id,
            trialEndsAt,
        });

        return created;
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            logger.warn("shop.server", "Concurrent create detected, loading existing shop", {
                shopDomain,
            });

            const alreadyCreated = await prisma.shop.findUnique({
                where: { shopDomain },
            });

            if (alreadyCreated) {
                logger.info("shop.server", "Loaded concurrently created shop", {
                    shopDomain,
                    shopId: alreadyCreated.id,
                });
                return alreadyCreated;
            }
        }

        logger.error("shop.server", "Failed to ensure shop exists", {
            shopDomain,
            message: error?.message,
            code: error?.code,
            stack: error?.stack,
        });

        throw error;
    }
}