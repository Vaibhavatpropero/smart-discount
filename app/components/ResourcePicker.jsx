// app/components/ResourcePicker.jsx
import { useEffect, useMemo, useRef, useState } from "react";

function useDebouncedValue(value, delayMs) {
    const [ debounced, setDebounced ] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(timer);
    }, [ value, delayMs ]);

    return debounced;
}

function trimText(value, max = 26) {
    if (!value) return "";
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function getItemMeta(item) {
    if (item.type === "product") {
        return [ item.skuPreview, item.priceLabel ].filter(Boolean).join(" · ") || item.handle || "Product";
    }
    return item.countLabel || item.handle || "Collection";
}

function getItemStatus(item) {
    if (item.status) return item.status;
    return item.type === "collection" ? "Active" : "Unknown";
}

function getItemDescription(item) {
    if (item.description) return item.description;
    if (item.type === "collection") {
        return "Collection details are limited in search results right now.";
    }
    return "Product description is not available in search results right now.";
}

function ResultRow({ item, selected, onToggle }) {
    return (
        <button
            type="button"
            onClick={() => onToggle(item)}
            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selected
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50"
                }`}
        >
            <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                {item.image ? (
                    <img src={item.image} alt="" className="h-full w-full object-cover" />
                ) : null}
            </div>

            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{item.title}</p>
                <p className="truncate text-xs text-gray-500">{getItemMeta(item)}</p>
            </div>

            <span
                className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${selected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
                    }`}
            >
                {selected ? "Selected" : "Select"}
            </span>
        </button>
    );
}

function TargetPreviewCard({ item, onRemove, onClose, mobile = false }) {
    return (
        <div className={`rounded-2xl border border-gray-200 bg-white shadow-xl ${mobile ? "w-full max-w-md" : "w-[340px]"}`}>
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4">
                <div className="w-full">
                    <div className="flex justify-between items-center">
                        <p className="text-sm font-semibold text-gray-900">{item.title || "Untitled"}</p>
                        <p className={`px-3 py-1 text-sm font-semibold text-gray-900 ${getItemStatus(item) === "ACTIVE" ? "bg-green-300" : "bg-gray-100"} rounded`}>{getItemStatus(item)}</p>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                        {item.type === "product" ? "Product" : "Collection"}
                    </p>
                </div>

                {mobile ? (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close preview"
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                        ✕
                    </button>
                ) : null}
            </div>

            <div className="space-y-4 p-4">
                <div className="overflow-hidden rounded-xl bg-gray-100">
                    {item.image ? (
                        <img
                            src={item.image}
                            alt=""
                            className="h-44 w-full object-cover"
                        />
                    ) : (
                        <div className="flex h-44 items-center justify-center text-sm text-gray-400">
                            No image
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-3">
                    {item.type === "product" ? (
                        <>
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">SKU</p>
                                <p className="mt-1 text-sm text-gray-700">{item.skuPreview || "—"}</p>
                            </div>

                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Price</p>
                                <p className="mt-1 text-sm text-gray-700">{item.priceLabel || "—"}</p>
                            </div>
                        </>
                    ) : (
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Items</p>
                            <p className="mt-1 text-sm text-gray-700">{item.countLabel || "—"}</p>
                        </div>
                    )}

                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Description</p>
                        <p className="mt-1 text-sm text-gray-700">
                            {getItemDescription(item)}
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100"
                >
                    Remove
                </button>
            </div>
        </div>
    );
}

function TargetPreviewMobileModal({ item, onRemove, onClose }) {
    if (!item) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 sm:hidden">
            <TargetPreviewCard
                item={item}
                onRemove={onRemove}
                onClose={onClose}
                mobile
            />
        </div>
    );
}

function SelectedTargetTile({ item, onRemove }) {
    const [ desktopOpen, setDesktopOpen ] = useState(false);
    const [ mobileOpen, setMobileOpen ] = useState(false);

    return (
        <>
            <div
                className="relative hidden sm:block"
                onMouseEnter={() => setDesktopOpen(true)}
                onMouseLeave={() => setDesktopOpen(false)}
            >
                <div className="flex min-h-[88px] items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 transition hover:border-blue-300 hover:shadow-sm">
                    <button
                        type="button"
                        onClick={() => setDesktopOpen((value) => !value)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100">
                            {item.image ? (
                                <img src={item.image} alt="" className="h-full w-full object-cover" />
                            ) : null}
                        </div>

                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900">
                                {trimText(item.title, 24)}
                            </p>
                            <p className="truncate text-xs text-gray-500">{getItemMeta(item)}</p>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => onRemove(item.id)}
                        aria-label={`Remove ${item.title}`}
                        className="flex-shrink-0 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    >
                        Remove
                    </button>
                </div>

                {desktopOpen ? (
                    <div className="absolute left-0 top-full z-40 mt-2">
                        <TargetPreviewCard item={item} onRemove={onRemove} />
                    </div>
                ) : null}
            </div>

            <div className="sm:hidden">
                <div className="flex min-h-[88px] items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3">
                    <button
                        type="button"
                        onClick={() => setMobileOpen(true)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100">
                            {item.image ? (
                                <img src={item.image} alt="" className="h-full w-full object-cover" />
                            ) : null}
                        </div>

                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900">
                                {trimText(item.title, 22)}
                            </p>
                            <p className="truncate text-xs text-gray-500">{getItemMeta(item)}</p>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => onRemove(item.id)}
                        aria-label={`Remove ${item.title}`}
                        className="flex-shrink-0 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-500"
                    >
                        Remove
                    </button>
                </div>

                <TargetPreviewMobileModal
                    item={mobileOpen ? item : null}
                    onRemove={onRemove}
                    onClose={() => setMobileOpen(false)}
                />
            </div>
        </>
    );
}

function SelectedTargetGrid({ items, onRemove }) {
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {items.map((item) => (
                <SelectedTargetTile key={item.id} item={item} onRemove={onRemove} />
            ))}
        </div>
    );
}

