import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

function readFile(relativePath) {
	return fs.readFileSync(path.join(root, "..", "..", relativePath), "utf8");
}

describe("api version consistency (target: 2026-07)", () => {
	it("sets the Admin GraphQL codegen version to 2026-07 in .graphqlrc.js", () => {
		const graphqlrc = readFile(".graphqlrc.js");
		expect(graphqlrc).toContain("ApiVersion.July26");
		expect(graphqlrc).not.toContain("ApiVersion.October25");
	});

	it("sets the webhook API version to 2026-07 in both app configs", () => {
		const appToml = readFile("shopify.app.dev.toml");
		const prodToml = readFile("shopify.app.prod.toml");

		expect(appToml).toContain('api_version = "2026-07"');
		expect(prodToml).toContain('api_version = "2026-07"');
	});

	it("sets the Functions target version to 2026-07 in both extensions", () => {
		const capped = readFile("extensions/capped-order-discount/shopify.extension.toml");
		const freeGift = readFile("extensions/free-gift-discount/shopify.extension.toml");

		expect(capped).toContain('api_version = "2026-07"');
		expect(freeGift).toContain('api_version = "2026-07"');
	});
});
