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
        price { amount currencyCode }
        product { id title handle status featuredImage { url altText } }
      }
    }
  }
`;

function normalizeProduct(node) {
    const sku = node.variants?.edges?.[ 0 ]?.node?.sku || null;
    const price = node.priceRangeV2?.minVariantPrice;

    return {
        id: node.id,
        type: "product",
        title: node.title,
        handle: node.handle,
        description: (node.description.length > 200 ? node.description.slice(0, 200) + "..." : node.description.slice(0, 200)) || null,
        status: node.status,
        image: node.featuredImage?.url || null,
        priceLabel: price ? `${price.amount} ${price.currencyCode}` : null,
        skuPreview: sku,
    };
}

function normalizeCollection(node) {
    return {
        id: node.id,
        type: "collection",
        title: node.title,
        handle: node.handle,
        description: (node.description.length > 200 ? node.description.slice(0, 200) + "..." : node.description.slice(0, 200)) || null,
        status: "ACTIVE",
        image: node.image?.url || null,
        countLabel: `${node.productsCount?.count ?? 0} products`,
    };
}

/**
 * Normalizes a Shopify ProductVariant node into the ResourcePicker item contract.
 * @param {object} node - GraphQL ProductVariant node
 * @returns {object} { id, type, title, handle, description, status, image, priceLabel, skuPreview }
 */
function normalizeVariant(node) {
    const price = node.price;
    const product = node.product || {};

    return {
        id: node.id,
        type: "product",
        title: `${product.title ?? ""} — ${node.title}`.trim(),
        handle: product.handle ?? null,
        description: null,
        status: product.status ?? null,
        image: product.featuredImage?.url ?? null,
        priceLabel: price ? `${price.amount} ${price.currencyCode}` : null,
        skuPreview: node.sku ?? null,
    };
}

export default async function hydrateSelectedResource({ admin, type, ids }) {
    if (!Array.isArray(ids) || ids.length === 0) return [];

    const response = await admin.graphql(NODES_QUERY, {
        variables: { ids },
    });
    const json = await response.json();
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