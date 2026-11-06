// app/components/discount-wizard/steps/ValueStep.jsx
import { getCurrencySymbol } from "../../../utils/currency.js";
import { ResourcePicker } from "../../index.js";

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
    const isAppCapped = groupConfig.discountType === "APP_CAPPED";
    const isFreeGift = groupConfig.discountType === "APP_FREE_GIFT";

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

    if (isAppCapped) {
        return (
            <div className="space-y-5">
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    This custom discount applies a percentage off the order subtotal, up to a maximum capped amount.
                </div>

                <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                        Percentage off
                    </span>
                    <div className="relative">
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={state.discountValue}
                            onChange={(e) => state.setDiscountValue(e.target.value)}
                            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 pr-12 text-sm outline-none focus:border-blue-500"
                            placeholder="10"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                            %
                        </span>
                    </div>
                    {errors.discountValue ? (
                        <span className="mt-1 block text-xs text-red-600">
                            {errors.discountValue}
                        </span>
                    ) : (
                        <span className="mt-1 block text-xs text-gray-500">
                            Example: 10% off the order subtotal.
                        </span>
                    )}
                </label>

                <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                        Maximum discount cap
                    </span>
                    <div className="relative">
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={state.cappedAmount}
                            onChange={(e) => state.setCappedAmount(e.target.value)}
                            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 pr-12 text-sm outline-none focus:border-blue-500"
                            placeholder="200"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                            {symbol}
                        </span>
                    </div>
                    {errors.cappedAmount ? (
                        <span className="mt-1 block text-xs text-red-600">
                            {errors.cappedAmount}
                        </span>
                    ) : (
                        <span className="mt-1 block text-xs text-gray-500">
                            Example: cap the total discount at {symbol}200.
                        </span>
                    )}
                </label>
            </div>
        );
    }

    if (isFreeGift) {
        return (
            <div className="space-y-6">
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    Configure the free gift product, quantity, and how customers unlock it.
                </div>

                {/* Gift Product Picker */}
                <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">Gift product</span>
                    <ResourcePicker
                        type="product"
                        label="Select gift product variant"
                        selected={state.giftProduct
                            ? [state.giftProduct]
                            : state.giftVariantId
                                ? [{ id: state.giftVariantId, type: "product", title: state.giftVariantId }]
                                : []}
                        onChange={(items) => {
                            state.setGiftVariantId(items[0]?.id || "");
                            state.setGiftProduct(items[0] || null);
                        }}
                        hint="Choose the product variant to give as a free gift."
                        error={errors.giftVariantId}
                        mode="single"
                    />
                </label>

                {/* Gift Quantity */}
                <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">Gift quantity</span>
                    <input
                        type="number"
                        min="1"
                        step="1"
                        value={state.giftQuantity}
                        onChange={(e) => state.setGiftQuantity(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                    />
                    {errors.giftQuantity ? (
                        <span className="mt-1 block text-xs text-red-600">{errors.giftQuantity}</span>
                    ) : null}
                </label>

                {/* Trigger Type Selector */}
                <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <span className="block text-sm font-medium text-gray-700">How the gift is unlocked</span>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { value: "ORDER_THRESHOLD", label: "Order threshold", description: "Spend or quantity minimum" },
                            { value: "PRODUCT_TRIGGER", label: "Product purchase", description: "Specific product in cart" },
                        ].map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => state.setTriggerType(opt.value)}
                                className={`rounded-xl border p-4 text-left transition ${state.triggerType === opt.value
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-gray-200 bg-white hover:border-gray-300"
                                    }`}
                            >
                                <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                                <p className="mt-1 text-xs text-gray-500">{opt.description}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Order Threshold Panel */}
                {state.triggerType === "ORDER_THRESHOLD" && (
                    <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <span className="block text-sm font-medium text-gray-700">Order threshold</span>

                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { value: "SUBTOTAL", label: "Minimum spend", description: "Order subtotal" },
                                { value: "QUANTITY", label: "Minimum quantity", description: "Total items in cart" },
                            ].map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => state.setThresholdKind(opt.value)}
                                    className={`rounded-xl border p-4 text-left transition ${state.thresholdKind === opt.value
                                        ? "border-blue-500 bg-blue-50"
                                        : "border-gray-200 bg-white hover:border-gray-300"
                                        }`}
                                >
                                    <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                                    <p className="mt-1 text-xs text-gray-500">{opt.description}</p>
                                </button>
                            ))}
                        </div>

                        {state.thresholdKind === "SUBTOTAL" && (
                            <label className="block">
                                <span className="mb-1 block text-sm font-medium text-gray-700">Minimum spend</span>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={state.thresholdMinSubtotal}
                                        onChange={(e) => state.setThresholdMinSubtotal(e.target.value)}
                                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 pr-12 text-sm outline-none focus:border-blue-500"
                                        placeholder="100"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">{symbol}</span>
                                </div>
                                {errors.thresholdMinSubtotal ? (
                                    <span className="mt-1 block text-xs text-red-600">{errors.thresholdMinSubtotal}</span>
                                ) : null}
                            </label>
                        )}

                        {state.thresholdKind === "QUANTITY" && (
                            <label className="block">
                                <span className="mb-1 block text-sm font-medium text-gray-700">Minimum quantity</span>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={state.thresholdMinQuantity}
                                    onChange={(e) => state.setThresholdMinQuantity(e.target.value)}
                                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                                    placeholder="5"
                                />
                                {errors.thresholdMinQuantity ? (
                                    <span className="mt-1 block text-xs text-red-600">{errors.thresholdMinQuantity}</span>
                                ) : null}
                            </label>
                        )}
                    </div>
                )}

                {/* Product Trigger Panel */}
                {state.triggerType === "PRODUCT_TRIGGER" && (
                    <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <span className="block text-sm font-medium text-gray-700">Trigger products</span>

                        <ResourcePicker
                            type="product"
                            label="Products that unlock the gift"
                            selected={
                                state.productTriggerProducts.length > 0
                                    ? state.productTriggerProducts
                                    : state.productTriggerProductIds.map((id) => ({ id, type: "product", title: id }))
                            }
                            onChange={(items) => {
                                state.setProductTriggerProductIds(items.map((item) => item.id));
                                state.setProductTriggerProducts(items);
                            }}
                            hint="Add one or more products. When any of these are in the cart, the gift is unlocked."
                            error={errors.productTriggerProductIds}
                        />

                        <label className="block">
                            <span className="mb-1 block text-sm font-medium text-gray-700">Minimum quantity per product (optional)</span>
                            <input
                                type="number"
                                min="1"
                                step="1"
                                value={state.productTriggerMinQuantity ?? ""}
                                onChange={(e) => state.setProductTriggerMinQuantity(e.target.value || null)}
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                                placeholder="Optional"
                            />
                            {errors.productTriggerMinQuantity ? (
                                <span className="mt-1 block text-xs text-red-600">{errors.productTriggerMinQuantity}</span>
                            ) : (
                                <span className="mt-1 block text-xs text-gray-500">
                                    Require a minimum quantity of each trigger product to unlock the gift.
                                </span>
                            )}
                        </label>
                    </div>
                )}
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