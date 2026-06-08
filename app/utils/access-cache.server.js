// app/utils/access-cache.server.js
const DEFAULT_TTL_MS = 60 * 1000; // 60 seconds

const accessCache = new Map();

export function getCachedAccess(shopDomain) {
    if (!shopDomain) return null;

    const entry = accessCache.get(shopDomain);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
        accessCache.delete(shopDomain);
        return null;
    }

    return entry.value;
}

export function setCachedAccess(shopDomain, value, ttlMs = DEFAULT_TTL_MS) {
    if (!shopDomain || !value) return value;

    accessCache.set(shopDomain, {
        value,
        expiresAt: Date.now() + ttlMs,
    });

    return value;
}

export function invalidateAccessCache(shopDomain) {
    if (!shopDomain) return;
    accessCache.delete(shopDomain);
}

export function clearAccessCache() {
    accessCache.clear();
}

export function getAccessCacheMeta(shopDomain) {
    const entry = accessCache.get(shopDomain);
    if (!entry) return null;

    return {
        expiresAt: entry.expiresAt,
        ttlMsRemaining: Math.max(0, entry.expiresAt - Date.now()),
    };
}