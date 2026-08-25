// app/utils/discount-sync.server.js

// ---------------------------------------------------------------------------
// GraphQL Mutation Strings
// ---------------------------------------------------------------------------

/**
 * Mutation: discountAutomaticBasicCreate
 * Creates an automatic amount-off discount (percentage or fixed) applied at
 * cart and checkout without a code.
 *
 * Input type: DiscountAutomaticBasicInput
 * Docs: https://shopify.dev/docs/api/admin-graphql/latest/mutations/discountAutomaticBasicCreate
 *
 * @see DISCOUNT_TYPES.AUTOMATIC_BASIC for full supported variable reference
 */
const ORDER_AUTOMATIC_MUTATION = `#graphql
  mutation CreateAutomaticOrderDiscount($discount: DiscountAutomaticBasicInput!) {
    discountAutomaticBasicCreate(automaticBasicDiscount: $discount) {
      automaticDiscountNode { id }
      userErrors { field message }
    }
  }
`;

/**
 * Mutation: discountCodeBasicCreate
 * Creates a code-based amount-off discount (percentage or fixed) applied when
 * a customer enters a code at cart/checkout.
 *
 * Input type: DiscountCodeBasicInput
 * Docs: https://shopify.dev/docs/api/admin-graphql/latest/mutations/discountCodeBasicCreate
 *
 * @see DISCOUNT_TYPES.CODE_BASIC for full supported variable reference
 */
const ORDER_CODE_MUTATION = `#graphql
  mutation CreateCodeOrderDiscount($discount: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $discount) {
      codeDiscountNode { id }
      userErrors { field message }
    }
  }
`;

/**
 * Mutation: discountAutomaticBxgyCreate
 * Creates an automatic Buy X Get Y discount applied at cart/checkout
 * without requiring a code.
 *
 * Input type: DiscountAutomaticBxgyInput
 * Docs: https://shopify.dev/docs/api/admin-graphql/latest/mutations/discountAutomaticBxgyCreate
 *
 * @see DISCOUNT_TYPES.AUTOMATIC_BXGY for full supported variable reference
 */
const BXGY_AUTOMATIC_MUTATION = `#graphql
  mutation CreateAutomaticBxgyDiscount($automaticBxgyDiscount: DiscountAutomaticBxgyInput!) {
    discountAutomaticBxgyCreate(automaticBxgyDiscount: $automaticBxgyDiscount) {
      automaticDiscountNode { id }
      userErrors { field message }
    }
  }
`;

/**
 * Mutation: discountCodeBxgyCreate
 * Creates a code-based Buy X Get Y discount applied when a customer enters a code.
 *
 * Input type: DiscountCodeBxgyInput
 * Docs: https://shopify.dev/docs/api/admin-graphql/latest/mutations/discountCodeBxgyCreate
 *
 * @see DISCOUNT_TYPES.CODE_BXGY for full supported variable reference
 */
const BXGY_CODE_MUTATION = `#graphql
  mutation CreateCodeBxgyDiscount($bxgyCodeDiscount: DiscountCodeBxgyInput!) {
    discountCodeBxgyCreate(bxgyCodeDiscount: $bxgyCodeDiscount) {
        codeDiscountNode { id }
        userErrors { field message }
    }
  }
`;

/**
 * Mutation: discountAutomaticFreeShippingCreate
 * Creates an automatic free shipping discount applied at checkout without a code.
 *
 * Input type: DiscountAutomaticFreeShippingInput
 * Docs: https://shopify.dev/docs/api/admin-graphql/latest/mutations/discountAutomaticFreeShippingCreate
 *
 * @see DISCOUNT_TYPES.AUTOMATIC_FREE_SHIPPING for full supported variable reference
 */
const FREE_SHIPPING_AUTOMATIC_MUTATION = `#graphql
  mutation CreateAutomaticFreeShippingDiscount($freeShippingAutomaticDiscount: DiscountAutomaticFreeShippingInput!) {
    discountAutomaticFreeShippingCreate(freeShippingAutomaticDiscount: $freeShippingAutomaticDiscount) {
      automaticDiscountNode { id }
      userErrors { field message }
    }
  }
`;

/**
 * Mutation: discountCodeFreeShippingCreate
 * Creates a code-based free shipping discount applied when a customer enters a code.
 *
 * Input type: DiscountCodeFreeShippingInput
 * Docs: https://shopify.dev/docs/api/admin-graphql/latest/mutations/discountCodeFreeShippingCreate
 *
 * @see DISCOUNT_TYPES.CODE_FREE_SHIPPING for full supported variable reference
 */
const FREE_SHIPPING_CODE_MUTATION = `#graphql
  mutation CreateCodeFreeShippingDiscount($freeShippingCodeDiscount: DiscountCodeFreeShippingInput!) {
    discountCodeFreeShippingCreate(freeShippingCodeDiscount: $freeShippingCodeDiscount) {
      codeDiscountNode { id }
      userErrors { field message }
    }
  }
`;

// ---------------------------------------------------------------------------
// Shared Utility Helpers
// ---------------------------------------------------------------------------

/**
 * Coerces a value to a money string for Shopify GraphQL (e.g. "10.00").
 * Shopify expects MoneyInput amounts as plain decimal strings, not numbers.
 *
 * @param {number | string} value - A non-negative numeric value
 * @returns {string} Decimal string representation, e.g. "9.99"
 * @throws {Error} If value is not a valid non-negative finite number
 */
function toMoneyString(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
        throw new Error("Money value must be a valid non-negative number.");
    }
    return num.toFixed(2); // "10.00" instead of "10"
}

