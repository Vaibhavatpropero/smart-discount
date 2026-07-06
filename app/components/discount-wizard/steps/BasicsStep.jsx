// app/components/discount-wizard/steps/BasicsStep.jsx
function Field({ label, children, hint, error }) {
    return (
        <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
            {children}
            {error ? (
                <span className="mt-1 block text-xs text-red-600">{error}</span>
            ) : hint ? (
                <span className="mt-1 block text-xs text-gray-500">{hint}</span>
            ) : null}
        </label>
    );
}

export default function BasicsStep({ state, errors = {}, groupConfig }) {
    const supportedMethods = groupConfig?.supportedMethods || [ "AUTOMATIC" ];
    const methodLocked = supportedMethods.length === 1;
    const canUseAutomatic = supportedMethods.includes("AUTOMATIC");
    const canUseCode = supportedMethods.includes("CODE");
    const isCodeMethod = state.method === "CODE";
    const lockedMethod = supportedMethods[ 0 ] || "AUTOMATIC";

    return (
        <div className="space-y-5">
            <Field label="Discount title" error={errors.title}>
                <input
                    type="text"
                    value={state.title}
                    onChange={(e) => state.setTitle(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                    placeholder="Summer offer"
                />
            </Field>

            <Field label="Internal note" hint="Optional, merchant-only.">
                <textarea
                    rows={3}
                    value={state.description}
                    onChange={(e) => state.setDescription(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                    placeholder="Optional, merchant-only."
                />
            </Field>

            <div>
                <label className="mb-3 block text-sm font-medium text-gray-700">
                    How will this discount be applied?
                </label>

                {methodLocked ? (
                    <div className="grid grid-cols-1 gap-3">
                        <div className="rounded-xl border border-blue-500 bg-blue-50 p-4">
                            <p className="text-sm font-semibold text-gray-900">
                                {lockedMethod === "CODE" ? "Discount code" : "Automatic"}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                                {lockedMethod === "CODE"
                                    ? "This discount type currently supports code-based application only."
                                    : "This discount type currently supports automatic checkout application only."}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {canUseAutomatic ? (
                            <button
                                type="button"
                                onClick={() => state.setMethod("AUTOMATIC")}
                                className={`rounded-xl border p-4 text-left transition ${state.method === "AUTOMATIC"
                                        ? "border-blue-500 bg-blue-50"
                                        : "border-gray-200 bg-white hover:border-gray-300"
                                    }`}
                            >
                                <p className="text-sm font-semibold text-gray-900">Automatic</p>
                                <p className="mt-1 text-xs text-gray-500">
                                    Applies at checkout, no code needed
                                </p>
                            </button>
                        ) : null}

                        {canUseCode ? (
                            <button
                                type="button"
                                onClick={() => state.setMethod("CODE")}
                                className={`rounded-xl border p-4 text-left transition ${state.method === "CODE"
                                        ? "border-blue-500 bg-blue-50"
                                        : "border-gray-200 bg-white hover:border-gray-300"
                                    }`}
                            >
                                <p className="text-sm font-semibold text-gray-900">Discount code</p>
                                <p className="mt-1 text-xs text-gray-500">
                                    Customer enters a code
                                </p>
                            </button>
                        ) : null}
                    </div>
                )}
            </div>

            {canUseCode && isCodeMethod ? (
                <Field label="Discount code" error={errors.discountCode}>
                    <input
                        type="text"
                        value={state.discountCode}
                        onChange={(e) => state.setDiscountCode(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm uppercase outline-none focus:border-blue-500"
                        placeholder="SAVE20"
                    />
                </Field>
            ) : null}
        </div>
    );
}