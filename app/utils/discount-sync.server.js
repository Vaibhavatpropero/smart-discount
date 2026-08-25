// app/utils/discount-sync.server.js

const ORDER_AUTOMATIC_MUTATION = `#graphql
  mutation CreateAutomaticOrderDiscount($discount: DiscountAutomaticBasicInput!) {
    discountAutomaticBasicCreate(automaticBasicDiscount: $discount) {
      automaticDiscountNode { id }
      userErrors { field message }
    }
  }
`;

const ORDER_CODE_MUTATION = `#graphql
  mutation CreateCodeOrderDiscount($discount: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $discount) {
      codeDiscountNode { id }
      userErrors { field message }
    }
  }
`;

const BXGY_AUTOMATIC_MUTATION = `#graphql
  mutation CreateAutomaticBxgyDiscount($automaticBxgyDiscount: DiscountAutomaticBxgyInput!) {
    discountAutomaticBxgyCreate(automaticBxgyDiscount: $automaticBxgyDiscount) {
      automaticDiscountNode { id }
      userErrors { field message }
    }
  }
`;

const BXGY_CODE_MUTATION = `#graphql
  mutation CreateCodeBxgyDiscount($bxgyCodeDiscount: DiscountCodeBxgyInput!) {
    discountCodeBxgyCreate(bxgyCodeDiscount: $bxgyCodeDiscount) {
        codeDiscountNode { id }
        userErrors { field message }
    }
  }
`;

const FREE_SHIPPING_AUTOMATIC_MUTATION = `#graphql
  mutation CreateAutomaticFreeShippingDiscount($freeShippingAutomaticDiscount: DiscountAutomaticFreeShippingInput!) {
    discountAutomaticFreeShippingCreate(freeShippingAutomaticDiscount: $freeShippingAutomaticDiscount) {
      automaticDiscountNode { id }
      userErrors { field message }
    }
  }
`;

const FREE_SHIPPING_CODE_MUTATION = `#graphql
  mutation CreateCodeFreeShippingDiscount($freeShippingCodeDiscount: DiscountCodeFreeShippingInput!) {
    discountCodeFreeShippingCreate(freeShippingCodeDiscount: $freeShippingCodeDiscount) {
      codeDiscountNode { id }
      userErrors { field message }
    }
  }
`;

function toMoneyString(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
        throw new Error("Money value must be a valid non-negative number.");
    }
    return String(num);
}

function toPositiveIntegerOrNull(value, fieldName) {
    if (value === "" || value == null) return null;

    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
        throw new Error(`${fieldName} must be a positive integer.`);
    }

    return Math.trunc(num);
}

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

function buildCustomerBuysBxgy(bxgy) {
    const value =
        bxgy.customerBuysType === "AMOUNT"
            ? { amount: toMoneyString(bxgy.customerBuysAmount) }
            : { quantity: String(Math.trunc(Number(bxgy.customerBuysQty))) };

    return {
        value,
        items: buildBxgyItems(bxgy.customerBuysProducts, bxgy.customerBuysCollections),
    };
}

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
            appliesOnEachItem: false,
        },
    };
}

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

function buildCustomerGets(discount) {
    return {
        value: buildValue(discount),
        items: buildItems(discount),
    };
}

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
                greaterThanOrEqualToQuantity: Math.trunc(qty),
            },
        };
    }

    return null;
}

function buildCombinesWith(discount) {
    return {
        orderDiscounts: Boolean(discount.combineWithOrderDiscounts),
        productDiscounts: Boolean(discount.combineWithProductDiscounts),
        shippingDiscounts: Boolean(discount.combineWithShippingDiscounts),
    };
}

function buildStartsAt(discount) {
    const starts = discount.startsAt ? new Date(discount.startsAt) : new Date();
    if (Number.isNaN(starts.getTime())) {
        throw new Error("Invalid start date value.");
    }
    return starts.toISOString();
}

function buildEndsAt(discount) {
    if (!discount.endsAt) return null;

    const ends = new Date(discount.endsAt);
    if (Number.isNaN(ends.getTime())) {
        throw new Error("Invalid end date value.");
    }
    return ends.toISOString();
}

function buildFreeShippingDestination(discount) {
    const countryCodes = Array.isArray(discount.shippingDestinationCountries)
        ? discount.shippingDestinationCountries.filter(Boolean)
        : [];

    if (countryCodes.length > 0) {
        return { country: { add: countryCodes } };
    }

    return { all: true };
}

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

function assertNoUserErrors(userErrors, mutationName) {
    if (userErrors?.length) {
        const message = userErrors
            .map((e) => `${e.field?.join(".") || "field"}: ${e.message}`)
            .join(" | ");
        throw new Error(`${mutationName} rejected by Shopify — ${message}`);
    }
}

function assertGraphqlSucceeded(json, mutationName) {
    if (json?.errors?.length) {
        const message = json.errors.map((e) => e.message).join(" | ");
        throw new Error(`${mutationName} GraphQL error — ${message}`);
    }
}

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
                context: { all: "ALL" },
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
                usesPerOrderLimit: usesPerOrderLimit ?? null,
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