/**
 * Coerces a value to a positive integer or returns null if empty/absent.
 * Used for optional integer fields like `usageLimit` and `usesPerOrderLimit`.
 *
 * @param {number | string | null | undefined} value - Candidate integer value
 * @param {string} fieldName - Used in the error message for context
 * @returns {number | null} Truncated positive integer, or null
 * @throws {Error} If value is present but not a positive finite number
 */
function toPositiveIntegerOrNull(value, fieldName) {
    if (value === "" || value == null) return null;

    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
        throw new Error(`${fieldName} must be a positive integer.`);
    }

    return Math.trunc(num);
}

/**
 * Builds the BXGY discount context expected by Shopify.
 *
 * Priority:
 * 1. customer segment restriction
 * 2. market restriction
 * 3. explicit all-customers fallback
 *
 * NOTE:
 * Shopify rejected omitted context with:
 * `bxgyCodeDiscount.context: Context can't be blank`
 * so BXGY code discounts should always send a context object.
 *
 * @param {object} discount
 * @param {string[]} [discount.contextCustomerSegmentIds]
 * @param {string[]} [discount.contextMarketIds]
 * @returns {object}
 */
function buildBxgyContext(discount) {
    const segmentIds = Array.isArray(discount.contextCustomerSegmentIds)
        ? discount.contextCustomerSegmentIds.filter(Boolean)
        : [];

    if (segmentIds.length > 0) {
        return {
            customerSegments: {
                add: segmentIds,
            },
        };
    }

    const marketIds = Array.isArray(discount.contextMarketIds)
        ? discount.contextMarketIds.filter(Boolean)
        : [];

    if (marketIds.length > 0) {
        return {
            markets: {
                add: marketIds,
            },
        };
    }

    return {
        all: "ALL",
    };
}

/**
 * Builds a Shopify discount item selector for BXGY `customerBuys`/`customerGets`.
 * Priority: collections > products > all items.
 *
 * @param {string[]} products    - Array of product GIDs
 * @param {string[]} collections - Array of collection GIDs
 * @returns {{ collections: object } | { products: object } | { all: true }}
 */
function buildBxgyItems(products, collections) {
    const productIds = Array.isArray(products) ? products.filter(Boolean) : [];
    const collectionIds = Array.isArray(collections) ? collections.filter(Boolean) : [];

    if (collectionIds.length > 0) {
        return { collections: { collectionsToAdd: collectionIds } };
    }
    if (productIds.length > 0) {
        return { products: { productsToAdd: productIds } };
    }
    return { all: true };
}

/**
 * Builds the `customerBuys` field for a BXGY discount.
 * Supports purchase trigger by AMOUNT (subtotal) or QUANTITY (item count).
 *
 * @param {object} bxgy
 * @param {"AMOUNT" | "QUANTITY"} bxgy.customerBuysType    - Purchase trigger type
 * @param {number | string}       bxgy.customerBuysAmount  - Required if type is AMOUNT; MoneyInput string e.g. "50.00"
 * @param {number | string}       bxgy.customerBuysQty     - Required if type is QUANTITY; positive integer
 * @param {string[]}              bxgy.customerBuysProducts    - Product GIDs for item scope
 * @param {string[]}              bxgy.customerBuysCollections - Collection GIDs for item scope
 * @returns {{ value: object, items: object }}
 */
function buildCustomerBuysBxgy(bxgy) {
    let value;

    if (bxgy.customerBuysType === "AMOUNT") {
        value = { amount: toMoneyString(bxgy.customerBuysAmount) };
    } else if (bxgy.customerBuysType === "QUANTITY") {
        const qty = Math.trunc(Number(bxgy.customerBuysQty));
        if (!Number.isFinite(qty) || qty <= 0) {
            throw new Error("BXGY customerBuysQty must be a positive integer.");
        }
        value = { quantity: String(qty) };
    } else {
        throw new Error(`Unsupported BXGY customerBuysType: ${bxgy.customerBuysType}`);
    }

    return {
        value,
        items: buildBxgyItems(bxgy.customerBuysProducts, bxgy.customerBuysCollections),
    };
}

/**
 * Builds the discount `effect` for the BXGY `customerGets.value.discountOnQuantity.effect` field.
 * Supports three effect types:
 *   - FREE            → percentage: 1 (100% off, i.e. free)
 *   - AMOUNT_OFF_EACH → amount: string (fixed amount off each item)
 *   - PERCENTAGE      → percentage: 0–1 decimal (e.g. 0.20 for 20%)
 *
 * @param {object} bxgy
 * @param {"FREE" | "AMOUNT_OFF_EACH" | "PERCENTAGE"} bxgy.customerGetsEffect
 * @param {number | string} bxgy.customerGetsAmount     - Required if AMOUNT_OFF_EACH
 * @param {number | string} bxgy.customerGetsPercentage - Required if PERCENTAGE; value between 0–100
 * @returns {{ percentage: number } | { amount: string }}
 */
function buildBxgyEffect(bxgy) {
    if (bxgy.customerGetsEffect === "FREE") {
        return { percentage: 1 };
    }

    if (bxgy.customerGetsEffect === "AMOUNT_OFF_EACH") {
        const amount = Number(bxgy.customerGetsAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error("BXGY amount off each must be a positive number.");
        }
        return {
            amount: toMoneyString(amount),
        };
    }

    const pct = Number(bxgy.customerGetsPercentage);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        throw new Error("BXGY percentage reward must be between 0 and 100.");
    }

    return {
        percentage: pct / 100,
    };
}

