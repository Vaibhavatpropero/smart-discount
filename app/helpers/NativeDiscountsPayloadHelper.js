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

function normalizeJson(value) {
    if (!value) return null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

export function parseJsonArray(value) {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function buildDraftPayload({ shopId, formData, access, template }) {
    const group = String(formData.get("group") || "order").toLowerCase();
    const config = getGroupConfig(group);

    const discountType = String(formData.get("discountType") || config.discountType);
    const method = String(formData.get("method") || config.method);
    const shopifyDiscountCode =
        method === "CODE"
            ? String(formData.get("discountCode") || "").trim() || null
            : null;

    const title = String(formData.get("title") || `${config.title} draft`).trim();
    const description = String(formData.get("description") || "").trim() || null;
    const isPercentage = String(formData.get("isPercentage") || "true") !== "false";

    const discountValueRaw = formData.get("discountValue");
    const discountValue =
        discountValueRaw === "" || discountValueRaw == null ? null : Number(discountValueRaw);

    const scopeMode = String(formData.get("scopeMode") || "");
    const rawTargetProducts = normalizeJson(formData.get("targetProducts"));
    const rawTargetCollections = normalizeJson(formData.get("targetCollections"));

    let appliesToAll = true;
    let targetProducts = null;
    let targetCollections = null;

    if (group === "order") {
        appliesToAll = true;
    } else if (group === "product") {
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

    const minimumType = String(formData.get("minimumType") || "NONE");
    const minimumSubtotalRaw = formData.get("minimumSubtotal");
    const minimumQuantityRaw = formData.get("minimumQuantity");

    const usageLimitRaw = formData.get("usageLimit");
    const appliesOncePerCustomer =
        String(formData.get("appliesOncePerCustomer") || "false") === "true";
    const combineWithOrderDiscounts =
        String(formData.get("combineWithOrderDiscounts") || "false") === "true";
    const combineWithProductDiscounts =
        String(formData.get("combineWithProductDiscounts") || "false") === "true";
    const combineWithShippingDiscounts =
        String(formData.get("combineWithShippingDiscounts") || "false") === "true";

    const startsAtRaw = formData.get("startsAt");
    const endsAtRaw = formData.get("endsAt");

    const shippingDestinationMode = String(
        formData.get("shippingDestinationMode") || "ALL"
    );
    const shippingDestinationCountriesRaw = parseJsonArray(
        formData.get("shippingDestinationCountries")
    );
    const maximumShippingPriceRaw = formData.get("maximumShippingPrice");

    const templateSlug =
        template?.slug || String(formData.get("templateSlug") || "").trim() || null;

    return {
        shopId,
        title,
        description,
        discountType,
        method,
        shopifyDiscountCode,
        status: "DRAFT",
        discountValue:
            discountType === "FREE_SHIPPING"
                ? null
                : Number.isFinite(discountValue)
                    ? discountValue
                    : null,
        isPercentage,
        appliesToAll,
        targetProducts,
        targetCollections,
        minimumType,
        minimumSubtotal: minimumSubtotalRaw ? Number(minimumSubtotalRaw) : null,
        minimumQuantity: minimumQuantityRaw ? Number(minimumQuantityRaw) : null,
        usageLimit: usageLimitRaw ? Number(usageLimitRaw) : null,
        usesPerOrderLimit: (() => {
            const raw = formData.get("bxgyUsesPerOrderLimit");
            return raw ? Number(raw) : null;
        })(),
        appliesOncePerCustomer,
        combineWithOrderDiscounts,
        combineWithProductDiscounts,
        combineWithShippingDiscounts,
        startsAt: startsAtRaw ? new Date(startsAtRaw) : new Date(),
        endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
        shippingDestinationCountries:
            discountType === "FREE_SHIPPING"
                ? shippingDestinationMode === "SPECIFIC_COUNTRIES"
                    ? shippingDestinationCountriesRaw
                    : null
                : null,
        maximumShippingPrice:
            discountType === "FREE_SHIPPING" &&
                maximumShippingPriceRaw !== "" &&
                maximumShippingPriceRaw != null
                ? Number(maximumShippingPriceRaw)
                : null,
        templateSlug,
        createdOnPlan: access.planName,
    };
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
            buyRequirementType === "QUANTITY" && buyQuantityRaw ? Number(buyQuantityRaw) : null,
        customerBuysAmount:
            buyRequirementType === "AMOUNT" && buyAmountRaw ? Number(buyAmountRaw) : null,
        customerBuysProducts: buyTargetType === "PRODUCTS" ? buyProducts : null,
        customerBuysCollections: buyTargetType === "COLLECTIONS" ? buyCollections : null,
        customerGetsQty: getQuantityRaw ? Number(getQuantityRaw) : 1,
        customerGetsEffect: getEffect,
        customerGetsPercentage:
            getEffect === "PERCENTAGE" && getPercentageRaw ? Number(getPercentageRaw) : null,
        customerGetsAmount:
            getEffect === "AMOUNT_OFF_EACH" && getAmountRaw ? Number(getAmountRaw) : null,
        customerGetsProducts: getTargetType === "PRODUCTS" ? getProducts : null,
        customerGetsCollections: getTargetType === "COLLECTIONS" ? getCollections : null,
    };
}