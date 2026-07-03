// app/routes/app.discounts-new.jsx
import { boundary } from "@shopify/shopify-app-react-router/server";
import { data, Form, Link, redirect, useLoaderData, useNavigation } from "react-router";
import prisma from "../db.server.js";
import {
    assertCanCreateDiscount,
    canUseDiscountType,
    canUseTemplate,
    requireCreateDiscountAccess,
} from "../utils/plan-gate.server.js";
import { RouteErrorFallback } from "../components/index.js";

const GROUP_CONFIG = {
    order: {
        discountType: "ORDER_PERCENTAGE",
        method: "AUTOMATIC",
        title: "Order discount",
        description: "Percentage or fixed discounts for the full cart.",
    },
    product: {
        discountType: "PRODUCT_PERCENTAGE",
        method: "AUTOMATIC",
        title: "Product / collection discount",
        description: "Discount selected products or collections.",
    },
    bxgy: {
        discountType: "BXGY",
        method: "AUTOMATIC",
        title: "Buy X Get Y",
        description: "Create a BOGO or multi-buy promotion.",
    },
    shipping: {
        discountType: "FREE_SHIPPING",
        method: "AUTOMATIC",
        title: "Free shipping discount",
        description: "Create a shipping incentive for checkout conversion.",
    },
    app: {
        discountType: "APP_VOLUME",
        method: "AUTOMATIC",
        title: "Smart app discount",
        description: "Advanced Functions-based logic for premium plans.",
    },
};

function getGroupConfig(group) {
    return GROUP_CONFIG[ group ] || GROUP_CONFIG.order;
}

