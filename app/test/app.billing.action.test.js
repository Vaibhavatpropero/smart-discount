// app/test/app.billing.action.test.js
// TDD: red test first, then fix. Verifies ADVANCE purchase works in production (G7 fix).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock shopify.server (authenticate.admin).
vi.mock("../shopify.server.js", () => ({
    authenticate: {
        admin: vi.fn(async () => ({
            admin: { graphql: vi.fn() },
            session: { shop: "test.myshopify.com" },
        })),
    },
}));

// Mock db.server (prisma).
vi.mock("../db.server.js", () => ({
    default: {
        shop: {
            findUnique: vi.fn(async () => ({
                id: "shop1",
                shopDomain: "test.myshopify.com",
                planName: "BASIC",
                planStatus: "ACTIVE",
            })),
        },
    },
}));

// Mock billing.server (createAppSubscription, savePendingSubscriptionChange).
vi.mock("../utils/billing.server.js", () => ({
    createAppSubscription: vi.fn(async () => ({
        confirmationUrl: "https://test.myshopify.com/admin/apps/.../billing?activated=1",
    })),
    savePendingSubscriptionChange: vi.fn(async () => ({})),
}));

// Mock logger.server (file writes — keep tests hermetic).
vi.mock("../utils/logger.server.js", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { action } from "../routes/app.billing.jsx";

const makeRequest = (entries) => {
    const formData = new FormData();
    (entries || []).forEach(([k, v]) => formData.set(k, v));
    return new Request("http://x/app/billing", { method: "POST", body: formData });
};

describe("app.billing.action — ADVANCE purchase in production", () => {
    beforeEach(() => {
        vi.stubEnv("NODE_ENV", "production");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("ADVANCE upgrade in production proceeds (no 403 block)", async () => {
        const result = await action({
            request: makeRequest([
                ["intent", "upgrade"],
                ["plan", "ADVANCE"],
            ]),
        });

        // data() without init returns init: null → assert on result.data
        expect(result.data.confirmationUrl).toBeDefined();
    });

    it("ADVANCE upgrade in dev mode still succeeds", async () => {
        vi.stubEnv("NODE_ENV", "development");

        const result = await action({
            request: makeRequest([
                ["intent", "upgrade"],
                ["plan", "ADVANCE"],
            ]),
        });

        expect(result.data.confirmationUrl).toBeDefined();
    });

    it("invalid intent → 400", async () => {
        const result = await action({
            request: makeRequest([["intent", "bogus"], ["plan", "ADVANCE"]]),
        });
        expect(result.init.status).toBe(400);
    });

    it("invalid plan → 400", async () => {
        const result = await action({
            request: makeRequest([["intent", "upgrade"], ["plan", "ENTERPRISE"]]),
        });
        expect(result.init.status).toBe(400);
    });
});
