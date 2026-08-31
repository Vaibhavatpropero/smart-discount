// app/helpers/NativeDiscountsPayloadHelper.js

export const GROUP_CONFIG = {
    order: {
        key: "order",
        family: "PERCENTAGE_OR_FIXED",
        discountType: "ORDER_PERCENTAGE",
        method: "AUTOMATIC",
        supportedMethods: [ "AUTOMATIC", "CODE" ],
        title: "Order discount",
        shortTitle: "Order",
        description: "Percentage or fixed discounts for the full cart.",
        helper: "Apply a discount across the full order total.",
        supportsTargets: false,
        supportsValueTypeToggle: true,
    },
    product: {
        key: "product",
        family: "PERCENTAGE_OR_FIXED",
        discountType: "PRODUCT_PERCENTAGE",
        method: "AUTOMATIC",
        supportedMethods: [ "AUTOMATIC", "CODE" ],
        title: "Product / collection discount",
        shortTitle: "Products",
        description: "Discount selected products or collections.",
        helper: "Target specific products or collections instead of the full cart.",
        supportsTargets: true,
        supportsValueTypeToggle: true,
    },
    bxgy: {
        key: "bxgy",
        family: "BXGY",
        discountType: "BXGY",
        method: "AUTOMATIC",
        supportedMethods: [ "AUTOMATIC", "CODE" ],
        title: "Buy X get Y",
        shortTitle: "BXGY",
        description: "Create a BOGO or multi-buy promotion.",
        helper: "Build a reward flow where qualifying purchases unlock free or discounted items.",
        supportsTargets: false,
        supportsValueTypeToggle: false,
    },
    shipping: {
        key: "shipping",
        family: "FREE_SHIPPING",
        discountType: "FREE_SHIPPING",
        method: "AUTOMATIC",
        supportedMethods: [ "AUTOMATIC", "CODE" ],
        title: "Free shipping discount",
        shortTitle: "Shipping",
        description: "Create a shipping incentive for checkout conversion.",
        helper: "Use shipping offers to improve conversion at checkout.",
        supportsTargets: false,
        supportsValueTypeToggle: false,
    },
    app: {
        key: "app",
        family: "APP_FUNCTION",
        discountType: "APP_VOLUME",
        method: "AUTOMATIC",
        supportedMethods: [ "AUTOMATIC" ],
        title: "Smart app discount",
        shortTitle: "App discount",
        description: "Advanced Functions-based logic for premium plans.",
        helper: "Reserved for advanced app-owned discount logic.",
        supportsTargets: false,
        supportsValueTypeToggle: false,
    },
};

export function getGroupConfig(group) {
    return GROUP_CONFIG[ group ] || GROUP_CONFIG.order;
}

export function getGroupKeyFromDiscountType(discountType) {
    switch (discountType) {
        case "PRODUCT_PERCENTAGE":
        case "PRODUCT_FIXED":
            return "product";
        case "BXGY":
            return "bxgy";
        case "FREE_SHIPPING":
            return "shipping";
        case "APP_VOLUME":
        case "APP_BUNDLE":
        case "APP_CAPPED":
            return "app";
        case "ORDER_FIXED":
        case "ORDER_PERCENTAGE":
        default:
            return "order";
    }
}

export function normalizeJson(value) {
    if (!value) return null;
    try {
        return JSON.parse(String(value));
    } catch {
        return null;
    }
}

