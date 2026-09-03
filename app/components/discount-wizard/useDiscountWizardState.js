// app/components/discount-wizard/useDiscountWizardState.js
import { useEffect, useMemo, useState } from "react";

export function useDiscountWizardState({
    groupConfig,
    template,
    groupValue,
    initialState = null,
    skipConditionsStep = false,
}) {
    const templateDefaults = template?.defaultConfig ?? {};
    const isAppCappedTemplate = template?.discountType === "APP_CAPPED";

    const getInitialTitle = () =>
        initialState?.title ??
        (template?.name ? `${template.name} draft` : `${groupConfig.title} draft`);

    const getInitialDescription = () =>
        initialState?.description ?? template?.description ?? "";

    const getInitialMethod =
        initialState?.method ?? templateDefaults.method ?? groupConfig.method ?? "AUTOMATIC";

    const getInitialDiscountCode = () => initialState?.discountCode ?? "";
    const getInitialIsPercentage =
        initialState?.isPercentage ?? templateDefaults.isPercentage ?? true;
    const getInitialDiscountValue = () =>
        initialState?.discountValue ?? templateDefaults.discountValue ?? "";
    const getInitialCappedAmount = () =>
        initialState?.cappedAmount ?? templateDefaults.cappedAmount ?? "";

    const getInitialMinimumType =
        initialState?.minimumType ?? templateDefaults.minimumType ?? "NONE";
    const getInitialMinimumSubtotal = () => initialState?.minimumSubtotal ?? "";
    const getInitialMinimumQuantity = () => initialState?.minimumQuantity ?? "";
    const getInitialUsageLimit = () => initialState?.usageLimit ?? "";
    const getInitialAppliesOncePerCustomer = () =>
        initialState?.appliesOncePerCustomer ?? false;
    const getInitialCombineWithOrderDiscounts = () =>
        initialState?.combineWithOrderDiscounts ?? false;
    const getInitialCombineWithProductDiscounts = () =>
        initialState?.combineWithProductDiscounts ?? false;
    const getInitialCombineWithShippingDiscounts = () =>
        initialState?.combineWithShippingDiscounts ?? false;

    const getInitialScopeMode =
        initialState?.scopeMode ??
        templateDefaults.scopeMode ??
        (groupValue === "product" ? "ALL" : "ENTIRE_ORDER");
    const getInitialTargetProducts = () => initialState?.targetProducts ?? [];
    const getInitialTargetCollections = () => initialState?.targetCollections ?? [];

    const getInitialBxgyBuyRequirementType =
        initialState?.bxgyBuyRequirementType ?? templateDefaults.bxgyBuyRequirementType ?? "QUANTITY";
    const getInitialBxgyBuyQuantity = () =>
        initialState?.bxgyBuyQuantity ?? templateDefaults.bxgyBuyQuantity ?? "";
    const getInitialBxgyBuyAmount = () =>
        initialState?.bxgyBuyAmount ?? templateDefaults.bxgyBuyAmount ?? "";
    const getInitialBxgyBuyTargetType =
        initialState?.bxgyBuyTargetType ?? templateDefaults.bxgyBuyTargetType ?? "PRODUCTS";
    const getInitialBxgyBuyProducts = () => initialState?.bxgyBuyProducts ?? [];
    const getInitialBxgyBuyCollections = () => initialState?.bxgyBuyCollections ?? [];

    const getInitialBxgyGetQuantity =
        initialState?.bxgyGetQuantity ?? templateDefaults.bxgyGetQuantity ?? 1;
    const getInitialBxgyGetEffect =
        initialState?.bxgyGetEffect ?? templateDefaults.bxgyGetEffect ?? "FREE";
    const getInitialBxgyGetPercentage = () =>
        initialState?.bxgyGetPercentage ?? templateDefaults.bxgyGetPercentage ?? "";
    const getInitialBxgyGetAmount = () =>
        initialState?.bxgyGetAmount ?? templateDefaults.bxgyGetAmount ?? "";
    const getInitialBxgyGetTargetType =
        initialState?.bxgyGetTargetType ?? templateDefaults.bxgyGetTargetType ?? "PRODUCTS";
    const getInitialBxgyGetProducts = () => initialState?.bxgyGetProducts ?? [];
    const getInitialBxgyGetCollections = () => initialState?.bxgyGetCollections ?? [];
    const getInitialBxgyUsesPerOrderLimit = () =>
        initialState?.bxgyUsesPerOrderLimit ?? "";

    const getInitialShippingDestinationMode =
        initialState?.shippingDestinationMode ?? templateDefaults.shippingDestinationMode ?? "ALL";
    const getInitialShippingDestinationCountries = () =>
        initialState?.shippingDestinationCountries ?? templateDefaults.shippingDestinationCountries ?? [];
    const getInitialMaximumShippingPrice = () =>
        initialState?.maximumShippingPrice ?? templateDefaults.maximumShippingPrice ?? "";

    const getInitialStartsAt = () => initialState?.startsAt ?? "";
    const getInitialEndsAt = () => initialState?.endsAt ?? "";
    const getInitialCurrentStep = () => initialState?.currentStep ?? 0;

    const [ title, setTitle ] = useState(getInitialTitle);
    const [ description, setDescription ] = useState(getInitialDescription);
    const [ method, setMethod ] = useState(getInitialMethod);
    const [ discountCode, setDiscountCode ] = useState(getInitialDiscountCode);

    useEffect(() => {
        const fallbackMethod = groupConfig.method || "AUTOMATIC";

        if (!groupConfig.supportedMethods?.includes(method)) {
            setMethod(fallbackMethod);
        }

        if (
            groupConfig.supportedMethods &&
            !groupConfig.supportedMethods.includes("CODE") &&
            discountCode
        ) {
            setDiscountCode("");
        }
    }, [ groupConfig, method, discountCode ]);

    const [ isPercentage, setIsPercentage ] = useState(getInitialIsPercentage);
    const [ discountValue, setDiscountValue ] = useState(getInitialDiscountValue);
    const [ cappedAmount, setCappedAmount ] = useState(getInitialCappedAmount);

    const [ minimumType, setMinimumType ] = useState(getInitialMinimumType);
    const [ minimumSubtotal, setMinimumSubtotal ] = useState(getInitialMinimumSubtotal);
    const [ minimumQuantity, setMinimumQuantity ] = useState(getInitialMinimumQuantity);
    const [ usageLimit, setUsageLimit ] = useState(getInitialUsageLimit);
    const [ appliesOncePerCustomer, setAppliesOncePerCustomer ] = useState(
        getInitialAppliesOncePerCustomer
    );
    const [ combineWithOrderDiscounts, setCombineWithOrderDiscounts ] = useState(
        getInitialCombineWithOrderDiscounts
    );
    const [ combineWithProductDiscounts, setCombineWithProductDiscounts ] = useState(
        getInitialCombineWithProductDiscounts
    );
    const [ combineWithShippingDiscounts, setCombineWithShippingDiscounts ] = useState(
        getInitialCombineWithShippingDiscounts
    );

    const [ scopeMode, setScopeMode ] = useState(getInitialScopeMode);
    const [ targetProducts, setTargetProducts ] = useState(getInitialTargetProducts);
    const [ targetCollections, setTargetCollections ] = useState(
        getInitialTargetCollections
    );

    const [ bxgyBuyRequirementType, setBxgyBuyRequirementType ] = useState(
        getInitialBxgyBuyRequirementType
    );
    const [ bxgyBuyQuantity, setBxgyBuyQuantity ] = useState(getInitialBxgyBuyQuantity);
    const [ bxgyBuyAmount, setBxgyBuyAmount ] = useState(getInitialBxgyBuyAmount);
    const [ bxgyBuyTargetType, setBxgyBuyTargetType ] = useState(
        getInitialBxgyBuyTargetType
    );
    const [ bxgyBuyProducts, setBxgyBuyProducts ] = useState(getInitialBxgyBuyProducts);
    const [ bxgyBuyCollections, setBxgyBuyCollections ] = useState(
        getInitialBxgyBuyCollections
    );

    const [ bxgyGetQuantity, setBxgyGetQuantity ] = useState(getInitialBxgyGetQuantity);
    const [ bxgyGetEffect, setBxgyGetEffect ] = useState(getInitialBxgyGetEffect);
    const [ bxgyGetPercentage, setBxgyGetPercentage ] = useState(
        getInitialBxgyGetPercentage
    );
    const [ bxgyGetAmount, setBxgyGetAmount ] = useState(getInitialBxgyGetAmount);
    const [ bxgyGetTargetType, setBxgyGetTargetType ] = useState(
        getInitialBxgyGetTargetType
    );
    const [ bxgyGetProducts, setBxgyGetProducts ] = useState(getInitialBxgyGetProducts);
    const [ bxgyGetCollections, setBxgyGetCollections ] = useState(
        getInitialBxgyGetCollections
    );
    const [ bxgyUsesPerOrderLimit, setBxgyUsesPerOrderLimit ] = useState(
        getInitialBxgyUsesPerOrderLimit
    );

    const [ shippingDestinationMode, setShippingDestinationMode ] = useState(
        getInitialShippingDestinationMode
    );
    const [ shippingDestinationCountries, setShippingDestinationCountries ] = useState(
        getInitialShippingDestinationCountries
    );
    const [ maximumShippingPrice, setMaximumShippingPrice ] = useState(
        getInitialMaximumShippingPrice
    );

    const [ startsAt, setStartsAt ] = useState(getInitialStartsAt);
    const [ endsAt, setEndsAt ] = useState(getInitialEndsAt);

    const [ currentStep, setCurrentStep ] = useState(getInitialCurrentStep);

    const validation = useMemo(() => {
        const basicsValid =
            title.trim().length > 0 &&
            (method !== "CODE" || discountCode.trim().length > 0);

        const defaultValueValid =
            discountValue !== "" &&
            Number.isFinite(Number(discountValue)) &&
            Number(discountValue) > 0 &&
            (!isPercentage || Number(discountValue) <= 100);

        const bxgyBuyRequirementValid =
            bxgyBuyRequirementType === "QUANTITY"
                ? Number.isInteger(Number(bxgyBuyQuantity)) &&
                Number(bxgyBuyQuantity) > 0
                : Number.isFinite(Number(bxgyBuyAmount)) &&
                Number(bxgyBuyAmount) > 0;

        const bxgyGetQuantityValid =
            Number.isInteger(Number(bxgyGetQuantity)) &&
            Number(bxgyGetQuantity) > 0;

        const bxgyGetEffectValid =
            bxgyGetEffect === "FREE" ||
            (bxgyGetEffect === "PERCENTAGE" &&
                Number.isFinite(Number(bxgyGetPercentage)) &&
                Number(bxgyGetPercentage) > 0 &&
                Number(bxgyGetPercentage) <= 100) ||
            (bxgyGetEffect === "AMOUNT_OFF_EACH" &&
                Number.isFinite(Number(bxgyGetAmount)) &&
                Number(bxgyGetAmount) > 0);

        const shippingCountriesValid =
            groupValue !== "shipping" ||
            shippingDestinationMode !== "SPECIFIC_COUNTRIES" ||
            shippingDestinationCountries.length > 0;

        const maximumShippingPriceValid =
            groupValue !== "shipping" ||
            maximumShippingPrice === "" ||
            (Number.isFinite(Number(maximumShippingPrice)) &&
                Number(maximumShippingPrice) > 0);

        const appCappedValueValid =
            discountValue !== "" &&
            Number.isFinite(Number(discountValue)) &&
            Number(discountValue) > 0 &&
            Number(discountValue) <= 100 &&
            cappedAmount !== "" &&
            Number.isFinite(Number(cappedAmount)) &&
            Number(cappedAmount) > 0;

        const valueValid =
            groupValue === "bxgy"
                ? bxgyBuyRequirementValid && bxgyGetQuantityValid && bxgyGetEffectValid
                : groupValue === "shipping"
                    ? shippingCountriesValid && maximumShippingPriceValid
                    : isAppCappedTemplate
                        ? appCappedValueValid
                        : defaultValueValid;

        const defaultConditionsValid =
            minimumType === "NONE" ||
            (minimumType === "SUBTOTAL" && Number(minimumSubtotal) > 0) ||
            (minimumType === "QUANTITY" && Number(minimumQuantity) > 0);

        const bxgyBuyTargetsValid =
            (bxgyBuyTargetType === "PRODUCTS" && bxgyBuyProducts.length > 0) ||
            (bxgyBuyTargetType === "COLLECTIONS" &&
                bxgyBuyCollections.length > 0);

        const bxgyGetTargetsValid =
            (bxgyGetTargetType === "PRODUCTS" && bxgyGetProducts.length > 0) ||
            (bxgyGetTargetType === "COLLECTIONS" &&
                bxgyGetCollections.length > 0);

        const bxgyUsesPerOrderLimitValid =
            bxgyUsesPerOrderLimit === "" ||
            (Number.isInteger(Number(bxgyUsesPerOrderLimit)) &&
                Number(bxgyUsesPerOrderLimit) > 0);

        const conditionsValid = skipConditionsStep
            ? true
            : groupValue === "bxgy"
                ? bxgyBuyTargetsValid && bxgyGetTargetsValid && bxgyUsesPerOrderLimitValid
                : defaultConditionsValid;

        const scheduleValid =
            !endsAt || !startsAt || new Date(endsAt) > new Date(startsAt);

        return {
            basicsValid,
            appCappedValueValid,
            valueValid,
            conditionsValid,
            scheduleValid,
            bxgyBuyRequirementValid,
            bxgyGetQuantityValid,
            bxgyGetEffectValid,
            bxgyBuyTargetsValid,
            bxgyGetTargetsValid,
            bxgyUsesPerOrderLimitValid,
            shippingCountriesValid,
            maximumShippingPriceValid,
        };
    }, [
        title,
        method,
        discountCode,
        discountValue,
        cappedAmount,
        isPercentage,
        minimumType,
        minimumSubtotal,
        minimumQuantity,
        bxgyBuyRequirementType,
        bxgyBuyQuantity,
        bxgyBuyAmount,
        bxgyBuyTargetType,
        bxgyBuyProducts,
        bxgyBuyCollections,
        bxgyGetQuantity,
        bxgyGetEffect,
        bxgyGetPercentage,
        bxgyGetAmount,
        bxgyGetTargetType,
        bxgyGetProducts,
        bxgyGetCollections,
        bxgyUsesPerOrderLimit,
        shippingDestinationMode,
        shippingDestinationCountries,
        maximumShippingPrice,
        startsAt,
        endsAt,
        groupValue,
        isAppCappedTemplate,
    ]);

    const canGoToStep = (stepIndex) => {
        if (stepIndex <= 0) return true;
        if (stepIndex === 1) return validation.basicsValid;

        if (stepIndex === 2) {
            if (groupValue === "bxgy" || groupValue === "shipping") {
                return validation.basicsValid && validation.valueValid;
            }

            const targetingValid =
                groupValue !== "product" ||
                scopeMode === "ALL" ||
                (scopeMode === "SPECIFIC_PRODUCTS" && targetProducts.length > 0) ||
                (scopeMode === "SPECIFIC_COLLECTIONS" &&
                    targetCollections.length > 0);

            return (
                validation.basicsValid &&
                validation.valueValid &&
                targetingValid
            );
        }

        if (stepIndex === 3) {
            return (
                validation.basicsValid &&
                validation.valueValid &&
                validation.conditionsValid
            );
        }

        if (stepIndex === 4) {
            return (
                validation.basicsValid &&
                validation.valueValid &&
                validation.conditionsValid &&
                validation.scheduleValid
            );
        }

        return false;
    };

    return {
        title, setTitle,
        description, setDescription,
        method, setMethod,
        discountCode, setDiscountCode,

        isPercentage, setIsPercentage,
        discountValue, setDiscountValue,
        cappedAmount, setCappedAmount,

        minimumType, setMinimumType,
        minimumSubtotal, setMinimumSubtotal,
        minimumQuantity, setMinimumQuantity,
        usageLimit, setUsageLimit,
        appliesOncePerCustomer, setAppliesOncePerCustomer,
        combineWithOrderDiscounts, setCombineWithOrderDiscounts,
        combineWithProductDiscounts, setCombineWithProductDiscounts,
        combineWithShippingDiscounts, setCombineWithShippingDiscounts,

        scopeMode, setScopeMode,
        targetProducts, setTargetProducts,
        targetCollections, setTargetCollections,

        bxgyBuyRequirementType, setBxgyBuyRequirementType,
        bxgyBuyQuantity, setBxgyBuyQuantity,
        bxgyBuyAmount, setBxgyBuyAmount,
        bxgyBuyTargetType, setBxgyBuyTargetType,
        bxgyBuyProducts, setBxgyBuyProducts,
        bxgyBuyCollections, setBxgyBuyCollections,

        bxgyGetQuantity, setBxgyGetQuantity,
        bxgyGetEffect, setBxgyGetEffect,
        bxgyGetPercentage, setBxgyGetPercentage,
        bxgyGetAmount, setBxgyGetAmount,
        bxgyGetTargetType, setBxgyGetTargetType,
        bxgyGetProducts, setBxgyGetProducts,
        bxgyGetCollections, setBxgyGetCollections,
        bxgyUsesPerOrderLimit, setBxgyUsesPerOrderLimit,

        shippingDestinationMode, setShippingDestinationMode,
        shippingDestinationCountries, setShippingDestinationCountries,
        maximumShippingPrice, setMaximumShippingPrice,

        startsAt, setStartsAt,
        endsAt, setEndsAt,

        currentStep, setCurrentStep,
        validation,
        canGoToStep,
    };
}