/**
 * Builds the `customerGets` field for a BXGY discount.
 * Represents what the customer receives when the `customerBuys` condition is met.
 *
 * @param {object} bxgy
 * @param {number | string}       bxgy.customerGetsQty         - Quantity of items rewarded (default 1)
 * @param {string[]}              bxgy.customerGetsProducts    - Product GIDs for reward scope
 * @param {string[]}              bxgy.customerGetsCollections - Collection GIDs for reward scope
 * @param {"FREE" | "AMOUNT_OFF_EACH" | "PERCENTAGE"} bxgy.customerGetsEffect
 * @param {number | string}       [bxgy.customerGetsAmount]     - Required if effect is AMOUNT_OFF_EACH
 * @param {number | string}       [bxgy.customerGetsPercentage] - Required if effect is PERCENTAGE (0–100)
 * @returns {{ items: object, value: { discountOnQuantity: object } }}
 */
function buildCustomerGetsBxgy(bxgy) {
    const quantity = Math.trunc(Number(bxgy.customerGetsQty || 1));
    if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("BXGY reward quantity must be a positive integer.");
    }

    return {
        items: buildBxgyItems(bxgy.customerGetsProducts, bxgy.customerGetsCollections),
        value: {
            discountOnQuantity: {
                quantity: String(quantity),
                effect: buildBxgyEffect(bxgy),
            },
        },
    };
}

/**
 * Builds the `customerGets.value` field for order/product discounts.
 * Shopify requires either a `percentage` (0–1 decimal) or a `discountAmount`.
 *
 * @param {object}  discount
 * @param {number}  discount.discountValue    - Positive numeric discount value
 * @param {boolean} discount.isPercentage     - If true, treat value as percentage (0–100 scale)
 * @returns {{ percentage: number } | { discountAmount: { amount: string, appliesOnEachItem: false } }}
 * @throws {Error} If discountValue is not a positive finite number
 */
function buildValue(discount) {
    const rawValue = Number(discount.discountValue);

    if (!Number.isFinite(rawValue) || rawValue <= 0) {
        throw new Error("Discount value must be a positive number before syncing to Shopify.");
    }

    if (discount.isPercentage) {
        return { percentage: rawValue / 100 };
    }

    return {
        discountAmount: {
            amount: toMoneyString(rawValue),
            appliesOnEachItem: Boolean(discount.appliesOnEachItem ?? false),
        },
    };
}

/**
 * Builds the `customerGets.items` field for order/product discounts.
 * Determines which items the discount applies to.
 * Priority: all > products > collections.
 *
 * @param {object}   discount
 * @param {string}   [discount.group | discount.discountGroup]   - "order" | "product"
 * @param {boolean}  [discount.appliesToAll]                     - If true, applies to all items regardless of group
 * @param {string[]} [discount.targetProducts]                   - Product GIDs (used if group is "product")
 * @param {string[]} [discount.targetCollections]                - Collection GIDs (used if group is "product")
 * @returns {{ all: true } | { products: object } | { collections: object }}
 */
function buildItems(discount) {
    const group = String(discount.group || discount.discountGroup || "order").toLowerCase();
    const appliesToAll = Boolean(discount.appliesToAll);

    if (group !== "product" || appliesToAll) {
        return { all: true };
    }

    const productIds = Array.isArray(discount.targetProducts)
        ? discount.targetProducts.filter(Boolean)
        : [];
    const collectionIds = Array.isArray(discount.targetCollections)
        ? discount.targetCollections.filter(Boolean)
        : [];

    if (productIds.length > 0) {
        return {
            products: {
                productsToAdd: productIds,
            },
        };
    }

    if (collectionIds.length > 0) {
        return {
            collections: {
                collectionsToAdd: collectionIds,
            },
        };
    }

    return { all: true };
}

/**
 * Combines `value` and `items` into the `customerGets` payload used by
 * `discountAutomaticBasicCreate` and `discountCodeBasicCreate`.
 *
 * @param {object} discount - Full discount object passed to sync functions
 * @returns {{ value: object, items: object }}
 */
function buildCustomerGets(discount) {
    return {
        value: buildValue(discount),
        items: buildItems(discount),
    };
}

/**
 * Builds the `minimumRequirement` field, which gates when the discount applies.
 * Supports two modes: SUBTOTAL (minimum order value) or QUANTITY (minimum item count).
 * Returns null if no minimum is set or values are invalid/empty.
 *
 * @param {object}          discount
 * @param {"SUBTOTAL" | "QUANTITY" | null} discount.minimumType
 * @param {number | string} [discount.minimumSubtotal]  - Required if minimumType is SUBTOTAL; MoneyInput
 * @param {number | string} [discount.minimumQuantity]  - Required if minimumType is QUANTITY; positive integer
 * @returns {{ subtotal: object } | { quantity: object } | null}
 */
function buildMinimumRequirement(discount) {
    if (discount.minimumType === "SUBTOTAL") {
        const amount = Number(discount.minimumSubtotal);
        if (!Number.isFinite(amount) || amount <= 0) return null;
        return { subtotal: { greaterThanOrEqualToSubtotal: toMoneyString(amount) } };
    }

    if (discount.minimumType === "QUANTITY") {
        const qty = Number(discount.minimumQuantity);
        if (!Number.isFinite(qty) || qty <= 0) return null;

        return {
            quantity: {
                greaterThanOrEqualToQuantity: String(Math.trunc(qty)),
            },
        };
    }

    return null;
}

