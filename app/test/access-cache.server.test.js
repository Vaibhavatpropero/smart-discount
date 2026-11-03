import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
    getCachedAccess,
    setCachedAccess,
    invalidateAccessCache,
    clearAccessCache,
    getAccessCacheMeta,
    DEFAULT_TTL_MS,
} from "../utils/access-cache.server.js";

const SHORT_TTL = 50;

describe("access-cache", () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        clearAccessCache();
    });

    afterEach(() => {
        vi.useRealTimers();
        clearAccessCache();
    });

    it("set then get within TTL returns the value", () => {
        const startedAt = Date.now();
        const value = { trialDaysRemaining: 5 };
        setCachedAccess("test.myshopify.com", value, SHORT_TTL);

        expect(getCachedAccess("test.myshopify.com")).toBe(value);

        const meta = getAccessCacheMeta("test.myshopify.com");
        expect(meta.expiresAt).toBe(startedAt + SHORT_TTL);
        expect(meta.ttlMsRemaining).toBeGreaterThan(0);
        expect(meta.ttlMsRemaining).toBeLessThanOrEqual(SHORT_TTL);
    });

    it("expired entry returns null and deletes itself", () => {
        setCachedAccess("test.myshopify.com", { trialDaysRemaining: 5 }, SHORT_TTL);

        vi.advanceTimersByTime(SHORT_TTL + 1);

        expect(getCachedAccess("test.myshopify.com")).toBeNull();
        expect(getCachedAccess("test.myshopify.com")).toBeNull(); // stays deleted
    });

    it("custom TTL expiry", () => {
        const ttl = 5_000;
        setCachedAccess("test.myshopify.com", { trialDaysRemaining: 5 }, ttl);

        vi.advanceTimersByTime(ttl - 1);
        expect(getCachedAccess("test.myshopify.com")).toBeTruthy();

        vi.advanceTimersByTime(2);
        expect(getCachedAccess("test.myshopify.com")).toBeNull();
    });

    it("invalidateAccessCache removes entry", () => {
        setCachedAccess("test.myshopify.com", { trialDaysRemaining: 5 });
        invalidateAccessCache("test.myshopify.com");

        expect(getCachedAccess("test.myshopify.com")).toBeNull();
    });

    it("clearAccessCache empties the map", () => {
        setCachedAccess("shop-a", { trialDaysRemaining: 1 });
        setCachedAccess("shop-b", { trialDaysRemaining: 2 });
        clearAccessCache();

        expect(getCachedAccess("shop-a")).toBeNull();
        expect(getCachedAccess("shop-b")).toBeNull();
    });

    it("falsy guards never cache and return the value", () => {
        const value = { trialDaysRemaining: 5 };

        expect(setCachedAccess(null, value)).toBe(value);
        expect(setCachedAccess("shop", null)).toBeNull();
        expect(getCachedAccess("shop")).toBeNull();
    });
});
