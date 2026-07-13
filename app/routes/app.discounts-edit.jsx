// app/routes/app.discounts-edit.jsx
import { boundary } from "@shopify/shopify-app-react-router/server";
import { data, Form, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import prisma from "../db.server.js";
import {
    canUseDiscountType,
    getDiscountAccessState,
    requireCreateDiscountAccess,
} from "../utils/plan-gate.server.js";
import { authenticate } from "../shopify.server.js";
import BasicsStep from "../components/discount-wizard/steps/BasicsStep.jsx";
import ValueStep from "../components/discount-wizard/steps/ValueStep.jsx";
import ConditionsStep from "../components/discount-wizard/steps/ConditionsStep.jsx";
import ScheduleStep from "../components/discount-wizard/steps/ScheduleStep.jsx";
import ReviewStep from "../components/discount-wizard/steps/ReviewStep.jsx";
import {
    StepProgress,
    StickyActionBar,
    STEPS,
} from "../components/discount-wizard/WizardShell.jsx";
import { useDiscountWizardState } from "../components/discount-wizard/useDiscountWizardState.js";
import { RouteErrorFallback } from "../components";

const GROUP_CONFIG = {
    order: {
        key: "order",
        family: "PERCENTAGE_OR_FIXED",
        discountType: "ORDER_PERCENTAGE",
        method: "AUTOMATIC",
        supportedMethods: [ "AUTOMATIC", "CODE" ],
        title: "Order discount",
        shortTitle: "Order",
        description: "Percentage or fixed discounts for the full cart.",
        helper: "Apply a discount across the full order total.",
        supportsTargets: false,
        supportsValueTypeToggle: true,
    },
    product: {
        key: "product",
        family: "PERCENTAGE_OR_FIXED",
        discountType: "PRODUCT_PERCENTAGE",
        method: "AUTOMATIC",
        supportedMethods: [ "AUTOMATIC", "CODE" ],
        title: "Product / collection discount",
        shortTitle: "Products",
        description: "Discount selected products or collections.",
        helper: "Target specific products or collections instead of the full cart.",
        supportsTargets: true,
        supportsValueTypeToggle: true,
    },
    bxgy: {
        key: "bxgy",
        family: "BXGY",
        discountType: "BXGY",
        method: "AUTOMATIC",
        supportedMethods: [ "AUTOMATIC" ],
        title: "Buy X get Y",
        shortTitle: "BXGY",
        description: "Create a BOGO or multi-buy promotion.",
        helper: "Build a reward flow where qualifying purchases unlock free or discounted items.",
        supportsTargets: false,
        supportsValueTypeToggle: false,
    },
    shipping: {
        key: "shipping",
        family: "FREE_SHIPPING",
        discountType: "FREESHIPPING",
        method: "AUTOMATIC",
        supportedMethods: [ "AUTOMATIC", "CODE" ],
        title: "Free shipping discount",
        shortTitle: "Shipping",
        description: "Create a shipping incentive for checkout conversion.",
        helper: "Use shipping offers to improve conversion at checkout.",
        supportsTargets: false,
        supportsValueTypeToggle: false,
    },
};

function getGroupConfig(group) {
    return GROUP_CONFIG[ group ] || GROUP_CONFIG.order;
}

function getGroupKeyFromDiscountType(discountType) {
    switch (discountType) {
        case "PRODUCT_PERCENTAGE":
        case "PRODUCT_FIXED":
            return "product";
        case "BXGY":
            return "bxgy";
        case "FREESHIPPING":
            return "shipping";
        case "ORDER_FIXED":
        case "ORDER_PERCENTAGE":
        default:
            return "order";
    }
}

function parseJsonArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
        const parsed = JSON.parse(String(value));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function normalizeDateTimeLocal(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours()
    )}:${pad(d.getMinutes())}`;
}

function asResourceArray(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(Boolean).map((item) => {
        if (typeof item === "string") {
            return { id: item };
        }
        return item;
    });
}

function buildBxgyConfigPayload(formData) {
    return {
        customerBuysType: String(formData.get("bxgyBuyRequirementType") || "QUANTITY"),
        customerBuysQty:
            formData.get("bxgyBuyQuantity") === "" || formData.get("bxgyBuyQuantity") == null
                ? null
                : Number(formData.get("bxgyBuyQuantity")),
        customerBuysAmount:
            formData.get("bxgyBuyAmount") === "" || formData.get("bxgyBuyAmount") == null
                ? null
                : Number(formData.get("bxgyBuyAmount")),
        customerBuysProducts: parseJsonArray(formData.get("bxgyBuyProducts")),
        customerBuysCollections: parseJsonArray(formData.get("bxgyBuyCollections")),
        customerGetsQty:
            formData.get("bxgyGetQuantity") === "" || formData.get("bxgyGetQuantity") == null
                ? null
                : Number(formData.get("bxgyGetQuantity")),
        customerGetsEffect: String(formData.get("bxgyGetEffect") || "FREE"),
        customerGetsPercentage:
            formData.get("bxgyGetPercentage") === "" || formData.get("bxgyGetPercentage") == null
                ? null
                : Number(formData.get("bxgyGetPercentage")),
        customerGetsAmount:
            formData.get("bxgyGetAmount") === "" || formData.get("bxgyGetAmount") == null
                ? null
                : Number(formData.get("bxgyGetAmount")),
        customerGetsProducts: parseJsonArray(formData.get("bxgyGetProducts")),
        customerGetsCollections: parseJsonArray(formData.get("bxgyGetCollections")),
    };
}

function buildDraftPayload({ shopId, formData, access, template, existingDiscount }) {
    const group = String(
        formData.get("group") || getGroupKeyFromDiscountType(existingDiscount.discountType)
    ).toLowerCase();

    const groupConfig = getGroupConfig(group);
    const method = String(formData.get("method") || groupConfig.method);
    const postedDiscountType = String(
        formData.get("discountType") || existingDiscount.discountType || groupConfig.discountType
    );

    const isPercentage = String(formData.get("isPercentage") || "true") === "true";
    const discountValueRaw = formData.get("discountValue");
    const discountValue =
        discountValueRaw === "" || discountValueRaw == null ? null : Number(discountValueRaw);

    const scopeMode = String(formData.get("scopeMode") || "");
    const targetProducts = parseJsonArray(formData.get("targetProducts"));
    const targetCollections = parseJsonArray(formData.get("targetCollections"));

    const shippingDestinationMode = String(formData.get("shippingDestinationMode") || "ALL");
    const shippingDestinationCountries = parseJsonArray(
        formData.get("shippingDestinationCountries")
    );

    const maximumShippingPriceRaw = formData.get("maximumShippingPrice");
    const maximumShippingPrice =
        maximumShippingPriceRaw === "" || maximumShippingPriceRaw == null
            ? null
            : Number(maximumShippingPriceRaw);

    const minimumType = String(formData.get("minimumType") || "NONE");
    const minimumSubtotalRaw = formData.get("minimumSubtotal");
    const minimumQuantityRaw = formData.get("minimumQuantity");
    const usageLimitRaw = formData.get("usageLimit");
    const bxgyUsesPerOrderLimitRaw = formData.get("bxgyUsesPerOrderLimit");
    const startsAtRaw = formData.get("startsAt");
    const endsAtRaw = formData.get("endsAt");

    const isBxgy = postedDiscountType === "BXGY";
    const isFreeShipping = postedDiscountType === "FREE_SHIPPING";

    return {
        shopId,
        title: String(formData.get("title") || "").trim(),
        description: String(formData.get("description") || "").trim() || null,
        method,
        discountType: postedDiscountType,
        templateId: template?.id || existingDiscount.templateId || null,
        shopifyDiscountCode:
            method === "CODE" ? String(formData.get("discountCode") || "").trim() || null : null,
        isPercentage: isBxgy || isFreeShipping ? false : isPercentage,
        discountValue: isBxgy || isFreeShipping ? null : discountValue,
        appliesToAll: group === "product" ? scopeMode === "ALL" : true,
        scopeMode: group === "product" ? scopeMode : null,
        targetProducts:
            group === "product" && scopeMode === "SPECIFIC_PRODUCTS" ? targetProducts : [],
        targetCollections:
            group === "product" && scopeMode === "SPECIFIC_COLLECTIONS" ? targetCollections : [],
        minimumType,
        minimumSubtotal:
            minimumType === "SUBTOTAL" &&
                minimumSubtotalRaw !== "" &&
                minimumSubtotalRaw != null
                ? Number(minimumSubtotalRaw)
                : null,
        minimumQuantity:
            minimumType === "QUANTITY" &&
                minimumQuantityRaw !== "" &&
                minimumQuantityRaw != null
                ? Number(minimumQuantityRaw)
                : null,
        usageLimit:
            usageLimitRaw === "" || usageLimitRaw == null ? null : Number(usageLimitRaw),
        usesPerOrderLimit:
            bxgyUsesPerOrderLimitRaw === "" || bxgyUsesPerOrderLimitRaw == null
                ? null
                : Number(bxgyUsesPerOrderLimitRaw),
        appliesOncePerCustomer:
            String(formData.get("appliesOncePerCustomer") || "false") === "true",
        combineWithOrderDiscounts:
            String(formData.get("combineWithOrderDiscounts") || "false") === "true",
        combineWithProductDiscounts:
            String(formData.get("combineWithProductDiscounts") || "false") === "true",
        combineWithShippingDiscounts:
            String(formData.get("combineWithShippingDiscounts") || "false") === "true",
        shippingDestinationMode: isFreeShipping ? shippingDestinationMode : null,
        shippingDestinationCountries:
            isFreeShipping && shippingDestinationMode === "SPECIFIC_COUNTRIES"
                ? shippingDestinationCountries
                : [],
        maximumShippingPrice: isFreeShipping ? maximumShippingPrice : null,
        startsAt: startsAtRaw && String(startsAtRaw).trim() ? new Date(String(startsAtRaw)) : null,
        endsAt: endsAtRaw && String(endsAtRaw).trim() ? new Date(String(endsAtRaw)) : null,
        status: "DRAFT",
        lastError: null,
    };
}

function buildInitialState(discount, group) {
    const bxgy = discount.bxgyConfig;

    const bxgyBuyTargetType =
        Array.isArray(bxgy?.customerBuysCollections) && bxgy.customerBuysCollections.length > 0
            ? "COLLECTIONS"
            : "PRODUCTS";

    const bxgyGetTargetType =
        Array.isArray(bxgy?.customerGetsCollections) && bxgy.customerGetsCollections.length > 0
            ? "COLLECTIONS"
            : "PRODUCTS";

    const shippingDestinationMode =
        Array.isArray(discount.shippingDestinationCountries) &&
            discount.shippingDestinationCountries.length > 0
            ? "SPECIFIC_COUNTRIES"
            : "ALL";

    return {
        title: discount.title || "",
        description: discount.description || "",
        method: discount.method || getGroupConfig(group).method,
        discountCode: discount.discountCode || discount.shopifyDiscountCode || "",
        isPercentage: Boolean(discount.isPercentage),
        discountValue:
            discount.discountValue == null || discount.discountValue === undefined
                ? ""
                : String(discount.discountValue),

        minimumType: discount.minimumType || "NONE",
        minimumSubtotal:
            discount.minimumSubtotal == null || discount.minimumSubtotal === undefined
                ? ""
                : String(discount.minimumSubtotal),
        minimumQuantity:
            discount.minimumQuantity == null || discount.minimumQuantity === undefined
                ? ""
                : String(discount.minimumQuantity),
        usageLimit:
            discount.usageLimit == null || discount.usageLimit === undefined
                ? ""
                : String(discount.usageLimit),

        appliesOncePerCustomer: Boolean(discount.appliesOncePerCustomer),
        combineWithOrderDiscounts: Boolean(discount.combineWithOrderDiscounts),
        combineWithProductDiscounts: Boolean(discount.combineWithProductDiscounts),
        combineWithShippingDiscounts: Boolean(discount.combineWithShippingDiscounts),

        scopeMode: discount.scopeMode || (group === "product" ? "ALL" : "ENTIRE_ORDER"),
        targetProducts: asResourceArray(discount.targetProducts),
        targetCollections: asResourceArray(discount.targetCollections),

        bxgyBuyRequirementType: bxgy?.customerBuysType || "QUANTITY",
        bxgyBuyQuantity:
            bxgy?.customerBuysQty == null || bxgy?.customerBuysQty === undefined
                ? ""
                : String(bxgy.customerBuysQty),
        bxgyBuyAmount:
            bxgy?.customerBuysAmount == null || bxgy?.customerBuysAmount === undefined
                ? ""
                : String(bxgy.customerBuysAmount),
        bxgyBuyTargetType,
        bxgyBuyProducts: asResourceArray(bxgy?.customerBuysProducts),
        bxgyBuyCollections: asResourceArray(bxgy?.customerBuysCollections),

        bxgyGetQuantity:
            bxgy?.customerGetsQty == null || bxgy?.customerGetsQty === undefined
                ? "1"
                : String(bxgy.customerGetsQty),
        bxgyGetEffect: bxgy?.customerGetsEffect || "FREE",
        bxgyGetPercentage:
            bxgy?.customerGetsPercentage == null || bxgy?.customerGetsPercentage === undefined
                ? ""
                : String(bxgy.customerGetsPercentage),
        bxgyGetAmount:
            bxgy?.customerGetsAmount == null || bxgy?.customerGetsAmount === undefined
                ? ""
                : String(bxgy.customerGetsAmount),
        bxgyGetTargetType,
        bxgyGetProducts: asResourceArray(bxgy?.customerGetsProducts),
        bxgyGetCollections: asResourceArray(bxgy?.customerGetsCollections),
        bxgyUsesPerOrderLimit:
            discount.usesPerOrderLimit == null || discount.usesPerOrderLimit === undefined
                ? ""
                : String(discount.usesPerOrderLimit),

        shippingDestinationMode,
        shippingDestinationCountries: Array.isArray(discount.shippingDestinationCountries)
            ? discount.shippingDestinationCountries
            : [],
        maximumShippingPrice:
            discount.maximumShippingPrice == null || discount.maximumShippingPrice === undefined
                ? ""
                : String(discount.maximumShippingPrice),

        startsAt: normalizeDateTimeLocal(discount.startsAt),
        endsAt: normalizeDateTimeLocal(discount.endsAt),
    };
}

async function hydrateResourceSelection({ request, type, ids }) {
    if (!Array.isArray(ids) || ids.length === 0) return [];

    const url = new URL(request.url);
    url.pathname = "/app/api/resource-search";
    url.search = new URLSearchParams({
        type,
        ids: ids.join(","),
    }).toString();

    const response = await fetch(url.toString(), {
        headers: {
            cookie: request.headers.get("cookie") || "",
        },
    });

    if (!response.ok) {
        return [];
    }

    const json = await response.json();
    return Array.isArray(json?.results) ? json.results : [];
}

export async function loader({ request }) {
    const { admin } = await authenticate.admin(request);
    const context = await requireCreateDiscountAccess(request);
    const { shop, access } = context;

    const url = new URL(request.url);
    const id = String(url.searchParams.get("id") || "").trim();

    if (!id) {
        throw data({ message: "Draft id is required." }, { status: 400 });
    }

    const discount = await prisma.discount.findFirst({
        where: {
            id,
            shopId: shop.id,
        },
        include: {
            bxgyConfig: true,
        },
    });

    if (!discount) {
        throw data({ message: "Draft not found." }, { status: 404 });
    }

    if (discount.status !== "DRAFT" && discount.status !== "FAILED") {
        throw data({ message: "Only draft discounts can be edited here." }, { status: 400 });
    }

    const accessState = getDiscountAccessState(access, discount);

    if (!accessState.canEdit) {
        throw data(
            {
                message:
                    accessState.reason === "trialexpired"
                        ? "Your trial has expired. Upgrade to edit this discount."
                        : "Your current plan cannot edit this discount.",
            },
            { status: 403 }
        );
    }

    const group = getGroupKeyFromDiscountType(discount.discountType);
    const groupConfig = getGroupConfig(group);

    const hydratedTargetProducts =
        group === "product" && Array.isArray(discount.targetProducts) && discount.targetProducts.length > 0
            ? await hydrateResourceSelection({
                request,
                type: "product",
                ids: discount.targetProducts,
            })
            : [];

    const hydratedTargetCollections =
        group === "product" && Array.isArray(discount.targetCollections) && discount.targetCollections.length > 0
            ? await hydrateResourceSelection({
                request,
                type: "collection",
                ids: discount.targetCollections,
            })
            : [];

    const hydratedBxgyBuyProducts =
        group === "bxgy" &&
            Array.isArray(discount.bxgyConfig?.customerBuysProducts) &&
            discount.bxgyConfig.customerBuysProducts.length > 0
            ? await hydrateResourceSelection({
                request,
                type: "product",
                ids: discount.bxgyConfig.customerBuysProducts,
            })
            : [];

    const hydratedBxgyBuyCollections =
        group === "bxgy" &&
            Array.isArray(discount.bxgyConfig?.customerBuysCollections) &&
            discount.bxgyConfig.customerBuysCollections.length > 0
            ? await hydrateResourceSelection({
                request,
                type: "collection",
                ids: discount.bxgyConfig.customerBuysCollections,
            })
            : [];

    const hydratedBxgyGetProducts =
        group === "bxgy" &&
            Array.isArray(discount.bxgyConfig?.customerGetsProducts) &&
            discount.bxgyConfig.customerGetsProducts.length > 0
            ? await hydrateResourceSelection({
                request,
                type: "product",
                ids: discount.bxgyConfig.customerGetsProducts,
            })
            : [];

    const hydratedBxgyGetCollections =
        group === "bxgy" &&
            Array.isArray(discount.bxgyConfig?.customerGetsCollections) &&
            discount.bxgyConfig.customerGetsCollections.length > 0
            ? await hydrateResourceSelection({
                request,
                type: "collection",
                ids: discount.bxgyConfig.customerGetsCollections,
            })
            : [];

    const initialState = buildInitialState(
        {
            ...discount,
            targetProducts: hydratedTargetProducts,
            targetCollections: hydratedTargetCollections,
            bxgyConfig: discount.bxgyConfig
                ? {
                    ...discount.bxgyConfig,
                    customerBuysProducts: hydratedBxgyBuyProducts,
                    customerBuysCollections: hydratedBxgyBuyCollections,
                    customerGetsProducts: hydratedBxgyGetProducts,
                    customerGetsCollections: hydratedBxgyGetCollections,
                }
                : null,
        },
        group
    );

    return data({
        shop,
        access,
        discountId: discount.id,
        discount,
        group,
        groupConfig,
        initialState,
        shopCurrency: shop.currencyCode || "USD",
        canPublish: true,
        adminReady: Boolean(admin),
    });
}

export const action = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const context = await requireCreateDiscountAccess(request);
    const { shop, access } = context;
    const formData = await request.formData();

    const id = String(formData.get("id") || "").trim();
    if (!id) {
        return data({ errors: { form: "Draft id is required." } }, { status: 400 });
    }

    const existingDiscount = await prisma.discount.findFirst({
        where: {
            id,
            shopId: shop.id,
        },
        include: {
            bxgyConfig: true,
        },
    });

    if (!existingDiscount) {
        return data({ errors: { form: "Draft not found." } }, { status: 404 });
    }

    const accessState = getDiscountAccessState(access, existingDiscount);

    if (!accessState.canEdit) {
        return data(
            {
                errors: {
                    form:
                        accessState.reason === "trialexpired"
                            ? "Your trial has expired. Upgrade to edit this discount."
                            : "Your current plan cannot edit this discount.",
                },
            },
            { status: 403 }
        );
    }

    if (existingDiscount.status !== "DRAFT" && existingDiscount.status !== "FAILED") {
        return data(
            { errors: { form: "Only draft discounts can be edited or published here." } },
            { status: 400 }
        );
    }

    const group = String(
        formData.get("group") || getGroupKeyFromDiscountType(existingDiscount.discountType)
    ).toLowerCase();

    const groupConfig = getGroupConfig(group);
    const title = String(formData.get("title") || "").trim();
    const method = String(formData.get("method") || groupConfig.method);
    const discountCode = String(formData.get("discountCode") || "").trim();

    const discountValueRaw = formData.get("discountValue");
    const discountValue =
        discountValueRaw === "" || discountValueRaw == null ? null : Number(discountValueRaw);

    const scopeMode = String(formData.get("scopeMode") || "");
    const targetProducts = parseJsonArray(formData.get("targetProducts"));
    const targetCollections = parseJsonArray(formData.get("targetCollections"));

    if (group === "product") {
        if (scopeMode === "SPECIFIC_PRODUCTS" && targetProducts.length === 0) {
            return data(
                { errors: { targetProducts: "Add at least one product target." } },
                { status: 400 }
            );
        }

        if (scopeMode === "SPECIFIC_COLLECTIONS" && targetCollections.length === 0) {
            return data(
                { errors: { targetCollections: "Add at least one collection target." } },
                { status: 400 }
            );
        }
    }

    const minimumType = String(formData.get("minimumType") || "NONE");
    const minimumSubtotal = formData.get("minimumSubtotal");
    const minimumQuantity = formData.get("minimumQuantity");
    const startsAt = formData.get("startsAt");
    const endsAt = formData.get("endsAt");
    const usageLimit = formData.get("usageLimit");

    const errors = {};
    const postedDiscountType = String(
        formData.get("discountType") || existingDiscount.discountType || groupConfig.discountType
    );
    const isBxgy = postedDiscountType === "BXGY";
    const isFreeShipping = postedDiscountType === "FREE_SHIPPING";

    if (!title) {
        errors.title = "Title is required.";
    }

    if (method === "CODE" && !discountCode) {
        errors.discountCode = "Discount code is required when code method is selected.";
    }

    if (
        !isBxgy &&
        !isFreeShipping &&
        (discountValue == null || !Number.isFinite(discountValue) || discountValue <= 0)
    ) {
        errors.discountValue = "Enter a valid discount value.";
    }

    if (
        !isBxgy &&
        !isFreeShipping &&
        String(formData.get("isPercentage") || "true") === "true" &&
        discountValue > 100
    ) {
        errors.discountValue = "Percentage value cannot be more than 100.";
    }

    if (isBxgy) {
        const buyRequirementType = String(formData.get("bxgyBuyRequirementType") || "QUANTITY");
        const buyQuantity = Number(formData.get("bxgyBuyQuantity"));
        const buyAmount = Number(formData.get("bxgyBuyAmount"));
        const buyTargetType = String(formData.get("bxgyBuyTargetType") || "PRODUCTS");
        const buyProducts = parseJsonArray(formData.get("bxgyBuyProducts"));
        const buyCollections = parseJsonArray(formData.get("bxgyBuyCollections"));

        const getQuantity = Number(formData.get("bxgyGetQuantity"));
        const getEffect = String(formData.get("bxgyGetEffect") || "FREE");
        const getPercentage = Number(formData.get("bxgyGetPercentage"));
        const getTargetType = String(formData.get("bxgyGetTargetType") || "PRODUCTS");
        const getProducts = parseJsonArray(formData.get("bxgyGetProducts"));
        const getCollections = parseJsonArray(formData.get("bxgyGetCollections"));

        const usesPerOrderLimitRaw = formData.get("bxgyUsesPerOrderLimit");

        if (buyRequirementType === "QUANTITY" && (!Number.isInteger(buyQuantity) || buyQuantity <= 0)) {
            errors.bxgyBuyQuantity = "Enter a valid buy quantity.";
        }

        if (buyRequirementType === "AMOUNT" && (!Number.isFinite(buyAmount) || buyAmount <= 0)) {
            errors.bxgyBuyAmount = "Enter a valid spend amount.";
        }

        if (buyTargetType === "PRODUCTS" && buyProducts.length === 0) {
            errors.bxgyBuyProducts = "Add at least one product customers must buy.";
        }

        if (buyTargetType === "COLLECTIONS" && buyCollections.length === 0) {
            errors.bxgyBuyCollections = "Add at least one collection customers must buy from.";
        }

        if (!Number.isInteger(getQuantity) || getQuantity <= 0) {
            errors.bxgyGetQuantity = "Enter a valid reward quantity.";
        }

        if (
            getEffect === "PERCENTAGE" &&
            (!Number.isFinite(getPercentage) || getPercentage <= 0 || getPercentage > 100)
        ) {
            errors.bxgyGetPercentage = "Enter a valid reward percentage.";
        }

        if (getEffect === "AMOUNT_OFF_EACH") {
            const getAmount = Number(formData.get("bxgyGetAmount"));
            if (!Number.isFinite(getAmount) || getAmount <= 0) {
                errors.bxgyGetAmount = "Enter a valid amount off each item.";
            }
        }

        if (getTargetType === "PRODUCTS" && getProducts.length === 0) {
            errors.bxgyGetProducts = "Add at least one reward product.";
        }

        if (getTargetType === "COLLECTIONS" && getCollections.length === 0) {
            errors.bxgyGetCollections = "Add at least one reward collection.";
        }

        if (usesPerOrderLimitRaw && Number(usesPerOrderLimitRaw) <= 0) {
            errors.bxgyUsesPerOrderLimit = "Uses per order must be greater than 0.";
        }
    }

    if (isFreeShipping) {
        const shippingDestinationMode = String(formData.get("shippingDestinationMode") || "ALL");
        const shippingDestinationCountries = parseJsonArray(
            formData.get("shippingDestinationCountries")
        );
        const maximumShippingPriceRaw = formData.get("maximumShippingPrice");

        if (
            shippingDestinationMode === "SPECIFIC_COUNTRIES" &&
            shippingDestinationCountries.length === 0
        ) {
            errors.shippingDestinationCountries = "Add at least one destination country.";
        }

        if (
            maximumShippingPriceRaw !== "" &&
            maximumShippingPriceRaw != null &&
            (!Number.isFinite(Number(maximumShippingPriceRaw)) ||
                Number(maximumShippingPriceRaw) < 0)
        ) {
            errors.maximumShippingPrice = "Enter a valid maximum shipping price.";
        }
    }

    if (minimumType === "SUBTOTAL" && (!minimumSubtotal || Number(minimumSubtotal) <= 0)) {
        errors.minimumSubtotal = "Enter a valid minimum subtotal.";
    }

    if (minimumType === "QUANTITY" && (!minimumQuantity || Number(minimumQuantity) <= 0)) {
        errors.minimumQuantity = "Enter a valid minimum quantity.";
    }

    if (usageLimit && Number(usageLimit) <= 0) {
        errors.usageLimit = "Usage limit must be greater than 0.";
    }

    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
        errors.endsAt = "End date must be after the start date.";
    }

    if (Object.keys(errors).length > 0) {
        return data({ errors }, { status: 400 });
    }

    const payload = buildDraftPayload({
        shopId: shop.id,
        formData,
        access,
        template: null,
        existingDiscount,
    });

    if (!canUseDiscountType(access, payload.discountType)) {
        return data(
            { errors: { form: "This discount type requires a higher plan." } },
            { status: 403 }
        );
    }

    const intent = String(formData.get("intent") || "draft");
    const bxgyConfigPayload = buildBxgyConfigPayload(formData);

    const { shopId, ...updateData } = payload;

    const updatedDiscount = await prisma.discount.update({
        where: { id: existingDiscount.id },
        data: {
            ...updateData,
            bxgyConfig:
                payload.discountType === "BXGY"
                    ? {
                        upsert: {
                            create: bxgyConfigPayload,
                            update: bxgyConfigPayload,
                        },
                    }
                    : undefined,
        },
        include: { bxgyConfig: true },
    });

    const syncDiscount = {
        ...updatedDiscount,
        group,
        scopeMode: updateData.scopeMode,
    };

    if (intent === "draft") {
        return redirect(`/app/discounts-edit?id=${updatedDiscount.id}&saved=1`);
    }

    try {
        const { pushDiscountToShopify } = await import("../utils/discount-sync.server.js");
        const { shopifyDiscountId } = await pushDiscountToShopify({
            admin,
            discount: syncDiscount,
            currencyCode: shop.currency || "USD",
        });

        await prisma.discount.update({
            where: { id: updatedDiscount.id },
            data: {
                status: new Date(updatedDiscount.startsAt) > new Date() ? "SCHEDULED" : "ACTIVE",
                shopifyDiscountId,
                lastSyncedAt: new Date(),
                lastError: null,
            },
        });

        return redirect(`/app/discounts?published=${updatedDiscount.id}`);
    } catch (err) {
        await prisma.discount.update({
            where: { id: updatedDiscount.id },
            data: {
                status: "FAILED",
                lastError: String(err?.message || err),
            },
        });

        return data(
            {
                errors: {
                    form: `Saved draft changes, but publishing to Shopify failed: ${err?.message || err}`,
                },
            },
            { status: 422 }
        );
    }
};

function StepContent({ state, errors, groupConfig, shopCurrency }) {
    switch (state.currentStep) {
        case 0:
            return <BasicsStep state={state} errors={errors} groupConfig={groupConfig} />;
        case 1:
            return (
                <ValueStep
                    state={state}
                    errors={errors}
                    shopCurrency={shopCurrency}
                    groupConfig={groupConfig}
                />
            );
        case 2:
            return (
                <ConditionsStep
                    state={state}
                    errors={errors}
                    showTargeting={groupConfig.supportsTargets}
                    groupConfig={groupConfig}
                    shopCurrency={shopCurrency}
                />
            );
        case 3:
            return <ScheduleStep state={state} errors={errors} />;
        case 4:
        default:
            return (
                <ReviewStep
                    state={state}
                    groupConfig={groupConfig}
                    shopCurrency={shopCurrency}
                />
            );
    }
}

function HiddenFields({ state, group, discountId, discountType }) {
    return (
        <>
            <input type="hidden" name="id" value={discountId} />
            <input type="hidden" name="group" value={group} />
            <input type="hidden" name="discountType" value={discountType} />
            <input type="hidden" name="title" value={state.title} />
            <input type="hidden" name="description" value={state.description} />
            <input type="hidden" name="method" value={state.method} />
            <input type="hidden" name="discountCode" value={state.discountCode} />
            <input type="hidden" name="isPercentage" value={String(Boolean(state.isPercentage))} />
            <input type="hidden" name="discountValue" value={state.discountValue} />
            <input type="hidden" name="minimumType" value={state.minimumType || "NONE"} />
            <input type="hidden" name="minimumSubtotal" value={state.minimumSubtotal} />
            <input type="hidden" name="minimumQuantity" value={state.minimumQuantity} />
            <input type="hidden" name="usageLimit" value={state.usageLimit} />
            <input
                type="hidden"
                name="appliesOncePerCustomer"
                value={String(Boolean(state.appliesOncePerCustomer))}
            />
            <input
                type="hidden"
                name="combineWithOrderDiscounts"
                value={String(Boolean(state.combineWithOrderDiscounts))}
            />
            <input
                type="hidden"
                name="combineWithProductDiscounts"
                value={String(Boolean(state.combineWithProductDiscounts))}
            />
            <input
                type="hidden"
                name="combineWithShippingDiscounts"
                value={String(Boolean(state.combineWithShippingDiscounts))}
            />
            <input type="hidden" name="scopeMode" value={state.scopeMode} />
            <input
                type="hidden"
                name="targetProducts"
                value={JSON.stringify(state.targetProducts.map((item) => item?.id || item))}
            />
            <input
                type="hidden"
                name="targetCollections"
                value={JSON.stringify(state.targetCollections.map((item) => item?.id || item))}
            />
            <input type="hidden" name="bxgyBuyRequirementType" value={state.bxgyBuyRequirementType || "QUANTITY"} />
            <input type="hidden" name="bxgyBuyQuantity" value={state.bxgyBuyQuantity} />
            <input type="hidden" name="bxgyBuyAmount" value={state.bxgyBuyAmount} />
            <input type="hidden" name="bxgyBuyTargetType" value={state.bxgyBuyTargetType || "PRODUCTS"} />
            <input
                type="hidden"
                name="bxgyBuyProducts"
                value={JSON.stringify(state.bxgyBuyProducts.map((item) => item?.id || item))}
            />
            <input
                type="hidden"
                name="bxgyBuyCollections"
                value={JSON.stringify(state.bxgyBuyCollections.map((item) => item?.id || item))}
            />
            <input type="hidden" name="bxgyGetQuantity" value={state.bxgyGetQuantity} />
            <input type="hidden" name="bxgyGetEffect" value={state.bxgyGetEffect || "FREE"} />
            <input type="hidden" name="bxgyGetPercentage" value={state.bxgyGetPercentage} />
            <input type="hidden" name="bxgyGetAmount" value={state.bxgyGetAmount} />
            <input type="hidden" name="bxgyGetTargetType" value={state.bxgyGetTargetType || "PRODUCTS"} />
            <input
                type="hidden"
                name="bxgyGetProducts"
                value={JSON.stringify(state.bxgyGetProducts.map((item) => item?.id || item))}
            />
            <input
                type="hidden"
                name="bxgyGetCollections"
                value={JSON.stringify(state.bxgyGetCollections.map((item) => item?.id || item))}
            />
            <input type="hidden" name="bxgyUsesPerOrderLimit" value={state.bxgyUsesPerOrderLimit} />
            <input type="hidden" name="shippingDestinationMode" value={state.shippingDestinationMode || "ALL"} />
            <input
                type="hidden"
                name="shippingDestinationCountries"
                value={JSON.stringify(state.shippingDestinationCountries)}
            />
            <input type="hidden" name="maximumShippingPrice" value={state.maximumShippingPrice} />
            <input type="hidden" name="startsAt" value={state.startsAt} />
            <input type="hidden" name="endsAt" value={state.endsAt} />
        </>
    );
}

export default function DiscountEditRoute() {
    const loaderData = useLoaderData();
    const actionData = useActionData();
    const navigation = useNavigation();

    const { group, groupConfig, initialState, shopCurrency, discountId } = loaderData;
    const errors = actionData?.errors || {};
    const busy = navigation.state !== "idle";

    const state = useDiscountWizardState({
        groupConfig,
        template: null,
        groupValue: group,
        initialState,
    });

    const stepItems = STEPS.filter((step) => {
        if (group === "bxgy" || group === "shipping") {
            return step.key !== "targeting";
        }
        return true;
    });

    const visibleStepIndex = Math.min(state.currentStep, stepItems.length - 1);
    const isLastStep = state.currentStep === stepItems.length - 1;

    const computedDiscountType =
        group === "product"
            ? state.isPercentage
                ? "PRODUCT_PERCENTAGE"
                : "PRODUCT_FIXED"
            : group === "order"
                ? state.isPercentage
                    ? "ORDER_PERCENTAGE"
                    : "ORDER_FIXED"
                : groupConfig.discountType;

    const goNext = () => {
        const next = state.currentStep + 1;
        if (next < stepItems.length && state.canGoToStep(next)) {
            state.setCurrentStep(next);
        }
    };

    const goBack = () => {
        state.setCurrentStep(Math.max(0, state.currentStep - 1));
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-sm text-gray-500">Discount editor</p>
                        <h1 className="mt-1 text-2xl font-semibold text-gray-900">Edit discount</h1>
                        <p className="mt-2 max-w-2xl text-sm text-gray-500">
                            {groupConfig.description}
                        </p>
                    </div>

                    <Link
                        to="/app/discounts"
                        className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Back
                    </Link>
                </div>

                {errors.form ? (
                    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {errors.form}
                    </div>
                ) : null}

                <Form method="post">
                    <HiddenFields
                        state={state}
                        group={group}
                        discountId={discountId}
                        discountType={computedDiscountType}
                    />

                    <StepProgress
                        steps={stepItems}
                        currentStep={visibleStepIndex}
                        canGoToStep={state.canGoToStep}
                        onStepClick={(index) => {
                            if (state.canGoToStep(index)) {
                                state.setCurrentStep(index);
                            }
                        }}
                    />

                    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <StepContent
                            state={state}
                            errors={errors}
                            groupConfig={groupConfig}
                            shopCurrency={shopCurrency}
                        />
                    </div>

                    <StickyActionBar>
                        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-between">
                            <button
                                type="button"
                                onClick={goBack}
                                disabled={state.currentStep === 0}
                                className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                            >
                                Back
                            </button>

                            {!isLastStep ? (
                                <button
                                    type="button"
                                    onClick={goNext}
                                    disabled={!state.canGoToStep(state.currentStep + 1)}
                                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                                >
                                    Continue
                                </button>
                            ) : (
                                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                                    <button
                                        type="submit"
                                        name="intent"
                                        value="draft"
                                        disabled={busy}
                                        className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        Save draft changes
                                    </button>

                                    <button
                                        type="submit"
                                        name="intent"
                                        value="publish"
                                        disabled={busy}
                                        className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        Publish to Shopify
                                    </button>
                                </div>
                            )}
                        </div>
                    </StickyActionBar>
                </Form>
            </div>
        </div>
    );
}

export function ErrorBoundary() {
    return <RouteErrorFallback />;
}

export const headers = (headersArgs) => boundary.headers(headersArgs);