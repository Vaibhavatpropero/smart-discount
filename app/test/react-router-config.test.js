import { describe, it, expect } from "vitest";
import config from "../../react-router.config.js";

describe("react-router.config (allowedActionOrigins)", () => {
	it("allowlists action origins for dev tunnels and prod", () => {
		expect(Array.isArray(config.allowedActionOrigins)).toBe(true);
		expect(config.allowedActionOrigins).toContain("*.trycloudflare.com");
		expect(config.allowedActionOrigins).toContain(
			"smartdiscount.propero.in",
		);
	});
});
