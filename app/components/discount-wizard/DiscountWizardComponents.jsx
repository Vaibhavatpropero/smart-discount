// app/components/discount-wizard/DiscountWizardComponents.jsx
/**
 * Shared components for discount wizard (create/edit routes).
 * Extracts common UI components to avoid duplication.
 */

import { STEPS } from "./WizardShell.jsx";
import BasicsStep from "./steps/BasicsStep.jsx";
import ValueStep from "./steps/ValueStep.jsx";
import ConditionsStep from "./steps/ConditionsStep.jsx";
import ScheduleStep from "./steps/ScheduleStep.jsx";
import ReviewStep from "./steps/ReviewStep.jsx";

/**
 * Maps form field names to wizard step indices for error navigation
 * Used by both create and edit routes
 */
export const ERROR_STEP_BY_FIELD = {
    // Step 0: Basics
    title: 0,
    discountCode: 0,

    // Step 1: Value
    discountValue: 1,
    cappedAmount: 1,

    // Step 2: Conditions
    targetProducts: 2,
    targetCollections: 2,
    minimumSubtotal: 2,
    minimumQuantity: 2,
    shippingDestinationCountries: 2,
    maximumShippingPrice: 2,
    bxgyBuyQuantity: 2,
    bxgyBuyAmount: 2,
    bxgyBuyProducts: 2,
    bxgyBuyCollections: 2,
    bxgyGetQuantity: 2,
    bxgyGetPercentage: 2,
    bxgyGetAmount: 2,
    bxgyGetProducts: 2,
    bxgyGetCollections: 2,
    bxgyUsesPerOrderLimit: 2,

    // Step 3: Schedule
    startsAt: 3,
    endsAt: 3,
    usageLimit: 3,
};

/**
 * Renders the appropriate step content based on current step
 * @param {object} props
 * @param {object} props.state - Wizard state
 * @param {object} props.errors - Validation errors
 * @param {object} props.groupConfig - Group configuration
 * @param {string} props.shopCurrency - Shop currency code
 * @param {boolean} props.busy - Whether navigation is in progress
 */
export function StepContent({ state, errors, groupConfig, shopCurrency, busy }) {
    switch (state.currentStep) {
        case 0:
            return <BasicsStep state={state} errors={errors} groupConfig={groupConfig} />;
        case 1:
            return (
                <ValueStep
                    state={state}
                    errors={errors}
                    shopCurrency={shopCurrency}
                    groupConfig={groupConfig}
                    busy={busy}
                />
            );
        case 2:
            return (
                <ConditionsStep
                    state={state}
                    errors={errors}
                    showTargeting={groupConfig.supportsTargets}
                    groupConfig={groupConfig}
                    shopCurrency={shopCurrency}
                />
            );
        case 3:
            return <ScheduleStep state={state} errors={errors} />;
        case 4:
        default:
            return (
                <ReviewStep
                    state={state}
                    groupConfig={groupConfig}
                    shopCurrency={shopCurrency}
                />
            );
    }
}

/**
 * Renders hidden form fields for form submission
 * @param {object} props
 * @param {object} props.state - Wizard state
 * @param {string} props.group - Discount group
 * @param {object} props.template - Template (optional)
 * @param {string} props.discountId - Discount ID (for edit route)
 * @param {string} props.discountType - Computed discount type
 */
export function HiddenFields({ state, group, template, discountId, discountType }) {
    const hiddenFields = (
        <>
            {discountId && <input type="hidden" name="id" value={discountId} />}
            <input type="hidden" name="group" value={group} />
            <input type="hidden" name="templateSlug" value={template?.slug || ""} />
            <input type="hidden" name="discountType" value={discountType} />
            <input type="hidden" name="method" value={state.method} />
            <input type="hidden" name="discountCode" value={state.discountCode} />
            <input type="hidden" name="title" value={state.title} />
            <input type="hidden" name="description" value={state.description} />
            <input type="hidden" name="isPercentage" value={String(state.isPercentage)} />
            <input type="hidden" name="discountValue" value={state.discountValue} />
            <input type="hidden" name="cappedAmount" value={state.cappedAmount} />
            <input type="hidden" name="scopeMode" value={state.scopeMode} />
            <input
                type="hidden"
                name="targetProducts"
                value={JSON.stringify(state.targetProducts.map((i) => i.id))}
            />
            <input
                type="hidden"
                name="targetCollections"
                value={JSON.stringify(state.targetCollections.map((i) => i.id))}
            />
            <input type="hidden" name="minimumType" value={state.minimumType} />
            <input type="hidden" name="minimumSubtotal" value={state.minimumSubtotal} />
            <input type="hidden" name="minimumQuantity" value={state.minimumQuantity} />
            <input type="hidden" name="usageLimit" value={state.usageLimit} />
            <input
                type="hidden"
                name="appliesOncePerCustomer"
                value={String(state.appliesOncePerCustomer)}
            />
            <input
                type="hidden"
                name="combineWithOrderDiscounts"
                value={String(state.combineWithOrderDiscounts)}
            />
            <input
                type="hidden"
                name="combineWithProductDiscounts"
                value={String(state.combineWithProductDiscounts)}
            />
            <input
                type="hidden"
                name="combineWithShippingDiscounts"
                value={String(state.combineWithShippingDiscounts)}
            />
            <input type="hidden" name="startsAt" value={state.startsAt} />
            <input type="hidden" name="endsAt" value={state.endsAt} />
        </>
    );

    // Add group-specific hidden fields
    const groupSpecificFields = getGroupSpecificFields({ state, group });

    return <>{hiddenFields}{groupSpecificFields}</>;
}

