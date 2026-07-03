// app/components/discount-wizard/steps/ConditionsStep.jsx
import { ResourcePicker } from "../../index.js";

export default function ConditionsStep({ state, errors, showTargeting, groupConfig, shopCurrency }) {
    const isBxgy = groupConfig.discountType === "BXGY";

    if (isBxgy) {
        return (
            <div className="space-y-6">
                <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <span className="block text-sm font-medium text-gray-700">Customer must buy</span>

                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { value: "PRODUCTS", label: "Specific products" },
                            { value: "COLLECTIONS", label: "Specific collections" },
                        ].map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => state.setBxgyBuyTargetType(opt.value)}
                                className={`rounded-xl border p-3 text-left text-sm font-medium transition ${state.bxgyBuyTargetType === opt.value
                                    ? "border-blue-500 bg-blue-50 text-blue-700"
                                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {state.bxgyBuyTargetType === "PRODUCTS" ? (
                        <ResourcePicker
                            type="product"
                            label="Buy products"
                            selected={state.bxgyBuyProducts}
                            onChange={state.setBxgyBuyProducts}
                            hint="Customers must add these products to qualify."
                            error={errors.bxgyBuyProducts}
                        />
                    ) : null}

                    {state.bxgyBuyTargetType === "COLLECTIONS" ? (
                        <ResourcePicker
                            type="collection"
                            label="Buy collections"
                            selected={state.bxgyBuyCollections}
                            onChange={state.setBxgyBuyCollections}
                            hint="Customers must buy products from these collections to qualify."
                            error={errors.bxgyBuyCollections}
                        />
                    ) : null}
                </div>

                <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <span className="block text-sm font-medium text-gray-700">Customer gets</span>

                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { value: "PRODUCTS", label: "Specific products" },
                            { value: "COLLECTIONS", label: "Specific collections" },
                        ].map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => state.setBxgyGetTargetType(opt.value)}
                                className={`rounded-xl border p-3 text-left text-sm font-medium transition ${state.bxgyGetTargetType === opt.value
                                    ? "border-blue-500 bg-blue-50 text-blue-700"
                                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {state.bxgyGetTargetType === "PRODUCTS" ? (
                        <ResourcePicker
                            type="product"
                            label="Reward products"
                            selected={state.bxgyGetProducts}
                            onChange={state.setBxgyGetProducts}
                            hint="These products become eligible for the BXGY reward."
                            error={errors.bxgyGetProducts}
                        />
                    ) : null}

                    {state.bxgyGetTargetType === "COLLECTIONS" ? (
                        <ResourcePicker
                            type="collection"
                            label="Reward collections"
                            selected={state.bxgyGetCollections}
                            onChange={state.setBxgyGetCollections}
                            hint="Products from these collections become eligible for the BXGY reward."
                            error={errors.bxgyGetCollections}
                        />
                    ) : null}
                </div>

                <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">Usage limit</span>
                    <input
                        type="number"
                        min="1"
                        value={state.usageLimit}
                        onChange={(e) => state.setUsageLimit(e.target.value)}
                        placeholder="Unlimited"
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                    />
                    {errors.usageLimit ? <span className="mt-1 block text-xs text-red-600">{errors.usageLimit}</span> : null}
                </label>

                <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">Uses per order limit</span>
                    <input
                        type="number"
                        min="1"
                        value={state.bxgyUsesPerOrderLimit}
                        onChange={(e) => state.setBxgyUsesPerOrderLimit(e.target.value)}
                        placeholder="Unlimited"
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                    />
                    {errors.bxgyUsesPerOrderLimit ? (
                        <span className="mt-1 block text-xs text-red-600">{errors.bxgyUsesPerOrderLimit}</span>
                    ) : null}
                </label>

                <div className="space-y-3">
                    {[
                        { key: "combineWithOrderDiscounts", label: "Combine with other order discounts" },
                        { key: "combineWithProductDiscounts", label: "Combine with product discounts" },
                        { key: "combineWithShippingDiscounts", label: "Combine with shipping discounts" },
                    ].map((toggle) => (
                        <label key={toggle.key} className="flex items-center gap-3 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={state[ toggle.key ]}
                                onChange={(e) => state[ `set${toggle.key[ 0 ].toUpperCase()}${toggle.key.slice(1)}` ](e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            {toggle.label}
                        </label>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {showTargeting ? (
                <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <span className="block text-sm font-medium text-gray-700">Applies to</span>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {[
                            { value: "ALL", label: "All products" },
                            { value: "SPECIFIC_PRODUCTS", label: "Specific products" },
                            { value: "SPECIFIC_COLLECTIONS", label: "Specific collections" },
                        ].map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => state.setScopeMode(opt.value)}
                                className={`rounded-xl border p-3 text-left text-sm font-medium transition ${state.scopeMode === opt.value
                                    ? "border-blue-500 bg-blue-50 text-blue-700"
                                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {state.scopeMode === "SPECIFIC_PRODUCTS" ? (
                        <ResourcePicker
                            type="product"
                            label="Target products"
                            selected={state.targetProducts}
                            onChange={state.setTargetProducts}
                            hint="This discount applies only to the products you add here."
                            error={errors.targetProducts}
                        />
                    ) : null}

                    {state.scopeMode === "SPECIFIC_COLLECTIONS" ? (
                        <ResourcePicker
                            type="collection"
                            label="Target collections"
                            selected={state.targetCollections}
                            onChange={state.setTargetCollections}
                            hint="This discount applies to every product inside the collections you add here."
                            error={errors.targetCollections}
                        />
                    ) : null}
                </div>
            ) : null}

            <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Minimum purchase requirement</span>
                <select
                    value={state.minimumType}
                    onChange={(e) => state.setMinimumType(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                >
                    <option value="NONE">No minimum requirement</option>
                    <option value="SUBTOTAL">Minimum order amount</option>
                    <option value="QUANTITY">Minimum item quantity</option>
                </select>
            </label>

            {state.minimumType === "SUBTOTAL" ? (
                <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">Minimum subtotal</span>
                    <input
                        type="number"
                        min="0"
                        value={state.minimumSubtotal}
                        onChange={(e) => state.setMinimumSubtotal(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                    />
                    {errors.minimumSubtotal ? <span className="mt-1 block text-xs text-red-600">{errors.minimumSubtotal}</span> : null}
                </label>
            ) : null}

            {state.minimumType === "QUANTITY" ? (
                <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">Minimum quantity</span>
                    <input
                        type="number"
                        min="0"
                        value={state.minimumQuantity}
                        onChange={(e) => state.setMinimumQuantity(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                    />
                    {errors.minimumQuantity ? <span className="mt-1 block text-xs text-red-600">{errors.minimumQuantity}</span> : null}
                </label>
            ) : null}

            <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Usage limit</span>
                <input
                    type="number"
                    min="1"
                    value={state.usageLimit}
                    onChange={(e) => state.setUsageLimit(e.target.value)}
                    placeholder="Unlimited"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                />
                {errors.usageLimit ? <span className="mt-1 block text-xs text-red-600">{errors.usageLimit}</span> : null}
            </label>

            <div className="space-y-3">
                {[
                    { key: "appliesOncePerCustomer", label: "Limit to one use per customer" },
                    { key: "combineWithOrderDiscounts", label: "Combine with other order discounts" },
                    { key: "combineWithProductDiscounts", label: "Combine with product discounts" },
                    { key: "combineWithShippingDiscounts", label: "Combine with shipping discounts" },
                ].map((toggle) => (
                    <label key={toggle.key} className="flex items-center gap-3 text-sm text-gray-700">
                        <input
                            type="checkbox"
                            checked={state[ toggle.key ]}
                            onChange={(e) => state[ `set${toggle.key[ 0 ].toUpperCase()}${toggle.key.slice(1)}` ](e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        {toggle.label}
                    </label>
                ))}
            </div>
        </div>
    );
}