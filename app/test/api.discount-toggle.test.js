// app/routes/api.discount-toggle.test.js
// TDD: red test first, then fix. Verifies app-discount toggle fragments (B3 fix).
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma singleton. Mock fns exposed via __mocks for direct access.
vi.mock("../db.server", () => {
    const findUnique = vi.fn();
    const update = vi.fn();
    const discountEventCreate = vi.fn();
    return {
        default: {
            discount: { findUnique, update },
            discountEvent: { create: discountEventCreate },
            // Regular async function so mockReset in beforeEach does not
            // clear its callback-invoking implementation.
            $transaction: async (cb) => {
                const tx = { discount: { update }, discountEvent: { create: discountEventCreate } };
                return cb(tx);
            },
        },
        __mocks: { findUnique, update, discountEventCreate },
    };
});

// Mock shopify.server. graphql exposed via __mocks for direct access.
vi.mock("../shopify.server", () => {
    const graphql = vi.fn(async () => ({ json: vi.fn() }));
    return {
        authenticate: {
            admin: vi.fn(async () => ({
                admin: { graphql },
                session: { shop: "shop1" },
            })),
        },
        __mocks: { graphql },
    };
});

vi.mock("../utils/plan-gate.server", () => ({
    getPlanContext: vi.fn(async () => ({ shop: { id: "shop1" }, access: { isAdvance: true } })),
    getDiscountAccessState: vi.fn(() => ({ canReenable: true, canDisable: true })),
    __mocks: {},
}));

import { action } from "../routes/api.discount-toggle.jsx";
import { default as prisma } from "../db.server";
import { __mocks as shopifyMocks } from "../shopify.server";

const findUniqueMock = vi.mocked(prisma.discount.findUnique);
const updateMock = vi.mocked(prisma.discount.update);
const graphqlMock = shopifyMocks.graphql;

const makeRequest = (entries) => {
    const formData = new FormData();
    (entries || []).forEach(([k, v]) => formData.set(k, v));
    return new Request("http://x/api/discount-toggle", { method: "POST", body: formData });
};

const appDiscount = {
    id: "d1",
    shopId: "shop1",
    method: "AUTOMATIC",
    status: "ACTIVE",
    startsAt: new Date("2026-01-01"),
    endsAt: new Date("2026-12-31"),
    shopifyDiscountId: "gid://shopify/DiscountNode/1",
    createdOnPlan: "ADVANCE",
    discountType: "APP_CAPPED",
    customerSegments: null,
    shippingDestinationCountries: null,
};

describe("api.discount-toggle — app-discount fragments", () => {
    beforeEach(() => {
        findUniqueMock.mockReset();
        updateMock.mockReset();
        graphqlMock.mockReset();
        updateMock.mockResolvedValue({
            id: "d1",
            status: "DISABLED",
            startsAt: new Date("2026-01-01"),
            endsAt: new Date("2026-12-31"),
            lastSyncedAt: new Date(),
        });
    });

    it("app AUTOMATIC toggle succeeds — no 422 'did not return updated discount data'", async () => {
        findUniqueMock.mockResolvedValue(appDiscount);
        graphqlMock.mockResolvedValue({
            json: async () => ({
                data: {
                    discountAutomaticDeactivate: {
                        automaticDiscountNode: {
                            id: "node-1",
                            automaticDiscount: {
                                __typename: "DiscountAutomaticApp",
                                startsAt: "2026-01-01T00:00:00Z",
                                endsAt: null,
                                status: "INACTIVE",
                            },
                        },
                        userErrors: [],
                    },
                },
            }),
        });

        const result = await action({ request: makeRequest([["discountId", "d1"]]) });

        // data() without init returns init: null, so assert on result.data instead
        expect(result.data.success).toBe(true);
        expect(result.data.discount.status).toBe("DISABLED"); // INACTIVE -> DISABLED

        // Tripwire: mutation string contains the app fragment
        const mutationArg = graphqlMock.mock.calls[0][0];
        expect(mutationArg).toContain("... on DiscountAutomaticApp");
    });

    it("app CODE toggle succeeds", async () => {
        findUniqueMock.mockResolvedValue({ ...appDiscount, method: "CODE" });
        graphqlMock.mockResolvedValue({
            json: async () => ({
                data: {
                    discountCodeDeactivate: {
                        codeDiscountNode: {
                            id: "node-1",
                            codeDiscount: {
                                __typename: "DiscountCodeApp",
                                startsAt: "2026-01-01T00:00:00Z",
                                endsAt: null,
                                status: "INACTIVE",
                            },
                        },
                        userErrors: [],
                    },
                },
            }),
        });

        const result = await action({ request: makeRequest([["discountId", "d1"]]) });

        expect(result.data.success).toBe(true);
        const mutationArg = graphqlMock.mock.calls[0][0];
        expect(mutationArg).toContain("... on DiscountCodeApp");
    });

    it("endsAt preserved when Shopify omits it", async () => {
        findUniqueMock.mockResolvedValue(appDiscount);
        graphqlMock.mockResolvedValue({
            json: async () => ({
                data: {
                    discountAutomaticDeactivate: {
                        automaticDiscountNode: {
                            id: "node-1",
                            automaticDiscount: {
                                __typename: "DiscountAutomaticApp",
                                startsAt: "2026-01-01T00:00:00Z",
                                status: "INACTIVE",
                            },
                        },
                        userErrors: [],
                    },
                },
            }),
        });

        await action({ request: makeRequest([["discountId", "d1"]]) });

        expect(updateMock).toHaveBeenCalledTimes(1);
        // prisma.update takes a single object arg: calls[0][0] is the config
        const updateData = updateMock.mock.calls[0][0].data;
        // endsAt should fall back to existing discount.endsAt, NOT null
        expect(updateData.endsAt).toEqual(appDiscount.endsAt);
        expect(updateData.endsAt).not.toBeNull();
    });

    it("regression: userErrors → 422", async () => {
        findUniqueMock.mockResolvedValue(appDiscount);
        graphqlMock.mockResolvedValue({
            json: async () => ({
                data: {
                    discountAutomaticDeactivate: {
                        automaticDiscountNode: {
                            id: "node-1",
                            automaticDiscount: { __typename: "DiscountAutomaticApp", status: "INACTIVE" },
                        },
                        userErrors: [{ field: ["field"], message: "boom" }],
                    },
                },
            }),
        });

        const result = await action({ request: makeRequest([["discountId", "d1"]]) });
        expect(result.init.status).toBe(422);
    });

    it("regression: non-ACTIVE/SCHEDULED status → 400", async () => {
        findUniqueMock.mockResolvedValue({ ...appDiscount, status: "DRAFT" });

        const result = await action({ request: makeRequest([["discountId", "d1"]]) });
        expect(result.init.status).toBe(400);
    });

    it("regression: native BASIC AUTOMATIC toggle still succeeds", async () => {
        findUniqueMock.mockResolvedValue({ ...appDiscount, discountType: "ORDER_PERCENTAGE" });
        graphqlMock.mockResolvedValue({
            json: async () => ({
                data: {
                    discountAutomaticDeactivate: {
                        automaticDiscountNode: {
                            id: "node-1",
                            automaticDiscount: {
                                __typename: "DiscountAutomaticBasic",
                                startsAt: "2026-01-01T00:00:00Z",
                                endsAt: null,
                                status: "INACTIVE",
                            },
                        },
                        userErrors: [],
                    },
                },
            }),
        });

        const result = await action({ request: makeRequest([["discountId", "d1"]]) });
        expect(result.data.success).toBe(true);
    });
});
