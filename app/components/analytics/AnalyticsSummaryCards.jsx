// app/components/analytics/AnalyticsSummaryCards.jsx
function formatMoney(value, currency) {
    return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD",
        maximumFractionDigits: 2,
    }).format(Number(value ?? 0));
}

function MetricCard({ label, value, helper, accentClass = "bg-blue-600" }) {
    return (
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_10px_24px_rgba(37,99,235,0.12)]">
            <span className={`absolute inset-x-0 top-0 h-1 ${accentClass}`} />

            <p className="text-sm font-medium text-slate-500">{label}</p>

            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                {value}
            </p>

            {helper ? (
                <p className="mt-1.5 text-xs text-slate-500">{helper}</p>
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

            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-6">
                <p className="text-slate-600">
                    <span className="font-semibold text-slate-900">
                        {summary.refundedUsageCount}
                    </span>{" "}
                    refunded redemption{summary.refundedUsageCount === 1 ? "" : "s"}
                    {" · "}
                    <span className="font-semibold text-orange-700">
                        {formatMoney(summary.refundedAmount, currency)}
                    </span>{" "}
                    refunded
                </p>

                <span className="hidden h-4 w-px bg-slate-200 sm:block" />

                <p className="text-slate-600">
                    <span className="font-semibold text-slate-900">
                        {summary.cancelledUsageCount}
                    </span>{" "}
                    cancelled redemption{summary.cancelledUsageCount === 1 ? "" : "s"}
                </p>
            </div>
        </>
    );
}