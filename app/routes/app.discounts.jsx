// app/routes/app.discounts.jsx
import { boundary } from "@shopify/shopify-app-react-router/server";
import { data, Link, Outlet, useFetcher, useLoaderData, useRevalidator } from "react-router";
import prisma from "../db.server";
import {
    getPlanContext,
    getDiscountAccessState,
    canUseTemplate,
} from "../utils/plan-gate.server";
import { SquarePen } from 'lucide-react';
import { DeleteDiscountButton, RouteErrorFallback } from "../components";

export const loader = async ({ request }) => {
    const { shop, access, trialDaysRemaining } = await getPlanContext(request);

    const [ discountsRaw, templatesRaw ] = await Promise.all([
        prisma.discount.findMany({
            where: { shopId: shop.id },
            orderBy: { createdAt: "desc" },
            take: 50,
            select: {
                id: true,
                shopifyDiscountId: true,
                title: true,
                discountType: true,
                method: true,
                status: true,
                startsAt: true,
                endsAt: true,
                createdOnPlan: true,
                createdAt: true,
                updatedAt: true,
                lastSyncedAt: true,
                customerSegments: true,
                shippingDestinationCountries: true,
                totalUsageCount: true,
                totalSavings: true,
                templateSlug: true,
            },
        }),
        prisma.discountTemplate.findMany({
            where: { isActive: true },
            orderBy: [ { sortOrder: "asc" }, { name: "asc" } ],
            select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                discountType: true,
                method: true,
                requiredPlan: true,
                category: true,
                isPopular: true,
            },
        }),
    ]);

    const discounts = discountsRaw
        .map((discount) => {
            const accessState = getDiscountAccessState(access, discount);
            const canEditDraft = [ "DRAFT", "FAILED" ].includes(discount.status) && !access.isExpired;

            const now = new Date();
            const hasEnded = discount.endsAt ? new Date(discount.endsAt) <= now : false;
            const canToggle =
                !accessState.lockedByPlan &&
                (
                    discount.status === "ACTIVE" ||
                    (discount.status === "SCHEDULED" && !hasEnded)
                );
            const canDelete =
                accessState.canDelete &&
                [ "DRAFT", "SCHEDULED", "DISABLED", "FAILED" ].includes(discount.status);

            return {
                ...discount,
                updatedAtLabel: new Date(discount.updatedAt).toLocaleDateString(),
                totalSavingsLabel:
                    discount.totalSavings != null ? Number(discount.totalSavings).toFixed(2) : "0.00",
                accessState,
                canEditDraft,
                canToggle,
                canDelete,
                editHref: canEditDraft ? `/app/discounts-edit?id=${discount.id}` : null,
            };
        })
        .sort((a, b) => {
            const aIsDraftGroup = [ "DRAFT", "FAILED" ].includes(a.status);
            const bIsDraftGroup = [ "DRAFT", "FAILED" ].includes(b.status);

            if (aIsDraftGroup && !bIsDraftGroup) return -1;
            if (!aIsDraftGroup && bIsDraftGroup) return 1;

            if (aIsDraftGroup && bIsDraftGroup) {
                return new Date(b.createdAt) - new Date(a.createdAt);
            }

            const aPublishedAt = a.lastSyncedAt ? new Date(a.lastSyncedAt) : new Date(a.updatedAt);
            const bPublishedAt = b.lastSyncedAt ? new Date(b.lastSyncedAt) : new Date(b.updatedAt);

            return bPublishedAt - aPublishedAt;
        });

    const templates = templatesRaw.map((template) => ({
        ...template,
        locked: !canUseTemplate(access, template),
    }));

    const createOptions = [
        {
            key: "ORDER",
            title: "Order discounts",
            description: "Percentage or fixed discounts for the full cart.",
            examples: [ "% off order", "$ off order", "Code or automatic" ],
            href: "/app/discounts-new?group=order",
            locked: false,
            badge: "Core",
        },
        {
            key: "PRODUCT",
            title: "Product / collection discounts",
            description: "Discount selected products or collections.",
            examples: [ "% off products", "$ off products", "Collection campaigns" ],
            href: "/app/discounts-new?group=product",
            locked: false,
            badge: "Core",
        },
        {
            key: "BXGY",
            title: "Buy X get Y",
            description: "Run BOGO and multi-buy promotions.",
            examples: [ "Simple BOGO", "Buy N get M", "Template-based setups" ],
            href: "/app/discounts-new?group=bxgy",
            locked: false,
            badge: "Popular",
        },
        {
            key: "FREE_SHIPPING",
            title: "Free shipping",
            description: "Create shipping incentives for checkout conversion.",
            examples: [ "Over subtotal", "Code-based", "Automatic shipping offers" ],
            href: "/app/discounts-new?group=shipping",
            locked: false,
            badge: "Core",
        },
        {
            key: "APP_FUNCTIONS",
            title: "Smart app discounts",
            description: "Bundles, capped discounts, and future Functions-based logic.",
            examples: [ "Bundles", "Volume pricing", "Capped promotions" ],
            href: "/app/discounts-new?group=app",
            locked: !access.canUseFunctionsDiscounts,
            badge: "Advance",
        },
    ];

    const stats = {
        total: discounts.length,
        active: discounts.filter((d) => d.status === "ACTIVE").length,
        locked: discounts.filter((d) => d.accessState.lockedByPlan).length,
        drafts: discounts.filter((d) => d.status === "DRAFT").length,
    };

    return data({
        shop: {
            id: shop.id,
            planName: shop.planName,
            planStatus: shop.planStatus,
        },
        access,
        trialDaysRemaining,
        stats,
        discounts,
        templates,
        createOptions,
    });
};

