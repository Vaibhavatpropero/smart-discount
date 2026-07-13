// app/routes/api.discount-toggle.jsx
import { data } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { getPlanContext, getDiscountAccessState } from "../utils/plan-gate.server";

const DISCOUNT_CODE_ACTIVATE_MUTATION = `#graphql
  mutation discountCodeActivate($id: ID!) {
    discountCodeActivate(id: $id) {
      codeDiscountNode {
        id
        codeDiscount {
          ... on DiscountCodeBasic {
            startsAt
            endsAt
            status
          }
          ... on DiscountCodeFreeShipping {
            startsAt
            endsAt
            status
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

const DISCOUNT_CODE_DEACTIVATE_MUTATION = `#graphql
  mutation discountCodeDeactivate($id: ID!) {
    discountCodeDeactivate(id: $id) {
      codeDiscountNode {
        id
        codeDiscount {
          ... on DiscountCodeBasic {
            startsAt
            endsAt
            status
          }
          ... on DiscountCodeFreeShipping {
            startsAt
            endsAt
            status
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

const DISCOUNT_AUTOMATIC_ACTIVATE_MUTATION = `#graphql
  mutation discountAutomaticActivate($id: ID!) {
    discountAutomaticActivate(id: $id) {
      automaticDiscountNode {
        id
        automaticDiscount {
          ... on DiscountAutomaticBasic {
            startsAt
            endsAt
            status
          }
          ... on DiscountAutomaticBxgy {
            startsAt
            endsAt
            status
          }
          ... on DiscountAutomaticFreeShipping {
            startsAt
            endsAt
            status
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

const DISCOUNT_AUTOMATIC_DEACTIVATE_MUTATION = `#graphql
  mutation discountAutomaticDeactivate($id: ID!) {
    discountAutomaticDeactivate(id: $id) {
      automaticDiscountNode {
        id
        automaticDiscount {
          ... on DiscountAutomaticBasic {
            startsAt
            endsAt
            status
          }
          ... on DiscountAutomaticBxgy {
            startsAt
            endsAt
            status
          }
          ... on DiscountAutomaticFreeShipping {
            startsAt
            endsAt
            status
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

function mapShopifyStatusToDbStatus(status) {
  switch (status) {
    case "ACTIVE":
      return "ACTIVE";
    case "SCHEDULED":
      return "SCHEDULED";
    case "EXPIRED":
      return "EXPIRED";
    default:
      return "DISABLED";
  }
}

function getDiscountPayload(result, method, actionType) {
  if (method === "CODE") {
    const root =
      actionType === "activate"
        ? result?.data?.discountCodeActivate
        : result?.data?.discountCodeDeactivate;

    return {
      userErrors: root?.userErrors || [],
      nodeId: root?.codeDiscountNode?.id || null,
      discount: root?.codeDiscountNode?.codeDiscount || null,
    };
  }

  const root =
    actionType === "activate"
      ? result?.data?.discountAutomaticActivate
      : result?.data?.discountAutomaticDeactivate;

  return {
    userErrors: root?.userErrors || [],
    nodeId: root?.automaticDiscountNode?.id || null,
    discount: root?.automaticDiscountNode?.automaticDiscount || null,
  };
}

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  const { admin } = await authenticate.admin(request);
  const { shop, access } = await getPlanContext(request);

  const formData = await request.formData();
  const discountId = formData.get("discountId");

  if (!discountId || typeof discountId !== "string") {
    return data({ error: "discountId is required" }, { status: 400 });
  }

  const discount = await prisma.discount.findUnique({
    where: { id: discountId },
    select: {
      id: true,
      shopId: true,
      method: true,
      status: true,
      startsAt: true,
      endsAt: true,
      shopifyDiscountId: true,
      createdOnPlan: true,
      discountType: true,
      customerSegments: true,
      shippingDestinationCountries: true,
    },
  });

  if (!discount || discount.shopId !== shop.id) {
    return data({ error: "Discount not found" }, { status: 404 });
  }

  if (!discount.shopifyDiscountId) {
    return data({ error: "Discount is not synced with Shopify" }, { status: 400 });
  }

  const now = new Date();
  const hasEnded = discount.endsAt && new Date(discount.endsAt) <= now;

  const canActivate = discount.status === "SCHEDULED" && !hasEnded;
  const canDeactivate = discount.status === "ACTIVE";

  if (!canActivate && !canDeactivate) {
    return data(
      { error: "Only ACTIVE discounts or non-expired SCHEDULED discounts can be toggled" },
      { status: 400 }
    );
  }

  const accessState = getDiscountAccessState(access, discount);

  if (canActivate && !accessState.canReenable) {
    return data(
      { error: "Your current plan cannot activate this discount." },
      { status: 403 }
    );
  }

  if (canDeactivate && !accessState.canDisable) {
    return data(
      { error: "Your current plan cannot deactivate this discount." },
      { status: 403 }
    );
  }

  const actionType = canActivate ? "activate" : "deactivate";

  const mutation =
    discount.method === "CODE"
      ? actionType === "activate"
        ? DISCOUNT_CODE_ACTIVATE_MUTATION
        : DISCOUNT_CODE_DEACTIVATE_MUTATION
      : actionType === "activate"
        ? DISCOUNT_AUTOMATIC_ACTIVATE_MUTATION
        : DISCOUNT_AUTOMATIC_DEACTIVATE_MUTATION;

  const response = await admin.graphql(mutation, {
    variables: { id: discount.shopifyDiscountId },
  });

  const result = await response.json();
  const payload = getDiscountPayload(result, discount.method, actionType);

  if (result?.errors?.length) {
    return data(
      { error: result.errors.map((e) => e.message).join(" | ") },
      { status: 422 }
    );
  }

  if (payload.userErrors.length) {
    return data(
      {
        error: payload.userErrors
          .map((e) => `${e.field?.join(".") || "field"}: ${e.message}`)
          .join(" | "),
      },
      { status: 422 }
    );
  }

  if (!payload.discount) {
    return data({ error: "Shopify did not return updated discount data" }, { status: 422 });
  }

  const nextStatus = mapShopifyStatusToDbStatus(payload.discount.status);

  const updated = await prisma.$transaction(async (tx) => {
    const updatedDiscount = await tx.discount.update({
      where: { id: discount.id },
      data: {
        status: nextStatus,
        startsAt: payload.discount.startsAt
          ? new Date(payload.discount.startsAt)
          : discount.startsAt,
        endsAt: payload.discount.endsAt
          ? new Date(payload.discount.endsAt)
          : null,
        lastSyncedAt: new Date(),
        lastError: null,
      },
      select: {
        id: true,
        status: true,
        startsAt: true,
        endsAt: true,
        lastSyncedAt: true,
      },
    });

    await tx.discountEvent.create({
      data: {
        discountId: discount.id,
        shopId: shop.id,
        eventType: actionType === "activate" ? "ACTIVATED" : "DEACTIVATED",
        description:
          actionType === "activate"
            ? "Discount activated via discounts table toggle"
            : "Discount deactivated via discounts table toggle",
        metadata: {
          shopifyDiscountId: discount.shopifyDiscountId,
          shopifyStatus: payload.discount.status,
          startsAt: payload.discount.startsAt,
          endsAt: payload.discount.endsAt,
        },
      },
    });

    return updatedDiscount;
  });

  return data({
    success: true,
    discount: {
      id: updated.id,
      status: updated.status,
      startsAt: updated.startsAt,
      endsAt: updated.endsAt,
      lastSyncedAt: updated.lastSyncedAt,
    },
  });
};