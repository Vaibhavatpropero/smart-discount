// app/utils/hydrateSelectedResource.server.js
import { logger } from "./logger.server";

const SRC = "hydrateSelectedResource.server"

const NODES_QUERY = `#graphql
  query ResourceNodes($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product {
        id
        title
        handle
        description
        status
        featuredImage { url altText }
        priceRangeV2 { minVariantPrice { amount currencyCode } }
        variants(first: 5) { edges { node { sku } } }
      }
      ... on Collection {
        id
        title
        handle
        description
        image { url altText }
        productsCount { count }
      }
      ... on ProductVariant {
        id
        title
        sku
        price
        product {
          id
          title
          handle
          status
          featuredImage { url altText }
          priceRangeV2 { minVariantPrice { amount currencyCode } }
        }
      }
    }
  }
`;

/**
 * Normalizes a Shopify Product node into the ResourcePicker item contract.
 * @param {object} node - GraphQL Product node from the `nodes` query
 * @returns {object} { id, type, title, handle, description, status, image, priceLabel, skuPreview }
 */
function normalizeProduct(node) {
    const sku = node.variants?.edges?.[ 0 ]?.node?.sku || null;
    const price = node.priceRangeV2?.minVariantPrice;

    const rawDescription = typeof node.description === "string" ? node.description : "";
    const description =
        rawDescription.length > 200 ? `${rawDescription.slice(0, 200)}...` : rawDescription || null;

    return {
        id: node.id,
        type: "product",
        title: node.title,
        handle: node.handle,
        description,
        status: node.status,
        image: node.featuredImage?.url || null,
        priceLabel: price ? `${price.amount} ${price.currencyCode}` : null,
        skuPreview: sku,
    };
}

/**
 * Normalizes a Shopify Collection node into the ResourcePicker item contract.
 * @param {object} node - GraphQL Collection node from the `nodes` query
 * @returns {object} { id, type, title, handle, description, status, image, countLabel }
 */
function normalizeCollection(node) {
    const rawDescription = typeof node.description === "string" ? node.description : "";
    const description =
        rawDescription.length > 200 ? `${rawDescription.slice(0, 200)}...` : rawDescription || null;

    return {
        id: node.id,
        type: "collection",
        title: node.title,
        handle: node.handle,
        description,
        status: "ACTIVE",
        image: node.image?.url || null,
        countLabel: `${node.productsCount?.count ?? 0} products`,
    };
}

/**
 * Normalizes a Shopify ProductVariant node into the ResourcePicker item contract.
 *
 * @param {object} node - GraphQL ProductVariant node from the `nodes` query
 * @returns {object} { id, type, title, handle, description, status, image, priceLabel, skuPreview }
 *
 * Note: in Admin API 2025-10 `ProductVariant.price` is a `Money` scalar
 * (serialized as a decimal string like "10.00"), not a `MoneyV2` object — so it
 * must not carry sub-selections in the query. The currency code is taken from the
 * parent product's price range instead.
 */
function normalizeVariant(node) {
    const price = typeof node.price === "string" && node.price !== "" ? node.price : null;
    const product = node.product || {};
    const currencyCode = product.priceRangeV2?.minVariantPrice?.currencyCode ?? null;
    const priceLabel = price ? `${price}${currencyCode ? ` ${currencyCode}` : ""}` : null;

    return {
        id: node.id,
        type: "product",
        title: `${product.title ?? ""} — ${node.title}`.trim(),
        handle: product.handle ?? null,
        description: null,
        status: product.status ?? null,
        image: product.featuredImage?.url ?? null,
        priceLabel,
        skuPreview: node.sku ?? null,
    };
}

export default async function hydrateSelectedResource({ admin, type, ids }) {
    if (!Array.isArray(ids) || ids.length === 0) return [];

    const response = await admin.graphql(NODES_QUERY, {
        variables: { ids },
    });
    const json = await response.json();

    if (Array.isArray(json?.errors) && json.errors.length > 0) {
        logger.warn(SRC, "Resource nodes query returned GraphQL errors", { type, ids, errors: json.errors });
    }

    const nodes = json?.data?.nodes || [];

    return nodes
        .map((node) => {
            if (!node?.id) return null;

            if (type === "collection") {
                return node.handle !== undefined && node.productsCount !== undefined
                    ? normalizeCollection(node)
                    : null;
            }

            if (type === "variant") {
                return node.title !== undefined && node.product !== undefined
                    ? normalizeVariant(node)
                    : null;
            }

            return node.status !== undefined && node.priceRangeV2 !== undefined
                ? normalizeProduct(node)
                : null;
        })
        .filter(Boolean);
}