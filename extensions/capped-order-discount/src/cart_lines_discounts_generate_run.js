// extensions/capped-order-discount/src/cart_lines_discounts_generate_run.js

import {
  DiscountClass,
  OrderDiscountSelectionStrategy,
} from "../generated/api";

/**
 * @typedef {import("../generated/api").CartInput} RunInput
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
 */

const EMPTY_RESULT = {
  operations: [],
};

const CURRENCY_SYMBOLS = {
  USD: "$",
  CAD: "$",
  EUR: "€",
  GBP: "£",
  AUD: "$",
  NZD: "$",
  JPY: "¥",
  // fallback for others will be code itself
};

function formatCurrencyAmount(amount, currencyCode) {
  const symbol = CURRENCY_SYMBOLS[ currencyCode ] || currencyCode || "";
  const value = Number(amount).toFixed(2);
  return `${symbol}${value}`;
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0; // 32-bit signed
  }
  return hash >>> 0; // unsigned
}

function pseudoRandom01(seed) {
  // simple LCG based on the hash
  let x = (seed + 0x9e3779b9) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  // map to [0, 1)
  return (x >>> 0) / 0xffffffff;
}

function computeBandedRandomDiscount({ subtotal, cap, seed }) {
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return 0;
  }

  const ratio = subtotal / cap;

  let minFactor;
  let maxFactor;

  if (ratio >= 4) {
    // [0.6 * cap, 1.0 * cap]
    minFactor = 0.6;
    maxFactor = 1.0;
  } else if (ratio >= 3) {
    // [0.2 * cap, 0.6 * cap]
    minFactor = 0.2;
    maxFactor = 0.6;
  } else if (ratio >= 1) {
    // [0.0 * cap, 0.2 * cap]
    minFactor = 0.0;
    maxFactor = 0.2;
  } else {
    // subtotal < cap: very small band, e.g. up to 10% of cap
    minFactor = 0.0;
    maxFactor = 0.1;
  }

  const r = pseudoRandom01(seed);
  const factor = minFactor + r * (maxFactor - minFactor);
  const amount = cap * factor;

  // round to cents
  return Math.max(0, Math.round(amount * 100) / 100);
}

function parseConfiguration(jsonValue) {
  try {
    const parsed =
      typeof jsonValue === "string" ? JSON.parse(jsonValue) : jsonValue ?? {};

    const percent = Number(parsed.percent);
    const cappedAmount = Number(parsed.cappedAmount);

    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      return null;
    }

    if (!Number.isFinite(cappedAmount) || cappedAmount <= 0) {
      return null;
    }

    return { percent, cappedAmount };
  } catch {
    return null;
  }
}

/**
 * @param {RunInput} input
 * @returns {CartLinesDiscountsGenerateRunResult}
 */
export function cartLinesDiscountsGenerateRun(input) {
  const hasOrderDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Order,
  );

  if (!hasOrderDiscountClass) {
    return EMPTY_RESULT;
  }

  const configuration = parseConfiguration(
    input?.discount?.metafield?.jsonValue,
  );

  if (!configuration) {
    return EMPTY_RESULT;
  }

  const subtotal = Number(input?.cart?.cost?.subtotalAmount?.amount ?? 0);

  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return EMPTY_RESULT;
  }

  const cap = configuration.cappedAmount;

  // Build a deterministic seed from all cart line IDs
  const lineIdKey = (input.cart.lines || [])
    .map((line) => line.id)
    .join("|");

  if (!lineIdKey) {
    return EMPTY_RESULT;
  }

  const seed = hashString(lineIdKey);

  const finalDiscount = computeBandedRandomDiscount({
    subtotal,
    cap,
    seed,
  });

  // If the computed discount is effectively zero, do nothing
  if (!Number.isFinite(finalDiscount) || finalDiscount <= 0) {
    return EMPTY_RESULT;
  }

  const currencyCode =
    input?.cart?.cost?.subtotalAmount?.currencyCode ?? null;

  const messageAmount = formatCurrencyAmount(
    configuration.cappedAmount,
    currencyCode,
  );

  return {
    operations: [
      {
        orderDiscountsAdd: {
          candidates: [
            {
              message: `${configuration.percent}% off up to ${messageAmount}`,
              targets: [
                {
                  orderSubtotal: {
                    excludedCartLineIds: [],
                  },
                },
              ],
              value: {
                fixedAmount: {
                  amount: finalDiscount.toFixed(2),
                },
              },
            },
          ],
          selectionStrategy: OrderDiscountSelectionStrategy.First,
        },
      },
    ],
  };
}