function SearchModal({ type, excludeIds, onAddMany, onClose }) {
    const [ term, setTerm ] = useState("");
    const [ results, setResults ] = useState([]);
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState(null);
    const [ stagedItems, setStagedItems ] = useState([]);
    const debouncedTerm = useDebouncedValue(term, 350);
    const requestRef = useRef(0);

    const stagedIds = useMemo(
        () => new Set(stagedItems.map((item) => item.id)),
        [ stagedItems ]
    );

    useEffect(() => {
        if (!debouncedTerm.trim()) {
            setResults([]);
            setError(null);
            return;
        }

        const requestId = ++requestRef.current;
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
            type,
            q: debouncedTerm.trim(),
            exclude: Array.from(excludeIds).join(","),
        });

        fetch(`/api/resource-search?${params.toString()}`)
            .then((res) => {
                if (!res.ok) throw new Error("Search failed");
                return res.json();
            })
            .then((json) => {
                if (requestRef.current === requestId) {
                    setResults(json.results || []);
                }
            })
            .catch(() => {
                if (requestRef.current === requestId) {
                    setError("Could not search right now. Try again.");
                }
            })
            .finally(() => {
                if (requestRef.current === requestId) {
                    setLoading(false);
                }
            });
    }, [ debouncedTerm, type, excludeIds ]);

    function handleToggle(item) {
        setStagedItems((current) => {
            const exists = current.some((entry) => entry.id === item.id);
            if (exists) {
                return current.filter((entry) => entry.id !== item.id);
            }
            return [ ...current, item ];
        });
    }

    function handleClear() {
        setStagedItems([]);
    }

    function handleAdd() {
        if (stagedItems.length === 0) return;
        onAddMany(stagedItems);
        setStagedItems([]);
        setTerm("");
        setResults([]);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                    <div>
                        <h3 className="text-base font-semibold text-gray-900">
                            {type === "product" ? "Add products" : "Add collections"}
                        </h3>
                        {stagedItems.length > 0 ? (
                            <p className="mt-1 text-xs text-blue-600">
                                {stagedItems.length} selected
                            </p>
                        ) : null}
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                        ✕
                    </button>
                </div>

                <div className="border-b border-gray-100 px-5 py-3">
                    <input
                        autoFocus
                        type="text"
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        placeholder={
                            type === "product"
                                ? "Search by title, handle, or SKU"
                                : "Search by title or handle"
                        }
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                    />
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
                    {loading ? (
                        <p className="py-6 text-center text-sm text-gray-400">Searching…</p>
                    ) : error ? (
                        <p className="py-6 text-center text-sm text-red-600">{error}</p>
                    ) : !term.trim() ? (
                        <p className="py-6 text-center text-sm text-gray-400">
                            Start typing to search your store.
                        </p>
                    ) : results.length === 0 ? (
                        <p className="py-6 text-center text-sm text-gray-400">No matches found.</p>
                    ) : (
                        results.map((item) => (
                            <ResultRow
                                key={item.id}
                                item={item}
                                selected={stagedIds.has(item.id)}
                                onToggle={handleToggle}
                            />
                        ))
                    )}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-4">
                    <button
                        type="button"
                        onClick={handleClear}
                        disabled={stagedItems.length === 0}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        Clear
                    </button>

                    <button
                        type="button"
                        onClick={handleAdd}
                        disabled={stagedItems.length === 0}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                        Add {stagedItems.length > 0 ? `(${stagedItems.length})` : ""}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function ResourcePicker({
    type,
    label,
    selected,
    onChange,
    hint,
    error,
}) {
    const [ modalOpen, setModalOpen ] = useState(false);

    const excludeIds = useMemo(
        () => new Set(selected.map((item) => item.id)),
        [ selected ]
    );

    function handleAddMany(items) {
        onChange([ ...selected, ...items ]);
        setModalOpen(false);
    }

    function handleRemove(id) {
        onChange(selected.filter((item) => item.id !== id));
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="block text-sm font-medium text-gray-700">{label}</span>
                <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                    + Add {type === "product" ? "products" : "collections"}
                </button>
            </div>

            {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
            {error ? <p className="text-xs text-red-600">{error}</p> : null}

            {selected.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
                    No {type === "product" ? "products" : "collections"} selected yet.
                </div>
            ) : (
                <SelectedTargetGrid items={selected} onRemove={handleRemove} />
            )}

            {modalOpen ? (
                <SearchModal
                    type={type}
                    excludeIds={excludeIds}
                    onAddMany={handleAddMany}
                    onClose={() => setModalOpen(false)}
                />
            ) : null}
        </div>
    );
}