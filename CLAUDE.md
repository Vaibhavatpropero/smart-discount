# Project: sd-dev (Shopify discount app)

## Stack
- Shopify app (React-router, Vite, Tailwind) with Prisma and a database in `prisma/`
- Shopify custom discounts Functions in `extensions/settings.jsoncapped-order-discount` and `extensions/free-gift-discount`
- Routes in `app/routes/`, shared logic in `app/utils/` and `app/services/`

## Key areas
- Discount creation UI: `app/components/discount-wizard/`
- Discount sync with Shopify: `app/utils/discount-*.server.js`
- Billing and plans: `app/utils/billing.server.js`, `plans.js`, `app/routes/app.billing.jsx`
- Analytics: `app/components/analytics/`, `app/utils/discount-analytics.server.js`

## Commands
- Dev: `shopify app dev`
- Extension tests: `npm test` (inside each extension folder)
- DB migrate: `npx prisma migrate dev`

## Rules
- Never read, print, or edit `.env` files, keys, tokens, or database files.
- Never edit existing Prisma migrations. Create new ones, and ask before running them.
- Keep `*.server.js` code out of client components.
- Ask before adding dependencies or running destructive commands.
- Keep both extensions' `schema.graphql` and `generated/` files in sync via the Shopify CLI, not by hand.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
