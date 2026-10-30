# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.
For each session the AI needs to follow evrything written in this file and if something needed to be done which is ristricted in this file prompt the user/human what and why that needs to be done it will be handled by human itself.

# HARD RULES (override everything below)

1. NEVER read, open, list, search for, or write any `.env*` file by any method (Read, grep, cat, type, Get-Content, dir, find, glob). If a command fails with "DATABASE_URL missing" or similar, STOP and tell me. Do not go looking for env files.
2. NEVER run the prisma CLI directly (`npx prisma ...`). Use only the scripts under ‘AI may run’.
3. NEVER run anything listed under "HUMAN ONLY" below. If one is needed, tell me the exact command and stop.
4. Only run scripts listed under "AI may run". Do not browse package.json for other scripts, and never invent one.
5. If a needed command or script doesn't exist, ask me. Don't improvise.
6. Whenever Planing or Implementing a feature you must plan/create it corresponding unit test.
7. Always Follow Test Driven Development(TDD).

# MCP Rules
- When doing code review, restructuring, or looking for setup steps, configuration steps, or library/API documentation, automatically use the `context7` tools to resolve and query the latest documentation and prompt the finding to user.

## Project Overview

**Smart Discount** is an embedded Shopify app that lets merchants create, manage, and analyze discount campaigns from a custom admin UI. Merchants pick a discount template, walk a 5-step wizard, and the app pushes the discount to Shopify via Admin GraphQL — native discount types use Shopify's built-in mutations, while two custom types run on Shopify Functions (WASM) deployed from this repo.

