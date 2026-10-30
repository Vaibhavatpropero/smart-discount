// app/test/freeGiftFormSerializer.test.js
// TDD: red test first, then freeGiftFormSerializer module. Locks the
// wizard -> FormData -> buildFreeGiftConfigPayload -> validateFreeGift
// round-trip contract (BUG 1 fix: posted freeGiftConfig must reflect live
// wizard fields, not the stale initial value).
import { describe, it, expect, vi } from "vitest";

vi.mock("../shopify.server.js", () => ({
    authenticate: { admin: vi.fn() },
}));

import { serializeFreeGiftConfigForForm } from "../components/discount-wizard/freeGiftFormSerializer.js";
import { buildFreeGiftConfigPayload } from "../helpers/NativeDiscountsPayloadHelper.js";
import { validateFreeGift } from "../utils/discount-validation.server.js";

const baseState = {
    giftVariantId: "gid://shopify/ProductVariant/123",
    giftQuantity: "1",
    triggerType: "ORDER_THRESHOLD",
    thresholdKind: "SUBTOTAL",
    thresholdMinSubtotal: "100.00",
    thresholdMinQuantity: "",
    productTriggerProductIds: [],
    productTriggerMinQuantity: null,
};

describe("freeGiftFormSerializer", () => {
    it("serializes ORDER_THRESHOLD/SUBTOTAL config", () => {
        const result = serializeFreeGiftConfigForForm(baseState);
        expect(result.giftVariantId).toBe("gid://shopify/ProductVariant/123");
        expect(result.giftQuantity).toBe("1");
        expect(result.triggerType).toBe("ORDER_THRESHOLD");
        expect(result.threshold).toEqual({
            kind: "SUBTOTAL",
            minSubtotal: "100.00",
            minQuantity: "",
        });
        expect(result.productTrigger).toBeNull();
    });

    it("serializes ORDER_THRESHOLD/QUANTITY config", () => {
        const result = serializeFreeGiftConfigForForm({
            ...baseState,
            thresholdKind: "QUANTITY",
            thresholdMinSubtotal: "",
            thresholdMinQuantity: "5",
        });
        expect(result.threshold).toEqual({
            kind: "QUANTITY",
            minSubtotal: "",
            minQuantity: "5",
        });
        expect(result.productTrigger).toBeNull();
    });

    it("serializes PRODUCT_TRIGGER config", () => {
        const result = serializeFreeGiftConfigForForm({
            ...baseState,
            triggerType: "PRODUCT_TRIGGER",
            productTriggerProductIds: ["gid://shopify/ProductVariant/999"],
            productTriggerMinQuantity: "2",
        });
        expect(result.productTrigger).toEqual({
            productIds: ["gid://shopify/ProductVariant/999"],
            minQuantityPerProduct: 2,
        });
        expect(result.threshold).toBeNull();
    });

    it("round-trip ORDER_THRESHOLD: serializer -> FormData -> buildFreeGiftConfigPayload -> validateFreeGift passes", () => {
        const state = {
            ...baseState,
            triggerType: "ORDER_THRESHOLD",
            thresholdKind: "SUBTOTAL",
            thresholdMinSubtotal: "100.00",
        };
        const config = serializeFreeGiftConfigForForm(state);
        const fd = new FormData();
        fd.set("freeGiftConfig", JSON.stringify(config));
        const payload = buildFreeGiftConfigPayload(fd);
        expect(payload).not.toBeNull();
        expect(payload.giftVariantId).toBe("gid://shopify/ProductVariant/123");
        const errors = validateFreeGift({ formData: fd });
        expect(errors).toEqual({});
    });

    it("round-trip PRODUCT_TRIGGER: serializer -> FormData -> buildFreeGiftConfigPayload -> validateFreeGift passes", () => {
        const state = {
            ...baseState,
            triggerType: "PRODUCT_TRIGGER",
            productTriggerProductIds: ["gid://shopify/ProductVariant/999"],
        };
        const config = serializeFreeGiftConfigForForm(state);
        const fd = new FormData();
        fd.set("freeGiftConfig", JSON.stringify(config));
        const payload = buildFreeGiftConfigPayload(fd);
        expect(payload.productTrigger.productIds).toEqual([
            "gid://shopify/ProductVariant/999",
        ]);
        const errors = validateFreeGift({ formData: fd });
        expect(errors).toEqual({});
    });

    it("returns null minQuantityPerProduct when empty/unset", () => {
        const result = serializeFreeGiftConfigForForm({
            ...baseState,
            triggerType: "PRODUCT_TRIGGER",
            productTriggerProductIds: ["gid://shopify/ProductVariant/999"],
            productTriggerMinQuantity: "",
        });
        expect(result.productTrigger.minQuantityPerProduct).toBeNull();
    });
});
