// app/components/analytics/RecentRedemptionsTable.jsx
function formatMoney(value, currency) {
    return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD",
        maximumFractionDigits: 2,
    }).format(Number(value ?? 0));
}

function formatDate(value) {
    if (!value) return "—";

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

function UsageStatusPill({ usage }) {
    if (usage.cancelled) {
        return (
            <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                Cancelled
            </span>
        );
    }

    if (usage.refunded) {
        return (
            <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
                Refunded
            </span>
        );
    }

    return (
        <span className="inline-flex rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
            Completed
        </span>
    );
}

export function RecentRedemptionsTable({
    recentUsages,
    mode,
    fallbackCurrency,
}) {
    return (
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
                <h3 className="text-sm font-semibold text-gray-900">
                    Recent redemptions
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                    {mode === "DISCOUNT"
                        ? "Latest orders that applied this discount."
                        : "Latest orders that applied one of your app-managed discounts."}
                </p>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full">
                    <thead>
                        <tr className="border-b border-gray-100 text-left">
                            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                Order
                            </th>

                            {mode === "OVERALL" ? (
                                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                    Discount
                                </th>
                            ) : null}

                            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                Savings
                            </th>

                            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                Order total
                            </th>

                            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                Status
                            </th>

                            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                Date
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {recentUsages.map((usage) => {
                            const currency = usage.currency || fallbackCurrency;

                            return (
                                <tr
                                    key={usage.id}
                                    className="border-b border-gray-100 last:border-none"
                                >
                                    <td className="px-5 py-4 text-sm font-medium text-gray-900">
                                        {usage.orderName || "Unnamed order"}
                                    </td>

                                    {mode === "OVERALL" ? (
                                        <td className="px-5 py-4 text-sm text-gray-600">
                                            {usage.discount?.title || "Unknown discount"}
                                        </td>
                                    ) : null}

                                    <td className="px-5 py-4 text-sm text-gray-700">
                                        {formatMoney(usage.discountAmount, currency)}
                                    </td>

                                    <td className="px-5 py-4 text-sm text-gray-700">
                                        {formatMoney(usage.orderTotal, currency)}
                                    </td>

                                    <td className="px-5 py-4">
                                        <UsageStatusPill usage={usage} />
                                    </td>

                                    <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-500">
                                        {formatDate(usage.createdAt)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}