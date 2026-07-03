// app/components/discount-wizard/useDiscountWizardState.js
import { useMemo, useState } from "react";

export function useDiscountWizardState({ groupConfig, template, groupValue }) {
    const [ title, setTitle ] = useState(template?.name ? `${template.name} draft` : `${groupConfig.title} draft`);
    const [ description, setDescription ] = useState(template?.description || "");
    const [ method, setMethod ] = useState(groupConfig.method || "AUTOMATIC");
    const [ discountCode, setDiscountCode ] = useState("");

    const [ isPercentage, setIsPercentage ] = useState(true);
    const [ discountValue, setDiscountValue ] = useState("");

    const [ minimumType, setMinimumType ] = useState("NONE");
    const [ minimumSubtotal, setMinimumSubtotal ] = useState("");
    const [ minimumQuantity, setMinimumQuantity ] = useState("");
    const [ usageLimit, setUsageLimit ] = useState("");
    const [ appliesOncePerCustomer, setAppliesOncePerCustomer ] = useState(false);
    const [ combineWithOrderDiscounts, setCombineWithOrderDiscounts ] = useState(false);
    const [ combineWithProductDiscounts, setCombineWithProductDiscounts ] = useState(false);
    const [ combineWithShippingDiscounts, setCombineWithShippingDiscounts ] = useState(false);

    const [ scopeMode, setScopeMode ] = useState(
        groupValue === "product" ? "ALL" : "ENTIRE_ORDER"
    );
    const [ targetProducts, setTargetProducts ] = useState([]);
    const [ targetCollections, setTargetCollections ] = useState([]);

    const [ bxgyBuyRequirementType, setBxgyBuyRequirementType ] = useState("QUANTITY");
    const [ bxgyBuyQuantity, setBxgyBuyQuantity ] = useState("");
    const [ bxgyBuyAmount, setBxgyBuyAmount ] = useState("");
    const [ bxgyBuyTargetType, setBxgyBuyTargetType ] = useState("PRODUCTS");
    const [ bxgyBuyProducts, setBxgyBuyProducts ] = useState([]);
    const [ bxgyBuyCollections, setBxgyBuyCollections ] = useState([]);

    const [ bxgyGetQuantity, setBxgyGetQuantity ] = useState("1");
    const [ bxgyGetEffect, setBxgyGetEffect ] = useState("FREE");
    const [ bxgyGetPercentage, setBxgyGetPercentage ] = useState("");
    const [ bxgyGetTargetType, setBxgyGetTargetType ] = useState("PRODUCTS");
    const [ bxgyGetProducts, setBxgyGetProducts ] = useState([]);
    const [ bxgyGetCollections, setBxgyGetCollections ] = useState([]);
    const [ bxgyUsesPerOrderLimit, setBxgyUsesPerOrderLimit ] = useState("");

    const [ startsAt, setStartsAt ] = useState("");
    const [ endsAt, setEndsAt ] = useState("");

    const [ currentStep, setCurrentStep ] = useState(0);

    const validation = useMemo(() => {
        const basicsValid =
            title.trim().length > 0 && (method !== "CODE" || discountCode.trim().length > 0);

        const defaultValueValid =
            discountValue !== "" &&
            Number.isFinite(Number(discountValue)) &&
            Number(discountValue) > 0 &&
            (!isPercentage || Number(discountValue) <= 100);

        const bxgyBuyRequirementValid =
            bxgyBuyRequirementType === "QUANTITY"
                ? Number.isInteger(Number(bxgyBuyQuantity)) && Number(bxgyBuyQuantity) > 0
                : Number.isFinite(Number(bxgyBuyAmount)) && Number(bxgyBuyAmount) > 0;

        const bxgyGetQuantityValid =
            Number.isInteger(Number(bxgyGetQuantity)) && Number(bxgyGetQuantity) > 0;

        const bxgyGetEffectValid =
            bxgyGetEffect === "FREE" ||
            (
                bxgyGetEffect === "PERCENTAGE" &&
                Number.isFinite(Number(bxgyGetPercentage)) &&
                Number(bxgyGetPercentage) > 0 &&
                Number(bxgyGetPercentage) <= 100
            );

        const valueValid =
            groupValue === "bxgy"
                ? bxgyBuyRequirementValid && bxgyGetQuantityValid && bxgyGetEffectValid
                : defaultValueValid;

        const defaultConditionsValid =
            minimumType === "NONE" ||
            (minimumType === "SUBTOTAL" && Number(minimumSubtotal) > 0) ||
            (minimumType === "QUANTITY" && Number(minimumQuantity) > 0);

        const bxgyBuyTargetsValid =
            (bxgyBuyTargetType === "PRODUCTS" && bxgyBuyProducts.length > 0) ||
            (bxgyBuyTargetType === "COLLECTIONS" && bxgyBuyCollections.length > 0);

        const bxgyGetTargetsValid =
            (bxgyGetTargetType === "PRODUCTS" && bxgyGetProducts.length > 0) ||
            (bxgyGetTargetType === "COLLECTIONS" && bxgyGetCollections.length > 0);

        const bxgyUsesPerOrderLimitValid =
            bxgyUsesPerOrderLimit === "" ||
            (Number.isInteger(Number(bxgyUsesPerOrderLimit)) && Number(bxgyUsesPerOrderLimit) > 0);

        const conditionsValid =
            groupValue === "bxgy"
                ? bxgyBuyTargetsValid && bxgyGetTargetsValid && bxgyUsesPerOrderLimitValid
                : defaultConditionsValid;

        const scheduleValid = !endsAt || !startsAt || new Date(endsAt) > new Date(startsAt);

        return {
            basicsValid,
            valueValid,
            conditionsValid,
            scheduleValid,
            bxgyBuyRequirementValid,
            bxgyGetQuantityValid,
            bxgyGetEffectValid,
            bxgyBuyTargetsValid,
            bxgyGetTargetsValid,
            bxgyUsesPerOrderLimitValid,
        };
    }, [
        title,
        method,
        discountCode,
        discountValue,
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
        bxgyGetTargetType,
        bxgyGetProducts,
        bxgyGetCollections,
        bxgyUsesPerOrderLimit,
        startsAt,
        endsAt,
        groupValue,
    ]);

    const canGoToStep = (stepIndex) => {
        if (stepIndex <= 0) return true;
        if (stepIndex === 1) return validation.basicsValid;

        if (stepIndex === 2) {
            if (groupValue === "bxgy") {
                return validation.basicsValid && validation.valueValid;
            }

            const targetingValid =
                groupValue !== "product" ||
                scopeMode === "ALL" ||
                (scopeMode === "SPECIFIC_PRODUCTS" && targetProducts.length > 0) ||
                (scopeMode === "SPECIFIC_COLLECTIONS" && targetCollections.length > 0);

            return validation.basicsValid && validation.valueValid && targetingValid;
        }

        if (stepIndex === 3) {
            return validation.basicsValid && validation.valueValid && validation.conditionsValid;
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
        bxgyGetTargetType, setBxgyGetTargetType,
        bxgyGetProducts, setBxgyGetProducts,
        bxgyGetCollections, setBxgyGetCollections,
        bxgyUsesPerOrderLimit, setBxgyUsesPerOrderLimit,

        startsAt, setStartsAt,
        endsAt, setEndsAt,
        currentStep, setCurrentStep,
        validation,
        canGoToStep,
    };
}