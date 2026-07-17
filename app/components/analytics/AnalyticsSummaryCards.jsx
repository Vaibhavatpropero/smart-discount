// app/components/analytics/AnalyticsSummaryCards.jsx
function formatMoney(value, currency) {
    return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD",
        maximumFractionDigits: 2,
    }).format(Number(value ?? 0));
}

function MetricCard({ label, value, helper }) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
                {value}
            </p>
            {helper ? (
                <p className="mt-1 text-xs text-gray-500">{helper}</p>
            ) : null}
        </div>
    );
}

export function AnalyticsSummaryCards({ summary, currency }) {
    return (
        <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    label="Valid redemptions"
                    value={summary.usageCount}
                    helper="Cancelled orders excluded"
                />

                <MetricCard
                    label="Discount given"
                    value={formatMoney(summary.totalSavings, currency)}
                    helper="Across valid redemptions"
                />

                <MetricCard
                    label="Average discount"
                    value={formatMoney(summary.averageSavings, currency)}
                    helper="Per valid redemption"
                />

                <MetricCard
                    label="Revenue influenced"
                    value={formatMoney(summary.attributedRevenue, currency)}
                    helper="Order totals using a discount"
                />
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-6">
                <p className="text-gray-600">
                    <span className="font-medium text-gray-900">
                        {summary.refundedUsageCount}
                    </span>{" "}
                    refunded redemption{summary.refundedUsageCount === 1 ? "" : "s"}
                    {" · "}
                    <span className="font-medium text-gray-900">
                        {formatMoney(summary.refundedAmount, currency)}
                    </span>{" "}
                    refunded
                </p>

                <p className="text-gray-600">
                    <span className="font-medium text-gray-900">
                        {summary.cancelledUsageCount}
                    </span>{" "}
                    cancelled redemption{summary.cancelledUsageCount === 1 ? "" : "s"}
                </p>
            </div>
        </>
    );
}