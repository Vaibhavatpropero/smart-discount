// app/utils/discount-identity.server.js
import prisma from "../db.server.js";

const DISCOUNT_STATUS = {
  ACTIVE: "ACTIVE",
  SCHEDULED: "SCHEDULED",
  DRAFT: "DRAFT",
  FAILED: "FAILED",
};

const DISCOUNT_METHOD = {
  CODE: "CODE",
  AUTOMATIC: "AUTOMATIC",
};

const COLLISION_MATCH_TYPE = {
  CODE: "CODE",
  MATCH_KEY: "MATCH_KEY",
};

function normalizeDiscountTitle(discountTitle) {
  return String(discountTitle || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function normalizeDiscountCode(discountCode) {
  return String(discountCode || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeDiscountMethod(discountMethod = DISCOUNT_METHOD.AUTOMATIC) {
  return String(discountMethod || DISCOUNT_METHOD.AUTOMATIC)
    .trim()
    .toUpperCase();
}

function normalizeDiscountStatus(discountStatus) {
  return String(discountStatus || "").trim().toUpperCase();
}

function isLiveDiscountStatus(discountStatus) {
  const normalizedStatus = normalizeDiscountStatus(discountStatus);

  return (
    normalizedStatus === DISCOUNT_STATUS.ACTIVE ||
    normalizedStatus === DISCOUNT_STATUS.SCHEDULED
  );
}

function buildAutomaticDiscountMatchKey(discountTitle) {
  const normalizedTitle = normalizeDiscountTitle(discountTitle);

  return normalizedTitle ? `shopify:auto:${normalizedTitle}` : null;
}

function buildCodeDiscountMatchKey(discountCode) {
  const normalizedCode = normalizeDiscountCode(discountCode);

  return normalizedCode ? `shopify:code:${normalizedCode}` : null;
}

function buildDiscountSelect() {
  return {
    id: true,
    title: true,
    method: true,
    status: true,
    startsAt: true,
    endsAt: true,
    createdAt: true,
    matchType: true,
    matchKey: true,
    isMatchable: true,
    shopifyDiscountCode: true,
    shopifyDeletedAt: true,
    supersededById: true,
  };
}

function buildExcludeWhere(excludeDiscountId = null) {
  if (!excludeDiscountId) return {};

  return {
    NOT: {
      id: excludeDiscountId,
    },
  };
}

async function findLiveDiscountByMatchKey({
  shopId,
  matchKey,
  excludeDiscountId = null,
}) {
  if (!shopId || !matchKey) return null;

  return prisma.discount.findFirst({
    where: {
      shopId,
      matchKey,
      isMatchable: true,
      status: {
        in: [ DISCOUNT_STATUS.ACTIVE, DISCOUNT_STATUS.SCHEDULED ],
      },
      shopifyDeletedAt: null,
      ...buildExcludeWhere(excludeDiscountId),
    },
    orderBy: {
      createdAt: "desc",
    },
    select: buildDiscountSelect(),
  });
}

async function findLiveCodeCollision({
  shopId,
  discountCode,
  excludeDiscountId = null,
}) {
  const normalizedCode = normalizeDiscountCode(discountCode);

  if (!shopId || !normalizedCode) return null;

  return prisma.discount.findFirst({
    where: {
      shopId,
      method: DISCOUNT_METHOD.CODE,
      isMatchable: true,
      status: {
        in: [ DISCOUNT_STATUS.ACTIVE, DISCOUNT_STATUS.SCHEDULED ],
      },
      shopifyDeletedAt: null,
      shopifyDiscountCode: normalizedCode,
      ...buildExcludeWhere(excludeDiscountId),
    },
    orderBy: {
      createdAt: "desc",
    },
    select: buildDiscountSelect(),
  });
}

async function findWebhookCandidatesByMatchKey({
  shopId,
  matchKey,
  discountMethod = DISCOUNT_METHOD.AUTOMATIC,
  discountCode = null,
}) {
  if (!shopId) return [];

  const normalizedMethod = normalizeDiscountMethod(discountMethod);
  const normalizedCode = normalizeDiscountCode(discountCode);

  const orFilters = [];

  if (matchKey) {
    orFilters.push({ matchKey });
  }

  if (normalizedMethod === DISCOUNT_METHOD.CODE && normalizedCode) {
    orFilters.push({
      method: DISCOUNT_METHOD.CODE,
      shopifyDiscountCode: normalizedCode,
    });
  }

  if (!orFilters.length) return [];

  return prisma.discount.findMany({
    where: {
      shopId,
      status: {
        notIn: [ DISCOUNT_STATUS.DRAFT, DISCOUNT_STATUS.FAILED ],
      },
      OR: orFilters,
    },
    orderBy: [ { createdAt: "desc" } ],
    select: buildDiscountSelect(),
  });
}

function isDiscountCandidateValidForOrder(discount, orderCreatedAt) {
  if (!discount || !orderCreatedAt) return false;

  const orderTime = new Date(orderCreatedAt).getTime();
  const createdTime = discount.createdAt ? new Date(discount.createdAt).getTime() : null;
  const startsAtTime = discount.startsAt ? new Date(discount.startsAt).getTime() : null;
  const endsAtTime = discount.endsAt ? new Date(discount.endsAt).getTime() : null;
  const deletedAtTime = discount.shopifyDeletedAt
    ? new Date(discount.shopifyDeletedAt).getTime()
    : null;

  if (createdTime && createdTime > orderTime) return false;
  if (startsAtTime && startsAtTime > orderTime) return false;
  if (endsAtTime && endsAtTime < orderTime) return false;
  if (deletedAtTime && deletedAtTime < orderTime) return false;

  return true;
}

/**
 * Takes discount title, method, code and returns matchKey for a discount.
 *
 * CODE discounts resolve by code only because Shopify order payloads expose
 * the code but do not provide a durable internal discount ID.
 *
 * AUTOMATIC discounts resolve by normalized title because Shopify order payloads
 * expose the title for automatic applications.
 *
 * @returns {object} { matchKey: string | null, isMatchable: boolean }
 */
export function buildDiscountMatchKey(
  discountTitle,
  discountStatus,
  discountMethod = DISCOUNT_METHOD.AUTOMATIC,
  discountCode = null
) {
  const normalizedMethod = normalizeDiscountMethod(discountMethod);
  const isMatchable = isLiveDiscountStatus(discountStatus);

  if (normalizedMethod === DISCOUNT_METHOD.AUTOMATIC) {
    return {
      matchKey: buildAutomaticDiscountMatchKey(discountTitle),
      isMatchable,
    };
  }

  if (normalizedMethod === DISCOUNT_METHOD.CODE) {
    return {
      matchKey: buildCodeDiscountMatchKey(discountCode),
      isMatchable,
    };
  }

  return {
    matchKey: null,
    isMatchable,
  };
}

/**
 * Used during publish flow.
 *
 * Collision types:
 * 1. CODE discounts collide by normalized code among ACTIVE/SCHEDULED live rows.
 * 2. AUTOMATIC discounts collide by normalized matchKey among ACTIVE/SCHEDULED live rows.
 *
 * @returns {object}
 * {
 *   matchedDiscountId: string | null,
 *   matchedDiscount: object | null,
 *   matchKey: string | null,
 *   isMatchable: boolean,
 *   isCollided: boolean,
 *   hasCollision: boolean,
 *   matchType: "CODE" | "MATCH_KEY" | null,
 * }
 */
export async function resolveDiscountCollision({
  shopId,
  discountTitle,
  discountMethod = DISCOUNT_METHOD.AUTOMATIC,
  discountCode = null,
  excludeDiscountId = null,
}) {
  const normalizedMethod = normalizeDiscountMethod(discountMethod);
  const { matchKey, isMatchable } = buildDiscountMatchKey(
    discountTitle,
    DISCOUNT_STATUS.ACTIVE,
    normalizedMethod,
    discountCode
  );

  if (!shopId) {
    return {
      matchedDiscountId: null,
      matchedDiscount: null,
      matchKey,
      isMatchable,
      isCollided: false,
      hasCollision: false,
      matchType: null,
    };
  }

  if (normalizedMethod === DISCOUNT_METHOD.CODE) {
    const matchedDiscount = await findLiveCodeCollision({
      shopId,
      discountCode,
      excludeDiscountId,
    });

    return {
      matchedDiscountId: matchedDiscount?.id || null,
      matchedDiscount,
      matchKey,
      isMatchable,
      isCollided: Boolean(matchedDiscount),
      hasCollision: Boolean(matchedDiscount),
      matchType: matchedDiscount ? COLLISION_MATCH_TYPE.CODE : null,
    };
  }

  if (normalizedMethod === DISCOUNT_METHOD.AUTOMATIC) {
    const matchedDiscount = await findLiveDiscountByMatchKey({
      shopId,
      matchKey,
      excludeDiscountId,
    });

    return {
      matchedDiscountId: matchedDiscount?.id || null,
      matchedDiscount,
      matchKey,
      isMatchable,
      isCollided: Boolean(matchedDiscount),
      hasCollision: Boolean(matchedDiscount),
      matchType: matchedDiscount ? COLLISION_MATCH_TYPE.MATCH_KEY : null,
    };
  }

  return {
    matchedDiscountId: null,
    matchedDiscount: null,
    matchKey,
    isMatchable,
    isCollided: false,
    hasCollision: false,
    matchType: null,
  };
}

/**
 * Used by webhook processing to identify which discount row an incoming
 * order/refund discount application belongs to.
 *
 * This intentionally does NOT require isMatchable=true, because historical
 * orders/refunds can arrive after a discount is disabled, expired, or deleted.
 *
 * Resolution order:
 * 1. Rebuild matchKey from webhook payload.
 * 2. Find all non-draft/non-failed rows with that key.
 * 3. Prefer the row whose lifecycle window contains orderCreatedAt.
 * 4. If multiple match, prefer the most recently created valid row.
 * 5. Final fallback: newest currently matchable row for that key.
 *
 * @returns {object}
 * {
 *   discountId: string | null,
 *   matchedDiscount: object | null,
 *   matchKey: string | null,
 *   isMatchable: boolean,
 *   candidateCount: number,
 * }
 */
export async function resolveDiscountMatchKey({
  shopId,
  discountTitle,
  discountMethod = DISCOUNT_METHOD.AUTOMATIC,
  discountCode = null,
  orderCreatedAt = null,
}) {
  const normalizedMethod = normalizeDiscountMethod(discountMethod);
  const { matchKey, isMatchable } = buildDiscountMatchKey(
    discountTitle,
    DISCOUNT_STATUS.ACTIVE,
    normalizedMethod,
    discountCode
  );

  if (!shopId || !matchKey) {
    return {
      discountId: null,
      matchedDiscount: null,
      matchKey,
      isMatchable,
      candidateCount: 0,
    };
  }

  const candidates = await findWebhookCandidatesByMatchKey({
    shopId,
    matchKey,
    discountMethod: normalizedMethod,
    discountCode,
  });

  if (!candidates.length) {
    return {
      discountId: null,
      matchedDiscount: null,
      matchKey,
      isMatchable,
      candidateCount: 0,
    };
  }

  let matchedDiscount = null;

  if (orderCreatedAt) {
    matchedDiscount =
      candidates.find((candidate) =>
        isDiscountCandidateValidForOrder(candidate, orderCreatedAt)
      ) || null;

    // Do not guess a newer campaign when the order window missed.
    return {
      discountId: matchedDiscount?.id || null,
      matchedDiscount,
      matchKey,
      isMatchable,
      candidateCount: candidates.length,
    };
  }

  matchedDiscount =
    candidates.find(
      (candidate) =>
        candidate.isMatchable &&
        candidate.shopifyDeletedAt == null &&
        isLiveDiscountStatus(candidate.status)
    ) || null;

  return {
    discountId: matchedDiscount?.id || null,
    matchedDiscount,
    matchKey,
    isMatchable,
    candidateCount: candidates.length,
  };
}