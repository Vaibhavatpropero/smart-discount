// app/components/discount-wizard/WizardShell.jsx
const STEPS = [
    { key: "basics", label: "Basics" },
    { key: "value", label: "Value" },
    { key: "conditions", label: "Conditions" },
    { key: "schedule", label: "Schedule" },
    { key: "review", label: "Review" },
];

function progressState(index, currentIndex) {
    if (index < currentIndex) return "complete";
    if (index === currentIndex) return "current";
    return "upcoming";
}

export function StepProgress({ currentIndex, onStepClick, canGoToStep }) {
    return (
        <div className="overflow-x-auto">
            <div className="flex min-w-max items-center gap-3">
                {STEPS.map((step, index) => {
                    const state = progressState(index, currentIndex);
                    const clickable = canGoToStep(index);

                    return (
                        <div key={step.key} className="flex items-center gap-3">
                            <button
                                type="button"
                                disabled={!clickable}
                                onClick={() => clickable && onStepClick(index)}
                                className="flex items-center gap-3 disabled:cursor-not-allowed"
                            >
                                <div
                                    className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold ${state === "complete"
                                            ? "border-blue-600 bg-blue-600 text-white"
                                            : state === "current"
                                                ? "border-blue-300 bg-blue-50 text-blue-700"
                                                : "border-gray-200 bg-white text-gray-400"
                                        }`}
                                >
                                    {state === "complete" ? "✓" : index + 1}
                                </div>
                                <span className={`text-xs font-semibold uppercase tracking-wide ${state === "current" ? "text-blue-700" : state === "complete" ? "text-gray-700" : "text-gray-400"
                                    }`}>
                                    {step.label}
                                </span>
                            </button>
                            {index < STEPS.length - 1 ? <div className="h-px w-10 bg-gray-200" /> : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function StickyActionBar({ children }) {
    return (
        <div className="sticky bottom-0 left-0 right-0 border-t border-gray-200 bg-white/95 px-4 py-4 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">{children}</div>
        </div>
    );
}

export { STEPS };