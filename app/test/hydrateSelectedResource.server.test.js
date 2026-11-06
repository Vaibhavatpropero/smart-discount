import { describe, it, expect, vi } from "vitest";
import hydrateSelectedResource from "../utils/hydrateSelectedResource.server.js";
import { logger } from "../utils/logger.server.js";

const mockAdmin = (json) => ({
    graphql: vi.fn(async () => ({ json: async () => json })),
});

describe("hydrateSelectedResource.server", () => {
	it("returns a clean item when Product.description is null instead of throwing", async () => {
		const node = {
			id: "gid://shopify/Product/1",
			title: "Test product",
			handle: "test-product",
			description: null,
			status: "ACTIVE",
			featuredImage: null,
			priceRangeV2: { minVariantPrice: { amount: "10", currencyCode: "USD" } },
			variants: { edges: [] },
		};
		const admin = mockAdmin({ data: { nodes: [node] } });

		const result = await hydrateSelectedResource({
			admin,
			type: "product",
			ids: [node.id],
		});

		expect(result).toEqual([
			{
				id: node.id,
				type: "product",
				title: "Test product",
				handle: "test-product",
				description: null,
				status: "ACTIVE",
				image: null,
				priceLabel: "10 USD",
				skuPreview: null,
			},
		]);
	});

	it("returns a clean item when Collection.description is null instead of throwing", async () => {
		const node = {
			id: "gid://shopify/Collection/1",
			title: "Test collection",
			handle: "test-collection",
			description: null,
			image: null,
			productsCount: null,
		};
		const admin = mockAdmin({ data: { nodes: [node] } });

		const result = await hydrateSelectedResource({
			admin,
			type: "collection",
			ids: [node.id],
		});

		expect(result[0]).toMatchObject({
			id: node.id,
			type: "collection",
			title: "Test collection",
			handle: "test-collection",
			description: null,
		});
	});

	it("resolves product variants through the variant fragment", async () => {
		const node = {
			id: "gid://shopify/ProductVariant/1",
			title: "Small",
			sku: "T-SMALL",
			price: "10.00",
			product: {
				id: "gid://shopify/Product/1",
				title: "Test product",
				handle: "test-product",
				status: "ACTIVE",
				featuredImage: null,
				priceRangeV2: {
					minVariantPrice: { amount: "10.00", currencyCode: "USD" },
				},
			},
		};
		const admin = mockAdmin({ data: { nodes: [node] } });

		const result = await hydrateSelectedResource({
			admin,
			type: "variant",
			ids: [node.id],
		});

		expect(result[0]).toMatchObject({
			id: node.id,
			type: "product",
			title: "Test product — Small",
			skuPreview: "T-SMALL",
			priceLabel: "10.00 USD",
		});
	});

	it("returns an empty array and logs when the GraphQL response carries errors", async () => {
		const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
		const admin = mockAdmin({ errors: [{ message: "Internal server error" }] });

		const result = await hydrateSelectedResource({
			admin,
			type: "product",
			ids: ["gid://shopify/Product/1"],
		});

		expect(result).toEqual([]);
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});
});
