// app/components/discount-wizard/steps/ValueStep.jsx
import { getCurrencySymbol } from "../../../utils/currency.js";

function ShippingCountriesInput({ value, onChange, error }) {
    const textValue = Array.isArray(value) ? value.join(", ") : "";

    return (
        <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
                Country codes
            </span>
            <input
                type="text"
                value={textValue}
                onChange={(e) => {
                    const next = e.target.value
                        .split(",")
                        .map((item) => item.trim().toUpperCase())
                        .filter(Boolean);
                    onChange(next);
                }}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm uppercase outline-none focus:border-blue-500"
                placeholder="US, CA, GB"
            />
            {error ? (
                <span className="mt-1 block text-xs text-red-600">{error}</span>
            ) : (
                <span className="mt-1 block text-xs text-gray-500">
                    Use ISO country codes separated by commas.
                </span>
            )}
        </label>
    );
}

export default function ValueStep({ state, errors, shopCurrency, groupConfig }) {
    const symbol = getCurrencySymbol(shopCurrency);
    const isBxgy = groupConfig.discountType === "BXGY";
    const isFreeShipping = groupConfig.discountType === "FREE_SHIPPING";

    if (isBxgy) {
        return (
            <div className="space-y-6">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                        Customer buys condition
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => state.setBxgyBuyRequirementType("QUANTITY")}
                            className={`rounded-xl border p-4 text-left transition ${state.bxgyBuyRequirementType === "QUANTITY"
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-gray-200 bg-white hover:border-gray-300"
                                }`}
                        >
                            <p className="text-sm font-semibold text-gray-900">Buy quantity</p>
                            <p className="mt-1 text-xs text-gray-500">Example: buy 2 items</p>
                        </button>

                        <button
                            type="button"
                            onClick={() => state.setBxgyBuyRequirementType("AMOUNT")}
                            className={`rounded-xl border p-4 text-left transition ${state.bxgyBuyRequirementType === "AMOUNT"
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-gray-200 bg-white hover:border-gray-300"
                                }`}
                        >
                            <p className="text-sm font-semibold text-gray-900">Spend amount</p>
                            <p className="mt-1 text-xs text-gray-500">
                                Example: spend {symbol}500
                            </p>
                        </button>
                    </div>

                    {state.bxgyBuyRequirementType === "QUANTITY" ? (
                        <label className="mt-4 block">
                            <span className="mb-1 block text-sm font-medium text-gray-700">
                                Buy quantity
                            </span>
                            <input
                                type="number"
                                min="1"
                                step="1"
                                value={state.bxgyBuyQuantity}
                                onChange={(e) => state.setBxgyBuyQuantity(e.target.value)}
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                            />
                            {errors.bxgyBuyQuantity ? (
                                <span className="mt-1 block text-xs text-red-600">
                                    {errors.bxgyBuyQuantity}
                                </span>
                            ) : null}
                        </label>
                    ) : (
                        <label className="mt-4 block">
                            <span className="mb-1 block text-sm font-medium text-gray-700">
                                Buy amount
                            </span>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={state.bxgyBuyAmount}
                                    onChange={(e) => state.setBxgyBuyAmount(e.target.value)}
                                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 pr-12 text-sm outline-none focus:border-blue-500"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                                    {symbol}
                                </span>
                            </div>
                            {errors.bxgyBuyAmount ? (
                                <span className="mt-1 block text-xs text-red-600">
                                    {errors.bxgyBuyAmount}
                                </span>
                            ) : null}
                        </label>
                    )}
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                        Customer gets reward
                    </label>

                    <label className="mt-4 block">
                        <span className="mb-1 block text-sm font-medium text-gray-700">
                            Reward quantity
                        </span>
                        <input
                            type="number"
                            min="1"
                            step="1"
                            value={state.bxgyGetQuantity}
                            onChange={(e) => state.setBxgyGetQuantity(e.target.value)}
                            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                        />
                        {errors.bxgyGetQuantity ? (
                            <span className="mt-1 block text-xs text-red-600">
                                {errors.bxgyGetQuantity}
                            </span>
                        ) : null}
                    </label>

                    <div className="mt-4 grid grid-cols-3 gap-3">
                        <button
                            type="button"
                            onClick={() => state.setBxgyGetEffect("FREE")}
                            className={`rounded-xl border p-4 text-left transition ${state.bxgyGetEffect === "FREE"
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-gray-200 bg-white hover:border-gray-300"
                                }`}
                        >
                            <p className="text-sm font-semibold text-gray-900">Free</p>
                            <p className="mt-1 text-xs text-gray-500">
                                Makes the reward item free
                            </p>
                        </button>

                        <button
                            type="button"
                            onClick={() => state.setBxgyGetEffect("AMOUNT_OFF_EACH")}
                            className={`rounded-xl border p-4 text-left transition ${state.bxgyGetEffect === "AMOUNT_OFF_EACH"
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-gray-200 bg-white hover:border-gray-300"
                                }`}
                        >
                            <p className="text-sm font-semibold text-gray-900">
                                Amount off each
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                                Example: {symbol}5 off each reward item
                            </p>
                        </button>

                        <button
                            type="button"
                            onClick={() => state.setBxgyGetEffect("PERCENTAGE")}
                            className={`rounded-xl border p-4 text-left transition ${state.bxgyGetEffect === "PERCENTAGE"
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-gray-200 bg-white hover:border-gray-300"
                                }`}
                        >
                            <p className="text-sm font-semibold text-gray-900">
                                Percentage off
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                                Example: 50% off the reward item
                            </p>
                        </button>
                    </div>

                    {state.bxgyGetEffect === "PERCENTAGE" ? (
                        <label className="mt-4 block">
                            <span className="mb-1 block text-sm font-medium text-gray-700">
                                Reward percentage
                            </span>
                            <div className="relative">
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.01}
                                    value={state.bxgyGetPercentage}
                                    onChange={(e) => state.setBxgyGetPercentage(e.target.value)}
                                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 pr-12 text-sm outline-none focus:border-blue-500"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                                    %
                                </span>
                            </div>
                            {errors.bxgyGetPercentage ? (
                                <span className="mt-1 block text-xs text-red-600">
                                    {errors.bxgyGetPercentage}
                                </span>
                            ) : null}
                        </label>
                    ) : null}

                    {state.bxgyGetEffect === "AMOUNT_OFF_EACH" ? (
                        <label className="mt-4 block">
                            <span className="mb-1 block text-sm font-medium text-gray-700">
                                Amount off each item
                            </span>
                            <div className="relative">
                                <input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={state.bxgyGetAmount}
                                    onChange={(e) => state.setBxgyGetAmount(e.target.value)}
                                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 pr-12 text-sm outline-none focus:border-blue-500"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                                    {symbol}
                                </span>
                            </div>
                            {errors.bxgyGetAmount ? (
                                <span className="mt-1 block text-xs text-red-600">
                                    {errors.bxgyGetAmount}
                                </span>
                            ) : null}
                        </label>
                    ) : null}
                </div>
            </div>
        );
    }

    if (isFreeShipping) {
        return (
            <div className="space-y-5">
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    Free shipping discounts remove shipping charges instead of applying a
                    percentage or fixed amount discount.
                </div>

                <div>
                    <label className="mb-3 block text-sm font-medium text-gray-700">
                        Shipping destination
                    </label>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => state.setShippingDestinationMode("ALL")}
                            className={`rounded-xl border p-4 text-left transition ${state.shippingDestinationMode === "ALL"
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-gray-200 bg-white hover:border-gray-300"
                                }`}
                        >
                            <p className="text-sm font-semibold text-gray-900">All countries</p>
                            <p className="mt-1 text-xs text-gray-500">
                                Make eligible shipping free everywhere.
                            </p>
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                state.setShippingDestinationMode("SPECIFIC_COUNTRIES")
                            }
                            className={`rounded-xl border p-4 text-left transition ${state.shippingDestinationMode === "SPECIFIC_COUNTRIES"
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-gray-200 bg-white hover:border-gray-300"
                                }`}
                        >
                            <p className="text-sm font-semibold text-gray-900">
                                Specific countries
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                                Restrict free shipping to selected destinations.
                            </p>
                        </button>
                    </div>
                </div>

                {state.shippingDestinationMode === "SPECIFIC_COUNTRIES" ? (
                    <ShippingCountriesInput
                        value={state.shippingDestinationCountries}
                        onChange={state.setShippingDestinationCountries}
                        error={errors.shippingDestinationCountries}
                    />
                ) : null}

                <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                        Maximum shipping price
                    </span>
                    <div className="relative">
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={state.maximumShippingPrice}
                            onChange={(e) => state.setMaximumShippingPrice(e.target.value)}
                            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 pr-12 text-sm outline-none focus:border-blue-500"
                            placeholder="Optional"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                            {symbol}
                        </span>
                    </div>
                    {errors.maximumShippingPrice ? (
                        <span className="mt-1 block text-xs text-red-600">
                            {errors.maximumShippingPrice}
                        </span>
                    ) : (
                        <span className="mt-1 block text-xs text-gray-500">
                            Optional. Leave blank to make all eligible shipping rates free.
                        </span>
                    )}
                </label>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <label className="mb-1 block text-sm font-medium text-gray-700">
                Discount type
            </label>
            <div className="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => state.setIsPercentage(true)}
                    className={`rounded-xl border p-4 text-left transition ${state.isPercentage
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                >
                    <p className="text-sm font-semibold text-gray-900">Percentage off</p>
                    <p className="mt-1 text-xs text-gray-500">e.g. 10% off order</p>
                </button>
                <button
                    type="button"
                    onClick={() => state.setIsPercentage(false)}
                    className={`rounded-xl border p-4 text-left transition ${!state.isPercentage
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                >
                    <p className="text-sm font-semibold text-gray-900">Fixed amount off</p>
                    <p className="mt-1 text-xs text-gray-500">e.g. {symbol}200 off order</p>
                </button>
            </div>

            <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">
                    {state.isPercentage ? "Percentage value" : "Amount value"}
                </span>
                <div className="relative">
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={state.discountValue}
                        onChange={(e) => state.setDiscountValue(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 pr-12 text-sm outline-none focus:border-blue-500"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                        {state.isPercentage ? "%" : `${symbol}`}
                    </span>
                </div>
                {errors.discountValue ? (
                    <span className="mt-1 block text-xs text-red-600">
                        {errors.discountValue}
                    </span>
                ) : null}
            </label>
        </div>
    );
}