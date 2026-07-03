// app/components/discount-wizard/steps/BasicsStep.jsx
function Field({ label, children, hint, error }) {
    return (
        <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
            {children}
            {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-gray-500">{hint}</span> : null}
        </label>
    );
}

export default function BasicsStep({ state, errors }) {
    return (
        <div className="space-y-5">
            <Field label="Discount title" error={errors.title}>
                <input
                    type="text"
                    value={state.title}
                    onChange={(e) => state.setTitle(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                />
            </Field>

            <Field label="Internal note" hint="Optional, merchant-only">
                <textarea
                    rows="2"
                    value={state.description}
                    onChange={(e) => state.setDescription(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                />
            </Field>

            <Field label="How will this discount be applied?">
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { value: "AUTOMATIC", label: "Automatic", hint: "Applies at checkout, no code needed" },
                        { value: "CODE", label: "Discount code", hint: "Customer enters a code" },
                    ].map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => state.setMethod(option.value)}
                            className={`rounded-xl border p-4 text-left transition ${state.method === option.value ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"
                                }`}
                        >
                            <p className="text-sm font-semibold text-gray-900">{option.label}</p>
                            <p className="mt-1 text-xs text-gray-500">{option.hint}</p>
                        </button>
                    ))}
                </div>
            </Field>

            {state.method === "CODE" ? (
                <Field label="Discount code" error={errors.discountCode}>
                    <input
                        type="text"
                        value={state.discountCode}
                        onChange={(e) => state.setDiscountCode(e.target.value.toUpperCase())}
                        placeholder="SAVE20"
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm uppercase outline-none focus:border-blue-500"
                    />
                </Field>
            ) : null}
        </div>
    );
}