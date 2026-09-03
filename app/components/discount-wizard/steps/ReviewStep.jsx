// app/components/discount-wizard/steps/ReviewStep.jsx
// import { useEffect } from "react";
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
            : state.bxgyGetEffect === "AMOUNT_OFF_EACH"
                ? `${symbol}${state.bxgyGetAmount || 0} off each`
                : "free";

    const getTargetPart =
        state.bxgyGetTargetType === "COLLECTIONS"
            ? `${state.bxgyGetCollections.length} collection(s)`
            : `${state.bxgyGetProducts.length} product(s)`;

    return `${buyPart} from ${buyTargetPart} → get ${state.bxgyGetQuantity || 0} reward item(s) ${getValuePart} from ${getTargetPart}`;
}

function formatShippingSummary(state, symbol) {
    const destinationPart =
        state.shippingDestinationMode === "SPECIFIC_COUNTRIES"
            ? state.shippingDestinationCountries.length > 0
                ? state.shippingDestinationCountries.join(", ")
                : "No countries selected"
            : "All countries";

    const maxRatePart = state.maximumShippingPrice
        ? `Up to ${symbol}${state.maximumShippingPrice}`
        : "All shipping rates";

    return `Free shipping for ${destinationPart} · ${maxRatePart}`;
}

function formatAppCappedSummary(state, symbol) {
    return `${state.discountValue || 0}% off order subtotal, capped at ${symbol}${state.cappedAmount || 0}`;
}

export default function ReviewStep({ state, groupConfig, shopCurrency }) {
    const symbol = getCurrencySymbol(shopCurrency);
    const isBxgy = groupConfig.discountType === "BXGY";
    const isFreeShipping = groupConfig.discountType === "FREE_SHIPPING";
    const isAppCapped = groupConfig.discountType === "APP_CAPPED";

    // useEffect(() => {
    //     console.log(`Form final state: ${JSON.stringify(state)}`);
    // }, [ state ])

    const valueLabel = state.isPercentage
        ? `${state.discountValue || 0}% off`
        : `${symbol}${state.discountValue || 0} off`;

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
            {
                label: "Method",
                value: state.method === "CODE" ? `Code: ${state.discountCode.toUpperCase()}` : "Automatic",
            },
            { label: "BXGY rule", value: formatBxgySummary(state, symbol) },
            { label: "Usage limit", value: state.usageLimit || "Unlimited" },
            { label: "Uses per order", value: state.bxgyUsesPerOrderLimit || "Unlimited" },
            {
                label: "Schedule",
                value: state.startsAt
                    ? `${state.startsAt} → ${state.endsAt || "No end date"}`
                    : "Starts immediately",
            },
        ]
        : isFreeShipping
            ? [
                { label: "Title", value: state.title },
                { label: "Discount family", value: groupConfig.title },
                { label: "Method", value: "Automatic" },
                { label: "Shipping offer", value: formatShippingSummary(state, symbol) },
                { label: "Condition", value: minLabel },
                { label: "Usage limit", value: state.usageLimit || "Unlimited" },
                {
                    label: "Schedule",
                    value: state.startsAt
                        ? `${state.startsAt} → ${state.endsAt || "No end date"}`
                        : "Starts immediately",
                },
            ]
            : isAppCapped
                ? [
                    { label: "Title", value: state.title },
                    { label: "Discount family", value: groupConfig.title },
                    {
                        label: "Method",
                        value: state.method === "CODE" ? `Code: ${state.discountCode}` : "Automatic",
                    },
                    { label: "Discount rule", value: formatAppCappedSummary(state, symbol) },
                    {
                        label: "Schedule",
                        value: state.startsAt
                            ? `${state.startsAt} → ${state.endsAt || "No end date"}`
                            : "Starts immediately",
                    },
                ]
                : [
                    { label: "Title", value: state.title },
                    { label: "Discount family", value: groupConfig.title },
                    {
                        label: "Method",
                        value: state.method === "CODE" ? `Code: ${state.discountCode}` : "Automatic",
                    },
                    { label: "Value", value: `${valueLabel} entire order` },
                    { label: "Condition", value: minLabel },
                    { label: "Usage limit", value: state.usageLimit || "Unlimited" },
                    {
                        label: "Schedule",
                        value: state.startsAt
                            ? `${state.startsAt} → ${state.endsAt || "No end date"}`
                            : "Starts immediately",
                    },
                ];

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <dl className="space-y-3">
                    {rows.map((row) => (
                        <div
                            key={row.label}
                            className="flex items-start justify-between gap-4 text-sm"
                        >
                            <dt className="text-gray-500">{row.label}</dt>
                            <dd className="text-right font-medium text-gray-900">{row.value}</dd>
                        </div>
                    ))}
                </dl>
            </div>
        </div>
    );
}