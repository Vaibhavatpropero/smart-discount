// app/configs/discount-templates.js

export const DISCOUNT_TEMPLATE_FAMILIES = {
    ORDER: "order",
    PRODUCT: "product",
    BXGY: "bxgy",
    SHIPPING: "shipping",
};

export const DISCOUNT_TEMPLATES = [
    {
        slug: "order-percentage",
        name: "Percentage off order",
        description: "Apply a percentage discount to the whole order.",
        family: DISCOUNT_TEMPLATE_FAMILIES.ORDER,
        category: "Percent off order",
        discountType: "ORDER_PERCENTAGE",
        method: "AUTOMATIC",
        requiredPlan: "FREE",
        isPopular: false,
        defaultConfig: {
            isPercentage: true,
            scopeMode: "ENTIRE_ORDER",
            minimumType: "NONE",
        },
    },
    {
        slug: "order-fixed",
        name: "Amount off order",
        description: "Apply a fixed amount discount to the whole order.",
        family: DISCOUNT_TEMPLATE_FAMILIES.ORDER,
        category: "Amount off order",
        discountType: "ORDER_FIXED",
        method: "AUTOMATIC",
        requiredPlan: "FREE",
        isPopular: false,
        defaultConfig: {
            isPercentage: false,
            scopeMode: "ENTIRE_ORDER",
            minimumType: "NONE",
        },
    },
    {
        slug: "product-percentage",
        name: "Percentage off products",
        description: "Apply a percentage discount to selected products or collections.",
        family: DISCOUNT_TEMPLATE_FAMILIES.PRODUCT,
        category: "Percent off products",
        discountType: "PRODUCT_PERCENTAGE",
        method: "AUTOMATIC",
        requiredPlan: "FREE",
        isPopular: false,
        defaultConfig: {
            isPercentage: true,
            scopeMode: "ALL",
            minimumType: "NONE",
        },
    },
    {
        slug: "product-fixed",
        name: "Amount off products",
        description: "Apply a fixed amount discount to selected products or collections.",
        family: DISCOUNT_TEMPLATE_FAMILIES.PRODUCT,
        category: "Amount off products",
        discountType: "PRODUCT_FIXED",
        method: "AUTOMATIC",
        requiredPlan: "FREE",
        isPopular: false,
        defaultConfig: {
            isPercentage: false,
            scopeMode: "ALL",
            minimumType: "NONE",
        },
    },
    {
        slug: "bxgy-free",
        name: "Buy X get Y free",
        description: "Reward customers with free items after they buy qualifying items.",
        family: DISCOUNT_TEMPLATE_FAMILIES.BXGY,
        category: "Free reward item",
        discountType: "BXGY",
        method: "AUTOMATIC",
        requiredPlan: "FREE",
        isPopular: true,
        defaultConfig: {
            bxgyBuyRequirementType: "QUANTITY",
            bxgyBuyTargetType: "PRODUCTS",
            bxgyGetQuantity: 1,
            bxgyGetEffect: "FREE",
            bxgyGetTargetType: "PRODUCTS",
            minimumType: "NONE",
        },
    },
    {
        slug: "bxgy-amount-off",
        name: "Buy X get Y amount off",
        description: "Reward customers with a fixed amount off qualifying reward items.",
        family: DISCOUNT_TEMPLATE_FAMILIES.BXGY,
        category: "Amount off reward item",
        discountType: "BXGY",
        method: "AUTOMATIC",
        requiredPlan: "FREE",
        isPopular: false,
        defaultConfig: {
            bxgyBuyRequirementType: "QUANTITY",
            bxgyBuyTargetType: "PRODUCTS",
            bxgyGetQuantity: 1,
            bxgyGetEffect: "AMOUNT_OFF_EACH",
            bxgyGetTargetType: "PRODUCTS",
            minimumType: "NONE",
        },
    },
    {
        slug: "bxgy-percentage-off",
        name: "Buy X get Y percentage off",
        description: "Reward customers with a percentage discount on reward items.",
        family: DISCOUNT_TEMPLATE_FAMILIES.BXGY,
        category: "Percentage off reward item",
        discountType: "BXGY",
        method: "AUTOMATIC",
        requiredPlan: "FREE",
        isPopular: false,
        defaultConfig: {
            bxgyBuyRequirementType: "QUANTITY",
            bxgyBuyTargetType: "PRODUCTS",
            bxgyGetQuantity: 1,
            bxgyGetEffect: "PERCENTAGE",
            bxgyGetTargetType: "PRODUCTS",
            minimumType: "NONE",
        },
    },
    {
        slug: "free-shipping",
        name: "Free shipping",
        description: "Remove shipping cost for eligible orders.",
        family: DISCOUNT_TEMPLATE_FAMILIES.SHIPPING,
        category: "Free shipping",
        discountType: "FREE_SHIPPING",
        method: "AUTOMATIC",
        requiredPlan: "FREE",
        isPopular: false,
        defaultConfig: {
            shippingDestinationMode: "ALL",
            minimumType: "NONE",
        },
    },
];

export function getDiscountTemplateByDiscount(discount) {
    if (!discount?.discountType) return null;

    if (discount.templateSlug) {
        const direct = getDiscountTemplateBySlug(discount.templateSlug);
        if (direct) return direct;
    }

    switch (discount.discountType) {
        case "ORDER_PERCENTAGE":
            return getDiscountTemplateBySlug("order-percentage");

        case "ORDER_FIXED":
            return getDiscountTemplateBySlug("order-fixed");

        case "PRODUCT_PERCENTAGE":
            return getDiscountTemplateBySlug("product-percentage");

        case "PRODUCT_FIXED":
            return getDiscountTemplateBySlug("product-fixed");

        case "FREE_SHIPPING":
            return getDiscountTemplateBySlug("free-shipping");

        case "BXGY": {
            const effect = discount?.bxgyConfig?.customerGetsEffect;

            if (effect === "FREE") {
                return getDiscountTemplateBySlug("bxgy-free");
            }

            if (effect === "AMOUNT_OFF_EACH" || effect === "AMOUNTOFFEACH") {
                return getDiscountTemplateBySlug("bxgy-amount-off");
            }

            if (effect === "PERCENTAGE") {
                return getDiscountTemplateBySlug("bxgy-percentage-off");
            }

            return getDiscountTemplateBySlug("bxgy-free");
        }

        default:
            return null;
    }
}

export function getTemplateInitialConfig(template) {
    return template?.defaultConfig ? { ...template.defaultConfig } : {};
}

export function getDiscountTemplateBySlug(slug) {
    if (!slug) return null;
    return DISCOUNT_TEMPLATES.find((template) => template.slug === slug) ?? null;
}

export function listDiscountTemplates() {
    return DISCOUNT_TEMPLATES;
}

export function listDiscountTemplatesByFamily(family) {
    return DISCOUNT_TEMPLATES.filter((template) => template.family === family);
}