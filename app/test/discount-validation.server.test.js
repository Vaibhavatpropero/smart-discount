// app/test/discount-validation.server.test.js
// TDD: red test first, then fix. Verifies usage-limit validation skip for app-fn AUTOMATIC (B9+G8 fix).
import { describe, it, expect, vi } from "vitest";

vi.mock("../shopify.server.js", () => ({
    authenticate: { admin: vi.fn() },
}));

import { validateDiscountForm } from "../utils/discount-validation.server.js";

function makeFormData(values = {}) {
    const defaults = {
        discountType: "APP_CAPPED",
        method: "AUTOMATIC",
        title: "Test",
        discountValue: "20",
        cappedAmount: "50",
        usageLimit: "abc", // invalid — should be ignored for app-fn AUTOMATIC
        appliesOncePerCustomer: "true",
    };
    const all = { ...defaults, ...values };
    return {
        get: (key) => all[key] ?? null,
    };
}

describe("validateDiscountForm — app-fn AUTOMATIC usage-limit skip", () => {
    const access = { isAdvance: true };
    const appGroupConfig = {
        key: "app",
        discountType: "APP_CAPPED",
        title: "App discounts",
        supportedMethods: ["AUTOMATIC", "CODE"],
    };
    const appFreeGiftGroupConfig = {
        key: "app",
        discountType: "APP_FREE_GIFT",
        title: "App discounts",
        supportedMethods: ["AUTOMATIC", "CODE"],
    };
    const orderGroupConfig = {
        key: "order",
        discountType: "ORDER_PERCENTAGE",
        title: "Order discounts",
        supportedMethods: ["AUTOMATIC", "CODE"],
    };

    it("APP_CAPPED + AUTOMATIC + invalid usageLimit → no usageLimit error (skipped)", async () => {
        const errors = await validateDiscountForm({
            formData: makeFormData({ discountType: "APP_CAPPED", method: "AUTOMATIC", usageLimit: "abc" }),
            access,
            groupConfig: appGroupConfig,
        });
        expect(errors.usageLimit).toBeUndefined();
    });

    it("APP_FREE_GIFT + AUTOMATIC + invalid usageLimit → no usageLimit error (skipped)", async () => {
        const errors = await validateDiscountForm({
            formData: makeFormData({
                discountType: "APP_FREE_GIFT",
                method: "AUTOMATIC",
                usageLimit: "abc",
            }),
            access,
            groupConfig: appFreeGiftGroupConfig,
        });
        expect(errors.usageLimit).toBeUndefined();
    });

    it("APP_CAPPED + CODE + invalid usageLimit → usageLimit error present (still validated)", async () => {
        const { errors } = await validateDiscountForm({
            formData: makeFormData({ discountType: "APP_CAPPED", method: "CODE", usageLimit: "abc" }),
            access,
            groupConfig: appGroupConfig,
        });
        expect(errors.usageLimit).toBeDefined();
    });

    it("Native type + invalid usageLimit → usageLimit error present (still validated)", async () => {
        const { errors } = await validateDiscountForm({
            formData: makeFormData({ discountType: "ORDER_PERCENTAGE", method: "AUTOMATIC", usageLimit: "abc" }),
            access,
            groupConfig: orderGroupConfig,
        });
        expect(errors.usageLimit).toBeDefined();
    });
});
