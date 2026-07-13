// app/routes/app.billing.jsx
import { data } from "react-router";
import { useLoaderData, useActionData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server.js";
import prisma from "../db.server.js";
import { logger } from "../utils/logger.server.js";
import {
    createAppSubscription,
    savePendingSubscriptionChange,
    getTrialDaysRemaining,
} from "../utils/billing.server.js";
import { PLANS } from "../utils/plans.js";
import { useEffect } from "react";

// ─── Loader ───────────────────────────────────────────────────────────────────
export async function loader({ request }) {
    const { session, admin } = await authenticate.admin(request);

    logger.info("app.billing.loader", "Loading billing page", {
        shop: session.shop,
    });

    let shop = await prisma.shop.findUnique({
        where: { shopDomain: session.shop },
        include: { subscription: true },
    });

    if (!shop) {
        logger.warn("app.billing.loader", "Shop missing during billing load, attempting self-heal", {
            shop: session.shop,
        });

        shop = await prisma.shop.findUnique({
            where: { shopDomain: session.shop },
            include: { subscription: true },
        });
    }

    if (!shop) {
        logger.error("app.billing.loader", "Shop still not found after self-heal", {
            shop: session.shop,
        });

        return data({
            planName: "FREE",
            planStatus: "TRIALING",
            trialDaysRemaining: 14,
            subscription: null,
            isAdvanceLocked: process.env.NODE_ENV === "production",
        });
    }

    const isAdvanceLocked = process.env.NODE_ENV === "production";

    return data({
        planName: shop.planName,
        planStatus: shop.planStatus,
        trialDaysRemaining: getTrialDaysRemaining(shop.trialEndsAt),
        subscription: shop.subscription
            ? {
                price: shop.subscription.price?.toFixed(2) ?? null,
                currency: shop.subscription.currency,
                billingPeriod: shop.subscription.billingPeriod,
                activatedAt: shop.subscription.activatedAt,
                nextBillingDate: shop.subscription.activatedAt
                    ? new Date(
                        new Date(shop.subscription.activatedAt).getTime() +
                        30 * 24 * 60 * 60 * 1000
                    ).toISOString()
                    : null,
            }
            : null,
        isAdvanceLocked,
    });
}

// ─── Action ───────────────────────────────────────────────────────────────────
// NOTE: Returns confirmationUrl as JSON — NOT a redirect().
// useFetcher does not follow redirects, so we handle navigation on the client.
export async function action({ request }) {
    const { session, admin } = await authenticate.admin(request);

    const formData = await request.formData();
    const intent = formData.get("intent");
    const targetPlan = formData.get("plan");

    logger.info("app.billing.action", "Billing action triggered", {
        shop: session.shop,
        intent,
        targetPlan,
    });

    if (intent !== "upgrade" && intent !== "downgrade") {
        logger.warn("app.billing.action", "Invalid intent received", {
            shop: session.shop,
            intent,
        });
        return data({ error: "Invalid intent" }, { status: 400 });
    }

    if (![ "BASIC", "ADVANCE" ].includes(targetPlan)) {
        logger.warn("app.billing.action", "Invalid plan received", {
            shop: session.shop,
            targetPlan,
        });
        return data({ error: "Invalid plan" }, { status: 400 });
    }

    if (targetPlan === "ADVANCE" && process.env.NODE_ENV === "production") {
        logger.warn("app.billing.action", "Blocked ADVANCE plan purchase in production", {
            shop: session.shop,
            targetPlan,
        });
        return data({ error: "Advance plan is not available yet." }, { status: 403 });
    }

    const shop = await prisma.shop.findUnique({
        where: { shopDomain: session.shop },
    });

    if (!shop) {
        logger.error("app.billing.action", "Shop not found in DB", {
            shop: session.shop,
        });
        return data({ error: "Shop not found" }, { status: 404 });
    }

    const appHandleOrApiKey = process.env.APP_CLIENT_ID || process.env.SHOPIFY_API_KEY;
    const returnUrl = `https://${session.shop}/admin/apps/${appHandleOrApiKey}/app/billing?activated=1`;

    try {
        const isTest = process.env.NODE_ENV !== "production";

        logger.info("app.billing.action", "Calling createAppSubscription", {
            shop: session.shop,
            targetPlan,
            returnUrl,
            isTest,
        });

        const { shopifySubscriptionId, confirmationUrl, shopifyStatus } =
            await createAppSubscription({
                admin,
                planName: targetPlan,
                returnUrl,
                isTest,
            });

        logger.info("app.billing.action", "Shopify subscription created, saving pending change", {
            shop: session.shop,
            targetPlan,
            shopifySubscriptionId,
            shopifyStatus,
            confirmationUrl,
        });

        await savePendingSubscriptionChange({
            shopId: shop.id,
            shop,
            targetPlanName: targetPlan,
            shopifySubscriptionId,
            confirmationUrl,
        });

        logger.info("app.billing.action", "Returning confirmationUrl to client", {
            shop: session.shop,
            confirmationUrl,
        });

        // Return URL as JSON — PlanCard will do window.location.href on the client
        return data({ confirmationUrl });
    } catch (err) {
        logger.error("app.billing.action", "Subscription creation failed", {
            shop: session.shop,
            targetPlan,
            message: err?.message,
            stack: err?.stack,
        });

        return data(
            { error: err.message ?? "Something went wrong. Please try again." },
            { status: 500 }
        );
    }
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function CheckIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-blue-500 shrink-0 mt-0.5"
            aria-hidden="true"
        >
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
function StatusBadge({ planStatus, trialDaysRemaining }) {
    if (planStatus === "ACTIVE") {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Active
            </span>
        );
    }
    if (planStatus === "TRIALING") {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Trial — {trialDaysRemaining}d left
            </span>
        );
    }
    if (planStatus === "EXPIRED") {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Expired
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
            {planStatus}
        </span>
    );
}