/**
 * Builds the `combinesWith` field, controlling whether this discount stacks
 * with other active discounts.
 *
 * @param {object}  discount
 * @param {boolean} [discount.combineWithOrderDiscounts]    - Allow stacking with order discounts
 * @param {boolean} [discount.combineWithProductDiscounts]  - Allow stacking with product discounts
 * @param {boolean} [discount.combineWithShippingDiscounts] - Allow stacking with shipping discounts
 * @returns {{ orderDiscounts: boolean, productDiscounts: boolean, shippingDiscounts: boolean }}
 */
function buildCombinesWith(discount) {
    return {
        orderDiscounts: Boolean(discount.combineWithOrderDiscounts),
        productDiscounts: Boolean(discount.combineWithProductDiscounts),
        shippingDiscounts: Boolean(discount.combineWithShippingDiscounts),
    };
}

/**
 * Builds the `startsAt` ISO 8601 timestamp string.
 * Defaults to the current time if no `startsAt` is provided.
 *
 * @param {object}         discount
 * @param {string | Date}  [discount.startsAt] - ISO date string or Date object
 * @returns {string} ISO 8601 UTC timestamp, e.g. "2025-01-01T00:00:00.000Z"
 * @throws {Error} If provided value parses to an invalid date
 */
function buildStartsAt(discount) {
    const starts = discount.startsAt ? new Date(discount.startsAt) : new Date();
    if (Number.isNaN(starts.getTime())) {
        throw new Error("Invalid start date value.");
    }
    return starts.toISOString();
}

/**
 * Builds the `endsAt` ISO 8601 timestamp string, or returns null for open-ended discounts.
 *
 * @param {object}         discount
 * @param {string | Date}  [discount.endsAt] - ISO date string or Date object; omit for no end date
 * @returns {string | null} ISO 8601 UTC timestamp or null
 * @throws {Error} If provided value parses to an invalid date
 */
function buildEndsAt(discount) {
    if (!discount.endsAt) return null;

    const ends = new Date(discount.endsAt);
    if (Number.isNaN(ends.getTime())) {
        throw new Error("Invalid end date value.");
    }
    return ends.toISOString();
}

/**
 * Builds the `destination` field for free shipping discounts.
 * Supports specific country codes or all destinations.
 *
 * @param {object}   discount
 * @param {string[]} [discount.shippingDestinationCountries]
 *   Array of ISO 3166-1 alpha-2 country codes, e.g. ["US", "CA"].
 *   If empty or absent, applies to all destinations.
 * @returns {{ country: { add: string[] } } | { all: true }}
 */
function buildFreeShippingDestination(discount) {
    const countryCodes = Array.isArray(discount.shippingDestinationCountries)
        ? discount.shippingDestinationCountries.filter(Boolean)
        : [];

    if (countryCodes.length > 0) {
        return { country: { add: countryCodes } };
    }

    return { all: true };
}

/**
 * Assembles the shared base payload for both automatic and code free shipping mutations.
 * Handles title, dates, destination, minimum requirement, combinesWith, and optional maximumShippingPrice.
 *
 * @param {object}          discount
 * @param {string}          discount.title
 * @param {string | Date}   [discount.startsAt]
 * @param {string | Date}   [discount.endsAt]
 * @param {string[]}        [discount.shippingDestinationCountries]
 * @param {"SUBTOTAL" | "QUANTITY" | null} [discount.minimumType]
 * @param {number | string} [discount.minimumSubtotal]
 * @param {number | string} [discount.minimumQuantity]
 * @param {boolean}         [discount.combineWithOrderDiscounts]
 * @param {boolean}         [discount.combineWithProductDiscounts]
 * @param {boolean}         [discount.combineWithShippingDiscounts]
 * @param {number | string} [discount.maximumShippingPrice]
 *   Optional cap on qualifying shipping rates. Only rates at or below this amount
 *   will be made free. Type: MoneyInput string, e.g. "9.99".
 * @returns {object} Base payload for DiscountAutomaticFreeShippingInput / DiscountCodeFreeShippingInput
 */
function buildFreeShippingPayloadBase(discount) {
    const payload = {
        title: discount.title,
        startsAt: buildStartsAt(discount),
        endsAt: buildEndsAt(discount),
        destination: buildFreeShippingDestination(discount),
        minimumRequirement: buildMinimumRequirement(discount),
        combinesWith: buildCombinesWith(discount),
    };

    if (discount.maximumShippingPrice != null && discount.maximumShippingPrice !== "") {
        payload.maximumShippingPrice = toMoneyString(discount.maximumShippingPrice);
    }

    return payload;
}

// ---------------------------------------------------------------------------
// Error Assertion Helpers
// ---------------------------------------------------------------------------

/**
 * Throws if the Shopify mutation returned any userErrors.
 * userErrors are business-logic validation failures (e.g. duplicate code, invalid input).
 *
 * @param {Array<{ field: string[], message: string }>} userErrors
 * @param {string} mutationName - Used in the thrown error message for traceability
 * @throws {Error}
 */
function assertNoUserErrors(userErrors, mutationName) {
    if (userErrors?.length) {
        const message = userErrors
            .map((e) => `${e.field?.join(".") || "field"}: ${e.message}`)
            .join(" | ");
        throw new Error(`${mutationName} rejected by Shopify — ${message}`);
    }
}

/**
 * Throws if the GraphQL response itself contains top-level errors.
 * These are transport/schema-level errors, distinct from userErrors
 * (e.g. permission denied, unknown field, malformed query).
 *
 * @param {object} json         - Parsed GraphQL response JSON
 * @param {string} mutationName - Used in the thrown error message for traceability
 * @throws {Error}
 */
