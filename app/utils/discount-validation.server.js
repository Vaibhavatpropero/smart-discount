// app/utils/discount-validation.server.js
/**
 * Shared validation utilities for discount create/edit routes.
 * Centralizes all form validation logic to avoid duplication and ensure consistency.
 */

import { parseJsonArray, normalizeJson } from "../helpers/NativeDiscountsPayloadHelper.js";
import { assertAdvancedFeatureAccess } from "./plan-gate.server.js";

/**
 * Validates basic discount fields (title, discount code, method)
 * @param {object} params
 * @param {string} params.title - Discount title
 * @param {string} params.discountCode - Discount code
 * @param {string} params.method - Discount method (CODE/AUTOMATIC)
 * @param {object} params.groupConfig - Group configuration
 * @returns {object} errors object (empty if valid)
 */
export function validateBasicFields({ title, discountCode, method, groupConfig }) {
    const errors = {};

    if (!title || !title.trim()) {
        errors.title = "Title is required.";
    }

    if (method === "CODE" && (!discountCode || !discountCode.trim())) {
        errors.discountCode = "Discount code is required when code method is selected.";
    }

    if (method && !groupConfig.supportedMethods.includes(method)) {
        errors.form = `${groupConfig.title} currently supports ${groupConfig.supportedMethods
            .map((item) => item.toLowerCase())
            .join(" or ")} method only.`;
    }

    return errors;
}

/**
 * Validates discount value for non-BXGY, non-free-shipping, non-app-capped discounts
 * @param {object} params
 * @param {number|null} params.discountValue - Discount value
 * @param {boolean} params.isPercentage - Whether value is percentage
 * @param {boolean} params.isBxgy - Whether discount is BXGY
 * @param {boolean} params.isFreeShipping - Whether discount is free shipping
 * @param {boolean} params.isAppCapped - Whether discount is APP_CAPPED
 * @returns {object} errors object (empty if valid)
 */
export function validateDiscountValue({ discountValue, isPercentage, isBxgy, isFreeShipping, isAppCapped }) {
    const errors = {};

    if (!isBxgy && !isFreeShipping && !isAppCapped) {
        if (
            discountValue == null ||
            !Number.isFinite(discountValue) ||
            discountValue <= 0
        ) {
            errors.discountValue = "Enter a valid discount value.";
        }

        if (isPercentage && discountValue > 100) {
            errors.discountValue = "Percentage value cannot be more than 100.";
        }
    }

    return errors;
}

/**
 * Validates APP_CAPPED discount specific fields
 * @param {object} params
 * @param {number|null} params.discountValue - Discount value (percentage)
 * @param {number|null} params.cappedAmount - Capped amount
 * @returns {object} errors object (empty if valid)
 */
export function validateAppCapped({ discountValue, cappedAmount }) {
    const errors = {};

    if (
        discountValue == null ||
        !Number.isFinite(discountValue) ||
        discountValue <= 0 ||
        discountValue > 100
    ) {
        errors.discountValue = "Enter a valid percentage value between 0 and 100.";
    }

    if (
        cappedAmount == null ||
        !Number.isFinite(cappedAmount) ||
        cappedAmount <= 0
    ) {
        errors.cappedAmount = "Enter a valid capped amount.";
    }

    return errors;
}

/**
 * Validates APP_FREE_GIFT specific fields (reads the freeGiftConfig JSON)
 * @param {object} params
 * @param {FormData} params.formData - Raw form data
 * @returns {object} errors object (empty if valid)
 */
export function validateFreeGift({ formData }) {
    const errors = {};
    const raw = normalizeJson(formData.get("freeGiftConfig"));

    if (!raw) {
        errors.freeGiftConfig = "Configure the free gift.";
        return errors;
    }

    if (!(raw.giftVariantId ?? raw.giftVariant)) {
        errors.giftVariantId = "Select the gift product variant.";
    }

    if (
        raw.giftQuantity != null &&
        raw.giftQuantity !== "" &&
        (!Number.isInteger(Number(raw.giftQuantity)) || Number(raw.giftQuantity) <= 0)
    ) {
        errors.giftQuantity = "Gift quantity must be a positive whole number.";
    }

    if (raw.triggerType === "ORDER_THRESHOLD") {
        const t = raw.threshold;
        if (t?.kind === "SUBTOTAL") {
            if (!(Number(t.minSubtotal) > 0)) {
                errors.minSubtotal = "Enter a minimum spend greater than 0.";
            }
        } else if (t?.kind === "QUANTITY") {
            if (!Number.isInteger(Number(t.minQuantity)) || Number(t.minQuantity) <= 0) {
                errors.minQuantity = "Enter a valid minimum quantity.";
            }
        } else {
            errors.threshold = "Choose a spend or quantity threshold.";
        }
    } else if (raw.triggerType === "PRODUCT_TRIGGER") {
        const ids = (raw.productTrigger?.productIds || []).filter(Boolean);
        if (ids.length === 0) {
            errors.productIds = "Add at least one trigger variant.";
        }
        const m = raw.productTrigger?.minQuantityPerProduct;
        if (m !== "" && m != null && (!Number.isInteger(Number(m)) || Number(m) <= 0)) {
            errors.minQuantityPerProduct = "Minimum quantity must be a positive whole number.";
        }
    } else {
        errors.triggerType = "Choose how the gift is unlocked.";
    }

    return errors;
}

