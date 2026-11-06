// ============================================
// React Router build/dev config.
//
// `allowedActionOrigins` permits action POSTs whose `origin` header host
// matches an entry — required since react-router 7.12's CSRF protection
// rejects submissions whose `origin` doesn't match `request.url`.
//
// Both entries cover TLS-terminating proxies, where the server reconstructs
// request.url over plain http while the browser origin is https:
// - "*.trycloudflare.com": dev — Shopify CLI / cloudflared quick tunnels
//   (subdomains rotate on every restart, so a wildcard is required)
// - "smartdiscount.propero.in": prod — EC2 proxy terminates TLS before the
//   container (deploy.yml binds 127.0.0.1:APP_PORT:3000)
//
// Host-only entries (no scheme); matching is per-segment glob
// (`*` = one label). Resource routes are unaffected by design.
// ============================================
export default {
	allowedActionOrigins: ["*.trycloudflare.com", "smartdiscount.propero.in"],
};
