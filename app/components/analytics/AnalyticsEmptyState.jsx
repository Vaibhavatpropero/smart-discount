// app/components/analytics/AnalyticsEmptyState.jsx
export function AnalyticsEmptyState({ selectedDiscount }) {
    return (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
            <h3 className="text-sm font-semibold text-gray-900">
                No discount activity yet
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
                {selectedDiscount
                    ? `Orders that use "${selectedDiscount.title}" will appear here after checkout.`
                    : "Orders that use your app-managed discounts will appear here after checkout."}
            </p>
        </div>
    );
}