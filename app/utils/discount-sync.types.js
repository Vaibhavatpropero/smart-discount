/**
 * @file discount-sync.types.js
 *
 * Shopify Admin GraphQL — Discount Mutation Input Type Reference
 * -------------------------------------------------------------
 * This file documents the full set of supported input variables for every
 * discount mutation used in discount-sync.server.js.
 *
 * Format per field:
 *   fieldName   {GraphQLType}   [required?]   — Description. Notes on current usage.
 *
 * ✅ = currently used in discount-sync.server.js
 * ⬜ = supported by Shopify but NOT currently passed (available to add)
 *
 * Docs: https://shopify.dev/docs/api/admin-graphql/latest/mutations/
 */

// =============================================================================
// SHARED TYPES
// =============================================================================

/**
 * DiscountCombinesWithInput
 * Controls stacking behaviour with other active discounts.
 *
 *   orderDiscounts    {Boolean}   ✅  — Stack with order-level discounts
 *   productDiscounts  {Boolean}   ✅  — Stack with product-level discounts
 *   shippingDiscounts {Boolean}   ✅  — Stack with shipping discounts
 */

/**
 * DiscountMinimumRequirementInput — one of:
 *
 *   subtotal  {DiscountMinimumSubtotalInput}
 *     greaterThanOrEqualToSubtotal  {Decimal!}  ✅  — e.g. "50.00"
 *
 *   quantity  {DiscountMinimumQuantityInput}
 *     greaterThanOrEqualToQuantity  {UnsignedInt64!}  ✅  — e.g. 3
 */

/**
 * DiscountContextInput — ⬜ NOT currently used in any function
 * Restricts discount eligibility to a specific audience. Mutually exclusive options:
 *
 *   markets          {MarketLocaleRegionsInput}
 *     add  {[ID!]!}  — Array of Market GIDs, e.g. ["gid://shopify/Market/123"]
 *
 *   customerSegments {CustomerSegmentMembersInput}
 *     add  {[ID!]!}  — Array of Segment GIDs, e.g. ["gid://shopify/Segment/123"]
 *
 * Available on: discountAutomaticBasicCreate, discountCodeBasicCreate,
 *               discountAutomaticBxgyCreate, discountCodeBxgyCreate,
 *               discountCodeFreeShippingCreate
 */

// =============================================================================
// 1. discountAutomaticBasicCreate
//    Input: DiscountAutomaticBasicInput
//    Docs: https://shopify.dev/docs/api/admin-graphql/latest/mutations/discountAutomaticBasicCreate
// =============================================================================
/**
 *   title              {String!}                               ✅
 *   startsAt           {DateTime!}                             ✅  — ISO 8601
 *   endsAt             {DateTime}                              ✅  — null = no end
 *   customerGets       {DiscountCustomerGetsInput!}            ✅
 *     value  — one of:
 *       percentage       {Float}  — 0.0–1.0 decimal (e.g. 0.15 = 15%)
 *       discountAmount   {DiscountAmountInput}
 *         amount             {Decimal!}     — e.g. "10.00"
 *         appliesOnEachItem  {Boolean}      — default false
 *     items  — one of:
 *       all              {Boolean}          — applies to all items
 *       products         {DiscountProductsInput}
 *         productsToAdd    {[ID!]}
 *         productsToRemove {[ID!]}
 *       collections      {DiscountCollectionsInput}
 *         collectionsToAdd    {[ID!]}
 *         collectionsToRemove {[ID!]}
 *   minimumRequirement {DiscountMinimumRequirementInput}       ✅
 *   combinesWith       {DiscountCombinesWithInput}             ✅
 *   context            {DiscountContextInput}                  ⬜  — restrict to market/segment
 */

// =============================================================================
// 2. discountCodeBasicCreate
//    Input: DiscountCodeBasicInput
//    Docs: https://shopify.dev/docs/api/admin-graphql/latest/mutations/discountCodeBasicCreate
// =============================================================================
/**
 *   title                  {String!}                           ✅
 *   code                   {String!}                           ✅
 *   startsAt               {DateTime!}                         ✅
 *   endsAt                 {DateTime}                          ✅
 *   customerGets           {DiscountCustomerGetsInput!}        ✅  — same shape as above
 *   customerSelection      {DiscountCustomerSelectionInput!}   ✅  — hardcoded to { all: true }
 *     all                    {Boolean}
 *     customers              {DiscountCustomersInput}          ⬜
 *       add  {[ID!]}  — e.g. ["gid://shopify/Customer/123"]
 *   minimumRequirement     {DiscountMinimumRequirementInput}   ✅
 *   usageLimit             {Int}                               ✅  — null = unlimited
 *   appliesOncePerCustomer {Boolean}                           ✅
 *   combinesWith           {DiscountCombinesWithInput}         ✅
 *   context                {DiscountContextInput}              ⬜  — restrict to market/segment
 */