/**
 * Validates free shipping discount specific fields
 * @param {object} params
 * @param {string} params.shippingDestinationMode - Destination mode
 * @param {Array} params.shippingDestinationCountries - Destination countries
 * @param {number|null} params.maximumShippingPrice - Maximum shipping price
 * @returns {object} errors object (empty if valid)
 */
export function validateFreeShipping({ shippingDestinationMode, shippingDestinationCountries, maximumShippingPrice }) {
    const errors = {};

    if (
        shippingDestinationMode === "SPECIFIC_COUNTRIES" &&
        shippingDestinationCountries.length === 0
    ) {
        errors.shippingDestinationCountries = "Add at least one destination country.";
    }

    if (
        maximumShippingPrice !== "" &&
        maximumShippingPrice != null &&
        (!Number.isFinite(maximumShippingPrice) || maximumShippingPrice < 0)
    ) {
        errors.maximumShippingPrice = "Enter a valid maximum shipping price.";
    }

    return errors;
}

/**
 * Validates BXGY discount specific fields
 * @param {object} params
 * @param {FormData} params.formData - Raw form data
 * @returns {object} errors object (empty if valid)
 */
export function validateBxgy({ formData }) {
    const errors = {};

    const buyRequirementType = String(formData.get("bxgyBuyRequirementType") || "QUANTITY");
    const buyQuantity = Number(formData.get("bxgyBuyQuantity"));
    const buyAmount = Number(formData.get("bxgyBuyAmount"));
    const buyTargetType = String(formData.get("bxgyBuyTargetType") || "PRODUCTS");
    const buyProducts = parseJsonArray(formData.get("bxgyBuyProducts"));
    const buyCollections = parseJsonArray(formData.get("bxgyBuyCollections"));

    const getQuantity = Number(formData.get("bxgyGetQuantity"));
    const getEffect = String(formData.get("bxgyGetEffect") || "FREE");
    const getPercentage = Number(formData.get("bxgyGetPercentage"));
    const getAmount = Number(formData.get("bxgyGetAmount"));
    const getTargetType = String(formData.get("bxgyGetTargetType") || "PRODUCTS");
    const getProducts = parseJsonArray(formData.get("bxgyGetProducts"));
    const getCollections = parseJsonArray(formData.get("bxgyGetCollections"));

    const usesPerOrderLimitRaw = formData.get("bxgyUsesPerOrderLimit");

    if (
        buyRequirementType === "QUANTITY" &&
        (!Number.isInteger(buyQuantity) || buyQuantity <= 0)
    ) {
        errors.bxgyBuyQuantity = "Enter a valid buy quantity.";
    }

    if (
        buyRequirementType === "AMOUNT" &&
        (!Number.isFinite(buyAmount) || buyAmount <= 0)
    ) {
        errors.bxgyBuyAmount = "Enter a valid spend amount.";
    }

    if (buyTargetType === "PRODUCTS" && buyProducts.length === 0) {
        errors.bxgyBuyProducts = "Add at least one product customers must buy.";
    }

    if (buyTargetType === "COLLECTIONS" && buyCollections.length === 0) {
        errors.bxgyBuyCollections = "Add at least one collection customers must buy from.";
    }

    if (!Number.isInteger(getQuantity) || getQuantity <= 0) {
        errors.bxgyGetQuantity = "Enter a valid reward quantity.";
    }

    if (
        getEffect === "PERCENTAGE" &&
        (!Number.isFinite(getPercentage) || getPercentage <= 0 || getPercentage > 100)
    ) {
        errors.bxgyGetPercentage = "Enter a valid reward percentage.";
    }

    if (
        getEffect === "AMOUNT_OFF_EACH" &&
        (!Number.isFinite(getAmount) || getAmount <= 0)
    ) {
        errors.bxgyGetAmount = "Enter a valid amount off per reward item.";
    }

    if (getTargetType === "PRODUCTS" && getProducts.length === 0) {
        errors.bxgyGetProducts = "Add at least one reward product.";
    }

    if (getTargetType === "COLLECTIONS" && getCollections.length === 0) {
        errors.bxgyGetCollections = "Add at least one reward collection.";
    }

    if (
        usesPerOrderLimitRaw &&
        (!Number.isInteger(Number(usesPerOrderLimitRaw)) || Number(usesPerOrderLimitRaw) <= 0)
    ) {
        errors.bxgyUsesPerOrderLimit = "Uses per order must be a positive whole number.";
    }

    return errors;
}

