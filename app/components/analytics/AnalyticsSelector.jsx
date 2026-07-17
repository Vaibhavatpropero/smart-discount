// app/components/analytics/AnalyticsSelector.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";

const STATUS_CLASS = {
    ACTIVE: "bg-green-50 text-green-700",
    SCHEDULED: "bg-blue-50 text-blue-700",
    DRAFT: "bg-gray-100 text-gray-700",
    EXPIRED: "bg-gray-100 text-gray-600",
    DISABLED: "bg-gray-100 text-gray-600",
    FAILED: "bg-red-50 text-red-700",
};

function getStatusClass(status) {
    return STATUS_CLASS[ status ] || "bg-gray-100 text-gray-700";
}

export function AnalyticsSelector({
    mode,
    selectedDiscount,
    selectorDiscounts,
}) {
    const [ searchParams, setSearchParams ] = useSearchParams();
    const selectorRef = useRef(null);
    const searchInputRef = useRef(null);

    const [ isOpen, setIsOpen ] = useState(false);
    const [ searchQuery, setSearchQuery ] = useState("");

    const filteredDiscounts = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();

        if (!normalizedQuery) {
            return selectorDiscounts;
        }

        return selectorDiscounts.filter((discount) => {
            const searchableValue = [
                discount.title,
                discount.discountType,
                discount.method,
                discount.status,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchableValue.includes(normalizedQuery);
        });
    }, [ searchQuery, selectorDiscounts ]);

    useEffect(() => {
        if (!isOpen) return undefined;

        function handlePointerDown(event) {
            if (!selectorRef.current?.contains(event.target)) {
                setIsOpen(false);
                setSearchQuery("");
            }
        }

        function handleKeyDown(event) {
            if (event.key === "Escape") {
                setIsOpen(false);
                setSearchQuery("");
            }
        }

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);

        requestAnimationFrame(() => {
            searchInputRef.current?.focus();
        });

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [ isOpen ]);

    function closePopover() {
        setIsOpen(false);
        setSearchQuery("");
    }

    function selectDiscount(discountId) {
        const nextParams = new URLSearchParams(searchParams);

        if (discountId) {
            nextParams.set("discountId", discountId);
        } else {
            nextParams.delete("discountId");
        }

        closePopover();
        setSearchParams(nextParams);
    }

    const triggerLabel = selectedDiscount
        ? selectedDiscount.title
        : "All discounts";

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                    {mode === "DISCOUNT" ? "Discount performance" : "Store performance"}
                </p>

                <h2 className="mt-1 text-lg font-semibold text-gray-900">
                    {selectedDiscount
                        ? selectedDiscount.title
                        : "Discount analytics"}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                    {selectedDiscount
                        ? "Track usage, savings, refunds, and recent redemptions for this campaign."
                        : "See how all app-managed discounts are performing in your store."}
                </p>
            </div>

            <div ref={selectorRef} className="relative sm:w-80">
                <span className="mb-1.5 block text-xs font-medium text-gray-600">
                    View analytics for
                </span>

                <button
                    type="button"
                    onClick={() => setIsOpen((current) => !current)}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 outline-none transition hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                    <span className="min-w-0 truncate font-medium">
                        {triggerLabel}
                    </span>

                    <svg
                        className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""
                            }`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                    >
                        <path
                            fillRule="evenodd"
                            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                            clipRule="evenodd"
                        />
                    </svg>
                </button>

                {isOpen ? (
                    <div className="absolute right-0 z-30 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                        <div className="border-b border-gray-100 p-3">
                            <label htmlFor="analytics-discount-search" className="sr-only">
                                Search discounts
                            </label>

                            <input
                                ref={searchInputRef}
                                id="analytics-discount-search"
                                type="search"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search discounts..."
                                className="min-h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        <div
                            role="listbox"
                            aria-label="Discount analytics options"
                            className="max-h-72 overflow-y-auto p-1.5"
                        >
                            <button
                                type="button"
                                role="option"
                                aria-selected={!selectedDiscount}
                                onClick={() => selectDiscount("")}
                                className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${!selectedDiscount
                                    ? "bg-blue-50 text-blue-800"
                                    : "text-gray-700 hover:bg-gray-50"
                                    }`}
                            >
                                <span
                                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${!selectedDiscount
                                        ? "border-blue-600 bg-blue-600 text-white"
                                        : "border-gray-300"
                                        }`}
                                    aria-hidden="true"
                                >
                                    {!selectedDiscount ? "✓" : null}
                                </span>

                                <span className="min-w-0 truncate font-medium">
                                    All discounts
                                </span>
                            </button>

                            {filteredDiscounts.length > 0 ? (
                                filteredDiscounts.map((discount) => {
                                    const isSelected = selectedDiscount?.id === discount.id;

                                    return (
                                        <button
                                            key={discount.id}
                                            type="button"
                                            role="option"
                                            aria-selected={isSelected}
                                            onClick={() => selectDiscount(discount.id)}
                                            className={`flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${isSelected
                                                ? "bg-blue-50"
                                                : "hover:bg-gray-50"
                                                }`}
                                        >
                                            <span
                                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-xs ${isSelected
                                                    ? "border-blue-600 bg-blue-600 text-white"
                                                    : "border-gray-300 text-transparent"
                                                    }`}
                                                aria-hidden="true"
                                            >
                                                ✓
                                            </span>

                                            <span className="min-w-0 flex-1">
                                                <span
                                                    className={`block truncate text-sm font-medium ${isSelected ? "text-blue-800" : "text-gray-900"
                                                        }`}
                                                    title={discount.title}
                                                >
                                                    {discount.title}
                                                </span>

                                                <span className="mt-0.5 flex items-center gap-2">
                                                    <span className="truncate text-xs text-gray-500">
                                                        {discount.discountType}
                                                    </span>

                                                    <span
                                                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${getStatusClass(
                                                            discount.status
                                                        )}`}
                                                    >
                                                        {discount.status}
                                                    </span>
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="px-3 py-8 text-center">
                                    <p className="text-sm font-medium text-gray-900">
                                        No discounts found
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500">
                                        Try searching by campaign name, type, or status.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}