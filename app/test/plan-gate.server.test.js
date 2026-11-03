import { describe, it, expect, vi, beforeEach } from "vitest";

import { getCachedAccess, setCachedAccess } from "../utils/access-cache.server.js";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";
import { buildCapabilities, buildLimitations, getPlanContext } from "../utils/plan-gate.server.js";

// Mock shopify.server to prevent shopifyApp() call at module load (needs SHOPIFY_APP_URL env).
vi.mock("../shopify.server", () => ({
    authenticate: {
        admin: vi.fn(),
    },
}));

// Mock db.server (not used by buildCapabilities/buildLimitations directly, but
// plan-gate.server.js imports it at module load).
vi.mock("../db.server.js", () => ({
    default: new (class {
        shop = { findUnique: vi.fn() };
    })(),
}));

// Mock access-cache and logger (module-load imports).
vi.mock("../utils/access-cache.server.js", () => ({
    getCachedAccess: vi.fn(() => null),
    setCachedAccess: vi.fn(),
}));
vi.mock("./logger.server.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const makeShop = (overrides = {}) => ({
    id: "shop1",
    shopDomain: "test.myshopify.com",
    planName: "FREE",
    planStatus: "TRIALING",
    trialEndsAt: null,
    ...overrides,
});

describe("plan-gate trial expiry derivation", () => {
    it("FREE + TRIALING + future trialEndsAt → trialing behavior unchanged", () => {
        const shop = makeShop({
            planStatus: "TRIALING",
            trialEndsAt: new Date("2027-01-01").toISOString(),
        });
        const caps = buildCapabilities({ shop, trialDaysRemaining: 100 });

        expect(caps.isTrialing).toBe(true);
        expect(caps.isExpired).toBe(false);
        expect(caps.canCreateDiscount).toBe(true);
        expect(caps.canUseFunctionsDiscounts).toBe(true);
        expect(caps.maxActiveDiscounts).toBe(3);
    });

    it("FREE + TRIALING + past trialEndsAt → expired (lapsed trial)", () => {
        const shop = makeShop({
            planStatus: "TRIALING",
            trialEndsAt: new Date("2026-01-01").toISOString(),
        });
        const caps = buildCapabilities({ shop, trialDaysRemaining: 0 });

        expect(caps.isExpired).toBe(true);
        expect(caps.isTrialing).toBe(false);
        expect(caps.canCreateDiscount).toBe(false);
        expect(caps.maxActiveDiscounts).toBeNull();
    });

    it("FREE + TRIALING + null trialEndsAt → expired (never armed)", () => {
        const shop = makeShop({
            planStatus: "TRIALING",
            trialEndsAt: null,
        });
        const caps = buildCapabilities({ shop, trialDaysRemaining: 0 });

        expect(caps.isExpired).toBe(true);
        expect(caps.isTrialing).toBe(false);
        expect(caps.canCreateDiscount).toBe(false);
        expect(caps.maxActiveDiscounts).toBeNull();
    });

    it("FREE + EXPIRED → expired (unchanged)", () => {
        const shop = makeShop({ planName: "FREE", planStatus: "EXPIRED" });
        const caps = buildCapabilities({ shop, trialDaysRemaining: 0 });

        expect(caps.isExpired).toBe(true);
        expect(caps.isTrialing).toBe(false);
        expect(caps.canCreateDiscount).toBe(false);
    });

    it("BASIC + ACTIVE → basic behavior unchanged", () => {
        const shop = makeShop({ planName: "BASIC", planStatus: "ACTIVE" });
        const caps = buildCapabilities({ shop, trialDaysRemaining: 0 });

        expect(caps.isBasic).toBe(true);
        expect(caps.isAdvance).toBe(false);
        expect(caps.isPaid).toBe(true);
    });

    it("ADVANCE + ACTIVE → advance behavior unchanged", () => {
        const shop = makeShop({ planName: "ADVANCE", planStatus: "ACTIVE" });
        const caps = buildCapabilities({ shop, trialDaysRemaining: 0 });

        expect(caps.isAdvance).toBe(true);
        expect(caps.canUseFunctionsDiscounts).toBe(true);
    });

    it("buildLimitations: lapsed trial shows expired items, not '0 days remaining'", () => {
        const shop = makeShop({
            planStatus: "TRIALING",
            trialEndsAt: new Date("2026-01-01").toISOString(),
        });
        const items = buildLimitations({ shop, trialDaysRemaining: 0, trialLapsed: true });

        expect(items).toContain("Trial expired — discount creation and editing are locked");
        expect(items).toContain("Existing discounts are read-only until upgrade");
        expect(items).not.toContain("Free trial active");
    });

    it("buildLimitations: active trial shows trial items", () => {
        const shop = makeShop({
            planStatus: "TRIALING",
            trialEndsAt: new Date("2027-01-01").toISOString(),
        });
        const items = buildLimitations({ shop, trialDaysRemaining: 5, trialLapsed: false });

        expect(items).toContain("Free trial active — 5 days remaining");
        expect(items).toContain("Maximum 3 active discounts at a time");
        expect(items).not.toContain("Trial expired");
    });
});

