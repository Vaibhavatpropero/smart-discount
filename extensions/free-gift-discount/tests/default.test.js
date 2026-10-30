import { describe, it, expect } from "vitest";
import { cartLinesDiscountsGenerateRun } from "../src/cart_lines_discounts_generate_run.js";
import freeGiftBasic from "./fixtures/free-gift-basic.json";

const EMPTY = { operations: [] };

const GIFT_VARIANT = "gid://shopify/ProductVariant/123";
const TRIGGER_VARIANT = "gid://shopify/ProductVariant/999";
const GIFT_LINE_ID = "gid://shopify/CartLine/1";

const line = (id, variantId, quantity = 1, productId) => ({
    id,
    quantity,
    merchandise: {
        __typename: "ProductVariant",
        id: variantId,
        ...(productId && { product: { id: productId } }),
    },
    cost: { subtotalAmount: { amount: "10.00" } },
});

const giftLine = (id = GIFT_LINE_ID) => line(id, GIFT_VARIANT);

const cfg = (over = {}) => ({
    giftVariantId: GIFT_VARIANT,
    giftQuantity: 1,
    triggerType: "ORDER_THRESHOLD",
    threshold: { kind: "SUBTOTAL", minSubtotal: "100.00" },
    productTrigger: { productIds: [], minQuantityPerProduct: null },
    ...over,
});

const input = (cartLines, config) => ({
    cart: { cost: { subtotalAmount: { amount: "200.00", currencyCode: "USD" } }, lines: cartLines },
    discount: { discountClasses: ["PRODUCT"], metafield: { jsonValue: config } },
});

const assertOp = (result, targetLineId = GIFT_LINE_ID) => {
    expect(result.operations).toHaveLength(1);
    const op = result.operations[0];
    expect(op.productDiscountsAdd).toBeDefined();
    const candidates = op.productDiscountsAdd.candidates;
    expect(candidates).toHaveLength(1);
    expect(candidates[0].message).toBe("Free gift");
    expect(candidates[0].value.percentage.value).toBe(100);
    expect(op.productDiscountsAdd.selectionStrategy).toBe("FIRST");
    expect(candidates[0].targets[0].cartLine.id).toBe(targetLineId);
};

