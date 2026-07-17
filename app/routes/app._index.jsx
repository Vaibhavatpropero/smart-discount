// app/routes/app._index.jsx
import { boundary } from "@shopify/shopify-app-react-router/server";
import { data, Link, useLoaderData } from "react-router";
import prisma from "../db.server";
import { getPlanContext, getDiscountAccessState } from "../utils/plan-gate.server";
import { getAnalyticsDashboard } from "../utils/discount-analytics.server";
import { AnalyticsSection } from "../components/analytics";
import { RouteErrorFallback } from "../components";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (process.env.NODE_ENV !== "production" && url.searchParams.get("testError") === "1") {
    throw data({ error: "Test loader error from app._index.jsx" }, { status: 500 });
  }

  const { shop, access, trialDaysRemaining } = await getPlanContext(request);

  const selectedDiscountId = url.searchParams.get("discountId");

  const [
    totalDiscounts,
    activeDiscounts,
    recentDiscountsRaw,
    analytics,
  ] = await Promise.all([
    prisma.discount.count({
      where: { shopId: shop.id },
    }),
    prisma.discount.count({
      where: {
        shopId: shop.id,
        status: "ACTIVE",
      },
    }),
    prisma.discount.findMany({
      where: { shopId: shop.id },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        title: true,
        discountType: true,
        status: true,
        createdOnPlan: true,
        updatedAt: true,
        customerSegments: true,
        shippingDestinationCountries: true,
      },
    }),
    getAnalyticsDashboard({
      shopId: shop.id,
      selectedDiscountId: selectedDiscountId || null,
      recentLimit: 10,
    }),
  ]);

  const recentDiscounts = recentDiscountsRaw.map((discount) => {
    const accessState = getDiscountAccessState(access, discount);

    return {
      id: discount.id,
      title: discount.title,
      discountType: discount.discountType,
      status: discount.status,
      createdOnPlan: discount.createdOnPlan,
      updatedAt: discount.updatedAt,
      lockedByPlan: accessState.lockedByPlan,
      accessState,
    };
  });

  const lockedDiscounts = recentDiscounts.filter((d) => d.lockedByPlan).length;

  return data({
    shop: {
      id: shop.id,
      shopDomain: shop.shopDomain,
      planName: shop.planName,
      planStatus: shop.planStatus,
      currency: shop.currency || "USD",
    },
    access,
    trialDaysRemaining,
    stats: {
      totalDiscounts,
      activeDiscounts,
      lockedDiscounts,
    },
    recentDiscounts,
    analytics,
  });
};

function StatusBadge({ access, trialDaysRemaining }) {
  if (access.isTrialing) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-600 ring-4 ring-blue-100/70" />
        Trial · {trialDaysRemaining}d remaining
      </span>
    );
  }

  if (access.isExpired) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 ring-4 ring-red-100/70" />
        Trial expired
      </span>
    );
  }

  if (access.isAdvance) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500 ring-4 ring-orange-100/70" />
        Advance plan
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
      <span className="h-1.5 w-1.5 rounded-full bg-blue-600 ring-4 ring-blue-100/70" />
      Basic plan
    </span>
  );
}

function AlertBanner({ access, trialDaysRemaining }) {
  if (access.isExpired) {
    return (
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 shadow-[0_2px_8px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold text-red-900">
            Your free trial has ended
          </p>

          <p className="mt-1 text-sm leading-6 text-red-700">
            Your discounts are now read-only. Upgrade to resume creating and editing campaigns.
          </p>
        </div>

        <Link
          to="/app/billing?reason=trial_expired"
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          Upgrade plan
        </Link>
      </div>
    );
  }

  if (access.isTrialing) {
    return (
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-[0_2px_8px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold text-blue-900">
            Your free trial has {trialDaysRemaining} day
            {trialDaysRemaining === 1 ? "" : "s"} remaining
          </p>

          <p className="mt-1 text-sm leading-6 text-blue-700">
            You can run up to 3 active discounts during your trial. Upgrade anytime to remove plan limits.
          </p>
        </div>

        <Link
          to="/app/billing"
          className="inline-flex shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          View plans
        </Link>
      </div>
    );
  }

  return null;
}

function StatCard({ label, value, tone = "default" }) {
  const valueClass =
    tone === "orange"
      ? "text-orange-700"
      : tone === "red"
        ? "text-red-700"
        : "text-slate-950";

  const accentClass =
    tone === "orange"
      ? "bg-orange-500"
      : tone === "red"
        ? "bg-red-500"
        : "bg-blue-600";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_10px_24px_rgba(37,99,235,0.12)]">
      <span className={`absolute inset-x-0 top-0 h-1 ${accentClass}`} />

      <p className="text-sm font-medium text-slate-500">{label}</p>

      <p className={`mt-3 text-3xl font-semibold tracking-tight ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

function DiscountStatusPill({ status, lockedByPlan }) {
  if (lockedByPlan) {
    return (
      <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
        Locked by plan
      </span>
    );
  }

  const map = {
    ACTIVE: "border-green-200 bg-green-50 text-green-700",
    DRAFT: "border-slate-200 bg-slate-50 text-slate-600",
    SCHEDULED: "border-blue-200 bg-blue-50 text-blue-700",
    EXPIRED: "border-slate-200 bg-slate-100 text-slate-600",
    DISABLED: "border-slate-200 bg-slate-100 text-slate-600",
    FAILED: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${map[ status ] || "border-slate-200 bg-slate-50 text-slate-600"
        }`}
    >
      {status}
    </span>
  );
}

export default function Index() {
  const {
    shop,
    access,
    trialDaysRemaining,
    stats,
    recentDiscounts,
    analytics,
  } = useLoaderData();

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-gray-900">Home</h1>
              <StatusBadge access={access} trialDaysRemaining={trialDaysRemaining} />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Monitor your discount activity.
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
              to={access.canOpenCreateDiscount ? "/app/discounts" : "/app/billing?reason=trial_expired"}
              className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-white ${access.canOpenCreateDiscount
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-400"
                }`}
            >
              Create discount
            </Link>
          </div>
        </div>

        <div className="mt-6">
          <AlertBanner access={access} trialDaysRemaining={trialDaysRemaining} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Total discounts" value={stats.totalDiscounts} />
          <StatCard label="Active discounts" value={stats.activeDiscounts} />
          <StatCard label="Locked by plan" value={stats.lockedDiscounts} tone="orange" />
        </div>

        {/* Analytics: overall by default, per-discount via ?discountId= */}
        <div className="mt-6">
          <AnalyticsSection
            analytics={analytics}
            currency={shop.currency}
          />
        </div>

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Recent discounts</h2>
              <p className="mt-1 text-sm text-gray-500">Latest campaigns in your store.</p>
            </div>
            <Link
              to="/app/discounts"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View all
            </Link>
          </div>

          <div className="overflow-x-auto">
            {recentDiscounts.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-medium text-gray-900">No discounts yet</p>
                <p className="mt-1 text-sm text-gray-500">
                  Create your first campaign to start driving conversions.
                </p>
              </div>
            ) : (
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Title</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Type</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Status</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDiscounts.map((discount) => (
                    <tr key={discount.id} className="border-b border-gray-100 last:border-none">
                      <td className="px-5 py-4 text-sm font-medium text-gray-900">{discount.title}</td>
                      <td className="px-5 py-4 text-sm text-gray-500">{discount.discountType}</td>
                      <td className="px-5 py-4">
                        <DiscountStatusPill
                          status={discount.status}
                          lockedByPlan={discount.lockedByPlan}
                        />
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-500">
                        {new Date(discount.updatedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
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