function PlanBadge({ access, trialDaysRemaining }) {
    if (access.isTrialing) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Trial · {trialDaysRemaining}d left
            </span>
        );
    }

    if (access.isExpired) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                Trial expired
            </span>
        );
    }

    if (access.isAdvance) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                Advance
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
            Basic
        </span>
    );
}

function StatCard({ label, value, tone = "default" }) {
    const valueClass =
        tone === "orange"
            ? "text-orange-600"
            : tone === "red"
                ? "text-red-600"
                : "text-gray-900";

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p>
            <p className={`mt-2 text-2xl font-semibold ${valueClass}`}>{value}</p>
        </div>
    );
}

function LockBadge({ children = "Locked" }) {
    return (
        <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
            {children}
        </span>
    );
}

function StatusBadge({ status }) {
    const classes = {
        ACTIVE: "border-green-200 bg-green-50 text-green-700",
        DRAFT: "border-gray-200 bg-gray-50 text-gray-700",
        SCHEDULED: "border-blue-200 bg-blue-50 text-blue-700",
        EXPIRED: "border-gray-200 bg-gray-100 text-gray-600",
        DISABLED: "border-gray-200 bg-gray-100 text-gray-600",
        FAILED: "border-red-200 bg-red-50 text-red-700",
    };

    return (
        <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${classes[ status ] || "border-gray-200 bg-gray-50 text-gray-700"
                }`}
        >
            {status}
        </span>
    );
}

function CreateOptionCard({ option, access }) {
    const disabled = access.isExpired || option.locked;

    return (
        <div
            className={`flex flex-col justify-between rounded-2xl border p-5 shadow-sm transition ${disabled
                ? "border-gray-200 bg-gray-50"
                : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md"
                }`}
        >
            <div>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold text-gray-900">{option.title}</h3>
                            {option.badge === "Advance" ? (
                                <LockBadge>Advance</LockBadge>
                            ) : (
                                <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                                    {option.badge}
                                </span>
                            )}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-gray-600">{option.description}</p>
                    </div>
                </div>

                <ul className="mt-4 space-y-2">
                    {option.examples.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
                            <span>{item}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="mt-5 ">
                {disabled ? (
                    <Link
                        to="/app/billing"
                        className="inline-flex w-full items-center justify-center rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-medium text-orange-700 hover:bg-orange-100"
                    >
                        {access.isExpired ? "Upgrade to continue" : "Unlock with Advance"}
                    </Link>
                ) : (
                    <Link
                        to={option.href}
                        className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                        Create discount
                    </Link>
                )}
            </div>
        </div>
    );
}

function TemplateCard({ template, access }) {
    const disabled = access.isExpired || template.locked;

    return (
        <div
            className={`rounded-xl border p-4 ${disabled ? "border-gray-200 bg-gray-50" : "border-gray-200 bg-white"
                }`}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900">{template.name}</h3>
                        {template.requiredPlan === "ADVANCE" && <LockBadge>Advance</LockBadge>}
                        {template.isPopular && (
                            <span className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                                Popular
                            </span>
                        )}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                        {template.description || "Ready-to-use discount setup."}
                    </p>
                </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-xs text-gray-400">
                    {template.discountType} · {template.method}
                </div>

                {disabled ? (
                    <Link
                        to="/app/billing"
                        className="text-sm font-medium text-orange-700 hover:text-orange-800"
                    >
                        Unlock
                    </Link>
                ) : (
                    <Link
                        to={`/app/discounts-new?template=${template.slug}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                        Use template
                    </Link>
                )}
            </div>
        </div>
    );
}

