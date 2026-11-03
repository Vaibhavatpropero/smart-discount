import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import prisma from "../db.server.js";
import { invalidateAccessCache } from "../utils/access-cache.server.js";
import { upsertShopOnInstall } from "../utils/shop.server.js";

vi.mock("../db.server.js", () => ({
    default: new (class {
        shop = {
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        };
    })(),
}));

vi.mock("../utils/logger.server.js", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../utils/access-cache.server.js", () => ({
    invalidateAccessCache: vi.fn(),
}));

describe("upsertShopOnInstall", () => {
    const admin = {
        graphql: vi.fn().mockResolvedValue({ json: async () => ({ data: { shop: null } }) }),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("fresh install creates shop with 14-day trial", async () => {
        vi.mocked(prisma.shop.findUnique).mockResolvedValue(null);
        vi.mocked(prisma.shop.create).mockResolvedValue({ id: "new-shop" });

        const shop = await upsertShopOnInstall({ shopDomain: "test.myshopify.com", admin });

        expect(vi.mocked(prisma.shop.create)).toHaveBeenCalledTimes(1);
        const data = vi.mocked(prisma.shop.create).mock.calls[0][0].data;
        expect(data.planName).toBe("FREE");
        expect(data.planStatus).toBe("TRIALING");
        expect(data.trialEndsAt.getTime()).toBeGreaterThan(Date.now());
        expect(data.trialEndsAt.getTime()).toBeLessThan(Date.now() + 15 * 24 * 60 * 60 * 1000);
        expect(vi.mocked(invalidateAccessCache)).toHaveBeenCalledWith("test.myshopify.com");
        expect(shop.id).toBe("new-shop");
    });

    it("existing installed shop is a no-op (fast path, no writes)", async () => {
        vi.mocked(prisma.shop.findUnique).mockResolvedValue({
            id: "s1",
            shopDomain: "test.myshopify.com",
            uninstalledAt: null,
        });

        await upsertShopOnInstall({ shopDomain: "test.myshopify.com", admin });

        expect(vi.mocked(prisma.shop.create)).not.toHaveBeenCalled();
        expect(vi.mocked(prisma.shop.update)).not.toHaveBeenCalled();
    });

    it("reinstall keeps original future trialEndsAt and stays trialing", async () => {
        const trialEndsAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
        vi.mocked(prisma.shop.findUnique).mockResolvedValue({
            id: "s1",
            shopDomain: "test.myshopify.com",
            uninstalledAt: new Date(),
            trialEndsAt,
            planStatus: "TRIALING",
        });
        vi.mocked(prisma.shop.update).mockResolvedValue({ id: "s1", trialEndsAt, planStatus: "TRIALING" });

        await upsertShopOnInstall({ shopDomain: "test.myshopify.com", admin });

        const data = vi.mocked(prisma.shop.update).mock.calls[0][0].data;
        expect(data.trialEndsAt).toBe(trialEndsAt);
        expect(data.planStatus).toBe("TRIALING");
        expect(data.uninstalledAt).toBeNull();
        expect(data.billingId).toBeNull();
        expect(vi.mocked(invalidateAccessCache)).toHaveBeenCalledWith("test.myshopify.com");
    });

    it("reinstall with lapsed trial keeps original trialEndsAt but marks EXPIRED", async () => {
        const trialEndsAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
        vi.mocked(prisma.shop.findUnique).mockResolvedValue({
            id: "s1",
            shopDomain: "test.myshopify.com",
            uninstalledAt: new Date(),
            trialEndsAt,
            planStatus: "TRIALING",
        });
        vi.mocked(prisma.shop.update).mockResolvedValue({ id: "s1", trialEndsAt, planStatus: "EXPIRED" });

        await upsertShopOnInstall({ shopDomain: "test.myshopify.com", admin });

        const data = vi.mocked(prisma.shop.update).mock.calls[0][0].data;
        expect(data.trialEndsAt).toBe(trialEndsAt);
        expect(data.planStatus).toBe("EXPIRED");
        expect(data.uninstalledAt).toBeNull();
    });

    it("reinstall with null trialEndsAt marks EXPIRED", async () => {
        vi.mocked(prisma.shop.findUnique).mockResolvedValue({
            id: "s1",
            shopDomain: "test.myshopify.com",
            uninstalledAt: new Date(),
            trialEndsAt: null,
            planStatus: "TRIALING",
        });
        vi.mocked(prisma.shop.update).mockResolvedValue({ id: "s1", trialEndsAt: null, planStatus: "EXPIRED" });

        await upsertShopOnInstall({ shopDomain: "test.myshopify.com", admin });

        const data = vi.mocked(prisma.shop.update).mock.calls[0][0].data;
        expect(data.trialEndsAt).toBeNull();
        expect(data.planStatus).toBe("EXPIRED");
    });
});
