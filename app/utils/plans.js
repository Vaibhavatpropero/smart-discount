// app/utils/plans.js
export const PLANS = {
    FREE: {
        name: "FREE",
        displayName: "Free",
        price: 0,
        description: "Get started with essential discount tools",
        features: [
            "Up to 3 active discount campaigns",
            "Basic discount types (percentage, fixed)",
            "Pre-built discount templates",
            "Basic analytics",
            "14-day trial of Advance features",
        ],
    },
    BASIC: {
        name: "BASIC",
        displayName: "Basic",
        price: 9.99,
        description: "Everything you need for growing stores",
        features: [
            "Up to 20 active discount campaigns",
            "All discount types (BXGY, shipping, volume)",
            "All pre-built templates",
            "Full analytics dashboard",
            "Code & automatic discounts",
            "Email support",
        ],
    },
    ADVANCE: {
        name: "ADVANCE",
        displayName: "Advance",
        price: 24.99,
        description: "Unlimited power for high-volume merchants",
        features: [
            "Unlimited active discount campaigns",
            "All discount types + Shopify Functions",
            "Custom discount templates",
            "Advanced analytics & reporting",
            "Priority support",
            "Early access to new features",
            "Discount stacking rules",
        ],
    },
};