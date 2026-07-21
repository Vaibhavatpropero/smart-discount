// app/routes/app.jsx
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { upsertShopOnInstall } from "../utils/shop.server.js";
import { authenticate } from "../shopify.server";
import { logger } from "../utils/logger.server.js";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);

  logger.info("app.layout", "Authenticated admin request", {
    shop: session.shop,
  });

  // Upsert shop on first install or re-install.
  // No-op on every subsequent request (fast path via findUnique).
  await upsertShopOnInstall({
    shopDomain: session.shop,
    admin,
  });

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Home</s-link>
        <s-link href="/app/discounts">Create discount</s-link>
        <s-link href="/app/billing">Plans</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
