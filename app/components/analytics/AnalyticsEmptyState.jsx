// app/components/analytics/AnalyticsEmptyState.jsx
export function AnalyticsEmptyState({ selectedDiscount }) {
    return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-14 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
                <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5m0 14h16M8 16v-4m4 4V8m4 8v-6" />
                </svg>
            </div>

            <h3 className="mt-4 text-base font-semibold text-slate-900">
                No discount activity yet
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                {selectedDiscount
                    ? `Orders that use "${selectedDiscount.title}" will appear here after checkout.`
                    : "Orders that use your app-managed discounts will appear here after checkout."}
            </p>
        </div>
    );
}