// =============================================================================
// 3. discountAutomaticBxgyCreate
//    Input: DiscountAutomaticBxgyInput
//    Docs: https://shopify.dev/docs/api/admin-graphql/latest/mutations/discountAutomaticBxgyCreate
// =============================================================================
/**
 *   title              {String!}                               ✅
 *   startsAt           {DateTime!}                             ✅
 *   endsAt             {DateTime}                              ✅
 *   customerBuys       {DiscountCustomerBuysInput!}            ✅
 *     value  — one of:
 *       amount           {Decimal}    — subtotal threshold e.g. "50.00"
 *       quantity         {String}     — item count e.g. "2"
 *     items  — one of: all | products | collections             ✅
 *   customerGets       {DiscountCustomerGetsInput!}            ✅
 *     value:
 *       discountOnQuantity:
 *         quantity  {String!}                                  ✅
 *         effect    — one of:
 *           percentage  {Float}  — 0.0–1.0 (1.0 = free)       ✅
 *           amount      {Decimal} — fixed amount off each      ✅
 *     items  — same shape as customerBuys.items                ✅
 *   usesPerOrderLimit  {String}                                ✅  — ⚠ see bug note in JSDoc
 *   combinesWith       {DiscountCombinesWithInput}             ✅
 */

// =============================================================================
// 4. discountCodeBxgyCreate
//    Input: DiscountCodeBxgyInput
//    Docs: https://shopify.dev/docs/api/admin-graphql/latest/mutations/discountCodeBxgyCreate
// =============================================================================
/**
 *   title                  {String!}                           ✅
 *   code                   {String!}                           ✅
 *   startsAt               {DateTime!}                         ✅
 *   endsAt                 {DateTime}                          ✅
 *   customerBuys           {DiscountCustomerBuysInput!}        ✅
 *   customerGets           {DiscountCustomerGetsInput!}        ✅
 *   usesPerOrderLimit      {Int}                               ✅
 *   combinesWith           {DiscountCombinesWithInput}         ✅
 *   customerSelection      {DiscountCustomerSelectionInput}    ✅  — currently { all: "ALL" }
 *   appliesOncePerCustomer {Boolean}                           ⬜  — limit one use per customer
 *   context                {DiscountContextInput}              ⬜  — restrict to market/segment
 */

// =============================================================================
// 5. discountAutomaticFreeShippingCreate
//    Input: DiscountAutomaticFreeShippingInput
//    Docs: https://shopify.dev/docs/api/admin-graphql/latest/mutations/discountAutomaticFreeShippingCreate
// =============================================================================
/**
 *   title                    {String!}                         ✅
 *   startsAt                 {DateTime!}                       ✅
 *   endsAt                   {DateTime}                        ✅
 *   destination              {DiscountShippingDestinationInput!} ✅
 *     all      {Boolean}
 *     country  {DiscountCountriesInput}
 *       add  {[CountryCode!]}  — ISO 3166-1 alpha-2 e.g. ["US", "CA"]
 *   minimumRequirement       {DiscountMinimumRequirementInput} ✅
 *   combinesWith             {DiscountCombinesWithInput}       ✅
 *   maximumShippingPrice     {Decimal}                         ✅  — cap on qualifying rate
 *   appliesOnOneTimePurchase {Boolean}                         ✅  — hardcoded to true
 *   appliesOnSubscription    {Boolean}                         ⬜  — also apply to subscriptions
 *   recurringCycleLimit      {Int}                             ⬜  — billing cycles (subscriptions only)
 */

// =============================================================================
// 6. discountCodeFreeShippingCreate
//    Input: DiscountCodeFreeShippingInput
//    Docs: https://shopify.dev/docs/api/admin-graphql/latest/mutations/discountCodeFreeShippingCreate
// =============================================================================
/**
 *   title                  {String!}                           ✅
 *   code                   {String!}                           ✅
 *   startsAt               {DateTime!}                         ✅
 *   endsAt                 {DateTime}                          ✅
 *   destination            {DiscountShippingDestinationInput!} ✅
 *   minimumRequirement     {DiscountMinimumRequirementInput}   ✅
 *   combinesWith           {DiscountCombinesWithInput}         ✅
 *   maximumShippingPrice   {Decimal}                           ✅
 *   customerSelection      {DiscountCustomerSelectionInput!}   ✅  — hardcoded to { all: true }
 *   appliesOncePerCustomer {Boolean}                           ✅
 *   usageLimit             {Int}                               ⬜  — max total redemptions
 *   context                {DiscountContextInput}              ⬜  — restrict to market/segment
 */