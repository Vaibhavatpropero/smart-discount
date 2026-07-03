// app/utils/resource-hydration.server.js
export async function hydrateResourceGids(admin, gids = []) {
    if (!gids || gids.length === 0) return [];

    const response = await admin.graphql(`#graphql
        query HydrateResources($ids: [ID!]!) {
            nodes(ids: $ids) {
                ... on Product {
                    id
                    title
                    featuredImage { url altText }
                    priceRangeV2 { minVariantPrice { amount currencyCode } }
                    variants(first: 1) { nodes { sku } }
                }
                ... on Collection {
                    id
                    title
                    image { url altText }
                    productsCount { count }
                }
            }
        }
    `, { variables: { ids: gids } });

    const json = await response.json();

    return (json?.data?.nodes || [])
        .filter(Boolean)
        .map((node) => ({
            id: node.id,
            title: node.title,
            image: node.featuredImage?.url || node.image?.url || null,
            price: node.priceRangeV2?.minVariantPrice?.amount ?? null,
            sku: node.variants?.nodes?.[ 0 ]?.sku ?? null,
            productsCount: node.productsCount?.count ?? null,
        }));
}