function normalizeJson(value) {
    if (!value) return null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function buildDraftPayload({ shopId, formData, access, template }) {
    const group = formData.get("group") || "order";
    const config = getGroupConfig(group);
    const discountType = formData.get("discountType") || config.discountType;
    const method = formData.get("method") || config.method;
    const title = String(formData.get("title") || `${config.title} draft`).trim();
    const description = String(formData.get("description") || "").trim() || null;
    const isPercentage = formData.get("isPercentage") !== "false";
    const discountValueRaw = formData.get("discountValue");
    const discountValue =
        discountValueRaw === "" || discountValueRaw == null ? null : Number(discountValueRaw);
    const appliesToAll = formData.get("appliesToAll") !== "false";
    const targetProducts = normalizeJson(formData.get("targetProducts"));
    const targetCollections = normalizeJson(formData.get("targetCollections"));
    const minimumType = formData.get("minimumType") || "NONE";
    const minimumSubtotalRaw = formData.get("minimumSubtotal");
    const minimumQuantityRaw = formData.get("minimumQuantity");
    const startsAtRaw = formData.get("startsAt");
    const endsAtRaw = formData.get("endsAt");
    const templateSlug = template?.slug || String(formData.get("templateSlug") || "") || null;

    return {
        shopId,
        title,
        description,
        discountType,
        method,
        status: "DRAFT",
        discountValue: Number.isFinite(discountValue) ? discountValue : null,
        isPercentage,
        appliesToAll,
        targetProducts,
        targetCollections,
        minimumType,
        minimumSubtotal: minimumSubtotalRaw ? Number(minimumSubtotalRaw) : null,
        minimumQuantity: minimumQuantityRaw ? Number(minimumQuantityRaw) : null,
        startsAt: startsAtRaw ? new Date(startsAtRaw) : new Date(),
        endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
        templateSlug,
        createdOnPlan: access.planName,
    };
}

export const loader = async ({ request }) => {
    const { shop, access, trialDaysRemaining } = await requireCreateDiscountAccess(request);
    const url = new URL(request.url);
    const group = String(url.searchParams.get("group") || "order").toLowerCase();
    const templateSlug = url.searchParams.get("template");
    const groupConfig = getGroupConfig(group);

    let template = null;
    if (templateSlug) {
        template = await prisma.discountTemplate.findUnique({ where: { slug: templateSlug } });
        if (!template || !canUseTemplate(access, template)) {
            throw redirect("/app/billing?reason=template_locked", { target: "_parent" });
        }
    }

    if (!canUseDiscountType(access, groupConfig.discountType)) {
        throw redirect("/app/billing?reason=plan_locked", { target: "_parent" });
    }

    const activeDiscountCount = await prisma.discount.count({
        where: { shopId: shop.id, status: { in: [ "ACTIVE", "SCHEDULED" ] } },
    });

    await assertCanCreateDiscount({
        request,
        activeDiscountCount,
        discountType: groupConfig.discountType,
        template,
    });

    return data({
        shop: { id: shop.id, planName: shop.planName, planStatus: shop.planStatus },
        access,
        trialDaysRemaining,
        group,
        groupConfig,
        template,
    });
};

export const action = async ({ request }) => {
    const context = await requireCreateDiscountAccess(request);
    const { shop, access } = context;
    const formData = await request.formData();
    const group = String(formData.get("group") || "order").toLowerCase();
    const templateSlug = String(formData.get("templateSlug") || "") || null;
    const groupConfig = getGroupConfig(group);

    const template = templateSlug
        ? await prisma.discountTemplate.findUnique({ where: { slug: templateSlug } })
        : null;

    const activeDiscountCount = await prisma.discount.count({
        where: { shopId: shop.id, status: { in: [ "ACTIVE", "SCHEDULED" ] } },
    });

    await assertCanCreateDiscount({
        request,
        activeDiscountCount,
        discountType: groupConfig.discountType,
        template,
    });

    const payload = buildDraftPayload({ shopId: shop.id, formData, access, template });

    if (!canUseDiscountType(access, payload.discountType)) {
        throw data({ error: "This discount type requires a higher plan." }, { status: 403 });
    }

    const discount = await prisma.discount.create({ data: payload });

    if (payload.discountType === "BXGY") {
        await prisma.bxgyConfig.create({ data: { discountId: discount.id } });
    }

    return redirect(`/app/discounts?draft=${discount.id}`);
};

function PlanBadge({ access, trialDaysRemaining }) {
    if (access.isTrialing) {
        return (
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                Trial · {trialDaysRemaining}d left
            </span>
        );
    }

    if (access.isExpired) {
        return (
            <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                Trial expired
            </span>
        );
    }

    if (access.isAdvance) {
        return (
            <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
                Advance
            </span>
        );
    }

    return (
        <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            Basic
        </span>
    );
}

function Field({ label, children, hint }) {
    return (
        <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
            {children}
            {hint ? <span className="mt-1 block text-xs text-gray-500">{hint}</span> : null}
        </label>
    );
}

export default function DiscountCreatePage() {
    const { access, trialDaysRemaining, groupConfig, template } = useLoaderData();
    const navigation = useNavigation();
    const busy = navigation.state !== "idle";

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-semibold text-gray-900">Create discount</h1>
                            <PlanBadge access={access} trialDaysRemaining={trialDaysRemaining} />
                        </div>
                        <p className="mt-2 text-sm text-gray-500">{groupConfig.description}</p>
                    </div>

                    <Link
                        to="/app/discounts"
                        className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Back
                    </Link>
                </div>

                {template ? (
                    <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                        Template prefilled: <span className="font-medium">{template.name}</span>
                    </div>
                ) : null}

                {access.isTrialing ? (
                    <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                        Trial active — you can create up to {access.maxActiveDiscounts} active discounts.
                    </div>
                ) : null}

                {access.isExpired ? (
                    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                        Your trial has expired. Upgrade to create discounts.
                    </div>
                ) : null}

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <Form method="post" className="space-y-5">
                        <input
                            type="hidden"
                            name="group"
                            value={
                                groupConfig.discountType === "BXGY"
                                    ? "bxgy"
                                    : groupConfig.discountType === "FREE_SHIPPING"
                                        ? "shipping"
                                        : groupConfig.discountType === "APP_VOLUME"
                                            ? "app"
                                            : "order"
                            }
                        />
                        <input type="hidden" name="templateSlug" value={template?.slug || ""} />
                        <input type="hidden" name="discountType" value={groupConfig.discountType} />
                        <input type="hidden" name="method" value={groupConfig.method} />

                        <Field label="Title">
                            <input
                                name="title"
                                defaultValue={template?.name ? `${template.name} draft` : `${groupConfig.title} draft`}
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                                required
                            />
                        </Field>

                        <Field label="Description">
                            <textarea
                                name="description"
                                rows="3"
                                defaultValue={template?.description || ""}
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                            />
                        </Field>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <Field label="Discount value" hint="Use number only.">
                                <input
                                    name="discountValue"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                                />
                            </Field>

                            <Field label="Value is percentage">
                                <select
                                    name="isPercentage"
                                    defaultValue={
                                        groupConfig.discountType === "ORDER_PERCENTAGE" ||
                                            groupConfig.discountType === "PRODUCT_PERCENTAGE"
                                            ? "true"
                                            : "false"
                                    }
                                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                                >
                                    <option value="true">Yes</option>
                                    <option value="false">No</option>
                                </select>
                            </Field>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <Field label="Minimum type">
                                <select
                                    name="minimumType"
                                    defaultValue="NONE"
                                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                                >
                                    <option value="NONE">None</option>
                                    <option value="SUBTOTAL">Subtotal</option>
                                    <option value="QUANTITY">Quantity</option>
                                </select>
                            </Field>

                            <Field label="Applies to all">
                                <select
                                    name="appliesToAll"
                                    defaultValue="true"
                                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                                >
                                    <option value="true">All products / order</option>
                                    <option value="false">Specific products / collections</option>
                                </select>
                            </Field>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <Field label="Starts at">
                                <input
                                    name="startsAt"
                                    type="datetime-local"
                                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                                />
                            </Field>

                            <Field label="Ends at">
                                <input
                                    name="endsAt"
                                    type="datetime-local"
                                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                                />
                            </Field>
                        </div>

                        <Field label="Target products JSON" hint="Optional. Array of product GIDs.">
                            <textarea
                                name="targetProducts"
                                rows="2"
                                placeholder='["gid://shopify/Product/1"]'
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                            />
                        </Field>

                        <Field label="Target collections JSON" hint="Optional. Array of collection GIDs.">
                            <textarea
                                name="targetCollections"
                                rows="2"
                                placeholder='["gid://shopify/Collection/1"]'
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                            />
                        </Field>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <Link
                                to="/app/discounts"
                                className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                disabled={busy || access.isExpired}
                                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                            >
                                {busy ? "Saving..." : "Save draft"}
                            </button>
                        </div>
                    </Form>
                </div>
            </div>
        </div>
    );
}

export function ErrorBoundary() {
    return <RouteErrorFallback />;
}

export const headers = (headersArgs) => boundary.headers(headersArgs);