import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Prisma client so this test never touches the database.
vi.mock("../db.server.js", () => ({
    default: {
        $queryRaw: vi.fn(),
    },
}));

import prisma from "../db.server.js";
import { loader } from "../routes/api.health.jsx";

describe("api.health", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 200 {status: ok} when Prisma is instantiated and DB ping succeeds", async () => {
        vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "1": 1 }]);

        const result = await loader({ request: new Request("http://localhost/api/health") });

        // data() without init leaves init null; default status is 200.
        expect(result.init).toBeNull();
        expect(result.data).toEqual({ status: "ok" });
        expect(vi.mocked(prisma.$queryRaw)).toHaveBeenCalledTimes(1);
    });

    it("returns 503 {status: error} when Prisma DB ping fails", async () => {
        vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("connection refused"));

        const result = await loader({ request: new Request("http://localhost/api/health") });

        expect(result.init.status).toBe(503);
        expect(result.data).toEqual({ status: "error" });
        expect(vi.mocked(prisma.$queryRaw)).toHaveBeenCalledTimes(1);
    });
});
