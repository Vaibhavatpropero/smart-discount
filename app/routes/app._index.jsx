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

function AlertBanner({ access, trialDaysRemaining }) {
  if (access.isExpired) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-semibold text-red-800">Your free trial has ended</p>
        <p className="mt-1 text-sm text-red-700">
          Discounts are now read-only in the app. Upgrade to create or edit campaigns again.
        </p>
        <Link
          to="/app/billing?reason=trial_expired"
          className="mt-3 inline-flex rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Upgrade plan
        </Link>
      </div>
    );
  }

  if (access.isTrialing) {
    return (
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm font-semibold text-blue-800">
          You are on a free trial with {trialDaysRemaining} day{trialDaysRemaining === 1 ? "" : "s"} remaining
        </p>
        <p className="mt-1 text-sm text-blue-700">
          You can run up to 3 active discounts during trial. Upgrade any time to remove limits.
        </p>
      </div>
    );
  }

  return null;
}

function StatCard({ label, value, tone = "default" }) {
  const toneClass =
    tone === "orange"
      ? "text-orange-600"
      : tone === "red"
        ? "text-red-600"
        : "text-gray-900";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function DiscountStatusPill({ status, lockedByPlan }) {
  if (lockedByPlan) {
    return (
      <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
        Locked
      </span>
    );
  }

  const map = {
    ACTIVE: "border-green-200 bg-green-50 text-green-700",
    DRAFT: "border-gray-200 bg-gray-50 text-gray-700",
    SCHEDULED: "border-blue-200 bg-blue-50 text-blue-700",
    EXPIRED: "border-gray-200 bg-gray-100 text-gray-600",
    DISABLED: "border-gray-200 bg-gray-100 text-gray-600",
    FAILED: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${map[ status ] || "border-gray-200 bg-gray-50 text-gray-700"}`}>
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
    <div className="min-h-screen bg-gray-50">
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

        <section className="rounded-2xl mt-5 border border-gray-200 bg-white shadow-sm">
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