// app/utils/logger.server.js
import fs from "fs";
import path from "path";

const IS_PROD = process.env.NODE_ENV === "production";
const LOG_DIR = "/app/logs";
const LOG_FILE = path.join(LOG_DIR, "app.log");

function ensureLogDir() {
    try {
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }
    } catch (err) {
        console.error("[Logger] Failed to create log dir:", err.message);
    }
}

function serializeError(error) {
    if (!error) return null;

    return {
        name: error.name || "Error",
        message: error.message || String(error),
        stack: error.stack || null,
    };
}

function writeLog(level, source, message, meta) {
    const entry = {
        ts: new Date().toISOString(),
        level,
        source,
        message,
        ...(meta ? { meta } : {}),
    };

    if (IS_PROD) {
        // Production → write to file
        try {
            ensureLogDir();
            fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
        } catch (err) {
            console.error("[Logger] Failed to write log:", err.message);
        }
    } else {
        // Development → write to terminal, colour-coded by level
        const colors = { info: "\x1b[36m", warn: "\x1b[33m", error: "\x1b[31m" };
        const reset = "\x1b[0m";
        const color = colors[ level ] || reset;
        const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
        console.log(`${color}[${level.toUpperCase()}]${reset} [${source}] ${message}${metaStr}`);
    }
}

export const logger = {
    info(source, message, meta) {
        writeLog("info", source, message, meta);
    },
    warn(source, message, meta) {
        writeLog("warn", source, message, meta);
    },
    error(source, message, meta) {
        writeLog("error", source, message, meta);
    },
    serializeError,
};