/**
 * Validates product/collection targeting fields
 * @param {object} params
 * @param {string} params.group - Discount group
 * @param {string} params.scopeMode - Scope mode
 * @param {Array} params.targetProducts - Target products
 * @param {Array} params.targetCollections - Target collections
 * @returns {object} errors object (empty if valid)
 */
export function validateProductTargeting({ group, scopeMode, targetProducts, targetCollections }) {
    const errors = {};

    if (group === "product") {
        if (scopeMode === "SPECIFIC_PRODUCTS" && targetProducts.length === 0) {
            errors.targetProducts = "Add at least one product target.";
        }

        if (scopeMode === "SPECIFIC_COLLECTIONS" && targetCollections.length === 0) {
            errors.targetCollections = "Add at least one collection target.";
        }
    }

    return errors;
}

/**
 * Validates minimum requirement fields
 * @param {object} params
 * @param {string} params.minimumType - Minimum type (SUBTOTAL/QUANTITY/NONE)
 * @param {string|number|null} params.minimumSubtotal - Minimum subtotal
 * @param {string|number|null} params.minimumQuantity - Minimum quantity
 * @param {boolean} params.isAppCapped - Whether discount is APP_CAPPED
 * @returns {object} errors object (empty if valid)
 */
export function validateMinimumRequirements({ minimumType, minimumSubtotal, minimumQuantity, isAppCapped }) {
    const errors = {};

    if (!isAppCapped) {
        if (minimumType === "SUBTOTAL" && (!minimumSubtotal || Number(minimumSubtotal) <= 0)) {
            errors.minimumSubtotal = "Enter a valid minimum subtotal.";
        }

        if (minimumType === "QUANTITY" && (!minimumQuantity || Number(minimumQuantity) <= 0)) {
            errors.minimumQuantity = "Enter a valid minimum quantity.";
        }
    }

    return errors;
}

/**
 * Validates usage limit field
 * @param {string|number|null} usageLimit - Usage limit value
 * @returns {object} errors object (empty if valid)
 */
export function validateUsageLimit(usageLimit) {
    const errors = {};

    if (usageLimit && (!Number.isInteger(Number(usageLimit)) || Number(usageLimit) <= 0)) {
        errors.usageLimit = "Usage limit must be a positive whole number.";
    }

    return errors;
}

/**
 * Validates date range (startsAt must be before endsAt)
 * @param {string|Date|null} startsAt - Start date
 * @param {string|Date|null} endsAt - End date
 * @returns {object} errors object (empty if valid)
 */
export function validateDateRange(startsAt, endsAt) {
    const errors = {};

    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
        errors.endsAt = "End date must be after the start date.";
    }

    return errors;
}

/**
 * Main validation orchestrator - runs all validations based on discount type
 * @param {object} params
 * @param {FormData} params.formData - Raw form data
 * @param {object} params.access - User access/plan info
 * @param {object} params.groupConfig - Group configuration
 * @param {object} params.template - Template (optional)
 * @param {object} params.existingDiscount - Existing discount for edit route (optional)
 * @returns {object} { errors, parsedData } - errors object and parsed form data
 */
