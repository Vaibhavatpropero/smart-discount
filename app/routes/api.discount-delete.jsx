// app/routes/api.discount-delete.jsx
import { data } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { getPlanContext, getDiscountAccessState } from "../utils/plan-gate.server";

const DISCOUNT_CODE_DELETE_MUTATION = `#graphql
mutation discountCodeDelete($id: ID!) {
  discountCodeDelete(id: $id) {
    deletedCodeDiscountId
    userErrors {
      field
      message
    }
  }
}
`;

const DISCOUNT_AUTOMATIC_DELETE_MUTATION = `#graphql
mutation discountAutomaticDelete($id: ID!) {
  discountAutomaticDelete(id: $id) {
    deletedAutomaticDiscountId
    userErrors {
      field
      message
    }
  }
}
`;

export const action = async ({ request }) => {
    if (request.method !== "POST") {
        return data({ error: "Method not allowed" }, { status: 405 });
    }

    const { admin } = await authenticate.admin(request);
    const { shop, access } = await getPlanContext(request);
    const formData = await request.formData();
    const discountId = String(formData.get("discountId") || "").trim();

    if (!discountId) {
        return data({ error: "discountId is required" }, { status: 400 });
    }

    const discount = await prisma.discount.findFirst({
        where: { id: discountId, shopId: shop.id },
        select: {
            id: true,
            shopId: true,
            title: true,
            method: true,
            status: true,
            shopifyDiscountId: true,
            createdOnPlan: true,
            discountType: true,
            customerSegments: true,
            shippingDestinationCountries: true,
        },
    });

    if (!discount) {
        return data({ error: "Discount not found" }, { status: 404 });
    }

    const accessState = getDiscountAccessState(access, discount);
    if (!accessState.canDelete) {
        return data({ error: "Your current plan cannot delete this discount." }, { status: 403 });
    }

    if (![ "DRAFT", "SCHEDULED", "DISABLED", "FAILED" ].includes(discount.status)) {
        return data(
            { error: "Only DRAFT, SCHEDULED, DISABLED and FAILED discounts can be deleted." },
            { status: 400 }
        );
    }

    if (discount.shopifyDiscountId) {
        const mutation =
            discount.method === "CODE"
                ? DISCOUNT_CODE_DELETE_MUTATION
                : DISCOUNT_AUTOMATIC_DELETE_MUTATION;

        const response = await admin.graphql(mutation, {
            variables: { id: discount.shopifyDiscountId },
        });

        const result = await response.json();

        if (result?.errors?.length) {
            return data(
                { error: result.errors.map((e) => e.message).join(", ") },
                { status: 422 }
            );
        }

        const root =
            discount.method === "CODE"
                ? result?.data?.discountCodeDelete
                : result?.data?.discountAutomaticDelete;

        if (root?.userErrors?.length) {
            return data(
                {
                    error: root.userErrors
                        .map((e) => (e.field?.length ? `${e.field.join(".")}: ${e.message}` : e.message))
                        .join(", "),
                },
                { status: 422 }
            );
        }
    }

    await prisma.$transaction(async (tx) => {
        await tx.discountEvent.create({
            data: {
                discountId: discount.id,
                shopId: shop.id,
                eventType: "DELETED",
                description: discount.shopifyDiscountId
                    ? "Discount deleted from app and Shopify"
                    : "Discount deleted from app database only",
                metadata: {
                    shopifyDiscountId: discount.shopifyDiscountId,
                    status: discount.status,
                },
            },
        });

        await tx.discount.delete({
            where: { id: discount.id },
        });
    });

    return data({ success: true, deletedId: discount.id });
};