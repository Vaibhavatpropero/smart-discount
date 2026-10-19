// extensions/free-gift-discount/src/cart_lines_discounts_generate_run.js

import {
  DiscountClass,
  OrderDiscountSelectionStrategy,
  ProductDiscountSelectionStrategy,
} from "../generated/api";

/**
 * @typedef {import("../generated/api").CartInput} RunInput
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
 */

const EMPTY_RESULT = {
  operations: [],
};

/**
 * Parse and validate configuration from metafield jsonValue.
 *
 * Expected shape:
 * {
 *   giftVariantId: string,
 *   giftQuantity: number,
 *   triggerType: "ORDER_THRESHOLD" | "PRODUCT_TRIGGER",
 *   threshold?: {
 *     kind: "SUBTOTAL" | "QUANTITY",
 *     minSubtotal?: string,
 *     minQuantity?: number
 *   },
 *   productTrigger?: {
 *     productIds: string[],             // variant IDs
 *     minQuantityPerProduct?: number
 *   }
 * }
 */
function parseConfiguration(jsonValue) {
  try {
    const raw =
      typeof jsonValue === "string" ? JSON.parse(jsonValue) : jsonValue ?? {};

    const giftVariantId =
      typeof raw.giftVariantId === "string" && raw.giftVariantId
        ? raw.giftVariantId
        : null;

    const giftQuantity =
      Number.isFinite(Number(raw.giftQuantity)) && Number(raw.giftQuantity) > 0
        ? Number(raw.giftQuantity)
        : 1;

    const triggerType = raw.triggerType;

    if (!giftVariantId) return null;
    if (triggerType !== "ORDER_THRESHOLD" && triggerType !== "PRODUCT_TRIGGER") {
      return null;
    }

    let threshold = null;
    if (triggerType === "ORDER_THRESHOLD" && raw.threshold) {
      const kind = raw.threshold.kind;
      if (kind === "SUBTOTAL") {
        const minSubtotal = Number(raw.threshold.minSubtotal);
        if (!Number.isFinite(minSubtotal) || minSubtotal <= 0) {
          return null;
        }
        threshold = {
          kind: "SUBTOTAL",
          minSubtotal,
        };
      } else if (kind === "QUANTITY") {
        const minQuantity = Number(raw.threshold.minQuantity);
        if (!Number.isInteger(minQuantity) || minQuantity <= 0) {
          return null;
        }
        threshold = {
          kind: "QUANTITY",
          minQuantity,
        };
      } else {
        return null;
      }
    }

    let productTrigger = null;
    if (triggerType === "PRODUCT_TRIGGER" && raw.productTrigger) {
      const productIds = Array.isArray(raw.productTrigger.productIds)
        ? raw.productTrigger.productIds.filter((id) => typeof id === "string" && id)
        : [];

      if (productIds.length === 0) {
        return null;
      }

      const minQuantityPerProduct =
        raw.productTrigger.minQuantityPerProduct != null
          ? Number(raw.productTrigger.minQuantityPerProduct)
          : null;

      if (
        minQuantityPerProduct != null &&
        (!Number.isInteger(minQuantityPerProduct) || minQuantityPerProduct <= 0)
      ) {
        return null;
      }

      productTrigger = {
        productIds,
        minQuantityPerProduct,
      };
    }

    return {
      giftVariantId,
      giftQuantity,
      triggerType,
      threshold,
      productTrigger,
    };
  } catch {
    return null;
  }
}

function orderThresholdMet({ config, cart }) {
  if (!config.threshold) return false;

  const { kind } = config.threshold;

  if (kind === "SUBTOTAL") {
    const subtotal = Number(cart?.cost?.subtotalAmount?.amount ?? 0);
    if (!Number.isFinite(subtotal) || subtotal <= 0) return false;
    return subtotal >= config.threshold.minSubtotal;
  }

  if (kind === "QUANTITY") {
    const totalQty = (cart?.lines ?? []).reduce(
      (sum, line) => sum + Number(line.quantity ?? 0),
      0,
    );
    return totalQty >= config.threshold.minQuantity;
  }

  return false;
}

function productTriggerMet({ config, cart }) {
  if (!config.productTrigger) return false;

  const { productIds, minQuantityPerProduct } = config.productTrigger;
  const lines = cart?.lines ?? [];

  for (const line of lines) {
    const merch = line.merchandise;
    if (!merch || merch.__typename !== "ProductVariant") continue;

    const variantId = merch.id;
    if (!productIds.includes(variantId)) continue;

    const qty = Number(line.quantity ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;

    if (minQuantityPerProduct != null) {
      if (qty >= minQuantityPerProduct) {
        return true;
      }
    } else {
      // presence is enough
      return true;
    }
  }

  return false;
}

function conditionsMet({ config, cart }) {
  if (config.triggerType === "ORDER_THRESHOLD") {
    return orderThresholdMet({ config, cart });
  }
  if (config.triggerType === "PRODUCT_TRIGGER") {
    return productTriggerMet({ config, cart });
  }
  return false;
}

/**
 * @param {RunInput} input
 * @returns {CartLinesDiscountsGenerateRunResult}
 */
export function cartLinesDiscountsGenerateRun(input) {
  if (!input.cart.lines.length) {
    return EMPTY_RESULT;
  }

  const hasProductDiscountClass =
    input.discount.discountClasses.includes(DiscountClass.Product);

  if (!hasProductDiscountClass) {
    return EMPTY_RESULT;
  }

  const config = parseConfiguration(input?.discount?.metafield?.jsonValue);
  if (!config) {
    return EMPTY_RESULT;
  }

  const cart = input.cart;

  if (!conditionsMet({ config, cart })) {
    return EMPTY_RESULT;
  }

  const giftLines = (cart?.lines ?? []).filter((line) => {
    const merch = line.merchandise;
    return (
      merch &&
      merch.__typename === "ProductVariant" &&
      merch.id === config.giftVariantId
    );
  });

  if (giftLines.length === 0) {
    return EMPTY_RESULT;
  }

  // For now: discount the first gift line entirely (100% off)
  const giftLine = giftLines[ 0 ];

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates: [
            {
              message: "Free gift",
              targets: [
                {
                  cartLine: {
                    id: giftLine.id,
                  },
                },
              ],
              value: {
                percentage: {
                  value: 100,
                },
              },
            },
          ],
          selectionStrategy: ProductDiscountSelectionStrategy.First,
        },
      },
    ],
  };
}