function assertGraphqlSucceeded(json, mutationName) {
    if (json?.errors?.length) {
        const message = json.errors.map((e) => e.message).join(" | ");
        throw new Error(`${mutationName} GraphQL error — ${message}`);
    }
}

// ---------------------------------------------------------------------------
// Mutation Executors — Code Discounts
// ---------------------------------------------------------------------------

/**
 * Creates a code-based basic (order/product) discount in Shopify.
 * Uses `discountCodeBasicCreate` mutation.
 *
 * Supported but NOT currently passed:
 *   - `context`          {DiscountContextInput}  — Restrict to specific markets or customer segments.
 *                         Shape: { markets: { add: ["gid://shopify/Market/123"] } }
 *                            or: { customerSegments: { add: ["gid://shopify/Segment/123"] } }
 *   - `customerSelection` {DiscountCustomerSelectionInput} — Restrict to specific customers.
 *                         Shape: { customers: { add: ["gid://shopify/Customer/123"] } }
 *                            or: { all: true }
 *                         Currently hardcoded to `{ all: true }`.
 *
 * @param {object} params
 * @param {object} params.admin    - Shopify authenticated admin client
 * @param {object} params.discount - Discount data object
 * @param {string}          params.discount.title
 * @param {string}          [params.discount.shopifyDiscountCode] - Preferred code string
 * @param {string}          [params.discount.discountCode]        - Fallback code string
 * @param {string | Date}   [params.discount.startsAt]
 * @param {string | Date}   [params.discount.endsAt]
 * @param {number}          params.discount.discountValue
 * @param {boolean}         params.discount.isPercentage
 * @param {string}          [params.discount.group | discountGroup]
 * @param {boolean}         [params.discount.appliesToAll]
 * @param {string[]}        [params.discount.targetProducts]
 * @param {string[]}        [params.discount.targetCollections]
 * @param {"SUBTOTAL" | "QUANTITY" | null} [params.discount.minimumType]
 * @param {number | string} [params.discount.minimumSubtotal]
 * @param {number | string} [params.discount.minimumQuantity]
 * @param {number | string} [params.discount.usageLimit]            - Max total redemptions; null = unlimited
 * @param {boolean}         [params.discount.appliesOncePerCustomer] - Limit one use per customer
 * @param {boolean}         [params.discount.combineWithOrderDiscounts]
 * @param {boolean}         [params.discount.combineWithProductDiscounts]
 * @param {boolean}         [params.discount.combineWithShippingDiscounts]
 * @returns {Promise<{ shopifyDiscountId: string }>}
 * @throws {Error} On GraphQL errors, userErrors, or missing discount node
 */
async function createCodeDiscount({ admin, discount }) {
    const code =
        discount.shopifyDiscountCode?.trim() ||
        discount.discountCode?.trim() ||
        discount.title.toUpperCase().replace(/\s+/g, "");

    if (!code) {
        throw new Error("A discount code is required when method is CODE.");
    }

    const response = await admin.graphql(ORDER_CODE_MUTATION, {
        variables: {
            discount: {
                title: discount.title,
                code,
                startsAt: buildStartsAt(discount),
                endsAt: buildEndsAt(discount),
                customerSelection: { all: true },
                customerGets: buildCustomerGets(discount),
                minimumRequirement: buildMinimumRequirement(discount),
                usageLimit: toPositiveIntegerOrNull(discount.usageLimit, "Usage limit"),
                appliesOncePerCustomer: Boolean(discount.appliesOncePerCustomer),
                combinesWith: buildCombinesWith(discount),
            },
        },
    });

    const json = await response.json();
    assertGraphqlSucceeded(json, "discountCodeBasicCreate");
    assertNoUserErrors(json?.data?.discountCodeBasicCreate?.userErrors, "discountCodeBasicCreate");

    const node = json?.data?.discountCodeBasicCreate?.codeDiscountNode;
    if (!node?.id) {
        throw new Error("Shopify did not return a discount node id for the code discount.");
    }

    return { shopifyDiscountId: node.id };
}

/**
 * Creates an automatic basic (order/product) discount in Shopify.
 * Uses `discountAutomaticBasicCreate` mutation.
 *
 * Supported but NOT currently passed:
 *   - `context` {DiscountContextInput} — Restrict the automatic discount to specific
 *     markets or customer segments. Without this, the discount applies to ALL customers.
 *     Shape: { markets: { add: ["gid://shopify/Market/123"] } }
 *        or: { customerSegments: { add: ["gid://shopify/Segment/123"] } }
 *
 * @param {object} params
 * @param {object} params.admin    - Shopify authenticated admin client
 * @param {object} params.discount - Discount data object
 * @param {string}          params.discount.title
 * @param {string | Date}   [params.discount.startsAt]
 * @param {string | Date}   [params.discount.endsAt]
 * @param {number}          params.discount.discountValue
 * @param {boolean}         params.discount.isPercentage
 * @param {string}          [params.discount.group | discountGroup]
 * @param {boolean}         [params.discount.appliesToAll]
 * @param {string[]}        [params.discount.targetProducts]
 * @param {string[]}        [params.discount.targetCollections]
 * @param {"SUBTOTAL" | "QUANTITY" | null} [params.discount.minimumType]
 * @param {number | string} [params.discount.minimumSubtotal]
 * @param {number | string} [params.discount.minimumQuantity]
 * @param {boolean}         [params.discount.combineWithOrderDiscounts]
 * @param {boolean}         [params.discount.combineWithProductDiscounts]
 * @param {boolean}         [params.discount.combineWithShippingDiscounts]
 * @returns {Promise<{ shopifyDiscountId: string }>}
 * @throws {Error} On GraphQL errors, userErrors, or missing discount node
 */
