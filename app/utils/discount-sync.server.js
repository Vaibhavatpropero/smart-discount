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

function buildValue(discount, currencyCode) {
    const rawValue = Number(discount.discountValue);

    if (!Number.isFinite(rawValue) || rawValue <= 0) {
        throw new Error("Discount value must be a positive number before syncing to Shopify.");
    }

    if (discount.isPercentage) {
        return { percentage: rawValue / 100 };
    }

    return {
        discountAmount: {
            amount: String(rawValue),
            currencyCode, // e.g. "USD"
        },
    };
}

function buildItems(discount) {
    const group = String(discount.group || discount.discountGroup || "order").toLowerCase();
    const appliesToAll = Boolean(discount.appliesToAll);

    if (group !== "product" || appliesToAll) {
        // For order-wide discounts, or product group with "all products"
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

function buildCustomerGets(discount, currencyCode) {
    return {
        value: buildValue(discount, currencyCode),
        items: buildItems(discount),
    };
}

function buildMinimumRequirement(discount) {
    if (discount.minimumType === "SUBTOTAL") {
        const amount = Number(discount.minimumSubtotal);
        if (!Number.isFinite(amount) || amount <= 0) return null;
        return { subtotal: { greaterThanOrEqualToSubtotal: amount } };
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

function buildCombinesWith(discount) {
    return {
        orderDiscounts: Boolean(discount.combineWithOrderDiscounts),
        productDiscounts: Boolean(discount.combineWithProductDiscounts),
        shippingDiscounts: Boolean(discount.combineWithShippingDiscounts),
    };
}

function buildStartsAt(discount) {
    const starts = discount.startsAt ? new Date(discount.startsAt) : new Date();
    return starts.toISOString();
}

function buildEndsAt(discount) {
    if (!discount.endsAt) return null;
    return new Date(discount.endsAt).toISOString();
}

function assertNoUserErrors(userErrors, mutationName) {
    if (userErrors?.length) {
        const message = userErrors.map((e) => `${e.field?.join(".") || "field"}: ${e.message}`).join(" | ");
        throw new Error(`${mutationName} rejected by Shopify — ${message}`);
    }
}

function assertGraphqlSucceeded(json, mutationName) {
    if (json?.errors?.length) {
        const message = json.errors.map((e) => e.message).join(" | ");
        throw new Error(`${mutationName} GraphQL error — ${message}`);
    }
}

async function createCodeDiscount({ admin, discount, currencyCode }) {
    const code =
        discount.shopifyDiscountCode?.trim() ||
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
                customerGets: buildCustomerGets(discount, currencyCode),
                minimumRequirement: buildMinimumRequirement(discount),
                usageLimit: discount.usageLimit ? Number(discount.usageLimit) : null,
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

async function createAutomaticDiscount({ admin, discount, currencyCode }) {
    const response = await admin.graphql(ORDER_AUTOMATIC_MUTATION, {
        variables: {
            discount: {
                title: discount.title,
                startsAt: buildStartsAt(discount),
                endsAt: buildEndsAt(discount),
                customerGets: buildCustomerGets(discount, currencyCode),
                minimumRequirement: buildMinimumRequirement(discount),
                combinesWith: buildCombinesWith(discount),
            },
        },
    });

    const json = await response.json();
    assertGraphqlSucceeded(json, "discountAutomaticBasicCreate");
    assertNoUserErrors(json?.data?.discountAutomaticBasicCreate?.userErrors, "discountAutomaticBasicCreate");

    const node = json?.data?.discountAutomaticBasicCreate?.automaticDiscountNode;
    if (!node?.id) {
        throw new Error("Shopify did not return a discount node id for the automatic discount.");
    }

    return { shopifyDiscountId: node.id };
}

export async function pushDiscountToShopify({ admin, discount, currencyCode }) {
    if (!admin) throw new Error("Missing authenticated admin client — cannot sync to Shopify.");
    if (!discount?.title?.trim()) throw new Error("Discount title is required before syncing to Shopify.");

    const discountType = discount.discountType || discount.type || "ORDER_PERCENTAGE";
    const group = (discount.group || discount.discountGroup || getGroupKeyFromDiscountType(discountType)).toLowerCase();

    if (![ "order", "product" ].includes(group)) {
        throw new Error(`Sync for discount group '${group}' is not implemented yet.`);
    }

    if (discount.method === "CODE") {
        return createCodeDiscount({ admin, discount, currencyCode });
    }
    if (discount.method === "AUTOMATIC") {
        return createAutomaticDiscount({ admin, discount, currencyCode });
    }

    throw new Error(`Unsupported discount method: ${discount.method}`);
}