function EditCell({ discount }) {
    if (!discount.canEditDraft || !discount.editHref) {
        return <span className="text-sm text-gray-400">—</span>;
    }

    return (
        <Link
            to={discount.editHref}
        >
            <SquarePen className="h-5 w-5" />
        </Link>
    );
}

function DiscountToggle({ discount }) {
    const fetcher = useFetcher();
    const revalidator = useRevalidator();
    const isSubmitting = fetcher.state !== "idle";

    const checked =
        fetcher.formData?.get("nextState") === "DISABLED"
            ? false
            : fetcher.formData?.get("nextState") === "ACTIVE"
                ? true
                : discount.status === "ACTIVE";

    if (fetcher.data?.success && revalidator.state === "idle") {
        revalidator.revalidate();
    }

    return (
        <fetcher.Form method="post" action="/api/discount-toggle">
            <input type="hidden" name="discountId" value={discount.id} />
            <button
                type="submit"
                name="nextState"
                value={checked ? "DISABLED" : "ACTIVE"}
                disabled={isSubmitting}
                aria-label={checked ? "Deactivate discount" : "Activate discount"}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? "bg-green-600" : "bg-gray-300"
                    } ${isSubmitting ? "cursor-not-allowed opacity-60" : ""}`}
            >
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${checked ? "translate-x-6" : "translate-x-1"
                        }`}
                />
            </button>
        </fetcher.Form>
    );
}

function ActionCell({ discount }) {
    const showToggle =
        !discount.accessState.lockedByPlan &&
        discount.status !== "DRAFT" &&
        discount.status !== "FAILED" &&
        discount.canToggle;

    const showDelete = discount.canDelete;

    if (!showToggle && !showDelete) {
        if (discount.status === "DRAFT" || discount.status === "FAILED") {
            return <span className="text-sm text-gray-400">Not published</span>;
        }

        return <span className="text-sm text-gray-400">—</span>;
    }

    return (
        <div className="flex items-center gap-3">
            {showToggle ? <DiscountToggle discount={discount} /> : <span className="text-sm text-gray-400">—</span>}
            {showDelete ? <DeleteDiscountButton discount={discount} /> : null}
        </div>
    );
}