async function createAutomaticDiscount({ admin, discount }) {
    const response = await admin.graphql(ORDER_AUTOMATIC_MUTATION, {
        variables: {
            discount: {
                title: discount.title,
                startsAt: buildStartsAt(discount),
                endsAt: buildEndsAt(discount),
                customerGets: buildCustomerGets(discount),
                minimumRequirement: buildMinimumRequirement(discount),
                combinesWith: buildCombinesWith(discount),
            },
        },
    });

    const json = await response.json();
    assertGraphqlSucceeded(json, "discountAutomaticBasicCreate");
    assertNoUserErrors(
        json?.data?.discountAutomaticBasicCreate?.userErrors,
        "discountAutomaticBasicCreate"
    );

    const node = json?.data?.discountAutomaticBasicCreate?.automaticDiscountNode;
    if (!node?.id) {
        throw new Error("Shopify did not return a discount node id for the automatic discount.");
    }

    return { shopifyDiscountId: node.id };
}

/**
 * Creates a code-based Buy X Get Y discount in Shopify.
 * Uses `discountCodeBxgyCreate` mutation.
 *
 * Supported but NOT currently passed:
 *   - `context`  {DiscountContextInput} — Restrict to specific markets or customer segments.
 *                Shape: { markets: { add: ["gid://shopify/Market/123"] } }
 *                   or: { customerSegments: { add: ["gid://shopify/Segment/123"] } }
 *   - `customerSelection` {DiscountCustomerSelectionInput} — Restrict to specific customers.
 *   - `appliesOncePerCustomer` {boolean} — Limit redemption to once per customer.
 *
 * @param {object} params
 * @param {object} params.admin    - Shopify authenticated admin client
 * @param {object} params.discount - Discount data object
 * @param {string}          params.discount.title
 * @param {string}          [params.discount.shopifyDiscountCode]
 * @param {string}          [params.discount.discountCode]
 * @param {string | Date}   [params.discount.startsAt]
 * @param {string | Date}   [params.discount.endsAt]
 * @param {object}          params.discount.bxgyConfig             - BXGY-specific config object
 * @param {"AMOUNT" | "QUANTITY"} params.discount.bxgyConfig.customerBuysType
 * @param {number | string} [params.discount.bxgyConfig.customerBuysAmount]
 * @param {number | string} [params.discount.bxgyConfig.customerBuysQty]
 * @param {string[]}        [params.discount.bxgyConfig.customerBuysProducts]
 * @param {string[]}        [params.discount.bxgyConfig.customerBuysCollections]
 * @param {number | string} [params.discount.bxgyConfig.customerGetsQty]
 * @param {string[]}        [params.discount.bxgyConfig.customerGetsProducts]
 * @param {string[]}        [params.discount.bxgyConfig.customerGetsCollections]
 * @param {"FREE" | "AMOUNT_OFF_EACH" | "PERCENTAGE"} params.discount.bxgyConfig.customerGetsEffect
 * @param {number | string} [params.discount.usesPerOrderLimit]    - Max redemptions per order; null = unlimited
 * @param {boolean}         [params.discount.combineWithOrderDiscounts]
 * @param {boolean}         [params.discount.combineWithProductDiscounts]
 * @param {boolean}         [params.discount.combineWithShippingDiscounts]
 * @returns {Promise<{ shopifyDiscountId: string }>}
 * @throws {Error} On missing BXGY config, code, GraphQL errors, or userErrors
 */
async function createCodeBxgyDiscount({ admin, discount }) {
    const bxgy = discount.bxgyConfig;
    if (!bxgy) throw new Error("Missing BXGY configuration for this discount.");

    const code =
        discount.shopifyDiscountCode?.trim() ||
        discount.discountCode?.trim() ||
        discount.title.toUpperCase().replace(/\s+/g, "");

    if (!code) {
        throw new Error("A discount code is required when method is CODE.");
    }

    const usesPerOrderLimit = toPositiveIntegerOrNull(
        discount.usesPerOrderLimit,
        "Uses per order limit"
    );

    const response = await admin.graphql(BXGY_CODE_MUTATION, {
        variables: {
            bxgyCodeDiscount: {
                title: discount.title,
                code,
                context: buildBxgyContext(discount),
                startsAt: buildStartsAt(discount),
                endsAt: buildEndsAt(discount),
                customerBuys: buildCustomerBuysBxgy(bxgy),
                customerGets: buildCustomerGetsBxgy(bxgy),
                usesPerOrderLimit: usesPerOrderLimit ?? null,
                combinesWith: buildCombinesWith(discount),
            },
        },
    });

    const json = await response.json();
    assertGraphqlSucceeded(json, "discountCodeBxgyCreate");
    assertNoUserErrors(
        json?.data?.discountCodeBxgyCreate?.userErrors,
        "discountCodeBxgyCreate"
    );

    const node = json?.data?.discountCodeBxgyCreate?.codeDiscountNode;
    if (!node?.id) {
        throw new Error("Shopify did not return a discount node id for the BXGY code discount.");
    }

    return { shopifyDiscountId: node.id };
}

