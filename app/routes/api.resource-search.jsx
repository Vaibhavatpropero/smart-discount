// app/routes/api.resource-search.jsx
import { data } from "react-router";
import { authenticate } from "../shopify.server.js";
import { logger } from "../utils/logger.server.js";

const SRC = "api.resource-search"

const PRODUCT_QUERY = `#graphql
  query SearchProducts($query: String!, $first: Int!) {
    products(first: $first, query: $query) {
      edges {
        node {
          id
          title
          handle
          description
          status
          featuredImage { url altText }
          priceRangeV2 { minVariantPrice { amount currencyCode } }
          variants(first: 5) {
            edges { node { sku } }
          }
        }
      }
    }
  }
`;

const COLLECTION_QUERY = `#graphql
  query SearchCollections($query: String!, $first: Int!) {
    collections(first: $first, query: $query) {
      edges {
        node {
          id
          title
          handle
          image { url altText }
          productsCount { count }
        }
      }
    }
  }
`;

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
        variants(first: 5) {
          edges { node { sku } }
        }
      }
      ... on Collection {
        id
        title
        handle
        description
        image { url altText }
        productsCount { count }
      }
    }
  }
`;

function buildProductSearchQuery(term) {
  const safe = term.replace(/"/g, '\\"');
  return `title:*${safe}* OR handle:*${safe}* OR sku:*${safe}*`;
}

function buildCollectionSearchQuery(term) {
  const safe = term.replace(/"/g, '\\"');
  return `title:*${safe}* OR handle:*${safe}*`;
}

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

function parseIdsParam(value) {
  if (!value) return [];

  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  logger.info(SRC, "Request query URL: ", url);

  const type = String(url.searchParams.get("type") || "product").toLowerCase();
  const term = String(url.searchParams.get("q") || "").trim();
  const ids = parseIdsParam(url.searchParams.get("ids"));
  const excludeParam = url.searchParams.get("exclude") || "";
  const excludeIds = new Set(
    excludeParam.split(",").map((id) => id.trim()).filter(Boolean)
  );

  if (ids.length > 0) {
    const response = await admin.graphql(NODES_QUERY, {
      variables: { ids },
    });
    const json = await response.json();
    const nodes = json?.data?.nodes || [];

    const results = nodes
      .map((node) => {
        if (!node?.id) return null;

        if (type === "collection") {
          return node.handle !== undefined && node.productsCount !== undefined
            ? normalizeCollection(node)
            : null;
        }

        return node.status !== undefined && node.priceRangeV2 !== undefined
          ? normalizeProduct(node)
          : null;
      })
      .filter(Boolean)
      .filter((item) => !excludeIds.has(item.id));

    return data({ results });
  }

  if (!term) {
    return data({ results: [] });
  }

  if (type === "collection") {
    const response = await admin.graphql(COLLECTION_QUERY, {
      variables: { query: buildCollectionSearchQuery(term), first: 20 },
    });
    const json = await response.json();
    const edges = json?.data?.collections?.edges || [];

    const results = edges
      .map((edge) => normalizeCollection(edge.node))
      .filter((item) => !excludeIds.has(item.id));

    return data({ results });
  }

  const response = await admin.graphql(PRODUCT_QUERY, {
    variables: { query: buildProductSearchQuery(term), first: 20 },
  });
  const json = await response.json();
  const edges = json?.data?.products?.edges || [];

  const results = edges
    .map((edge) => normalizeProduct(edge.node))
    .filter((item) => !excludeIds.has(item.id));

  logger.info(SRC, "Response result: ", results);

  return data({ results });
};