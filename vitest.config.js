import { defineConfig } from "vitest/config";

// Standalone config for app/ unit tests. Does NOT import vite.config.js:
// that file adds react-router dev plugins + SHOPIFY_APP_URL host logic
// that are irrelevant (and fail) in a plain node unit-test run.
export default defineConfig({
  test: {
    include: ["app/**/*.test.{js,jsx}"],
    environment: "node",
    globals: false,
  },
});