/**
 * Creates an automatic Buy X Get Y discount in Shopify.
 * Uses `discountAutomaticBxgyCreate` mutation.
 *
 * Supported but NOT currently passed:
 *   - `combinesWith` — Not sent; defaults to no stacking. Add via `buildCombinesWith(discount)`.
 *
 * @param {object} params
 * @param {object} params.admin    - Shopify authenticated admin client
 * @param {object} params.discount - Discount data object
 * @param {string}          params.discount.title
 * @param {string | Date}   [params.discount.startsAt]
 * @param {string | Date}   [params.discount.endsAt]
 * @param {object}          params.discount.bxgyConfig             - BXGY-specific config object
 * @param {"AMOUNT" | "QUANTITY"} params.discount.bxgyConfig.customerBuysType
 * @param {number | string} [params.discount.bxgyConfig.customerBuysAmount]
 * @param {number | string} [params.discount.bxgyConfig.customerBuysQty]
 * @param {string[]}        [params.discount.bxgyConfig.customerBuysProducts]
 * @param {string[]}        [params.discount.bxgyConfig.customerBuysCollections]
 * @param {number | string} [params.discount.bxgyConfig.customerGetsQty]
 * @param {string[]}        [params.discount.bxgyConfig.customerGetsProducts]
 * @param {string[]}        [params.discount.bxgyConfig.customerGetsCollections]
 * @param {"FREE" | "AMOUNT_OFF_EACH" | "PERCENTAGE"} params.discount.bxgyConfig.customerGetsEffect
 * @param {number | string} [params.discount.usesPerOrderLimit]
 * @returns {Promise<{ shopifyDiscountId: string }>}
 * @throws {Error} On missing BXGY config, GraphQL errors, or userErrors
 */
async function createAutomaticBxgyDiscount({ admin, discount }) {
    const bxgy = discount.bxgyConfig;
    if (!bxgy) throw new Error("Missing BXGY configuration for this discount.");

    const usesPerOrderLimit = toPositiveIntegerOrNull(
        discount.usesPerOrderLimit,
        "Uses per order limit"
    );

    const response = await admin.graphql(BXGY_AUTOMATIC_MUTATION, {
        variables: {
            automaticBxgyDiscount: {
                title: discount.title,
                startsAt: buildStartsAt(discount),
                endsAt: buildEndsAt(discount),
                customerBuys: buildCustomerBuysBxgy(bxgy),
                customerGets: buildCustomerGetsBxgy(bxgy),
                usesPerOrderLimit: usesPerOrderLimit != null ? String(usesPerOrderLimit) : null,
                combinesWith: buildCombinesWith(discount),
            },
        },
    });

    const json = await response.json();
    assertGraphqlSucceeded(json, "discountAutomaticBxgyCreate");
    assertNoUserErrors(
        json?.data?.discountAutomaticBxgyCreate?.userErrors,
        "discountAutomaticBxgyCreate"
    );

    const node = json?.data?.discountAutomaticBxgyCreate?.automaticDiscountNode;
    if (!node?.id) {
        throw new Error("Shopify did not return a discount node id for the BXGY discount.");
    }

    return { shopifyDiscountId: node.id };
}

/**
 * Creates an automatic free shipping discount in Shopify.
 * Uses `discountAutomaticFreeShippingCreate` mutation.
 * Hardcodes `appliesOnOneTimePurchase: true`.
 *
 * Supported but NOT currently passed:
 *   - `appliesOnSubscription` {boolean} — Also apply the discount to subscription purchases.
 *     Default: false. Pass alongside `appliesOnOneTimePurchase` if needed.
 *   - `recurringCycleLimit`   {number}  — Number of subscription billing cycles the discount
 *     applies to. Only relevant when `appliesOnSubscription` is true.
 *
 * @param {object} params
 * @param {object} params.admin    - Shopify authenticated admin client
 * @param {object} params.discount - Discount data object; see buildFreeShippingPayloadBase
 * @returns {Promise<{ shopifyDiscountId: string }>}
 * @throws {Error} On GraphQL errors, userErrors, or missing discount node
 */
async function createAutomaticFreeShippingDiscount({ admin, discount }) {
    const response = await admin.graphql(FREE_SHIPPING_AUTOMATIC_MUTATION, {
        variables: {
            freeShippingAutomaticDiscount: {
                ...buildFreeShippingPayloadBase(discount),
                appliesOnOneTimePurchase: true,
            },
        },
    });

    const json = await response.json();
    assertGraphqlSucceeded(json, "discountAutomaticFreeShippingCreate");
    assertNoUserErrors(
        json?.data?.discountAutomaticFreeShippingCreate?.userErrors,
        "discountAutomaticFreeShippingCreate"
    );

    const node = json?.data?.discountAutomaticFreeShippingCreate?.automaticDiscountNode;
    if (!node?.id) {
        throw new Error("Shopify did not return a discount node id for the automatic free shipping discount.");
    }

    return { shopifyDiscountId: node.id };
}

/**
 * Creates a code-based free shipping discount in Shopify.
 * Uses `discountCodeFreeShippingCreate` mutation.
 *
 * Supported but NOT currently passed:
 *   - `usageLimit`          {number}  — Maximum total redemptions across all customers.
 *   - `customerSelection`   {DiscountCustomerSelectionInput} — Currently hardcoded to `{ all: true }`.
 *     Can be narrowed to specific customers: `{ customers: { add: ["gid://shopify/Customer/123"] } }`
 *   - `context`             {DiscountContextInput} — Restrict to specific markets or customer segments.
 *
 * @param {object} params
 * @param {object} params.admin    - Shopify authenticated admin client
 * @param {object} params.discount - Discount data object; see buildFreeShippingPayloadBase
 * @param {string}  [params.discount.shopifyDiscountCode]
 * @param {string}  [params.discount.discountCode]
 * @param {boolean} [params.discount.appliesOncePerCustomer]
 * @returns {Promise<{ shopifyDiscountId: string }>}
 * @throws {Error} On missing code, GraphQL errors, userErrors, or missing discount node
 */