export default function DiscountsPage() {
    const { access, trialDaysRemaining, stats, discounts, templates, createOptions } =
        useLoaderData();

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-semibold text-gray-900">Discounts</h1>
                            <PlanBadge access={access} trialDaysRemaining={trialDaysRemaining} />
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                            Create and manage discount campaigns for your store.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <Link
                            to="/app/billing"
                            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Manage plan
                        </Link>
                        <Link
                            to={
                                access.canOpenCreateDiscount
                                    ? "/app/discounts-new?group=order"
                                    : "/app/billing?reason=trial_expired"
                            }
                            className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-white ${access.canOpenCreateDiscount ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400"
                                }`}
                        >
                            Create discount
                        </Link>
                    </div>
                </div>

                {access.isTrialing && (
                    <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                        <p className="text-sm font-semibold text-blue-800">
                            Trial active — you can run up to {access.maxActiveDiscounts} active discounts
                        </p>
                        <p className="mt-1 text-sm text-blue-700">
                            Advanced targeting, premium templates, and Shopify Functions stay locked until upgrade.
                        </p>
                    </div>
                )}

                {access.isExpired && (
                    <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
                        <p className="text-sm font-semibold text-red-800">Your trial has ended</p>
                        <p className="mt-1 text-sm text-red-700">
                            Existing discounts are read-only in the app. Upgrade to create or edit campaigns.
                        </p>
                    </div>
                )}

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
                    <StatCard label="Total discounts" value={stats.total} />
                    <StatCard label="Active discounts" value={stats.active} />
                    <StatCard label="Drafts" value={stats.drafts} />
                    <StatCard label="Locked by plan" value={stats.locked} tone="orange" />
                </div>

                <section className="mt-6">
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">Create new discount</h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Start from a discount family or unlock premium campaign types with Advance.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5 md:grid-cols-2">
                        {createOptions.map((option) => (
                            <CreateOptionCard key={option.key} option={option} access={access} />
                        ))}
                    </div>
                </section>

                {/* Templates - Not implemented */}
                {/* <section className="mt-8">
                    <div className="mb-4 flex items-end justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Templates</h2>
                            <p className="mt-1 text-sm text-gray-500">
                                Start faster with prebuilt campaign templates.
                            </p>
                        </div>
                        {!access.isAdvance && (
                            <Link
                                to="/app/billing"
                                className="text-sm font-medium text-orange-600 hover:text-orange-700"
                            >
                                Unlock premium templates
                            </Link>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        {templates.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500 lg:col-span-3">
                                No templates available yet.
                            </div>
                        ) : (
                            templates.map((template) => (
                                <TemplateCard key={template.id} template={template} access={access} />
                            ))
                        )}
                    </div>
                </section> */}

                <section className="mt-8 rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-900">All discounts</h2>
                            <p className="mt-1 text-sm text-gray-500">
                                Existing discount campaigns in your store.
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        {discounts.length === 0 ? (
                            <div className="px-5 py-10 text-center">
                                <p className="text-sm font-medium text-gray-900">No discounts created yet</p>
                                <p className="mt-1 text-sm text-gray-500">
                                    Use the options above to create your first campaign.
                                </p>
                            </div>
                        ) : (
                            <table className="min-w-full">
                                <thead>
                                    <tr className="border-b border-gray-100 text-left">
                                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                            Title
                                        </th>
                                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                            Type
                                        </th>
                                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                            Method
                                        </th>
                                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                            Status
                                        </th>
                                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                            Usage
                                        </th>
                                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                            Updated
                                        </th>
                                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                            Edit
                                        </th>
                                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {discounts.map((discount) => (
                                        <tr key={discount.id} className="border-b border-gray-100 last:border-none">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-medium text-gray-900">{discount.title}</span>
                                                    {discount.accessState.lockedByPlan && <LockBadge />}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-sm text-gray-500">{discount.discountType}</td>
                                            <td className="px-5 py-4 text-sm text-gray-500">{discount.method}</td>
                                            <td className="px-5 py-4">
                                                {discount.accessState.lockedByPlan ? (
                                                    <LockBadge />
                                                ) : (
                                                    <StatusBadge status={discount.status} />
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-sm text-gray-500">{discount.totalUsageCount}</td>
                                            <td className="px-5 py-4 text-sm text-gray-500">{discount.updatedAtLabel}</td>
                                            <td className="px-5 py-4">
                                                <EditCell discount={discount} />
                                            </td>
                                            <td className="px-5 py-4">
                                                <ActionCell discount={discount} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>

                <Outlet />
            </div>
        </div>
    );
}

export function ErrorBoundary() {
    return <RouteErrorFallback />;
}

export const headers = (headersArgs) => {
    return boundary.headers(headersArgs);
};