describe("free gift discount", () => {
    // Existing fixture test, strengthened with message/percentage/strategy assertions.
    it("applies 100% discount to gift line when threshold met", () => {
        const result = cartLinesDiscountsGenerateRun(freeGiftBasic);
        assertOp(result, "gid://shopify/CartLine/2");
    });

    it("applies discount when ORDER_THRESHOLD/SUBTOTAL met", () => {
        const result = cartLinesDiscountsGenerateRun(input([giftLine()], cfg()));
        assertOp(result);
    });

    it("returns EMPTY_RESULT when ORDER_THRESHOLD/SUBTOTAL below minimum", () => {
        const result = cartLinesDiscountsGenerateRun(
            input([giftLine()], cfg({ threshold: { kind: "SUBTOTAL", minSubtotal: "500.00" } }))
        );
        expect(result.operations).toEqual(EMPTY.operations);
    });

    it("applies discount when ORDER_THRESHOLD/QUANTITY met", () => {
        const result = cartLinesDiscountsGenerateRun(
            input([line("CL/1", GIFT_VARIANT, 3)], cfg({ triggerType: "ORDER_THRESHOLD", threshold: { kind: "QUANTITY", minQuantity: 3 } }))
        );
        assertOp(result, "CL/1");
    });

    it("returns EMPTY_RESULT when ORDER_THRESHOLD/QUANTITY not met", () => {
        const result = cartLinesDiscountsGenerateRun(
            input([line("CL/1", GIFT_VARIANT, 2)], cfg({ triggerType: "ORDER_THRESHOLD", threshold: { kind: "QUANTITY", minQuantity: 10 } }))
        );
        expect(result.operations).toEqual(EMPTY.operations);
    });

    it("applies discount for PRODUCT_TRIGGER when trigger product in cart", () => {
        const result = cartLinesDiscountsGenerateRun(
            input([line("CL/2", TRIGGER_VARIANT, 1), giftLine()], cfg({ triggerType: "PRODUCT_TRIGGER", productTrigger: { productIds: [TRIGGER_VARIANT], minQuantityPerProduct: null } }))
        );
        assertOp(result);
    });

    it("applies discount for PRODUCT_TRIGGER when minQuantityPerProduct met", () => {
        const result = cartLinesDiscountsGenerateRun(
            input([line("CL/2", TRIGGER_VARIANT, 2), giftLine()], cfg({ triggerType: "PRODUCT_TRIGGER", productTrigger: { productIds: [TRIGGER_VARIANT], minQuantityPerProduct: 2 } }))
        );
        assertOp(result);
    });

    it("returns EMPTY_RESULT when PRODUCT_TRIGGER min quantity not met", () => {
        const result = cartLinesDiscountsGenerateRun(
            input([line("CL/2", TRIGGER_VARIANT, 1), giftLine()], cfg({ triggerType: "PRODUCT_TRIGGER", productTrigger: { productIds: [TRIGGER_VARIANT], minQuantityPerProduct: 2 } }))
        );
        expect(result.operations).toEqual(EMPTY.operations);
    });

    it("returns EMPTY_RESULT when PRODUCT_TRIGGER product not in cart", () => {
        const result = cartLinesDiscountsGenerateRun(
            input([giftLine()], cfg({ triggerType: "PRODUCT_TRIGGER", productTrigger: { productIds: ["gid://shopify/ProductVariant/777"], minQuantityPerProduct: null } }))
        );
        expect(result.operations).toEqual(EMPTY.operations);
    });

    it("returns EMPTY_RESULT when gift variant not in cart", () => {
        const result = cartLinesDiscountsGenerateRun(input([line("CL/1", TRIGGER_VARIANT, 1)], cfg({ giftVariantId: "gid://shopify/ProductVariant/777" })));
        expect(result.operations).toEqual(EMPTY.operations);
    });

    it("returns EMPTY_RESULT when cart has no lines", () => {
        const result = cartLinesDiscountsGenerateRun(input([], cfg()));
        expect(result.operations).toEqual(EMPTY.operations);
    });

    it("returns EMPTY_RESULT when discountClasses does not include PRODUCT", () => {
        const result = cartLinesDiscountsGenerateRun({
            cart: { cost: { subtotalAmount: { amount: "200.00" } }, lines: [giftLine()] },
            discount: { discountClasses: ["ORDER"], metafield: { jsonValue: cfg() } },
        });
        expect(result.operations).toEqual(EMPTY.operations);
    });

    it("returns EMPTY_RESULT when metafield config is missing", () => {
        const result = cartLinesDiscountsGenerateRun({
            cart: { cost: { subtotalAmount: { amount: "200.00" } }, lines: [giftLine()] },
            discount: { discountClasses: ["PRODUCT"] },
        });
        expect(result.operations).toEqual(EMPTY.operations);
    });

    it("returns EMPTY_RESULT when giftVariantId is missing", () => {
        const result = cartLinesDiscountsGenerateRun(input([giftLine()], cfg({ giftVariantId: "" })));
        expect(result.operations).toEqual(EMPTY.operations);
    });

    it("returns EMPTY_RESULT when triggerType is invalid", () => {
        const result = cartLinesDiscountsGenerateRun(input([giftLine()], cfg({ triggerType: "SOMETHING" })));
        expect(result.operations).toEqual(EMPTY.operations);
    });

    it("returns EMPTY_RESULT when PRODUCT_TRIGGER productIds is empty", () => {
        const result = cartLinesDiscountsGenerateRun(
            input([giftLine()], cfg({ triggerType: "PRODUCT_TRIGGER", productTrigger: { productIds: [], minQuantityPerProduct: null } }))
        );
        expect(result.operations).toEqual(EMPTY.operations);
    });

    it("accepts string jsonValue config", () => {
        const result = cartLinesDiscountsGenerateRun({
            cart: { cost: { subtotalAmount: { amount: "200.00" } }, lines: [giftLine()] },
            discount: { discountClasses: ["PRODUCT"], metafield: { jsonValue: JSON.stringify(cfg()) } },
        });
        assertOp(result);
    });

    it("defaults giftQuantity to 1 when missing", () => {
        const result = cartLinesDiscountsGenerateRun(input([giftLine()], cfg({ giftQuantity: undefined })));
        assertOp(result);
    });

    // --- Dual-match cases (BUG 2 fix) ---
    // These are RED until the Function matches product.id as well as variant id.

    it("matches gift via product GID (product-level dual-match)", () => {
        const result = cartLinesDiscountsGenerateRun(
            input([line("CL/1", GIFT_VARIANT, 1, "gid://shopify/Product/123")], cfg({ giftVariantId: "gid://shopify/Product/123" }))
        );
        assertOp(result, "CL/1");
    });

    it("matches gift via variant GID (legacy path still works)", () => {
        const result = cartLinesDiscountsGenerateRun(input([line("CL/1", GIFT_VARIANT, 1)], cfg({ giftVariantId: GIFT_VARIANT })));
        assertOp(result, "CL/1");
    });

    it("matches trigger product via product GID (product-level dual-match)", () => {
        const result = cartLinesDiscountsGenerateRun(
            input([line("CL/1", GIFT_VARIANT, 1, "gid://shopify/Product/123")], cfg({ triggerType: "PRODUCT_TRIGGER", productTrigger: { productIds: ["gid://shopify/Product/123"], minQuantityPerProduct: null } }))
        );
        assertOp(result, "CL/1");
    });

    it("matches trigger product via variant GID (legacy path still works)", () => {
        const result = cartLinesDiscountsGenerateRun(
            input([line("CL/1", GIFT_VARIANT, 1)], cfg({ triggerType: "PRODUCT_TRIGGER", productTrigger: { productIds: [GIFT_VARIANT], minQuantityPerProduct: null } }))
        );
        assertOp(result, "CL/1");
    });
});