async function createCodeFreeShippingDiscount({ admin, discount }) {
    const code =
        discount.shopifyDiscountCode?.trim() ||
        discount.discountCode?.trim() ||
        discount.title.toUpperCase().replace(/\s+/g, "");

    if (!code) {
        throw new Error("A discount code is required when method is CODE.");
    }

    const response = await admin.graphql(FREE_SHIPPING_CODE_MUTATION, {
        variables: {
            freeShippingCodeDiscount: {
                ...buildFreeShippingPayloadBase(discount),
                code,
                customerSelection: { all: true },
                appliesOncePerCustomer: Boolean(discount.appliesOncePerCustomer),
            },
        },
    });

    const json = await response.json();
    assertGraphqlSucceeded(json, "discountCodeFreeShippingCreate");
    assertNoUserErrors(
        json?.data?.discountCodeFreeShippingCreate?.userErrors,
        "discountCodeFreeShippingCreate"
    );

    const node = json?.data?.discountCodeFreeShippingCreate?.codeDiscountNode;
    if (!node?.id) {
        throw new Error("Shopify did not return a discount node id for the free shipping code discount.");
    }

    return { shopifyDiscountId: node.id };
}

// ---------------------------------------------------------------------------
// Routing Helpers
// ---------------------------------------------------------------------------

/**
 * Maps a Shopify internal discount type string to a discount group key.
 * Used to route discounts to the correct mutation executor.
 *
 * @param {string} discountType - e.g. "PRODUCT_PERCENTAGE", "BXGY", "FREE_SHIPPING", "ORDER_FIXED"
 * @returns {"product" | "bxgy" | "shipping" | "app" | "order"}
 */
function getGroupKeyFromDiscountType(discountType) {
    switch (discountType) {
        case "PRODUCT_PERCENTAGE":
        case "PRODUCT_FIXED":
            return "product";
        case "BXGY":
            return "bxgy";
        case "FREE_SHIPPING":
            return "shipping";
        case "APP_VOLUME":
        case "APP_BUNDLE":
        case "APP_CAPPED":
            return "app";
        case "ORDER_FIXED":
        case "ORDER_PERCENTAGE":
        default:
            return "order";
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Routes a discount object to the correct Shopify mutation based on type and method.
 * Entry point for all discount creation synced to Shopify Admin GraphQL.
 *
 * Supported discount types and methods:
 *   - BXGY              → CODE   → discountCodeBxgyCreate
 *   - BXGY              → AUTO   → discountAutomaticBxgyCreate
 *   - FREE_SHIPPING     → CODE   → discountCodeFreeShippingCreate
 *   - FREE_SHIPPING     → AUTO   → discountAutomaticFreeShippingCreate
 *   - ORDER / PRODUCT   → CODE   → discountCodeBasicCreate
 *   - ORDER / PRODUCT   → AUTO   → discountAutomaticBasicCreate
 *
 * @param {object} params
 * @param {object} params.admin    - Shopify authenticated admin client (from `authenticate.admin`)
 * @param {object} params.discount - Discount data object
 * @param {string}          params.discount.title                - Required; used as discount name in Shopify
 * @param {"CODE" | "AUTOMATIC"} params.discount.method          - Required; determines mutation used
 * @param {string}          [params.discount.discountType]        - e.g. "ORDER_PERCENTAGE", "BXGY"
 * @param {string}          [params.discount.type]               - Alias for discountType
 * @param {string}          [params.discount.group]              - e.g. "order" | "product"
 * @param {string}          [params.discount.discountGroup]      - Alias for group
 * @returns {Promise<{ shopifyDiscountId: string }>}
 * @throws {Error} If admin is missing, title is empty, type is unsupported, or mutation fails
 */
export async function pushDiscountToShopify({ admin, discount }) {
    if (!admin) {
        throw new Error("Missing authenticated admin client — cannot sync to Shopify.");
    }
    if (!discount?.title?.trim()) {
        throw new Error("Discount title is required before syncing to Shopify.");
    }

    const discountType = discount.discountType || discount.type || "ORDER_PERCENTAGE";
    const group = (
        discount.group ||
        discount.discountGroup ||
        getGroupKeyFromDiscountType(discountType)
    ).toLowerCase();

    if (discountType === "BXGY") {
        if (discount.method === "CODE") {
            return createCodeBxgyDiscount({ admin, discount });
        }
        if (discount.method === "AUTOMATIC") {
            return createAutomaticBxgyDiscount({ admin, discount });
        }
        throw new Error(`Unsupported BXGY discount method: ${discount.method}`);
    }

    if (discountType === "FREE_SHIPPING") {
        if (discount.method === "CODE") {
            return createCodeFreeShippingDiscount({ admin, discount });
        }
        if (discount.method === "AUTOMATIC") {
            return createAutomaticFreeShippingDiscount({ admin, discount });
        }
        throw new Error(`Unsupported free shipping discount method: ${discount.method}`);
    }

    if (![ "order", "product" ].includes(group)) {
        throw new Error(`Sync for discount group '${group}' is not implemented yet.`);
    }

    if (discount.method === "CODE") {
        return createCodeDiscount({ admin, discount });
    }

    if (discount.method === "AUTOMATIC") {
        return createAutomaticDiscount({ admin, discount });
    }

    throw new Error(`Unsupported discount method: ${discount.method}`);
}