export function parseJsonArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
        const parsed = JSON.parse(String(value));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function normalizeDateTimeLocal(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function asResourceArray(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(Boolean).map((item) => {
        if (typeof item === "string") return { id: item };
        return item;
    });
}

export function buildBxgyConfigPayload(formData) {
    const buyRequirementType = String(formData.get("bxgyBuyRequirementType") || "QUANTITY");
    const buyTargetType = String(formData.get("bxgyBuyTargetType") || "PRODUCTS");
    const getTargetType = String(formData.get("bxgyGetTargetType") || "PRODUCTS");
    const getEffect = String(formData.get("bxgyGetEffect") || "FREE");

    const buyProducts = parseJsonArray(formData.get("bxgyBuyProducts"));
    const buyCollections = parseJsonArray(formData.get("bxgyBuyCollections"));
    const getProducts = parseJsonArray(formData.get("bxgyGetProducts"));
    const getCollections = parseJsonArray(formData.get("bxgyGetCollections"));

    const buyQuantityRaw = formData.get("bxgyBuyQuantity");
    const buyAmountRaw = formData.get("bxgyBuyAmount");
    const getQuantityRaw = formData.get("bxgyGetQuantity");
    const getPercentageRaw = formData.get("bxgyGetPercentage");
    const getAmountRaw = formData.get("bxgyGetAmount");

    return {
        customerBuysType: buyRequirementType,
        customerBuysQty:
            buyRequirementType === "QUANTITY" && buyQuantityRaw !== "" && buyQuantityRaw != null
                ? Number(buyQuantityRaw)
                : null,
        customerBuysAmount:
            buyRequirementType === "AMOUNT" && buyAmountRaw !== "" && buyAmountRaw != null
                ? Number(buyAmountRaw)
                : null,
        customerBuysProducts: buyTargetType === "PRODUCTS" ? buyProducts : null,
        customerBuysCollections: buyTargetType === "COLLECTIONS" ? buyCollections : null,
        customerGetsQty:
            getQuantityRaw !== "" && getQuantityRaw != null ? Number(getQuantityRaw) : 1,
        customerGetsEffect: getEffect,
        customerGetsPercentage:
            getEffect === "PERCENTAGE" && getPercentageRaw !== "" && getPercentageRaw != null
                ? Number(getPercentageRaw)
                : null,
        customerGetsAmount:
            getEffect === "AMOUNT_OFF_EACH" && getAmountRaw !== "" && getAmountRaw != null
                ? Number(getAmountRaw)
                : null,
        customerGetsProducts: getTargetType === "PRODUCTS" ? getProducts : null,
        customerGetsCollections: getTargetType === "COLLECTIONS" ? getCollections : null,
    };
}

export function buildDraftPayload({
    shopId,
    formData,
    access,
    template = null,
    existingDiscount = null,
}) {
    const fallbackGroup = existingDiscount
        ? getGroupKeyFromDiscountType(existingDiscount.discountType)
        : "order";

    const group = String(formData.get("group") || fallbackGroup).toLowerCase();
    const config = getGroupConfig(group);

    const discountType = String(
        formData.get("discountType") ||
        existingDiscount?.discountType ||
        config.discountType
    );

    const method = String(formData.get("method") || config.method);
    const isPercentage = String(formData.get("isPercentage") || "true") === "true";

    const discountValueRaw = formData.get("discountValue");
    const discountValue =
        discountValueRaw === "" || discountValueRaw == null ? null : Number(discountValueRaw);

    const scopeMode = String(formData.get("scopeMode") || "");
    const rawTargetProducts = normalizeJson(formData.get("targetProducts"));
    const rawTargetCollections = normalizeJson(formData.get("targetCollections"));

    const minimumType = String(formData.get("minimumType") || "NONE");
    const minimumSubtotalRaw = formData.get("minimumSubtotal");
    const minimumQuantityRaw = formData.get("minimumQuantity");
    const usageLimitRaw = formData.get("usageLimit");
    const bxgyUsesPerOrderLimitRaw = formData.get("bxgyUsesPerOrderLimit");
    const startsAtRaw = formData.get("startsAt");
    const endsAtRaw = formData.get("endsAt");

    const shippingDestinationMode = String(formData.get("shippingDestinationMode") || "ALL");
    const shippingDestinationCountries = parseJsonArray(
        formData.get("shippingDestinationCountries")
    );
    const maximumShippingPriceRaw = formData.get("maximumShippingPrice");

    const isBxgy = discountType === "BXGY";
    const isFreeShipping = discountType === "FREE_SHIPPING";

    let appliesToAll = true;
    let targetProducts = null;
    let targetCollections = null;

    if (group === "product") {
        if (scopeMode === "SPECIFIC_PRODUCTS") {
            appliesToAll = false;
            targetProducts = rawTargetProducts;
            targetCollections = null;
        } else if (scopeMode === "SPECIFIC_COLLECTIONS") {
            appliesToAll = false;
            targetProducts = null;
            targetCollections = rawTargetCollections;
        } else {
            appliesToAll = true;
        }
    }

    return {
        shopId,
        title: String(formData.get("title") || `${config.title} draft`).trim(),
        description: String(formData.get("description") || "").trim() || null,
        discountType,
        method,
        shopifyDiscountCode:
            method === "CODE" ? String(formData.get("discountCode") || "").trim() || null : null,
        status: "DRAFT",
        discountValue: isBxgy || isFreeShipping
            ? null
            : Number.isFinite(discountValue)
                ? discountValue
                : null,
        isPercentage: isBxgy || isFreeShipping ? false : isPercentage,
        appliesToAll,
        targetProducts,
        targetCollections,
        minimumType,
        minimumSubtotal:
            minimumType === "SUBTOTAL" && minimumSubtotalRaw !== "" && minimumSubtotalRaw != null
                ? Number(minimumSubtotalRaw)
                : null,
        minimumQuantity:
            minimumType === "QUANTITY" && minimumQuantityRaw !== "" && minimumQuantityRaw != null
                ? Number(minimumQuantityRaw)
                : null,
        usageLimit:
            usageLimitRaw === "" || usageLimitRaw == null ? null : Number(usageLimitRaw),
        usesPerOrderLimit:
            bxgyUsesPerOrderLimitRaw === "" || bxgyUsesPerOrderLimitRaw == null
                ? null
                : Number(bxgyUsesPerOrderLimitRaw),
        appliesOncePerCustomer:
            String(formData.get("appliesOncePerCustomer") || "false") === "true",
        combineWithOrderDiscounts:
            String(formData.get("combineWithOrderDiscounts") || "false") === "true",
        combineWithProductDiscounts:
            String(formData.get("combineWithProductDiscounts") || "false") === "true",
        combineWithShippingDiscounts:
            String(formData.get("combineWithShippingDiscounts") || "false") === "true",
        shippingDestinationCountries:
            isFreeShipping
                ? shippingDestinationMode === "SPECIFIC_COUNTRIES"
                    ? shippingDestinationCountries
                    : null
                : null,
        maximumShippingPrice:
            isFreeShipping && maximumShippingPriceRaw !== "" && maximumShippingPriceRaw != null
                ? Number(maximumShippingPriceRaw)
                : null,
        startsAt: startsAtRaw ? new Date(startsAtRaw) : existingDiscount?.startsAt ?? new Date(),
        endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
        templateId: template?.id || existingDiscount?.templateId || null,
        templateSlug: template?.slug || String(formData.get("templateSlug") || "").trim() || null,
        createdOnPlan: access?.planName || existingDiscount?.createdOnPlan || null,
        lastError: null,
    };
}

export function buildInitialState(discount, group) {
    const bxgy = discount.bxgyConfig;

    const bxgyBuyTargetType =
        Array.isArray(bxgy?.customerBuysCollections) && bxgy.customerBuysCollections.length > 0
            ? "COLLECTIONS"
            : "PRODUCTS";

    const bxgyGetTargetType =
        Array.isArray(bxgy?.customerGetsCollections) && bxgy.customerGetsCollections.length > 0
            ? "COLLECTIONS"
            : "PRODUCTS";

    const shippingDestinationMode =
        Array.isArray(discount.shippingDestinationCountries) &&
            discount.shippingDestinationCountries.length > 0
            ? "SPECIFIC_COUNTRIES"
            : "ALL";

    return {
        title: discount.title || "",
        description: discount.description || "",
        method: discount.method || getGroupConfig(group).method,
        discountCode: discount.discountCode || discount.shopifyDiscountCode || "",
        isPercentage: Boolean(discount.isPercentage),
        discountValue: discount.discountValue == null ? "" : String(discount.discountValue),

        minimumType: discount.minimumType || "NONE",
        minimumSubtotal: discount.minimumSubtotal == null ? "" : String(discount.minimumSubtotal),
        minimumQuantity: discount.minimumQuantity == null ? "" : String(discount.minimumQuantity),
        usageLimit: discount.usageLimit == null ? "" : String(discount.usageLimit),

        appliesOncePerCustomer: Boolean(discount.appliesOncePerCustomer),
        combineWithOrderDiscounts: Boolean(discount.combineWithOrderDiscounts),
        combineWithProductDiscounts: Boolean(discount.combineWithProductDiscounts),
        combineWithShippingDiscounts: Boolean(discount.combineWithShippingDiscounts),

        scopeMode: discount.scopeMode || (group === "product" ? "ALL" : "ENTIRE_ORDER"),
        targetProducts: asResourceArray(discount.targetProducts),
        targetCollections: asResourceArray(discount.targetCollections),

        bxgyBuyRequirementType: bxgy?.customerBuysType || "QUANTITY",
        bxgyBuyQuantity: bxgy?.customerBuysQty == null ? "" : String(bxgy.customerBuysQty),
        bxgyBuyAmount: bxgy?.customerBuysAmount == null ? "" : String(bxgy.customerBuysAmount),
        bxgyBuyTargetType,
        bxgyBuyProducts: asResourceArray(bxgy?.customerBuysProducts),
        bxgyBuyCollections: asResourceArray(bxgy?.customerBuysCollections),

        bxgyGetQuantity: bxgy?.customerGetsQty == null ? "1" : String(bxgy.customerGetsQty),
        bxgyGetEffect: bxgy?.customerGetsEffect || "FREE",
        bxgyGetPercentage:
            bxgy?.customerGetsPercentage == null ? "" : String(bxgy.customerGetsPercentage),
        bxgyGetAmount: bxgy?.customerGetsAmount == null ? "" : String(bxgy.customerGetsAmount),
        bxgyGetTargetType,
        bxgyGetProducts: asResourceArray(bxgy?.customerGetsProducts),
        bxgyGetCollections: asResourceArray(bxgy?.customerGetsCollections),
        bxgyUsesPerOrderLimit:
            discount.usesPerOrderLimit == null ? "" : String(discount.usesPerOrderLimit),

        shippingDestinationMode,
        shippingDestinationCountries: Array.isArray(discount.shippingDestinationCountries)
            ? discount.shippingDestinationCountries
            : [],
        maximumShippingPrice:
            discount.maximumShippingPrice == null ? "" : String(discount.maximumShippingPrice),

        startsAt: normalizeDateTimeLocal(discount.startsAt),
        endsAt: normalizeDateTimeLocal(discount.endsAt),
    };
}