export function validateDiscountForm({
    formData,
    access,
    groupConfig,
    template = null,
    existingDiscount = null,
}) {
    // Extract common fields
    const title = String(formData.get("title") || "").trim();
    const method = String(formData.get("method") || groupConfig.method);
    const discountCode = String(formData.get("discountCode") || "").trim();

    const discountValueRaw = formData.get("discountValue");
    const discountValue = discountValueRaw === "" || discountValueRaw == null ? null : Number(discountValueRaw);

    const cappedAmountRaw = formData.get("cappedAmount");
    const cappedAmount = cappedAmountRaw === "" || cappedAmountRaw == null ? null : Number(cappedAmountRaw);

    const scopeMode = String(formData.get("scopeMode") || "");
    const targetProducts = parseJsonArray(formData.get("targetProducts"));
    const targetCollections = parseJsonArray(formData.get("targetCollections"));

    const minimumType = String(formData.get("minimumType") || "NONE");
    const minimumSubtotal = formData.get("minimumSubtotal");
    const minimumQuantity = formData.get("minimumQuantity");
    const startsAt = formData.get("startsAt");
    const endsAt = formData.get("endsAt");
    const usageLimit = formData.get("usageLimit");

    const shippingDestinationMode = String(formData.get("shippingDestinationMode") || "ALL");
    const shippingDestinationCountries = parseJsonArray(formData.get("shippingDestinationCountries"));
    const maximumShippingPriceRaw = formData.get("maximumShippingPrice");
    const maximumShippingPrice = maximumShippingPriceRaw === "" || maximumShippingPriceRaw == null ? null : Number(maximumShippingPriceRaw);

    // Determine discount type
    const postedDiscountType =
        groupConfig.key === "free_gift"
            ? groupConfig.discountType
            : String(
                formData.get("discountType") ||
                existingDiscount?.discountType ||
                groupConfig.discountType
            );

    const isBxgy = postedDiscountType === "BXGY";
    const isFreeShipping = postedDiscountType === "FREE_SHIPPING";
    const isAppCapped = postedDiscountType === "APP_CAPPED";
    const isFreeGift = postedDiscountType === "APP_FREE_GIFT";
    const isPercentage = String(formData.get("isPercentage") || "true") === "true";

    // Run all validations
    let errors = {};

    // 1. Basic fields
    errors = { ...errors, ...validateBasicFields({ title, discountCode, method, groupConfig }) };

    // 2. Discount value (for non-BXGY, non-free-shipping, non-app-capped)
    errors = { ...errors, ...validateDiscountValue({ discountValue, isPercentage, isBxgy, isFreeShipping, isAppCapped: isAppCapped || isFreeGift }) };

    // 3. APP_CAPPED specific
    if (isAppCapped) {
        errors = { ...errors, ...validateAppCapped({ discountValue, cappedAmount }) };
    }

    // 3b. APP_FREE_GIFT specific
    if (isFreeGift) {
        errors = { ...errors, ...validateFreeGift({ formData }) };
    }

    // 4. Free shipping specific
    if (isFreeShipping) {
        errors = { ...errors, ...validateFreeShipping({ shippingDestinationMode, shippingDestinationCountries, maximumShippingPrice }) };
    }

    // 5. BXGY specific
    if (isBxgy) {
        errors = { ...errors, ...validateBxgy({ formData }) };
    }

    // 6. Product targeting
    errors = { ...errors, ...validateProductTargeting({ group: groupConfig.key, scopeMode, targetProducts, targetCollections }) };

    // 7. Minimum requirements
    errors = { ...errors, ...validateMinimumRequirements({ minimumType, minimumSubtotal, minimumQuantity, isAppCapped: isAppCapped || isFreeGift }) };

    // 8. Usage limit — skipped for app-fn AUTOMATIC (DiscountAutomaticAppInput
    // cannot enforce usage limits; buildDraftPayload nulls them)
    const skipUsageLimitValidation =
        (isAppCapped || isFreeGift) && method === "AUTOMATIC";
    errors = {
        ...errors,
        ...(skipUsageLimitValidation ? {} : validateUsageLimit(usageLimit)),
    };

    // 9. Date range
    errors = { ...errors, ...validateDateRange(startsAt, endsAt) };

    // 10. Advanced feature access check
    try {
        assertAdvancedFeatureAccess(access, groupConfig.key, formData);
    } catch (err) {
        errors.form = err?.message || "This feature is not available on your current plan.";
    }

    // 11. Plan-based discount type access check
    // We'll do the final check after building payload since discountType might be determined there
    // canUseDiscountType is available but final check happens in the route after payload is built

    // Return parsed data for use in payload building
    const parsedData = {
        title,
        method,
        discountCode,
        discountValue,
        cappedAmount,
        scopeMode,
        targetProducts,
        targetCollections,
        minimumType,
        minimumSubtotal,
        minimumQuantity,
        startsAt,
        endsAt,
        usageLimit,
        shippingDestinationMode,
        shippingDestinationCountries,
        maximumShippingPrice,
        postedDiscountType,
        isBxgy,
        isFreeShipping,
        isAppCapped,
        isFreeGift,
        isPercentage,
    };

    return { errors, parsedData };
}