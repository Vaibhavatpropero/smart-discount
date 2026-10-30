import { describe, it, expect } from "vitest";
import { cartLinesDiscountsGenerateRun } from "../src/cart_lines_discounts_generate_run.js";
import appCappedBasic from "./fixtures/app-capped-basic.json";

describe("capped-order-discount", () => {
  it("applies percentage discount when below cap", () => {
    const input = {
      cart: { cost: { subtotalAmount: { amount: "100.00", currencyCode: "USD" } } },
      discount: {
        discountClasses: ["ORDER"],
        metafield: { jsonValue: { percent: 20, cappedAmount: 50 } },
      },
    };
    const result = cartLinesDiscountsGenerateRun(input);
    expect(result.operations).toHaveLength(1);
    const op = result.operations[0].orderDiscountsAdd.candidates[0];
    expect(op.value.fixedAmount.amount).toBe("20.00");
    expect(op.message).toContain("20% off up to");
    expect(op.message).toContain("50.00");
    expect(op.targets[0].orderSubtotal.excludedCartLineIds).toEqual([]);
  });

  it("applies cap when percentage exceeds cap", () => {
    const input = {
      cart: { cost: { subtotalAmount: { amount: "100.00", currencyCode: "USD" } } },
      discount: {
        discountClasses: ["ORDER"],
        metafield: { jsonValue: { percent: 50, cappedAmount: 20 } },
      },
    };
    const result = cartLinesDiscountsGenerateRun(input);
    expect(result.operations).toHaveLength(1);
    const op = result.operations[0].orderDiscountsAdd.candidates[0];
    expect(op.value.fixedAmount.amount).toBe("20.00");
    expect(op.message).toContain("50% off up to");
    expect(op.message).toContain("20.00");
  });

  it("returns EMPTY_RESULT when discountClasses does not include ORDER", () => {
    const input = {
      cart: { cost: { subtotalAmount: { amount: "100.00", currencyCode: "USD" } } },
      discount: { discountClasses: ["PRODUCT"], metafield: { jsonValue: { percent: 20, cappedAmount: 50 } } },
    };
    const result = cartLinesDiscountsGenerateRun(input);
    expect(result.operations).toEqual([]);
  });

  it("returns EMPTY_RESULT when metafield config is missing", () => {
    const input = {
      cart: { cost: { subtotalAmount: { amount: "100.00", currencyCode: "USD" } } },
      discount: { discountClasses: ["ORDER"] },
    };
    const result = cartLinesDiscountsGenerateRun(input);
    expect(result.operations).toEqual([]);
  });

  it("returns EMPTY_RESULT when percent is 0", () => {
    const input = {
      cart: { cost: { subtotalAmount: { amount: "100.00", currencyCode: "USD" } } },
      discount: {
        discountClasses: ["ORDER"],
        metafield: { jsonValue: { percent: 0, cappedAmount: 50 } },
      },
    };
    const result = cartLinesDiscountsGenerateRun(input);
    expect(result.operations).toEqual([]);
  });

  it("returns EMPTY_RESULT when percent exceeds 100", () => {
    const input = {
      cart: { cost: { subtotalAmount: { amount: "100.00", currencyCode: "USD" } } },
      discount: {
        discountClasses: ["ORDER"],
        metafield: { jsonValue: { percent: 150, cappedAmount: 50 } },
      },
    };
    const result = cartLinesDiscountsGenerateRun(input);
    expect(result.operations).toEqual([]);
  });

  it("returns EMPTY_RESULT when cappedAmount is 0", () => {
    const input = {
      cart: { cost: { subtotalAmount: { amount: "100.00", currencyCode: "USD" } } },
      discount: {
        discountClasses: ["ORDER"],
        metafield: { jsonValue: { percent: 20, cappedAmount: 0 } },
      },
    };
    const result = cartLinesDiscountsGenerateRun(input);
    expect(result.operations).toEqual([]);
  });

  it("returns EMPTY_RESULT when subtotal is 0", () => {
    const input = {
      cart: { cost: { subtotalAmount: { amount: "0", currencyCode: "USD" } } },
      discount: {
        discountClasses: ["ORDER"],
        metafield: { jsonValue: { percent: 20, cappedAmount: 50 } },
      },
    };
    const result = cartLinesDiscountsGenerateRun(input);
    expect(result.operations).toEqual([]);
  });

  it("returns EMPTY_RESULT when subtotal is negative", () => {
    const input = {
      cart: { cost: { subtotalAmount: { amount: "-5.00", currencyCode: "USD" } } },
      discount: {
        discountClasses: ["ORDER"],
        metafield: { jsonValue: { percent: 20, cappedAmount: 50 } },
      },
    };
    const result = cartLinesDiscountsGenerateRun(input);
    expect(result.operations).toEqual([]);
  });

  it("returns EMPTY_RESULT when discount rounds to zero", () => {
    const input = {
      cart: { cost: { subtotalAmount: { amount: "0.01", currencyCode: "USD" } } },
      discount: {
        discountClasses: ["ORDER"],
        metafield: { jsonValue: { percent: 1, cappedAmount: 50 } },
      },
    };
    const result = cartLinesDiscountsGenerateRun(input);
    expect(result.operations).toEqual([]);
  });

  it("rounds discount to 2 decimal places", () => {
    const input = {
      cart: { cost: { subtotalAmount: { amount: "33.35", currencyCode: "USD" } } },
      discount: {
        discountClasses: ["ORDER"],
        metafield: { jsonValue: { percent: 10, cappedAmount: 50 } },
      },
    };
    const result = cartLinesDiscountsGenerateRun(input);
    expect(result.operations).toHaveLength(1);
    const op = result.operations[0].orderDiscountsAdd.candidates[0];
    expect(op.value.fixedAmount.amount).toBe("3.34");
  });

  it("uses currency symbol in message", () => {
    const input = {
      cart: { cost: { subtotalAmount: { amount: "100.00", currencyCode: "GBP" } } },
      discount: {
        discountClasses: ["ORDER"],
        metafield: { jsonValue: { percent: 20, cappedAmount: 50 } },
      },
    };
    const result = cartLinesDiscountsGenerateRun(input);
    expect(result.operations).toHaveLength(1);
    const op = result.operations[0].orderDiscountsAdd.candidates[0];
    expect(op.value.fixedAmount.amount).toBe("20.00");
    expect(op.message).toBe("20% off up to £50.00");
  });

  it("uses currency code as symbol for unknown currency", () => {
    const input = {
      cart: { cost: { subtotalAmount: { amount: "100.00", currencyCode: "XYZ" } } },
      discount: {
        discountClasses: ["ORDER"],
        metafield: { jsonValue: { percent: 20, cappedAmount: 50 } },
      },
    };
    const result = cartLinesDiscountsGenerateRun(input);
    expect(result.operations).toHaveLength(1);
    const op = result.operations[0].orderDiscountsAdd.candidates[0];
    expect(op.message).toContain("20% off up to");
    expect(op.message).toContain("XYZ50.00");
  });

  it("works with the existing app-capped-basic fixture", () => {
    const result = cartLinesDiscountsGenerateRun(appCappedBasic);
    expect(result.operations).toHaveLength(1);
    const op = result.operations[0].orderDiscountsAdd.candidates[0];
    expect(op.value.fixedAmount.amount).toBe("4.00");
    expect(op.message).toContain("20% off up to");
    expect(op.message).toContain("5.00");
  });
});
