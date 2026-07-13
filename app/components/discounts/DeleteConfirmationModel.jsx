// app/components/discounts/DeleteConfirmationModel.jsx
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useFetcher, useRevalidator } from "react-router";

export function DeleteDiscountButton({ discount }) {
    const fetcher = useFetcher();
    const revalidator = useRevalidator();
    const [ open, setOpen ] = useState(false);
    const isSubmitting = fetcher.state !== "idle";

    if (!discount.canDelete) {
        return <span className="text-sm text-gray-400">—</span>;
    }

    if (fetcher.data?.success && revalidator.state === "idle") {
        revalidator.revalidate();
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
                <Trash2 className="h-4 w-4" />
            </button>

            {open ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-semibold text-gray-900">Delete discount?</h3>
                        <p className="mt-2 text-sm text-gray-600">
                            This will permanently delete <span className="font-medium">{discount.title}</span>.
                        </p>
                        <p className="mt-2 text-sm text-gray-500">
                            Draft or failed discounts are removed from the app only. Scheduled or disabled discounts are removed from both Shopify and the app.
                        </p>

                        {fetcher.data?.error ? (
                            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {fetcher.data.error}
                            </div>
                        ) : null}

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                disabled={isSubmitting}
                                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                No
                            </button>

                            <fetcher.Form method="post" action="/api/discount-delete">
                                <input type="hidden" name="discountId" value={discount.id} />
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                >
                                    {isSubmitting ? "Deleting..." : "Yes, delete"}
                                </button>
                            </fetcher.Form>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}