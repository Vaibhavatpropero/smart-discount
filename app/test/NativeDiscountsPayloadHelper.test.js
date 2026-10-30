// app/test/NativeDiscountsPayloadHelper.test.js
// TDD: red test first, then fix. Verifies usage-limit nulling for app-fn AUTOMATIC (B9+G8 fix).
import { describe, it, expect } from "vitest";
import { buildDraftPayload } from "../helpers/NativeDiscountsPayloadHelper.js";

function makeFormData(overrides = {}) {
    const fd = new FormData();
    const defaults = {
        title: "Test discount",
        method: "AUTOMATIC",
        status: "DRAFT",
        isPercentage: "true",
        discountValue: "20",
        cappedAmount: "50",
        scopeMode: "ALL",
        minimumType: "NONE",
        usageLimit: "10",
        appliesOncePerCustomer: "true",
        startsAt: "",
        endsAt: "",
        shippingDestinationMode: "ALL",
    };
    Object.entries({ ...defaults, ...overrides }).forEach(([k, v]) => fd.set(k, String(v)));
    return fd;
}

describe("NativeDiscountsPayloadHelper.buildDraftPayload", () => {
    const shopId = "shop1";
    const access = {};
    const template = { discountType: "APP_CAPPED", name: "Test", defaultConfig: {} };

    it("APP_CAPPED + AUTOMATIC: usageLimit and appliesOncePerCustomer are nulled", () => {
        const payload = buildDraftPayload({
            shopId,
            formData: makeFormData({ method: "AUTOMATIC", discountType: "APP_CAPPED", usageLimit: "10", appliesOncePerCustomer: "true" }),
            access,
            template,
        });

        expect(payload.usageLimit).toBeNull();
        expect(payload.appliesOncePerCustomer).toBe(false);
    });

    it("APP_FREE_GIFT + AUTOMATIC: usageLimit and appliesOncePerCustomer are nulled", () => {
        const payload = buildDraftPayload({
            shopId,
            formData: makeFormData({
                method: "AUTOMATIC",
                discountType: "APP_FREE_GIFT",
                usageLimit: "10",
                appliesOncePerCustomer: "true",
            }),
            access,
            template: { discountType: "APP_FREE_GIFT", name: "Test", defaultConfig: {} },
        });

        expect(payload.usageLimit).toBeNull();
        expect(payload.appliesOncePerCustomer).toBe(false);
    });

    it("APP_CAPPED + CODE: usageLimit and appliesOncePerCustomer are kept", () => {
        const payload = buildDraftPayload({
            shopId,
            formData: makeFormData({ method: "CODE", discountType: "APP_CAPPED", usageLimit: "10", appliesOncePerCustomer: "true" }),
            access,
            template,
        });

        expect(payload.usageLimit).toBe(10);
        expect(payload.appliesOncePerCustomer).toBe(true);
    });

    it("Native type + AUTOMATIC: usageLimit and appliesOncePerCustomer are unchanged", () => {
        const payload = buildDraftPayload({
            shopId,
            formData: makeFormData({
                method: "AUTOMATIC",
                discountType: "ORDER_PERCENTAGE",
                usageLimit: "10",
                appliesOncePerCustomer: "true",
            }),
            access,
            template: { discountType: "ORDER_PERCENTAGE", name: "Test", defaultConfig: {} },
        });

        expect(payload.usageLimit).toBe(10);
        expect(payload.appliesOncePerCustomer).toBe(true);
    });
});
