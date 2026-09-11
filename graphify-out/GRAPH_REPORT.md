# Graph Report - sd-dev  (2026-09-07)

## Corpus Check
- Corpus is ~40,736 words - fits in a single context window. You may not need a graph.

## Summary
- 520 nodes · 975 edges · 29 communities (17 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Discount Wizard Steps
- App Routes & Billing
- Server Entry & Root
- Discount API Routes
- Discount Components & Pickers
- Custom Discount Sync Server
- Package Config
- Package Scripts
- Capped Order Discount Extension
- Analytics Components
- Package Dependencies
- TypeScript Config
- Package Dev Dependencies
- Discount Wizard Review Step
- Cart Lines Discount Extension
- Package Allow Scripts
- GraphQL Config
- MCP Server Config
- Vite Config
- App Routes Ref
- Package Engines
- Package Overrides

## God Nodes (most connected - your core abstractions)
1. `scripts` - 29 edges
2. `react-router` - 19 edges
3. `compilerOptions` - 18 edges
4. `getPlanContext()` - 16 edges
5. `action()` - 15 edges
6. `logger` - 15 edges
7. `getDiscountAccessState()` - 13 edges
8. `authenticate` - 12 edges
9. `action()` - 11 edges
10. `assertGraphqlSucceeded()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `DiscountEditRoute()` --calls--> `useDiscountWizardState()`  [EXTRACTED]
  app/routes/app.discounts-edit.jsx → app/components/discount-wizard/useDiscountWizardState.js
- `loader()` --calls--> `getDiscountTemplateBySlug()`  [EXTRACTED]
  app/routes/app.discounts-new.jsx → app/configs/discount-templates.js
- `loader()` --calls--> `getGroupConfig()`  [EXTRACTED]
  app/routes/app.discounts-new.jsx → app/helpers/NativeDiscountsPayloadHelper.js
- `loader()` --calls--> `getTrialDaysRemaining()`  [EXTRACTED]
  app/routes/app.billing.jsx → app/utils/billing.server.js
- `loader()` --calls--> `getDiscountAccessState()`  [EXTRACTED]
  app/routes/app.discounts-edit.jsx → app/utils/plan-gate.server.js

## Import Cycles
- None detected.

## Communities (29 total, 5 thin omitted)

### Community 0 - "Discount Wizard Steps"
Cohesion: 0.07
Nodes (45): BasicsStep(), ConditionsStep(), ScheduleStep(), useDiscountWizardState(), progressState(), StepProgress(), STEPS, StickyActionBar() (+37 more)

### Community 1 - "App Routes & Billing"
Cohesion: 0.08
Nodes (37): action(), loader(), NOTE: Returns confirmationUrl as JSON — NOT a redirect()., loader(), action(), handleAppUninstalled(), handleOrdersCancelledWebhook(), handleOrdersCreateWebhook() (+29 more)

### Community 2 - "Server Entry & Root"
Cohesion: 0.07
Nodes (29): handleRequest(), streamTimeout, buildCollectionSearchQuery(), buildProductSearchQuery(), loader(), normalizeCollection(), normalizeProduct(), parseIdsParam() (+21 more)

### Community 3 - "Discount API Routes"
Cohesion: 0.08
Nodes (28): listDiscountTemplates(), action(), action(), getDiscountPayload(), mapShopifyStatusToDbStatus(), loader(), loader(), loader() (+20 more)

### Community 4 - "Discount Components & Pickers"
Cohesion: 0.07
Nodes (14): DeleteDiscountButton(), getItemDescription(), getItemMeta(), getItemStatus(), ResourcePicker(), ResultRow(), SearchModal(), SelectedTargetTile() (+6 more)

### Community 5 - "Custom Discount Sync Server"
Cohesion: 0.19
Nodes (34): buildAppCappedConfiguration(), buildFunctionMetafield(), createAutomaticAppCappedDiscount(), createCodeAppCappedDiscount(), getCappedOrderFunctionId(), pushCustomDiscountToShopify(), resolveCappedOrderFunctionId(), assertGraphqlSucceeded() (+26 more)

### Community 6 - "Package Config"
Cohesion: 0.06
Nodes (32): author, name, private, trustedDependencies, type, workspaces, autoprefixer, dotenv-cli (+24 more)

### Community 7 - "Package Scripts"
Cohesion: 0.07
Nodes (29): scripts, build, build-extension:dev, build-extension:prod, config:link, config:use, db:dev, db:prod (+21 more)

### Community 8 - "Capped Order Discount Extension"
Cohesion: 0.07
Nodes (26): codegen, config, documents, generates, schema, omitOperationSuffix, dependencies, @shopify/shopify_function (+18 more)

### Community 9 - "Analytics Components"
Cohesion: 0.16
Nodes (13): AnalyticsEmptyState(), AnalyticsSection(), AnalyticsSelector(), closePopover(), selectDiscount(), getStatusClass(), STATUS_CLASS, AnalyticsSummaryCards() (+5 more)

### Community 10 - "Package Dependencies"
Cohesion: 0.10
Nodes (20): dependencies, autoprefixer, dotenv-cli, isbot, lucide-react, postcss, prisma, @prisma/client (+12 more)

### Community 11 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, allowSyntheticDefaultImports, baseUrl, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+11 more)

### Community 12 - "Package Dev Dependencies"
Cohesion: 0.11
Nodes (19): devDependencies, eslint, eslint-import-resolver-typescript, eslint-plugin-import, eslint-plugin-jsx-a11y, eslint-plugin-react, eslint-plugin-react-hooks, graphql-config (+11 more)

### Community 13 - "Discount Wizard Review Step"
Cohesion: 0.29
Nodes (8): formatAppCappedSummary(), formatBxgySummary(), formatShippingSummary(), ReviewStep(), ValueStep(), CURRENCY_SYMBOLS, formatCurrencyHint(), getCurrencySymbol()

### Community 14 - "Cart Lines Discount Extension"
Cohesion: 0.31
Nodes (8): cartLinesDiscountsGenerateRun(), computeBandedRandomDiscount(), CURRENCY_SYMBOLS, EMPTY_RESULT, formatCurrencyAmount(), hashString(), parseConfiguration(), pseudoRandom01()

### Community 15 - "Package Allow Scripts"
Cohesion: 0.29
Nodes (7): allowScripts, esbuild@0.25.12, @parcel/watcher@2.5.6, prisma@6.19.3, @prisma/client@6.19.3, @prisma/engines@6.19.3, unrs-resolver@1.12.2

### Community 17 - "MCP Server Config"
Cohesion: 0.50
Nodes (3): npx, shopify-dev-mcp, @shopify/dev-mcp

## Knowledge Gaps
- **165 isolated node(s):** `config`, `npx`, `@shopify/dev-mcp`, `STATUS_CLASS`, `DISCOUNT_TEMPLATE_FAMILIES` (+160 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 247 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react-router` connect `Server Entry & Root` to `Discount Wizard Steps`, `App Routes & Billing`, `Discount API Routes`, `Discount Components & Pickers`, `Package Config`, `Analytics Components`?**
  _High betweenness centrality (0.228) - this node is a cross-community bridge._
- **Why does `react` connect `Analytics Components` to `Discount Wizard Steps`, `App Routes & Billing`, `Server Entry & Root`, `Discount Components & Pickers`, `Package Config`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Why does `scripts` connect `Package Scripts` to `Package Config`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **What connects `config`, `npx`, `@shopify/dev-mcp` to the rest of the system?**
  _165 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Discount Wizard Steps` be split into smaller, more focused modules?**
  _Cohesion score 0.06760316066725197 - nodes in this community are weakly interconnected._
- **Should `App Routes & Billing` be split into smaller, more focused modules?**
  _Cohesion score 0.07597895967270601 - nodes in this community are weakly interconnected._
- **Should `Server Entry & Root` be split into smaller, more focused modules?**
  _Cohesion score 0.06956521739130435 - nodes in this community are weakly interconnected._