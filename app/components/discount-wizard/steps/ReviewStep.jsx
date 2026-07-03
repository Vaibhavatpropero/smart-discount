// app/components/discount-wizard/steps/ReviewStep.jsx
import { getCurrencySymbol } from "../../../utils/currency.js";

function formatBxgySummary(state, symbol) {
    const buyPart =
        state.bxgyBuyRequirementType === "AMOUNT"
            ? `Spend ${symbol}${state.bxgyBuyAmount || 0}`
            : `Buy ${state.bxgyBuyQuantity || 0} item(s)`;

    const buyTargetPart =
        state.bxgyBuyTargetType === "COLLECTIONS"
            ? `${state.bxgyBuyCollections.length} collection(s)`
            : `${state.bxgyBuyProducts.length} product(s)`;

    const getValuePart =
        state.bxgyGetEffect === "PERCENTAGE"
            ? `${state.bxgyGetPercentage || 0}% off`
            : "free";

    const getTargetPart =
        state.bxgyGetTargetType === "COLLECTIONS"
            ? `${state.bxgyGetCollections.length} collection(s)`
            : `${state.bxgyGetProducts.length} product(s)`;

    return `${buyPart} from ${buyTargetPart} → get ${state.bxgyGetQuantity || 0} reward item(s) ${getValuePart} from ${getTargetPart}`;
}

export default function ReviewStep({ state, groupConfig, busy, shopCurrency }) {
    const symbol = getCurrencySymbol(shopCurrency);
    const isBxgy = groupConfig.discountType === "BXGY";

    const valueLabel = state.isPercentage ? `${state.discountValue || 0}% off` : `${symbol}${state.discountValue || 0} off`;
    const minLabel =
        state.minimumType === "SUBTOTAL"
            ? `Min. order ${symbol}${state.minimumSubtotal || 0}`
            : state.minimumType === "QUANTITY"
                ? `Min. ${state.minimumQuantity || 0} items`
                : "No minimum requirement";

    const rows = isBxgy
        ? [
            { label: "Title", value: state.title },
            { label: "Discount family", value: groupConfig.title },
            { label: "Method", value: "Automatic" },
            { label: "BXGY rule", value: formatBxgySummary(state, symbol) },
            { label: "Usage limit", value: state.usageLimit || "Unlimited" },
            { label: "Uses per order", value: state.bxgyUsesPerOrderLimit || "Unlimited" },
            { label: "Schedule", value: state.startsAt ? `${state.startsAt} → ${state.endsAt || "No end date"}` : "Starts immediately" },
        ]
        : [
            { label: "Title", value: state.title },
            { label: "Discount family", value: groupConfig.title },
            { label: "Method", value: state.method === "CODE" ? `Code: ${state.discountCode}` : "Automatic" },
            { label: "Value", value: `${valueLabel} entire order` },
            { label: "Condition", value: minLabel },
            { label: "Usage limit", value: state.usageLimit || "Unlimited" },
            { label: "Schedule", value: state.startsAt ? `${state.startsAt} → ${state.endsAt || "No end date"}` : "Starts immediately" },
        ];

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <dl className="space-y-3">
                    {rows.map((row) => (
                        <div key={row.label} className="flex items-start justify-between gap-4 text-sm">
                            <dt className="text-gray-500">{row.label}</dt>
                            <dd className="text-right font-medium text-gray-900">{row.value}</dd>
                        </div>
                    ))}
                </dl>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                    type="submit"
                    name="intent"
                    value="draft"
                    disabled={busy}
                    className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    Save as draft
                </button>
                <button
                    type="submit"
                    name="intent"
                    value="publish"
                    disabled={busy}
                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                    Publish discount
                </button>
            </div>
        </div>
    );
}