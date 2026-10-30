// app/test/discount-usage.server.test.js
// TDD: red test first, then fix. Verifies cancelled reset (B4) + refund proration (B5).
import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mock fns so vi.mock factories can reference them.
const mocks = vi.hoisted(() => ({
    discountUsageUpsert: vi.fn(),
    discountUsageUpdateMany: vi.fn(),
    discountUsageUpdate: vi.fn(),
    discountUsageFindMany: vi.fn(),
    discountUsageAggregate: vi.fn(),
    discountUpdate: vi.fn(),
}));

vi.mock("../db.server.js", () => ({
    default: {
        discountUsage: {
            upsert: mocks.discountUsageUpsert,
            updateMany: mocks.discountUsageUpdateMany,
            update: mocks.discountUsageUpdate,
            findMany: mocks.discountUsageFindMany,
            aggregate: mocks.discountUsageAggregate,
        },
        discount: {
            update: mocks.discountUpdate,
        },
        $transaction: async (arg) => {
            if (Array.isArray(arg)) {
                // Array form: execute all operations in parallel.
                return Promise.all(arg);
            }
            // Callback form.
            const tx = {
                discountUsage: {
                    upsert: mocks.discountUsageUpsert,
                    update: mocks.discountUsageUpdate,
                    aggregate: mocks.discountUsageAggregate,
                },
                discount: { update: mocks.discountUpdate },
            };
            return arg(tx);
        },
    },
}));

const { resolveDiscountMatchKeyMock } = vi.hoisted(() => ({
    resolveDiscountMatchKeyMock: vi.fn(async () => null),
}));

vi.mock("../utils/discount-identity.server.js", () => ({
    resolveDiscountMatchKey: resolveDiscountMatchKeyMock,
}));

vi.mock("./logger.server.js", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
    upsertUsageFromOrder,
    markUsageRefunded,
    prorateRefundAcrossUsages,
} from "../utils/discount-usage.server.js";

const {
    discountUsageUpsert,
    discountUsageUpdateMany,
    discountUsageUpdate,
    discountUsageFindMany,
    discountUsageAggregate,
    discountUpdate,
} = mocks;

const orderWithDiscount = {
    id: "456",
    admin_graphql_api_id: "gid://shopify/Order/456",
    name: "#1001",
    currency: "USD",
    presentment_currency: "USD",
    cancelled_at: null,
    created_at: "2026-01-15T10:00:00Z",
    subtotal_price: "100.00",
    total_price: "100.00",
    customer: { id: "1", admin_graphql_api_id: "gid://shopify/Customer/1", orders_count: 1 },
    line_items: [
        {
            id: "line1",
            discount_allocations: [
                { discount_application_index: 0, amount: "10.00" },
            ],
        },
    ],
    shipping_lines: [],
    discount_applications: [
        {
            id: "app1",
            type: "automatic",
            title: "Capped order discount",
            code: null,
        },
    ],
};

const shopId = "shop1";

