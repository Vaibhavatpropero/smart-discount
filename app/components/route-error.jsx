// app/components/route-error.jsx
import { isRouteErrorResponse, useRouteError } from "react-router";

function DevErrorDetails({ error }) {
    const isDev = process.env.NODE_ENV !== "production";
    if (!isDev) return null;

    const stack =
        error instanceof Error
            ? error.stack
            : typeof error?.data === "object"
                ? JSON.stringify(error.data, null, 2)
                : null;

    return (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-800">Debug details</p>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-red-700">
                {stack || "No stack trace available"}
            </pre>
        </div>
    );
}

export function RouteErrorFallback() {
    const error = useRouteError();
    const isDev = process.env.NODE_ENV !== "production";

    let title = "Something went wrong";
    let message = "This page could not be loaded.";
    let status = 500;

    if (isRouteErrorResponse(error)) {
        status = error.status;
        title =
            error.status === 404
                ? "Page not found"
                : error.status === 403
                    ? "Access denied"
                    : error.statusText || "Request failed";

        message =
            typeof error.data === "string"
                ? error.data
                : error.data?.error || "The request could not be completed.";
    } else if (error instanceof Error) {
        message = isDev
            ? error.message
            : "An unexpected error occurred while loading this page.";
    }

    return (
        <div className="min-h-[60vh] flex items-center justify-center bg-gray-50 px-4 py-10">
            <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 border border-red-100">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                </div>

                <div className="mt-5">
                    <p className="text-sm font-medium text-red-600">Error {status}</p>
                    <h1 className="mt-1 text-2xl font-semibold text-gray-900">{title}</h1>
                    <p className="mt-3 text-sm leading-6 text-gray-600">{message}</p>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                        Reload page
                    </button>

                    <a
                        href="/app"
                        className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Back to home
                    </a>
                </div>

                <DevErrorDetails error={error} />
            </div>
        </div>
    );
}