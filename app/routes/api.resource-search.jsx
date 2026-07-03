// app/routes/app.api.resource-search.jsx
import { data } from "react-router";
import { authenticate } from "../shopify.server.js";

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
    description: node.description || null,
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
    image: node.image?.url || null,
    countLabel: `${node.productsCount?.count ?? 0} products`,
  };
}

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);

  const type = String(url.searchParams.get("type") || "product").toLowerCase();
  const term = String(url.searchParams.get("q") || "").trim();
  const excludeParam = url.searchParams.get("exclude") || "";
  const excludeIds = new Set(
    excludeParam.split(",").map((id) => id.trim()).filter(Boolean)
  );

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

  return data({ results });
};