describe("discount-usage.server", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    // --- B4: cancelled reset ---

    it("upsert create path sets cancelled from totals.cancelled", async () => {
        discountUsageFindMany.mockResolvedValue([]);
        resolveDiscountMatchKeyMock.mockResolvedValue({
            matchedDiscount: { id: "d1", matchType: "AUTOMATIC", matchKey: "shopify:auto:test" },
        });
        discountUsageUpsert.mockResolvedValue({ id: "u1" });
        discountUsageAggregate.mockResolvedValue({
            _count: { id: 1 },
            _sum: { discountAmount: 10 },
        });
        discountUpdate.mockResolvedValue({});

        await upsertUsageFromOrder({ shopId, order: orderWithDiscount, webhookId: "w1" });

        expect(discountUsageUpsert).toHaveBeenCalledTimes(1);
        const createData = discountUsageUpsert.mock.calls[0][0].create;
        expect(createData.cancelled).toBe(false);
    });

    it("upsert update path un-cancels restored order", async () => {
        discountUsageFindMany.mockResolvedValue([]);
        resolveDiscountMatchKeyMock.mockResolvedValue({
            matchedDiscount: { id: "d1", matchType: "AUTOMATIC", matchKey: "shopify:auto:test" },
        });
        discountUsageUpsert.mockResolvedValue({ id: "u1", discountId: "d1" });
        discountUsageAggregate.mockResolvedValue({
            _count: { id: 1 },
            _sum: { discountAmount: 10 },
        });
        discountUpdate.mockResolvedValue({});

        const restoredOrder = { ...orderWithDiscount, cancelled_at: null };

        await upsertUsageFromOrder({ shopId, order: restoredOrder, webhookId: "w1" });

        expect(discountUsageUpsert).toHaveBeenCalledTimes(1);
        const updateData = discountUsageUpsert.mock.calls[0][0].update;
        expect(updateData.cancelled).toBe(false);
    });

    it("upsert update path still cancels when cancelled_at is set", async () => {
        discountUsageFindMany.mockResolvedValue([]);
        resolveDiscountMatchKeyMock.mockResolvedValue({
            matchedDiscount: { id: "d1", matchType: "AUTOMATIC", matchKey: "shopify:auto:test" },
        });
        discountUsageUpsert.mockResolvedValue({ id: "u1", discountId: "d1" });
        discountUsageAggregate.mockResolvedValue({
            _count: { id: 1 },
            _sum: { discountAmount: 10 },
        });
        discountUpdate.mockResolvedValue({});

        const cancelledOrder = { ...orderWithDiscount, cancelled_at: "2026-01-16T00:00:00Z" };

        await upsertUsageFromOrder({ shopId, order: cancelledOrder, webhookId: "w1" });

        const updateData = discountUsageUpsert.mock.calls[0][0].update;
        expect(updateData.cancelled).toBe(true);
    });

    // --- B5: prorateRefundAcrossUsages ---

    it("prorateRefundAcrossUsages: single row gets full total", () => {
        const usages = [{ id: "u1", discountAmount: 50 }];
        const result = prorateRefundAcrossUsages(usages, 100);
        expect(result.get("u1")).toBe(100);
    });

    it("prorateRefundAcrossUsages: proportional split by discountAmount", () => {
        const usages = [
            { id: "u1", discountAmount: 30 },
            { id: "u2", discountAmount: 70 },
        ];
        const result = prorateRefundAcrossUsages(usages, 100);
        expect(result.get("u1")).toBe(30);
        expect(result.get("u2")).toBe(70);
    });

    it("prorateRefundAcrossUsages: rounding invariant — sum equals total", () => {
        const usages = [
            { id: "u1", discountAmount: 33.33 },
            { id: "u2", discountAmount: 33.33 },
            { id: "u3", discountAmount: 33.34 },
        ];
        const result = prorateRefundAcrossUsages(usages, 100);
        const sum = [...result.values()].reduce((a, b) => a + b, 0);
        expect(sum).toBe(100);
        for (const v of result.values()) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(100);
        }
    });

    it("prorateRefundAcrossUsages: zero basis (>1 rows) → equal split", () => {
        const usages = [
            { id: "u1", discountAmount: 0 },
            { id: "u2", discountAmount: 0 },
        ];
        const result = prorateRefundAcrossUsages(usages, 100);
        expect(result.get("u1")).toBe(50);
        expect(result.get("u2")).toBe(50);
    });

    it("prorateRefundAcrossUsages: refundTotal 0 → all zeros", () => {
        const usages = [{ id: "u1", discountAmount: 50 }, { id: "u2", discountAmount: 50 }];
        const result = prorateRefundAcrossUsages(usages, 0);
        expect(result.get("u1")).toBe(0);
        expect(result.get("u2")).toBe(0);
    });

    // --- B5: markUsageRefunded per-row updates ---

    it("markUsageRefunded: per-row prorated amounts (not whole-order smear)", async () => {
        discountUsageFindMany.mockResolvedValue([
            { id: "u1", discountAmount: 30 },
            { id: "u2", discountAmount: 70 },
        ]);
        discountUsageUpdate.mockResolvedValue({});
        discountUsageAggregate.mockResolvedValue({
            _count: { id: 0 },
            _sum: { discountAmount: 0 },
        });

        await markUsageRefunded({
            shopId,
            shopifyOrderId: "456",
            refundPayload: { transactions: [{ amount: 100 }] },
        });

        // Two separate update calls, not one updateMany
        expect(discountUsageUpdate).toHaveBeenCalledTimes(2);
        expect(discountUsageUpdate.mock.calls[0][0].where).toEqual({ id: "u1" });
        expect(discountUsageUpdate.mock.calls[0][0].data.refundedAmount).toBe(30);
        expect(discountUsageUpdate.mock.calls[1][0].where).toEqual({ id: "u2" });
        expect(discountUsageUpdate.mock.calls[1][0].data.refundedAmount).toBe(70);
        expect(discountUsageUpdateMany).not.toHaveBeenCalled();
    });

    it("markUsageRefunded: no usage rows → no writes, no throw", async () => {
        discountUsageFindMany.mockResolvedValue([]);
        discountUsageAggregate.mockResolvedValue({
            _count: { id: 0 },
            _sum: { discountAmount: 0 },
        });

        await expect(
            markUsageRefunded({
                shopId,
                shopifyOrderId: "456",
                refundPayload: { transactions: [{ amount: 100 }] },
            })
        ).resolves.not.toThrow();

        expect(discountUsageUpdate).not.toHaveBeenCalled();
        expect(discountUsageUpdateMany).not.toHaveBeenCalled();
    });

    it("markUsageRefunded: refundTotal 0 → refunded flag not set", async () => {
        discountUsageFindMany.mockResolvedValue([{ id: "u1", discountAmount: 50 }]);
        discountUsageUpdate.mockResolvedValue({});
        discountUsageAggregate.mockResolvedValue({
            _count: { id: 0 },
            _sum: { discountAmount: 0 },
        });

        await markUsageRefunded({
            shopId,
            shopifyOrderId: "456",
            refundPayload: { transactions: [] },
        });
        expect(discountUsageUpdate.mock.calls[0][0].data.refunded).toBe(false);
        expect(discountUsageUpdate.mock.calls[0][0].data.refundedAmount).toBe(0);
    });
});
