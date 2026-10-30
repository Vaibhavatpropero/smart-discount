// app/test/useDiscountWizardState.test.js
// TDD: red test first, then fix. Verifies edit route template wiring (G3 fix).
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { useDiscountWizardState } from "../components/discount-wizard/useDiscountWizardState";

function Probe({ template, groupConfig, groupValue, initialState }) {
    const state = useDiscountWizardState({ template, groupConfig, groupValue, initialState });
    return createElement("span", { "data-can-go-2": String(state.canGoToStep(2)) });
}

const groupConfig = { title: "App discounts", method: "AUTOMATIC", discountType: "APP_CAPPED" };
const appCappedTemplate = {
    discountType: "APP_CAPPED",
    name: "Capped percentage off order",
    defaultConfig: { isPercentage: true, minimumType: "NONE", cappedAmount: "" },
};

const baseInitialState = {
    title: "Test draft",
    scopeMode: "ALL", // make targetingValid true for non-product groups
    discountValue: "10",
};

describe("useDiscountWizardState — edit route template wiring", () => {
    it("APP_CAPPED template with empty cappedAmount blocks advance past Value", () => {
        const html = renderToString(
            createElement(Probe, {
                template: appCappedTemplate,
                groupConfig,
                groupValue: "app",
                initialState: { ...baseInitialState, cappedAmount: "" },
            })
        );
        expect(html).toContain('data-can-go-2="false"');
    });

    it("APP_CAPPED template with cappedAmount allows advance past Value", () => {
        const html = renderToString(
            createElement(Probe, {
                template: appCappedTemplate,
                groupConfig,
                groupValue: "app",
                initialState: { ...baseInitialState, cappedAmount: "50" },
            })
        );
        expect(html).toContain('data-can-go-2="true"');
    });

    it("template: null with empty cappedAmount allows advance (current bug)", () => {
        const html = renderToString(
            createElement(Probe, {
                template: null,
                groupConfig,
                groupValue: "app",
                initialState: { ...baseInitialState, cappedAmount: "" },
            })
        );
        // Documents the bug: with template null, isAppCappedTemplate is false,
        // valueValid skips cappedAmount check, so user can advance past Value.
        expect(html).toContain('data-can-go-2="true"');
    });
});