/**
 * Returns group-specific hidden fields
 * @param {object} params
 * @param {object} params.state - Wizard state
 * @param {string} params.group - Discount group
 */
function getGroupSpecificFields({ state, group }) {
    if (group === "shipping") {
        return (
            <>
                <input
                    type="hidden"
                    name="shippingDestinationMode"
                    value={state.shippingDestinationMode}
                />
                <input
                    type="hidden"
                    name="shippingDestinationCountries"
                    value={JSON.stringify(state.shippingDestinationCountries)}
                />
                <input
                    type="hidden"
                    name="maximumShippingPrice"
                    value={state.maximumShippingPrice}
                />
            </>
        );
    }

    if (group === "bxgy") {
        return (
            <>
                <input type="hidden" name="bxgyBuyRequirementType" value={state.bxgyBuyRequirementType} />
                <input type="hidden" name="bxgyBuyQuantity" value={state.bxgyBuyQuantity} />
                <input type="hidden" name="bxgyBuyAmount" value={state.bxgyBuyAmount} />
                <input type="hidden" name="bxgyBuyTargetType" value={state.bxgyBuyTargetType} />
                <input
                    type="hidden"
                    name="bxgyBuyProducts"
                    value={JSON.stringify(state.bxgyBuyProducts.map((i) => i.id))}
                />
                <input
                    type="hidden"
                    name="bxgyBuyCollections"
                    value={JSON.stringify(state.bxgyBuyCollections.map((i) => i.id))}
                />
                <input type="hidden" name="bxgyGetQuantity" value={state.bxgyGetQuantity} />
                <input type="hidden" name="bxgyGetEffect" value={state.bxgyGetEffect} />
                <input type="hidden" name="bxgyGetPercentage" value={state.bxgyGetPercentage} />
                <input type="hidden" name="bxgyGetAmount" value={state.bxgyGetAmount} />
                <input type="hidden" name="bxgyGetTargetType" value={state.bxgyGetTargetType} />
                <input
                    type="hidden"
                    name="bxgyGetProducts"
                    value={JSON.stringify(state.bxgyGetProducts.map((i) => i.id))}
                />
                <input
                    type="hidden"
                    name="bxgyGetCollections"
                    value={JSON.stringify(state.bxgyGetCollections.map((i) => i.id))}
                />
                <input type="hidden" name="bxgyUsesPerOrderLimit" value={state.bxgyUsesPerOrderLimit} />
            </>
        );
    }

    return null;
}

/**
 * Computes the discount type based on group and state
 * Used by both create and edit routes
 * @param {object} params
 * @param {string} params.group - Discount group
 * @param {object} params.groupConfig - Group configuration
 * @param {object} params.state - Wizard state
 * @param {object} params.template - Template (optional)
 */
export function computeDiscountType({ group, groupConfig, state, template }) {
    if (template?.discountType === "APP_CAPPED") {
        return "APP_CAPPED";
    }

    if (group === "product") {
        return state.isPercentage ? "PRODUCT_PERCENTAGE" : "PRODUCT_FIXED";
    }

    if (group === "order") {
        return state.isPercentage ? "ORDER_PERCENTAGE" : "ORDER_FIXED";
    }

    return groupConfig.discountType;
}

/**
 * Gets the visible steps for the current group
 * BXGY and Shipping groups don't have targeting step
 * @param {string} group - Discount group
 * @returns {Array} Filtered steps array
 */
export function getVisibleSteps(group) {
    return STEPS.filter((step) => {
        if (group === "bxgy" || group === "shipping") {
            return step.key !== "targeting";
        }
        return true;
    });
}

/**
 * Navigation handlers for wizard steps
 * @param {object} props
 * @param {object} props.state - Wizard state
 * @param {Array} props.stepItems - Visible steps
 */
export function useWizardNavigation({ state, stepItems }) {
    const visibleStepIndex = Math.min(state.currentStep, stepItems.length - 1);
    const isLastStep = state.currentStep === stepItems.length - 1;

    const goNext = () => {
        const next = state.currentStep + 1;
        if (next < stepItems.length && state.canGoToStep(next)) {
            state.setCurrentStep(next);
        }
    };

    const goBack = () => {
        state.setCurrentStep(Math.max(0, state.currentStep - 1));
    };

    return {
        visibleStepIndex,
        isLastStep,
        goNext,
        goBack,
    };
}