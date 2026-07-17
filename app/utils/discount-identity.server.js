// app/utils/discount-identity.server.js
import { createHash } from "node:crypto";
import prisma from "../db.server.js";

export const DISCOUNT_IDENTITY_VERSION = 1;

const MATCHABLE_STATUSES = [ "ACTIVE", "SCHEDULED" ];

/**
 * Normalize a Shopify discount code for stable matching.
 * Webhook applications expose the raw code string for type=discount_code.
 */
export function normalizeDiscountCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

/**
 * Normalize automatic discount title for stable matching.
 * Webhook applications expose title for automatic discounts.
 */
export function normalizeDiscountTitle(title) {
  return String(title || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildCodeMatchKey(shopifyDiscountCode) {
  const normalized = normalizeDiscountCode(shopifyDiscountCode);
  if (!normalized) return null;
  return `shopify:code:${normalized}`;
}

/** @param {string} title */
export function buildAutomaticMatchKey(title) {
  const normalized = normalizeDiscountTitle(title);
  if (!normalized) return null;
  return `shopify:auto:${normalized}`;
}

/**
 * Build identity from an app Discount-shaped object / create payload.
 * Used at create/edit/sync time.
 */
export function buildDiscountIdentity({
  method,
  title,
  shopifyDiscountCode,
  status = "DRAFT",
}) {
  const normalizedMethod = String(method || "").toUpperCase();

  if (normalizedMethod === "CODE") {
    const matchKey = buildCodeMatchKey(shopifyDiscountCode);
    if (!matchKey) {
      return {
        ok: false,
        errorField: "discountCode",
        error: "Discount code is required to build match identity.",
      };
    }

    return {
      ok: true,
      matchType: "CODE",
      matchKey,
      isMatchable: MATCHABLE_STATUSES.includes(String(status || "").toUpperCase()),
      identityVersion: DISCOUNT_IDENTITY_VERSION,
    };
  }

  if (normalizedMethod === "AUTOMATIC") {
    const matchKey = buildAutomaticMatchKey(title);
    if (!matchKey) {
      return {
        ok: false,
        errorField: "title",
        error: "Title is required to build match identity.",
      };
    }

    return {
      ok: true,
      matchType: "AUTOMATIC",
      matchKey,
      isMatchable: MATCHABLE_STATUSES.includes(String(status || "").toUpperCase()),
      identityVersion: DISCOUNT_IDENTITY_VERSION,
    };
  }

  return {
    ok: false,
    errorField: "form",
    error: `Unsupported discount method for identity: ${method}`,
  };
}

/**
 * Rebuild identity from a Shopify order discount_application entry.
 * Used by webhook matching in discount-usage.server.js.
 *
 * Expected shapes:
 * - code:       { type: "discount_code", code: "SUMMER10", ... }
 * - automatic:  { type: "automatic", title: "Summer Sale", ... }
 */
export function buildWebhookApplicationIdentity(application = {}) {
  const type = String(application.type || "").toLowerCase();

  // CODE: prefer type, also accept payloads that only expose code
  if (type === "discount_code" || application.code) {
    const matchKey = buildCodeMatchKey(application.code ?? application.title);
    if (!matchKey) {
      return { ok: false, reason: "MISSING_CODE" };
    }
    return {
      ok: true,
      matchType: "CODE",
      matchKey,
      identityVersion: DISCOUNT_IDENTITY_VERSION,
    };
  }

  // AUTOMATIC: type must be automatic (do not treat manual/script titles as auto)
  if (type === "automatic") {
    const matchKey = buildAutomaticMatchKey(application.title);
    if (!matchKey) {
      return { ok: false, reason: "MISSING_TITLE" };
    }
    return {
      ok: true,
      matchType: "AUTOMATIC",
      matchKey,
      identityVersion: DISCOUNT_IDENTITY_VERSION,
    };
  }

  return {
    ok: false,
    reason: "UNSUPPORTED_APPLICATION_TYPE",
    type: application.type ?? null,
  };
}

export function computeIsMatchable(status) {
  return MATCHABLE_STATUSES.includes(String(status || "").toUpperCase());
}

/**
 * Returns the conflicting Discount row if identity is already taken.
 * excludeDiscountId: pass on edit flows.
 */
export async function findDiscountIdentityCollision({
  shopId,
  matchType,
  matchKey,
  excludeDiscountId = null,
}) {
  if (!shopId || !matchType || !matchKey) return null;

  return prisma.discount.findFirst({
    where: {
      shopId,
      matchType,
      matchKey,
      isMatchable: true,
      shopifyDeletedAt: null,
      ...(excludeDiscountId ? { id: { not: excludeDiscountId } } : {}),
    },
    select: {
      id: true,
      title: true,
      method: true,
      status: true,
      shopifyDiscountCode: true,
      matchKey: true,
    },
  });
}

/**
 * Convenience: build identity + collision check for create/edit.
 */
export async function resolveDiscountIdentityForSave({
  shopId,
  method,
  title,
  shopifyDiscountCode,
  status = "DRAFT",
  excludeDiscountId = null,
}) {
  const identity = buildDiscountIdentity({
    method,
    title,
    shopifyDiscountCode,
    status,
  });

  if (!identity.ok) {
    return {
      ok: false,
      errors: {
        [ identity.errorField || "form" ]: identity.error,
      },
    };
  }

  const collision = await findDiscountIdentityCollision({
    shopId,
    matchType: identity.matchType,
    matchKey: identity.matchKey,
    excludeDiscountId,
  });

  if (collision) {
    if (identity.matchType === "CODE") {
      return {
        ok: false,
        errors: {
          discountCode:
            "Another discount in this shop already uses this code. Disable/expire it first, or choose a different code.",
        },
        collision,
      };
    }

    return {
      ok: false,
      errors: {
        title:
          "Another automatic discount in this shop already uses this title. Choose a unique title so order stats can map correctly.",
      },
      collision,
    };
  }

  return {
    ok: true,
    identity: {
      matchType: identity.matchType,
      matchKey: identity.matchKey,
      isMatchable: identity.isMatchable,
      identityVersion: identity.identityVersion,
    },
  };
}

// Kept for future algorithm evolution (identityVersion bumps).
export function hashIdentityParts(parts = []) {
  return createHash("sha256")
    .update(parts.filter(Boolean).join("|"))
    .digest("hex")
    .slice(0, 10);
}