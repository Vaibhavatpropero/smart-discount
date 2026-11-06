// app/routes/api.health.jsx
import { data } from "react-router";

import { logger } from "../utils/logger.server.js";
import prisma from "../db.server.js";

const SRC = "api.health";

/**
 * Health-check endpoint used by the blue/green deploy to verify the container
 * is fully up before promotion.
 *
 * It validates the two failure modes this pipeline actually has:
 *   1. @prisma/client instantiated (a missing `prisma generate` step leaves a
 *      throwing stub that dies here).
 *   2. Database reachable (a cheap `SELECT 1` ping).
 *
 * @returns {Promise<import("react-router").DataFunctionResponse>} 200 {status:"ok"}
 *   when both checks pass; 503 {status:"error"} otherwise.
 */
export const loader = async () => {
    try {
        // (1) instantiation happens at import; (2) verifies the DB connection.
        await prisma.$queryRaw`SELECT 1`;
        logger.info(SRC, "Health check passed: Prisma client ready, DB reachable.");
        return data({ status: "ok" });
    } catch (error) {
        logger.warn(SRC, "Health check failed", { error: logger.serializeError(error) });
        return data({ status: "error" }, { status: 503 });
    }
};