// ─── TrialBanner ──────────────────────────────────────────────────────────────
function TrialBanner({ daysRemaining }) {
    const isUrgent = daysRemaining <= 3;
    return (
        <div
            className={`rounded-xl p-4 mb-6 flex items-start gap-3 ${isUrgent
                ? "bg-orange-50 border border-orange-200"
                : "bg-blue-50 border border-blue-200"
                }`}
        >
            <div
                className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${isUrgent ? "bg-orange-100" : "bg-blue-100"
                    }`}
                aria-hidden="true"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={isUrgent ? "#f97316" : "#3b82f6"}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                </svg>
            </div>
            <div>
                <p className={`text-sm font-semibold ${isUrgent ? "text-orange-800" : "text-blue-800"}`}>
                    {isUrgent
                        ? `Trial ends in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} — upgrade to keep access`
                        : `You have ${daysRemaining} days left on your free trial`}
                </p>
                <p className={`text-sm mt-0.5 ${isUrgent ? "text-orange-600" : "text-blue-600"}`}>
                    {isUrgent
                        ? "After the trial ends your account will revert to the Free plan."
                        : "Explore all Advance features for free. Upgrade any time to keep them."}
                </p>
            </div>
        </div>
    );
}

// ─── ExpiredBanner ────────────────────────────────────────────────────────────
function ExpiredBanner() {
    return (
        <div className="rounded-xl p-4 mb-6 flex items-start gap-3 bg-red-50 border border-red-200">
            <div
                className="shrink-0 w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center"
                aria-hidden="true"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            </div>
            <div>
                <p className="text-sm font-semibold text-red-800">Your trial has ended</p>
                <p className="text-sm mt-0.5 text-red-600">
                    Discount campaigns are paused. Upgrade to a paid plan to reactivate them.
                </p>
            </div>
        </div>
    );
}

// ─── BillingInfo ──────────────────────────────────────────────────────────────
function BillingInfo({ subscription }) {
    if (!subscription?.activatedAt) return null;

    const fmt = (iso) =>
        new Date(iso).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });

    const items = [
        { label: "Current charge", value: `$${subscription.price}/mo` },
        { label: "Billing cycle", value: "Monthly" },
        { label: "Activated", value: fmt(subscription.activatedAt) },
        {
            label: "Next billing",
            value: subscription.nextBillingDate ? fmt(subscription.nextBillingDate) : "–",
        },
    ];

    return (
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Billing details</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {items.map(({ label, value }) => (
                    <div key={label} className="flex flex-col gap-1">
                        <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                            {label}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── PlanCard ─────────────────────────────────────────────────────────────────
function PlanCard({ planKey, currentPlanName, currentPlanStatus, isAdvanceLocked }) {
    const plan = PLANS[ planKey ];
    const fetcher = useFetcher();
    const isLoading = fetcher.state !== "idle";

    const isCurrent = planKey === currentPlanName;
    const isFree = planKey === "FREE";
    const isAdvance = planKey === "ADVANCE";
    const isComingSoon = isAdvance && isAdvanceLocked && !isCurrent;

    const isUpgrade =
        (currentPlanName === "FREE" && planKey !== "FREE") ||
        (currentPlanName === "BASIC" && planKey === "ADVANCE");
    const isDowngrade = currentPlanName === "ADVANCE" && planKey === "BASIC";

    let ctaLabel = "Get started";
    if (isCurrent) ctaLabel = currentPlanStatus === "TRIALING" ? "Current (Trial)" : "Current plan";
    else if (isUpgrade) ctaLabel = "Upgrade";
    else if (isDowngrade) ctaLabel = "Downgrade";

    const intent = isDowngrade ? "downgrade" : "upgrade";

    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data?.confirmationUrl) {
            window.open(fetcher.data.confirmationUrl, "_top");
        }
    }, [ fetcher.state, fetcher.data ]);

    return (
        <div
            className={[
                "relative flex flex-col h-full rounded-2xl border bg-white p-6 transition-shadow duration-200",
                isCurrent
                    ? "border-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.12)] shadow-lg"
                    : isAdvance
                        ? "border-orange-200 hover:shadow-md"
                        : "border-gray-200 hover:shadow-md hover:border-gray-300",
            ].join(" ")}
        >
            {isAdvance && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-orange-500 text-white shadow-sm">
                        ✦ Most popular
                    </span>
                </div>
            )}

            <div className="mb-4">
                <h3 className="text-base font-semibold text-gray-900">{plan.displayName}</h3>
                <p className="text-sm text-gray-500 mt-1 leading-snug">{plan.description}</p>
            </div>

            <div className="mb-5 flex items-end gap-1">
                {isFree ? (
                    <span className="text-3xl font-bold text-gray-900">Free</span>
                ) : (
                    <>
                        <span className="text-3xl font-bold text-gray-900">
                            ${plan.price.toFixed(2)}
                        </span>
                        <span className="text-sm text-gray-400 mb-1">/month</span>
                    </>
                )}
            </div>

            <ul className="space-y-2.5 mb-7 flex-1">
                {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                        <CheckIcon />
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>

            {isCurrent ? (
                <div className="w-full text-center py-2.5 rounded-xl text-sm font-medium border bg-blue-50 text-blue-600 border-blue-200 cursor-default select-none">
                    {ctaLabel}
                </div>
            ) : isComingSoon ? (
                <div
                    className="w-full text-center py-2.5 rounded-xl text-sm font-medium border bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed select-none"
                    aria-disabled="true"
                >
                    Coming soon
                </div>
            ) : isFree ? (
                <div className="w-full text-center py-2.5 rounded-xl text-sm font-medium border bg-gray-50 text-gray-400 border-gray-200 cursor-default select-none">
                    Default after trial
                </div>
            ) : (
                <fetcher.Form method="post">
                    <input type="hidden" name="intent" value={intent} />
                    <input type="hidden" name="plan" value={planKey} />
                    <button
                        type="submit"
                        disabled={isLoading}
                        className={[
                            "w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-150",
                            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                            isDowngrade
                                ? "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 focus-visible:outline-gray-500"
                                : isAdvance
                                    ? "bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white shadow-sm focus-visible:outline-orange-500"
                                    : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm focus-visible:outline-blue-600",
                            isLoading ? "opacity-60 cursor-not-allowed" : "",
                        ].join(" ")}
                    >
                        {isLoading ? (
                            <span className="inline-flex items-center justify-center gap-2">
                                <svg
                                    className="animate-spin h-4 w-4"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12" cy="12" r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                    />
                                </svg>
                                Redirecting…
                            </span>
                        ) : (
                            ctaLabel
                        )}
                    </button>
                </fetcher.Form>
            )}

            {isDowngrade && (
                <p className="mt-2.5 text-xs text-gray-400 text-center leading-snug">
                    Advance discounts stay live on Shopify but become read-only in the app.
                </p>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function BillingPage() {
    const { planName, planStatus, trialDaysRemaining, subscription, isAdvanceLocked } = useLoaderData();
    const actionData = useActionData();

    useEffect(() => {
        console.log(`Plan: ${planName}`);
        console.log(`Status: ${planStatus}`);
        console.log(`Trial days remaining: ${trialDaysRemaining}`);
        console.log(`Subscription: ${JSON.stringify(subscription)}`);
    }, [])

    const isTrialing = planStatus === "TRIALING";
    const isExpired = planStatus === "EXPIRED";
    const isActive = planStatus === "ACTIVE";

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">

                <div className="mb-7">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-xl font-bold text-gray-900">Subscription &amp; billing</h1>
                        <StatusBadge planStatus={planStatus} trialDaysRemaining={trialDaysRemaining} />
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                        Manage your Smart Discount plan. Changes take effect immediately.
                    </p>
                </div>

                {isTrialing && <TrialBanner daysRemaining={trialDaysRemaining} />}
                {isExpired && <ExpiredBanner />}

                {actionData?.error && (
                    <div
                        role="alert"
                        className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                    >
                        <span className="font-medium">Error: </span>
                        {actionData.error}
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-stretch">
                    {[ "FREE", "BASIC", "ADVANCE" ].map((planKey) => (
                        <PlanCard
                            key={planKey}
                            planKey={planKey}
                            currentPlanName={planName}
                            currentPlanStatus={planStatus}
                            isAdvanceLocked={isAdvanceLocked}
                        />
                    ))}
                </div>

                {isActive && subscription && <BillingInfo subscription={subscription} />}

                <p className="mt-6 text-xs text-gray-400 text-center leading-relaxed">
                    All charges are billed through Shopify. You can cancel any time from your Shopify admin.
                    Downgrading does not delete existing discounts — they stay live on Shopify but become
                    read-only in the app.
                </p>

            </div>
        </div>
    );
}