- **Product**: discount wizard with 11 templates across 5 template families (order/product/bxgy/shipping/free_gift) — order/product percentage or fixed, BXGY, free shipping (native), plus capped order discount and free gift (custom Shopify Functions, ADVANCE plan only). (GROUP_CONFIG has 6 sync groups including app and free_gift.)
- **Monetization**: freemium BASIC/ADVANCE plans with usage gating and billing (`app.billing.jsx`, app subscription webhooks)
- **Data split**: Shopify is the source of truth for products/orders; the app's own Prisma/MySQL (AWS RDS) DB stores discount campaigns, usage stats, and analytics — fed by order webhooks matching discounts via `matchKey`
- **Repo layout**: React Router 7 app in `app/`, Shopify Functions in `extensions/capped-order-discount` + `extensions/free-gift-discount` (npm workspaces), Prisma schema/migrations in `prisma/`
- **Environments**: dual Shopify apps — dev (`shopify.app.dev.toml`, `smart-discounts-dev`) and prod (`shopify.app.prod.toml`, `smart-discounts`, https://smartdiscount.propero.in); prod deploys via GitHub Actions → Docker → ECR → EC2
- **In active development**: free-gift discount feature (see "Free-gift discount status" under Architecture)

## Code Style
- Need to make sure any server files suffix `*.server.js` is not imported in any client side helper, functions or modules.
- Any new functions Created/updated required a JSDoc-stlye comment block, including a brief discription, list of params with data-types and a note on return type.
- Any critical code block/function that is handling important work then it has to use the custom server side logger from `app/utils/logger.server.js` to log the warnings/errors/failue in case any occurs.
- If a new environment variable is introduced then it properly needs to be wired into `.github/workflows/deploy.yml` and `/env.example.txt` environments as well.

## Architecture

### Tech Stack
- **React Router 7** framework mode (SSR) + Vite; flat fs-routes (`app/routes.js` → `flatRoutes()`)
- **Auth/embedding**: `@shopify/shopify-app-react-router` in `app/shopify.server.js`; `authenticate.admin(request)` returns `admin.graphql()` (Admin API 2025-10)
- **DB**: Prisma + **AWS RDS MySQL** (`prisma/schema.prisma`); sessions via `@shopify/shopify-app-session-storage-prisma`
- **UI**: **custom Tailwind components**, NOT Polaris in the wizard (`@shopify/polaris-types` is dev-only); `@shopify/app-bridge-react` present but unused in wizard
- **Extensions**: `extensions/capped-order-discount`, `extensions/free-gift-discount` — npm workspaces, `shopify app function` → WASM, vitest

### Discount creation wizard
- Routes: `app.discounts-new.jsx` (create), `app.discounts-edit.jsx` (edit), `app.discounts.jsx` (list, Prisma-only loader)
- **5 fixed steps** (`WizardShell.jsx` `STEPS`): `basics` → `value` → `conditions` → `schedule` → `review`
- **State**: single hook `useDiscountWizardState.js` (~40 `useState` pairs + validation memo + `canGoToStep(index)`)
- **Group-driven branching** (central pattern): `GROUP_CONFIG` in `app/helpers/NativeDiscountsPayloadHelper.js` — 6 groups:
  - `order` (ORDER_PERCENTAGE, ORDER_FIXED)
  - `product` (PRODUCT_PERCENTAGE, PRODUCT_FIXED)
  - `bxgy` (BXGY — buy X get Y)
  - `shipping` (FREE_SHIPPING)
  - `app` (APP_CAPPED — capped % off order, **ADVANCE plan**)
  - `free_gift` (APP_FREE_GIFT — free gift variant, **ADVANCE plan**)
- `getGroupKeyFromDiscountType()` maps a `discountType` → group; `method` (AUTOMATIC|CODE) is orthogonal
- Step components (`ValueStep`, `ConditionsStep`, `ReviewStep`) branch on `groupConfig.discountType` flags (`isBxgy`, `isFreeShipping`, `isAppCapped`, `isFreeGift`)
- **FormData contract**: `DiscountWizardComponents.jsx` `HiddenFields` serializes **all** React state into hidden `<input>` fields (arrays as JSON strings); final `<Form method="post">` submits plain FormData
- **Error mapping**: `ERROR_STEP_BY_FIELD` in `DiscountWizardComponents.jsx` maps server validation field errors → wizard step index for bounce-back

### Server sync dispatch table
`publishDiscountToShopify()` in `app/utils/discount-sync-handler.server.js` routes by `discountType`:

| Type family | Sync module | Mutations |
|---|---|---|
| Native (order/product/bxgy/shipping) | `pushDiscountToShopify` (`discount-sync.server.js`) | `discountAutomaticBasicCreate` / `discountCodeBasicCreate`, `discountAutomaticBxgyCreate` / `discountCodeBxgyCreate`, `discountAutomaticFreeShippingCreate` / `discountCodeFreeShippingCreate` |
| APP_CAPPED | `discount-custom-sync.server.js` | `discountAutomaticAppCreate` / `discountCodeAppCreate` + `$app:function-configuration` metafield |
| APP_FREE_GIFT | `discount-free-gift-sync.server.js` | same App mutations, `discountClasses: ["PRODUCT"]` + free-gift metafield |

Function IDs: env `SHOPIFY_CAPPED_ORDER_FUNCTION_ID` / `SHOPIFY_FREE_GIFT_FUNCTION_ID` override, else `shopifyFunctions` query filtered by title.

### matchKey / webhooks / analytics
- `matchKey` (`shopify:auto:<normalized title>` for automatic, code for CODE) + `matchType` on `Discount` row = join key for:
  - Collision detection (`discount-identity.server.js` → 409 on duplicate active title/code)
  - Webhook order matching: `app/utils/discount-usage.server.js` upserts `DiscountUsage` (not `DiscountDailyStat`, which is reserved for future analytics), increments `totalUsageCount`/`totalSavings` → feeds analytics UI
- Lifecycle API routes: `api.discount-toggle.jsx` (activate/deactivate), `api.discount-delete.jsx`, `api.resource-search.jsx` (GraphQL products/collections for custom `ResourcePicker.jsx` modal)

### Plan gating & templates
- `app/configs/discount-templates.js` — 11 templates with `defaultConfig`, `requiredPlan`
- `plan-gate.server.js` (`canUseTemplate`, `canUseDiscountType`) — APP_CAPPED/free-gift templates redirect to `/app/billing` if not ADVANCE (redirects are thrown in the route loaders; plan-gate itself returns booleans)

### Free-gift discount status
Phases 0–3 + 5 complete (templates, wizard state/validation, ValueStep UI, ReviewStep summary, edit hydration); Phase 4 skipped (trigger config in ValueStep); Phase 6 manual E2E flagged "NEW UI ISSUES FOUND" in `docs/free-gift-discount-plan.md` (gitignored).

## Common Commands

### AI may run
```bash
npm run build
npm run prisma:validate                # schema check (dummy URL from env.example.txt, safe)
npm run prisma:format
npm run prisma:generate                # regenerate client (no DB connection needed)
npm run prisma:migrate:status          # read-only migration status vs stage DB
npm run prisma:migrate:new "name"      # creates a migration FILE only (stage DB env)
npm run test                           # vitest run — app/ unit tests (read-only)
npm run test:watch                     # vitest — watch mode for TDD
```

### HUMAN ONLY (never run; tell me the command instead)
```bash
npm run dev, prod, start
npm run db:dev, db:prod                # Prisma Studio
npm run prisma:migrate:apply           # push pending migrations to stage DB
npm run prisma:migrate:prod            # manual prod migrate + generate (override for docker-start)
npm run deploy:dev, deploy:prod        # deploy Shopify app/extensions
npm run build-extension:dev, build-extension:prod
docker build / docker run
```

## graphify workflow

This project has a knowledge graph at `graphify-out/` with a PreToolUse hook that enforces graphify-first lookup:

- **For codebase questions**: run `graphify query "<question>"` first (BFS subgraph). Use `graphify path "<A>" "<B>"` for relationships, `graphify explain "<concept>"` for focused explanations. These return scoped subgraphs, smaller than full grep output.
- **After code edits**: run `graphify update .` (AST-only, no API cost) to keep the graph current.
- **Broad review**: read `graphify-out/GRAPH_REPORT.md` only when query/path/explain don't surface enough context.