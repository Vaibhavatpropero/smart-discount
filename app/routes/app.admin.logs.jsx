// app/routes/app.admin.logs.jsx
import { useLoaderData, Link } from "react-router";
import { authenticate } from "../shopify.server";
import fs from "fs";
import path from "path";
import { logger } from "../utils/logger.server";

const LOG_DIR = "/app/logs";

/** Parse rotation date from logrotate dateext names: app.log-20260722 or app.log-20260722.gz */
function parseRotationDate(name) {
  const match = name.match(/^app\.log-(\d{4})(\d{2})(\d{2})(?:\.gz)?$/);
  if (!match) return null;
  const [, y, m, d] = match;
  return `${y}-${m}-${d}`;
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** e.g. "22 Jul 2026, 12:30:45 UTC+05:30" */
function formatWithOffset(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "Unknown time";

  const utc = d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");

  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const oh = String(Math.floor(abs / 60)).padStart(2, "0");
  const om = String(abs % 60).padStart(2, "0");
  const offsetLabel = `UTC${sign}${oh}:${om}`;

  const local = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);

  return {
    utc,
    local: `${local} ${offsetLabel}`,
    offsetLabel,
  };
}

function dayLabel(isoDate /* YYYY-MM-DD or null */, isActive) {
  if (isActive) return "Today — active log (currently being written)";
  if (!isoDate) return "Rotated log (date unknown from filename)";

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const dayBefore = new Date(today);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 2);
  const dayBeforeStr = dayBefore.toISOString().slice(0, 10);

  if (isoDate === todayStr) return `Today (${isoDate}) — rotated copy`;
  if (isoDate === yesterdayStr) return `Yesterday (${isoDate})`;
  if (isoDate === dayBeforeStr) return `Day before yesterday (${isoDate})`;
  return `Log day: ${isoDate}`;
}

function listLogFiles() {
  if (!fs.existsSync(LOG_DIR)) return [];

  const files = fs
    .readdirSync(LOG_DIR)
    .filter((name) => name === "app.log" || name.startsWith("app.log-"))
    .map((name) => {
      const full = path.join(LOG_DIR, name);
      const stat = fs.statSync(full);
      const isActive = name === "app.log";
      const rotationDate = parseRotationDate(name); // YYYY-MM-DD or null
      const mtime = stat.mtime;
      const times = formatWithOffset(mtime);

      // Sort key: active first, then by rotation date desc, else mtime desc
      let sortKey;
      if (isActive) {
        sortKey = Number.MAX_SAFE_INTEGER;
      } else if (rotationDate) {
        sortKey = Number(rotationDate.replace(/-/g, "")); // 20260721
      } else {
        sortKey = Math.floor(mtime.getTime() / 1000);
      }

      return {
        name,
        size: stat.size,
        sizeLabel: formatBytes(stat.size),
        isActive,
        rotationDate,
        dayLabel: dayLabel(rotationDate, isActive),
        mtimeIso: mtime.toISOString(),
        mtimeUtc: times.utc,
        mtimeLocal: times.local,
        offsetLabel: times.offsetLabel,
        compressed: name.endsWith(".gz"),
        sortKey,
      };
    });

  // Latest first: active app.log, then newest rotated day, then older
  files.sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return b.sortKey - a.sortKey;
  });

  return files;
}

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const file = url.searchParams.get("file");

  if (file) {
    const safeName = path.basename(file);

    if (safeName !== "app.log" && !safeName.startsWith("app.log-")) {
      throw new Response("Invalid file", { status: 400 });
    }

    const fullPath = path.join(LOG_DIR, safeName);
    const resolved = path.resolve(fullPath);
    const logRoot = path.resolve(LOG_DIR);

    if (!resolved.startsWith(logRoot + path.sep) && resolved !== logRoot) {
      throw new Response("Not found", { status: 404 });
    }
    if (!fs.existsSync(resolved)) {
      throw new Response("Not found", { status: 404 });
    }

    logger.info("admin.logs", "Log download", { file: safeName });

    const body = fs.readFileSync(resolved);
    const contentType = safeName.endsWith(".gz")
      ? "application/gzip"
      : "application/octet-stream";

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const serverNow = formatWithOffset(new Date());

  return {
    files: listLogFiles(),
    serverNowUtc: serverNow.utc,
    serverOffset: serverNow.offsetLabel,
  };
};

export default function AdminLogsPage() {
  const { files, serverNowUtc, serverOffset } = useLoaderData();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">App logs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Persistent host logs. Survive container deploys. Newest first.
          </p>
        </div>
        <Link
          to="/app"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back
        </Link>
      </div>

      <div className="mb-6 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        <p className="font-medium">How to read times</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5 text-sky-800">
          <li>
            Server clock now: <span className="font-mono">{serverNowUtc}</span>
          </li>
          <li>
            This page formats “local” times using your{" "}
            <strong>browser timezone</strong> ({serverOffset} right now on the
            machine rendering this page).
          </li>
          <li>
            Log lines inside files use ISO timestamps ending in{" "}
            <span className="font-mono">Z</span> = UTC.
          </li>
          <li>
            Rotated names look like{" "}
            <span className="font-mono">app.log-YYYYMMDD</span> or{" "}
            <span className="font-mono">.gz</span> after logrotate compresses
            them.
          </li>
        </ul>
      </div>

      {files.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-10 text-center text-sm text-gray-500">
          No log files yet. Trigger app activity, then refresh.
        </div>
      ) : (
        <ul className="space-y-3">
          {files.map((f) => (
            <li
              key={f.name}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-mono text-sm font-semibold text-gray-900">
                      {f.name}
                    </span>
                    {f.isActive && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        Active
                      </span>
                    )}
                    {f.compressed && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        gzip
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-sm font-medium text-gray-800">
                    {f.dayLabel}
                  </p>

                  <div className="mt-2 space-y-0.5 text-xs text-gray-500">
                    <p>
                      Size: <span className="text-gray-700">{f.sizeLabel}</span>
                    </p>
                    <p>
                      Last modified (UTC):{" "}
                      <span className="font-mono text-gray-700">
                        {f.mtimeUtc}
                      </span>
                    </p>
                    <p>
                      Last modified (your browser tz, {f.offsetLabel}):{" "}
                      <span className="font-mono text-gray-700">
                        {f.mtimeLocal}
                      </span>
                    </p>
                    <p className="text-gray-400">
                      ISO: <span className="font-mono">{f.mtimeIso}</span>
                    </p>
                  </div>
                </div>

                <a
                  href={`?file=${encodeURIComponent(f.name)}`}
                  className="inline-flex shrink-0 items-center rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Download
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}