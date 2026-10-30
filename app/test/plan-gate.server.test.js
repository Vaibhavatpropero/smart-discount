// app/test/plan-gate.server.test.js
// TDD: red test first, then fix. Verifies trial expiry derivation (G6 fix).
import { describe, it, expect, vi } from "vitest";

// Mock shopify.server to prevent shopifyApp() call at module load (needs SHOPIFY_APP_URL env).
vi.mock("../shopify.server", () => ({
    authenticate: {
        admin: vi.fn(),
    },
}));

// Mock db.server (not used by buildCapabilities/buildLimitations directly, but
// plan-gate.server.js imports it at module load).
vi.mock("../db.server.js", () => ({ default: new (class {})() }));

// Mock access-cache and logger (module-load imports).
vi.mock("./access-cache.server.js", () => ({
    getCachedAccess: vi.fn(() => null),
    setCachedAccess: vi.fn(),
}));
vi.mock("./logger.server.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { buildCapabilities, buildLimitations } from "../utils/plan-gate.server.js";

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
        expect(caps.canUseFunctionsDiscounts).toBe(false);
        expect(caps.maxActiveDiscounts).toBeNull();
    });

    it("FREE + TRIALING + null trialEndsAt → stays trialing (never armed)", () => {
        const shop = makeShop({
            planStatus: "TRIALING",
            trialEndsAt: null,
        });
        const caps = buildCapabilities({ shop, trialDaysRemaining: 0 });

        expect(caps.isTrialing).toBe(true);
        expect(caps.isExpired).toBe(false);
        expect(caps.canCreateDiscount).toBe(true);
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
