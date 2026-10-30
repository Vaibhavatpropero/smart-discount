// app/test/discount-templates.test.js
// TDD: red test first, then fix. Verifies template family contract (G2+G5 fix).
import { describe, it, expect, vi } from "vitest";

// Mock shopify.server to prevent shopifyApp() call at module load (it needs SHOPIFY_APP_URL env).
vi.mock("../shopify.server", () => ({
    authenticate: {
        admin: vi.fn(),
    },
    // plan-gate.server imports shopify.server; mock its default export shape
    default: {},
}));

import {
    DISCOUNT_TEMPLATE_FAMILIES,
    DISCOUNT_TEMPLATES,
} from "../configs/discount-templates.js";
import { TEMPLATE_FAMILY_META } from "../routes/app.discounts.jsx";

describe("discount templates family contract", () => {
    it("DISCOUNT_TEMPLATE_FAMILIES.APP === 'app'", () => {
        expect(DISCOUNT_TEMPLATE_FAMILIES.APP).toBe("app");
    });

    it("app-capped-order template uses family 'app'", () => {
        const template = DISCOUNT_TEMPLATES.find((t) => t.slug === "app-capped-order");
        expect(template).toBeDefined();
        expect(template.family).toBe("app");
        expect(template.discountType).toBe("APP_CAPPED");
    });

    it("every template family is a valid DISCOUNT_TEMPLATE_FAMILIES value", () => {
        const validFamilies = new Set(Object.values(DISCOUNT_TEMPLATE_FAMILIES));
        for (const template of DISCOUNT_TEMPLATES) {
            expect(validFamilies.has(template.family)).toBe(true);
        }
    });

    it("free-gift templates keep family 'free_gift'", () => {
        for (const slug of ["free-gift-threshold", "free-gift-product"]) {
            const template = DISCOUNT_TEMPLATES.find((t) => t.slug === slug);
            expect(template.family).toBe("free_gift");
        }
    });

    it("every template family has a TEMPLATE_FAMILY_META entry (anti-disappearance guard)", () => {
        const families = new Set(DISCOUNT_TEMPLATES.map((t) => t.family));
        for (const family of families) {
            const meta = TEMPLATE_FAMILY_META[family];
            expect(meta).toBeDefined();
            expect(typeof meta.title).toBe("string");
            expect(typeof meta.description).toBe("string");
        }
    });
});