describe("getPlanContext", () => {
    const shopRow = {
        id: "shop1",
        shopDomain: "test.myshopify.com",
        planName: "FREE",
        planStatus: "TRIALING",
        trialEndsAt: new Date("2026-01-01").toISOString(),
        subscription: null,
    };

    const shopRowFuture = {
        ...shopRow,
        trialEndsAt: new Date("2027-01-01").toISOString(),
    };

    const context = { session: { shop: "test.myshopify.com" }, redirect: vi.fn() };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getCachedAccess).mockReturnValue(null);
        vi.mocked(setCachedAccess).mockReturnValue(undefined);
        vi.mocked(authenticate.admin).mockResolvedValue(context);
        vi.mocked(prisma.shop.findUnique).mockResolvedValue(shopRow);
    });

    it("cache miss: builds capabilities from DB and caches the raw shop row", async () => {
        const result = await getPlanContext({});

        expect(vi.mocked(authenticate.admin)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(prisma.shop.findUnique)).toHaveBeenCalledWith({
            where: { shopDomain: "test.myshopify.com" },
            include: { subscription: true },
        });
        expect(result.session).toBe(context.session);
        expect(result.redirect).toBe(context.redirect);
        expect(result.access.isExpired).toBe(true);
        expect(result.access.isTrialing).toBe(false);
        expect(result.trialDaysRemaining).toBe(0);
        // Raw row cached (not the derived result object).
        expect(vi.mocked(setCachedAccess)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(setCachedAccess)).toHaveBeenCalledWith("test.myshopify.com", shopRow);
        expect(vi.mocked(setCachedAccess).mock.calls[0][1]).toEqual(shopRow);
    });

    it("cache hit: derives fresh capabilities from cached row — no DB roundtrip, no stale expiry", async () => {
        vi.mocked(getCachedAccess).mockReturnValue(shopRow);

        const result = await getPlanContext({});

        expect(result.access.isExpired).toBe(true);
        expect(result.access.isTrialing).toBe(false);
        expect(result.trialDaysRemaining).toBe(0);
        expect(vi.mocked(prisma.shop.findUnique)).not.toHaveBeenCalled();
    });

    it("cache hit: cached trial row with future trialEndsAt derives trialing behavior", async () => {
        vi.mocked(getCachedAccess).mockReturnValue(shopRowFuture);

        const result = await getPlanContext({});

        expect(result.access.isTrialing).toBe(true);
        expect(result.access.isExpired).toBe(false);
        expect(result.access.canCreateDiscount).toBe(true);
        expect(vi.mocked(prisma.shop.findUnique)).not.toHaveBeenCalled();
    });

    it("cache miss with lapsed trial: locks even though planStatus still says TRIALING", async () => {
        // expiry is derived at read time, so a lapsed trial is locked even though
        // planStatus in the DB still says TRIALING.
        const result = await getPlanContext({});

        expect(result.access.isExpired).toBe(true);
        expect(result.access.canCreateDiscount).toBe(false);
    });
});
