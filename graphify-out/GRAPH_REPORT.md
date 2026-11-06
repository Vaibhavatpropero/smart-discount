# Graph Report - sd-dev  (2026-11-06)

## Corpus Check
- 114 files · ~58,455 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 25 file(s) not represented in the graph (top: (none) 11, .toml 6, .graphql 4)

## Summary
- 787 nodes · 1516 edges · 37 communities (27 shown, 10 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9137cdec`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.discounts-edit.jsx
- free-gift-discount/src/cart_lines_discounts_generate_run.js
- discount-usage.server.js
- Custom Discount Sync Logic
- GitHub Actions CI/CD Pipeline
- app.discounts.jsx
- plan-gate.server.js
- ReviewStep.jsx
- Package Metadata
- Package Scripts & Commands
- Capped Order Discount Extension
- Free Gift Discount Extension
- Analytics UI Components
- README Features & Deployment
- capped-order-discount/src/cart_lines_discounts_generate_run.js
- Package Dependencies
- TypeScript Configuration
- Package Dev Dependencies
- app._index.jsx
- Changelog: Template Evolution
- CLAUDE: Project Architecture
- AWS & EC2 Configuration
- shopify.server.js
- Shopify API Environment Config
- MCP Server Configuration
- Database Environment Config
- create_chunk3.py
- logger.server.js

## God Nodes (most connected - your core abstractions)
1. `scripts` - 22 edges
2. `Shopify App Template React Router` - 21 edges
3. `react-router` - 20 edges
4. `logger` - 20 edges
5. `validateDiscountForm()` - 18 edges
6. `compilerOptions` - 18 edges
7. `getPlanContext()` - 17 edges
8. `Deploy to EC2 step` - 16 edges
9. `action()` - 15 edges
10. `assertGraphqlSucceeded()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `cartDeliveryOptionsDiscountsGenerateRun (capped-order-discount)` --semantically_similar_to--> `cartDeliveryOptionsDiscountsGenerateRun (free-gift-discount)`  [INFERRED] [semantically similar]
  extensions/capped-order-discount/src/cart_delivery_options_discounts_generate_run.js.txt → extensions/free-gift-discount/src/cart_delivery_options_discounts_generate_run.js.txt
- `StepContent()` --calls--> `ValueStep()`  [EXTRACTED]
  app/components/discount-wizard/DiscountWizardComponents.jsx → app/components/discount-wizard/steps/ValueStep.jsx
- `loader()` --calls--> `hydrateSelectedResource()`  [EXTRACTED]
  app/routes/app.discounts-edit.jsx → app/utils/hydrateSelectedResource.server.js
- `StepContent()` --calls--> `ConditionsStep()`  [EXTRACTED]
  app/components/discount-wizard/DiscountWizardComponents.jsx → app/components/discount-wizard/steps/ConditionsStep.jsx
- `StepContent()` --calls--> `ReviewStep()`  [EXTRACTED]
  app/components/discount-wizard/DiscountWizardComponents.jsx → app/components/discount-wizard/steps/ReviewStep.jsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Template Evolution History** — changelog_shopify_app_template_react_router, changelog_shopify_app_template_remix, changelog_calver [EXTRACTED 0.75]
- **Project Architecture Overview** — claude_sd_dev_project, claude_shopify_discount_app, claude_react_router_vite_tailwind, claude_prisma_database, claude_shopify_functions [EXTRACTED 0.75]
- **Environment Configuration Sections** — env_example_shopify_api_config, env_example_database_config, env_example_aws_credentials [EXTRACTED 0.75]
- **Deployment Options** — readme_google_cloud_run, readme_fly_io, readme_render, readme_docker_deployment [EXTRACTED 0.75]
- **Template Features** — readme_shopify_app_template_react_router, readme_react_router, readme_shopify_cli, readme_graphql_admin_api, readme_prisma [EXTRACTED 0.75]
- **AWS Integration (ECR + EC2)** — github_workflows_deploy_step_configure_aws, github_workflows_deploy_step_login_ecr, github_workflows_deploy_step_build_push, github_workflows_deploy_ec2_ecr_login, github_workflows_deploy_ec2_docker_pull [EXTRACTED 1.00]
- **SmartDiscount CI/CD Pipeline** — github_workflows_deploy, github_workflows_deploy_job_deploy, github_workflows_deploy_step_checkout, github_workflows_deploy_step_configure_aws, github_workflows_deploy_step_login_ecr, github_workflows_deploy_step_setup_buildx, github_workflows_deploy_step_build_push, github_workflows_deploy_step_deploy_ec2 [EXTRACTED 1.00]
- **Container Lifecycle Management** — github_workflows_deploy_ec2_docker_pull, github_workflows_deploy_ec2_container_replace, github_workflows_deploy_ec2_verify, github_workflows_deploy_ec2_docker_prune [EXTRACTED 1.00]
- **Runtime Secrets Management** — github_workflows_deploy_ec2_env_file, github_workflows_deploy_ec2_cleanup_secrets, github_workflows_deploy_secret_shopify_api_key, github_workflows_deploy_secret_shopify_api_secret, github_workflows_deploy_secret_scopes, github_workflows_deploy_secret_shopify_app_url, github_workflows_deploy_secret_database_url, github_workflows_deploy_secret_session_secret [EXTRACTED 1.00]
- **Shopify App Runtime Configuration** — github_workflows_deploy_secret_shopify_api_key, github_workflows_deploy_secret_shopify_api_secret, github_workflows_deploy_secret_scopes, github_workflows_deploy_secret_shopify_app_url [EXTRACTED 1.00]
- **Shopify Cart Delivery Options Discount Function Pattern** — extensions_capped_order_discount_src_cart_delivery_options_discounts_generate_run_cartdeliverydiscountsgeneraterun, extensions_free_gift_discount_src_cart_delivery_options_discounts_generate_run_cartdeliverydiscountsgeneraterun, concept_free_delivery_discount_logic [INFERRED 0.95]

## Communities (37 total, 10 thin omitted)

### Community 0 - "app.discounts-edit.jsx"
Cohesion: 0.07
Nodes (66): computeDiscountType(), ERROR_STEP_BY_FIELD, getGroupSpecificFields(), getVisibleSteps(), HiddenFields(), StepContent(), useWizardNavigation(), serializeFreeGiftConfigForForm() (+58 more)

### Community 1 - "free-gift-discount/src/cart_lines_discounts_generate_run.js"
Cohesion: 0.14
Nodes (9): cartLinesDiscountsGenerateRun(), conditionsMet(), EMPTY_RESULT, orderThresholdMet(), parseConfiguration(), productTriggerMet(), EMPTY, giftLine() (+1 more)

### Community 2 - "discount-usage.server.js"
Cohesion: 0.10
Nodes (39): mocks, orderWithDiscount, { resolveDiscountMatchKeyMock }, buildAutomaticDiscountMatchKey(), buildCodeDiscountMatchKey(), buildDiscountMatchKey(), buildDiscountSelect(), buildExcludeWhere() (+31 more)

### Community 3 - "Custom Discount Sync Logic"
Cohesion: 0.16
Nodes (40): buildAppCappedConfiguration(), buildFunctionMetafield(), createAutomaticAppCappedDiscount(), createCodeAppCappedDiscount(), getCappedOrderFunctionId(), pushCustomDiscountToShopify(), resolveCappedOrderFunctionId(), buildAppFreeGiftConfiguration() (+32 more)

### Community 4 - "GitHub Actions CI/CD Pipeline"
Cohesion: 0.07
Nodes (41): Deploy SmartDiscount to EC2 Workflow, docker/build-push-action@v7 action, docker/setup-buildx-action@v4 action, actions/checkout@v6 action, aws-actions/configure-aws-credentials@v6 action, aws-actions/amazon-ecr-login@v2 action, appleboy/ssh-action@v1.2.2 action, smartdiscount-production concurrency group (+33 more)

### Community 5 - "app.discounts.jsx"
Cohesion: 0.16
Nodes (18): DeleteDiscountButton(), DISCOUNT_TEMPLATE_FAMILIES, DISCOUNT_TEMPLATES, listDiscountTemplates(), ActionCell(), CreateOptionCard(), DiscountsPage(), DiscountToggle() (+10 more)

### Community 6 - "plan-gate.server.js"
Cohesion: 0.08
Nodes (22): action(), action(), getDiscountPayload(), mapShopifyStatusToDbStatus(), appDiscount, findUniqueMock, updateMock, root (+14 more)

### Community 7 - "ReviewStep.jsx"
Cohesion: 0.25
Nodes (10): formatAppCappedSummary(), formatBxgySummary(), formatFreeGiftSummary(), formatShippingSummary(), ReviewStep(), ShippingCountriesInput(), ValueStep(), CURRENCY_SYMBOLS (+2 more)

### Community 8 - "Package Metadata"
Cohesion: 0.04
Nodes (44): allowScripts, esbuild@0.25.12, @parcel/watcher@2.5.6, prisma@6.19.3, @prisma/client@6.19.3, @prisma/engines@6.19.3, unrs-resolver@1.12.2, author (+36 more)

### Community 9 - "Package Scripts & Commands"
Cohesion: 0.09
Nodes (22): scripts, build, build-extension:dev, build-extension:prod, db:dev, db:prod, deploy:dev, deploy:prod (+14 more)

### Community 10 - "Capped Order Discount Extension"
Cohesion: 0.07
Nodes (26): codegen, config, documents, generates, schema, omitOperationSuffix, dependencies, @shopify/shopify_function (+18 more)

### Community 11 - "Free Gift Discount Extension"
Cohesion: 0.07
Nodes (26): codegen, config, documents, generates, schema, omitOperationSuffix, dependencies, @shopify/shopify_function (+18 more)

### Community 12 - "Analytics UI Components"
Cohesion: 0.19
Nodes (14): AnalyticsEmptyState(), AnalyticsSection(), AnalyticsSelector(), closePopover(), selectDiscount(), getStatusClass(), STATUS_CLASS, AnalyticsSummaryCards() (+6 more)

### Community 13 - "README Features & Deployment"
Cohesion: 0.09
Nodes (22): App Bridge, App Extensions, Declarative Custom Data, Docker Deployment, Fly.io, Google Cloud Run, GraphQL Admin API, Internationalization (+14 more)

### Community 14 - "capped-order-discount/src/cart_lines_discounts_generate_run.js"
Cohesion: 0.12
Nodes (17): Free Delivery Discount Logic, DeliveryDiscountSelectionStrategy (capped-order-discount), DiscountClass (capped-order-discount), RunInput / DeliveryInput (capped-order-discount), CartDeliveryOptionsDiscountsGenerateRunResult (capped-order-discount), cartDeliveryOptionsDiscountsGenerateRun (capped-order-discount), cartLinesDiscountsGenerateRun(), computeCappedPercentageDiscount() (+9 more)

### Community 15 - "Package Dependencies"
Cohesion: 0.10
Nodes (20): dependencies, autoprefixer, dotenv-cli, isbot, lucide-react, postcss, prisma, @prisma/client (+12 more)

### Community 16 - "TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, allowSyntheticDefaultImports, baseUrl, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+11 more)

### Community 17 - "Package Dev Dependencies"
Cohesion: 0.11
Nodes (19): devDependencies, eslint, eslint-import-resolver-typescript, eslint-plugin-import, eslint-plugin-jsx-a11y, eslint-plugin-react, eslint-plugin-react-hooks, graphql-config (+11 more)

### Community 18 - "app._index.jsx"
Cohesion: 0.08
Nodes (31): ConditionsStep(), getItemDescription(), getItemMeta(), getItemStatus(), ResourcePicker(), ResultRow(), SearchModal(), SelectedTargetGrid() (+23 more)

### Community 19 - "Changelog: Template Evolution"
Cohesion: 0.14
Nodes (14): Shopify Admin Intents, App Bridge Web Components, Calendar Versioning (calver), Expiring Offline Access Tokens, GraphQL Autocomplete, Polaris Types, Prisma Session Storage, React Router v7 (+6 more)

### Community 20 - "CLAUDE: Project Architecture"
Cohesion: 0.17
Nodes (12): Analytics, Billing and Plans, Capped Order Discount, Discount Sync with Shopify, Discount Creation Wizard, Free Gift Discount, Graphify Integration, Prisma Database (+4 more)

### Community 21 - "AWS & EC2 Configuration"
Cohesion: 0.17
Nodes (12): AWS_ACCESS_KEY_ID, AWS_CONTAINER_NAME, AWS Credentials, AWS ECR, AWS_ECR_URI, AWS IAM for GH Bot, AWS_REGION, AWS_SECRET_ACCESS_KEY (+4 more)

### Community 22 - "shopify.server.js"
Cohesion: 0.06
Nodes (33): handleRequest(), streamTimeout, buildCollectionSearchQuery(), buildProductSearchQuery(), loader(), normalizeCollection(), normalizeProduct(), parseIdsParam() (+25 more)

### Community 24 - "Shopify API Environment Config"
Cohesion: 0.40
Nodes (5): SCOPES, Shopify API Configuration, SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_APP_URL

### Community 25 - "MCP Server Configuration"
Cohesion: 0.50
Nodes (3): npx, shopify-dev-mcp, @shopify/dev-mcp

### Community 27 - "Database Environment Config"
Cohesion: 0.67
Nodes (3): Database Configuration, DATABASE_URL, LOCAL_DATABASE_URL

### Community 44 - "logger.server.js"
Cohesion: 0.08
Nodes (37): loader(), action(), BillingInfo(), BillingPage(), CheckIcon(), ExpiredBanner(), loader(), PlanCard() (+29 more)

## Knowledge Gaps
- **107 isolated node(s):** `@react-router/serve`, `@shopify/app-bridge-react`, `autoprefixer`, `dotenv-cli`, `postcss` (+102 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 331 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react-router` connect `shopify.server.js` to `app.discounts-edit.jsx`, `app.discounts.jsx`, `plan-gate.server.js`, `Package Metadata`, `Analytics UI Components`, `logger.server.js`, `app._index.jsx`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **What connects `@react-router/serve`, `@shopify/app-bridge-react`, `autoprefixer` to the rest of the system?**
  _107 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app.discounts-edit.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06569133677567413 - nodes in this community are weakly interconnected._
- **Why does `react` connect `app.discounts-edit.jsx` to `app.discounts.jsx`, `Package Metadata`, `Analytics UI Components`, `logger.server.js`, `app._index.jsx`, `shopify.server.js`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Should `free-gift-discount/src/cart_lines_discounts_generate_run.js` be split into smaller, more focused modules?**
  _Cohesion score 0.14035087719298245 - nodes in this community are weakly interconnected._
- **Why does `@shopify/shopify-app-react-router` connect `shopify.server.js` to `app.discounts-edit.jsx`, `app.discounts.jsx`, `Package Metadata`, `logger.server.js`, `app._index.jsx`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Should `discount-usage.server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10452961672473868 - nodes in this community are weakly interconnected._