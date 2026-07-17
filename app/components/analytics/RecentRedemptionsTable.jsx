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
            <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                Cancelled
            </span>
        );
    }

    if (usage.refunded) {
        return (
            <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                Refunded
            </span>
        );
    }

    return (
        <span className="inline-flex rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
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
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-1 border-b border-slate-200 bg-slate-50/50 px-5 py-4">
                <h3 className="text-base font-semibold text-slate-950">
                    Recent redemptions
                </h3>

                <p className="text-sm text-slate-500">
                    {mode === "DISCOUNT"
                        ? "Latest orders that applied this campaign."
                        : "Latest orders that applied one of your app-managed campaigns."}
                </p>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full">
                    <thead className="bg-slate-50/80">
                        <tr className="text-left">
                            <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Order
                            </th>

                            {mode === "OVERALL" ? (
                                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Campaign
                                </th>
                            ) : null}

                            <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Savings
                            </th>

                            <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Order total
                            </th>

                            <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Status
                            </th>

                            <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Date
                            </th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                        {recentUsages.map((usage) => {
                            const currency = usage.currency || fallbackCurrency;

                            return (
                                <tr
                                    key={usage.id}
                                    className="transition-colors hover:bg-blue-50/40"
                                >
                                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                                        {usage.orderName || "Unnamed order"}
                                    </td>

                                    {mode === "OVERALL" ? (
                                        <td
                                            className="max-w-[220px] truncate px-5 py-4 text-sm text-slate-600"
                                            title={usage.discount?.title || "Unknown discount"}
                                        >
                                            {usage.discount?.title || "Unknown discount"}
                                        </td>
                                    ) : null}

                                    <td className="px-5 py-4 text-sm font-medium text-slate-700">
                                        {formatMoney(usage.discountAmount, currency)}
                                    </td>

                                    <td className="px-5 py-4 text-sm text-slate-700">
                                        {formatMoney(usage.orderTotal, currency)}
                                    </td>

                                    <td className="px-5 py-4">
                                        <UsageStatusPill usage={usage} />
                                    </td>

                                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">
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