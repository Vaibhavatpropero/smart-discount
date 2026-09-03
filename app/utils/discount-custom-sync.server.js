// app/utils/discount-custom-sync.server.js

import {
    buildStartsAt,
    buildEndsAt,
    buildCombinesWith,
    toPositiveIntegerOrNull,
    assertGraphqlSucceeded,
    assertNoUserErrors,
} from "./discount-sync.server.js";

const APP_CODE_MUTATION = `#graphql
  mutation CreateCodeAppDiscount($codeAppDiscount: DiscountCodeAppInput!) {
    discountCodeAppCreate(codeAppDiscount: $codeAppDiscount) {
      codeAppDiscount {
        discountId
        codes(first: 1) {
          nodes {
            code
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const APP_AUTOMATIC_MUTATION = `#graphql
  mutation CreateAutomaticAppDiscount($automaticAppDiscount: DiscountAutomaticAppInput!) {
    discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
      automaticAppDiscount {
        discountId
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const GET_SHOPIFY_FUNCTIONS = `#graphql
query GetShopifyFunctions {
  shopifyFunctions(first: 50) {
    nodes {
      id
      apiType
      title
      app {
        title
      }
    }
  }
}
`;

export async function getCappedOrderFunctionId(admin) {
    if (process.env.SHOPIFY_CAPPED_ORDER_FUNCTION_ID) {
        return process.env.SHOPIFY_CAPPED_ORDER_FUNCTION_ID;
    }

    const response = await admin.graphql(GET_SHOPIFY_FUNCTIONS);
    const json = await response.json();

    assertGraphqlSucceeded(json, "shopifyFunctions");

    const nodes = json?.data?.shopifyFunctions?.nodes ?? [];
    const matches = nodes.filter((node) =>
        String(node.title || "").toLowerCase().includes("capped-order-discount"),
    );

    if (matches.length === 1 && matches[ 0 ]?.id) {
        return matches[ 0 ].id;
    }

    throw new Error(
        "Could not resolve capped-order-discount functionId. Set SHOPIFY_CAPPED_ORDER_FUNCTION_ID.",
    );
}

export async function resolveCappedOrderFunctionId(admin) {
    return getCappedOrderFunctionId(admin);
}

function buildAppCappedConfiguration(discount) {
    return {
        percent: Number(discount.discountValue),
        cappedAmount: Number(discount.cappedAmount),
    };
}

function buildFunctionMetafield(discount) {
    return {
        namespace: "$app",
        key: "function-configuration",
        type: "json",
        value: JSON.stringify(buildAppCappedConfiguration(discount)),
    };
}

async function createCodeAppCappedDiscount({ admin, discount, functionId }) {
    const code =
        discount.shopifyDiscountCode?.trim() ||
        discount.discountCode?.trim() ||
        discount.title.toUpperCase().replace(/\s+/g, "-");

    if (!code) {
        throw new Error("A discount code is required when method is CODE.");
    }

    if (!functionId) {
        throw new Error("Missing Shopify functionId for APP_CAPPED discount.");
    }

    const variables = {
        codeAppDiscount: {
            title: discount.title,
            code,
            functionId,
            discountClasses: [ "ORDER" ],
            startsAt: buildStartsAt(discount),
            endsAt: buildEndsAt(discount),
            combinesWith: buildCombinesWith(discount),
            usageLimit: toPositiveIntegerOrNull(discount.usageLimit, "Usage limit"),
            appliesOncePerCustomer: Boolean(discount.appliesOncePerCustomer),
            metafields: [ buildFunctionMetafield(discount) ],
        },
    };

    const response = await admin.graphql(APP_CODE_MUTATION, { variables });
    const json = await response.json();

    assertGraphqlSucceeded(json, "discountCodeAppCreate");
    assertNoUserErrors(
        json?.data?.discountCodeAppCreate?.userErrors,
        "discountCodeAppCreate",
    );

    const payload = json?.data?.discountCodeAppCreate?.codeAppDiscount;
    const shopifyDiscountId = payload?.discountId;
    const shopifyDiscountCode = payload?.codes?.nodes?.[ 0 ]?.code ?? code;

    if (!shopifyDiscountId) {
        throw new Error("Shopify did not return a discountId for the code app discount.");
    }

    return { shopifyDiscountId, shopifyDiscountCode };
}

async function createAutomaticAppCappedDiscount({ admin, discount, functionId }) {
    if (!functionId) {
        throw new Error("Missing Shopify functionId for APP_CAPPED discount.");
    }

    const variables = {
        automaticAppDiscount: {
            title: discount.title,
            functionId,
            discountClasses: [ "ORDER" ],
            startsAt: buildStartsAt(discount),
            endsAt: buildEndsAt(discount),
            combinesWith: buildCombinesWith(discount),
            metafields: [ buildFunctionMetafield(discount) ],
        },
    };

    const response = await admin.graphql(APP_AUTOMATIC_MUTATION, { variables });
    const json = await response.json();

    assertGraphqlSucceeded(json, "discountAutomaticAppCreate");
    assertNoUserErrors(
        json?.data?.discountAutomaticAppCreate?.userErrors,
        "discountAutomaticAppCreate",
    );

    const payload = json?.data?.discountAutomaticAppCreate?.automaticAppDiscount;
    const shopifyDiscountId = payload?.discountId;

    if (!shopifyDiscountId) {
        throw new Error("Shopify did not return a discountId for the automatic app discount.");
    }

    return { shopifyDiscountId };
}

export async function pushCustomDiscountToShopify({ admin, discount, functionId }) {
    if (!admin) {
        throw new Error("Missing authenticated admin client.");
    }

    if (!discount?.title?.trim()) {
        throw new Error("Discount title is required before syncing to Shopify.");
    }

    if (discount.discountType !== "APP_CAPPED") {
        throw new Error(`Unsupported custom discount type: ${discount.discountType}`);
    }

    if (discount.method === "CODE") {
        return createCodeAppCappedDiscount({ admin, discount, functionId });
    }

    if (discount.method === "AUTOMATIC") {
        return createAutomaticAppCappedDiscount({ admin, discount, functionId });
    }

    throw new Error(`Unsupported APP_CAPPED discount method: ${discount.method}`);
}