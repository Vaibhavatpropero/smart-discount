// app/components/analytics/AnalyticsSection.jsx
import { AnalyticsSelector } from "./AnalyticsSelector";
import { AnalyticsSummaryCards } from "./AnalyticsSummaryCards";
import { AnalyticsEmptyState } from "./AnalyticsEmptyState";
import { RecentRedemptionsTable } from "./RecentRedemptionsTable";

export function AnalyticsSection({ analytics, currency = "USD" }) {
    if (!analytics) return null;

    const {
        mode,
        selectedDiscount,
        selectorDiscounts,
        summary,
        recentUsages,
    } = analytics;

    const hasActivity =
        summary.usageCount > 0 ||
        summary.cancelledUsageCount > 0 ||
        recentUsages.length > 0;

    return (
        <section className="overflow-visible rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_14px_rgba(15,23,42,0.06)] sm:p-6">
            <AnalyticsSelector
                mode={mode}
                selectedDiscount={selectedDiscount}
                selectorDiscounts={selectorDiscounts}
            />

            <div className="mt-6">
                {!hasActivity ? (
                    <AnalyticsEmptyState selectedDiscount={selectedDiscount} />
                ) : (
                    <>
                        <AnalyticsSummaryCards
                            summary={summary}
                            currency={currency}
                        />

                        {recentUsages.length > 0 ? (
                            <div className="mt-6">
                                <RecentRedemptionsTable
                                    recentUsages={recentUsages}
                                    mode={mode}
                                    fallbackCurrency={currency}
                                />
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </section>
    );
}