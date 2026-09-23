#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";
import ws from "ws";

const CLOUDINARY_CLOUD_NAME = "dzlazqbvf";
const CLOUDINARY_UPLOAD_PRESET = "flicks_upload";
const PAGE_SIZE = 500;
const DEFAULT_MAX_FILE_BYTES = 100 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 120_000;

const args = new Set(process.argv.slice(2));
const applyChanges = args.has("--apply");
const verifyOnly = args.has("--verify-only");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const rowLimit = limitArg ? Math.max(1, Number(limitArg.slice("--limit=".length))) : Infinity;

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseKey =
  serviceRoleKey ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("[Migration] Missing SUPABASE_URL/VITE_SUPABASE_URL or Supabase key.");
  process.exit(1);
}

if (applyChanges && !serviceRoleKey) {
  console.error(
    "[Migration] Refusing --apply without SUPABASE_SERVICE_ROLE_KEY. " +
      "The anon key cannot update records owned by other users under RLS.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});

const maxFileBytes = Number(process.env.CLOUDINARY_MAX_FILE_BYTES || DEFAULT_MAX_FILE_BYTES);
const logDirectory = path.join(process.cwd(), "migration-logs");
const logPath = path.join(logDirectory, "cloudinary-migration-latest.jsonl");
const results = [];
const uploadCache = new Map();

// These are the media-bearing tables/columns used by the app. The "flicks"
// entries are included because older deployments may have used that table name;
// missing tables/columns are logged and skipped.
const MEDIA_SOURCES = [
  { table: "flicks", column: "media_url", bucket: "posts" },
  { table: "flicks", column: "image_url", bucket: "posts" },
  { table: "flicks", column: "video_url", bucket: "posts" },
  { table: "posts", column: "media_url", bucket: "posts" },
  { table: "posts", column: "cover_url", bucket: "posts" },
  { table: "stories", column: "image_url", bucket: "stories" },
  { table: "circle_posts", column: "media_url", bucket: "circles" },
  { table: "hook_page_posts", column: "media_url", bucket: "hooks" },
  { table: "hook_pages", column: "cover_url", bucket: "hooks" },
  { table: "hook_pages", column: "avatar_url", bucket: "hooks" },
  { table: "messages", column: "media_url", bucket: "messages" },
  { table: "group_messages", column: "media_url", bucket: "messages" },
  { table: "profiles", column: "avatar_url", bucket: "avatars" },
  { table: "groups", column: "avatar_url", bucket: "avatars" },
  { table: "circles", column: "cover_url", bucket: "circles" },
  { table: "surveys", column: "image_url", bucket: "surveys" },
  { table: "frame_requests", column: "needy_photo_url", bucket: "avatars" },
  { table: "frame_requests", column: "user_avatar", bucket: "avatars" },
  { table: "showcase_settings", column: "image_url", bucket: null },
];

function isCloudinaryUrl(value) {
  return typeof value === "string" && /(^|\/\/)(res\.)?cloudinary\.com\//i.test(value);
}

function isSupabaseStorageUrl(value) {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return /\/storage\/v1\/object\/(public|sign|authenticated)\//i.test(url.pathname);
  } catch {
    return false;
  }
}

function encodeStoragePath(value) {
  return value
    .trim()
    .replace(/^\/+/, "")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function resolveSourceUrl(value, bucket) {
  if (typeof value !== "string" || !value.trim() || isCloudinaryUrl(value)) return null;
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return isSupabaseStorageUrl(trimmed) ? trimmed : null;
  }
  if (!bucket) return null;
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${bucket}/${encodeStoragePath(trimmed)}`;
}

function safeFilename(sourceUrl, fallback) {
  try {
    const pathname = new URL(sourceUrl).pathname;
    const filename = decodeURIComponent(pathname.split("/").pop() || "");
    if (filename) return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  } catch {
    // Use the record id when the URL has no usable filename.
  }
  return `${fallback}.bin`;
}

async function withTimeout(promiseFactory, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await promiseFactory(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function uploadToCloudinary(sourceUrl, recordId) {
  if (uploadCache.has(sourceUrl)) return uploadCache.get(sourceUrl);

  const sourceResponse = await withTimeout((signal) =>
    fetch(sourceUrl, { signal, redirect: "follow" }),
  );
  if (!sourceResponse.ok) {
    throw new Error(`source download returned HTTP ${sourceResponse.status}`);
  }

  const declaredSize = Number(sourceResponse.headers.get("content-length") || 0);
  if (declaredSize > maxFileBytes) {
    throw new Error(`source is ${declaredSize} bytes; max is ${maxFileBytes}`);
  }

  const buffer = await sourceResponse.arrayBuffer();
  if (buffer.byteLength > maxFileBytes) {
    throw new Error(`source is ${buffer.byteLength} bytes; max is ${maxFileBytes}`);
  }

  const contentType =
    sourceResponse.headers.get("content-type")?.split(";")[0] || "application/octet-stream";
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: contentType }), safeFilename(sourceUrl, recordId));
  form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const cloudinaryResponse = await withTimeout((signal) =>
    fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, {
      method: "POST",
      body: form,
      signal,
    }),
  );
  const payload = await parseJson(cloudinaryResponse);
  if (!cloudinaryResponse.ok || !payload.secure_url) {
    throw new Error(
      payload.error?.message ||
        `Cloudinary upload returned HTTP ${cloudinaryResponse.status}`,
    );
  }

  uploadCache.set(sourceUrl, payload.secure_url);
  return payload.secure_url;
}

async function verifyUrl(url) {
  try {
    const response = await withTimeout((signal) =>
      fetch(url, { method: "HEAD", redirect: "follow", signal }),
    );
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, status: 0, error: error?.message || String(error) };
  }
}

async function fetchSourceRows(source) {
  const rows = [];
  for (let page = 0; rows.length < rowLimit; page += 1) {
    const remaining = Number.isFinite(rowLimit) ? rowLimit - rows.length : PAGE_SIZE;
    const pageSize = Math.min(PAGE_SIZE, remaining);
    const { data, error } = await supabase
      .from(source.table)
      .select(`id, ${source.column}`)
      .not(source.column, "is", null)
      .range(page * PAGE_SIZE, page * PAGE_SIZE + pageSize - 1);

    if (error) {
      console.warn(
        `[${source.table}.${source.column}] skipped: ${error.message}`,
      );
      return rows;
    }

    const pageRows = Array.isArray(data) ? data : [];
    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
  }
  return rows;
}

async function verifyDatabase() {
  let supabaseCount = 0;
  let cloudinaryCount = 0;
  let brokenCloudinaryCount = 0;

  for (const source of MEDIA_SOURCES) {
    const rows = await fetchSourceRows(source);
    for (const row of rows) {
      const value = row[source.column];
      const hasValue = typeof value === "string" && value.trim().length > 0;
      if (
        hasValue &&
        (isSupabaseStorageUrl(value) ||
          (source.bucket && !/^https?:\/\//i.test(value) && !/^data:/i.test(value)))
      ) {
        supabaseCount += 1;
      }
      if (isCloudinaryUrl(value)) {
        cloudinaryCount += 1;
        const result = await verifyUrl(value);
        if (!result.ok) {
          brokenCloudinaryCount += 1;
          console.error(
            `[VERIFY][BROKEN] ${source.table}.${source.column}/${row.id} HTTP ${result.status || "network error"}`,
          );
        }
      }
    }
  }

  console.log(
    `[VERIFY][SUMMARY] Supabase storage/path values remaining: ${supabaseCount}; ` +
      `Cloudinary values checked: ${cloudinaryCount}; broken Cloudinary URLs: ${brokenCloudinaryCount}`,
  );
  return { supabaseCount, cloudinaryCount, brokenCloudinaryCount };
}

async function migrateSource(source) {
  const rows = await fetchSourceRows(source);
  let pending = 0;
  let succeeded = 0;
  let failed = 0;

  for (const row of rows) {
    const oldValue = row[source.column];
    const sourceUrl = resolveSourceUrl(oldValue, source.bucket);
    if (!sourceUrl) continue;

    pending += 1;
    const label = `${source.table}.${source.column}/${row.id}`;
    if (!applyChanges) {
      console.log(`[DRY-RUN][PENDING] ${label} <- ${sourceUrl}`);
      continue;
    }

    try {
      const secureUrl = await uploadToCloudinary(sourceUrl, row.id);
      const { error } = await supabase
        .from(source.table)
        .update({ [source.column]: secureUrl })
        .eq("id", row.id);
      if (error) throw new Error(`database update failed: ${error.message}`);

      succeeded += 1;
      const result = {
        status: "success",
        table: source.table,
        column: source.column,
        id: row.id,
        sourceUrl,
        secureUrl,
      };
      results.push(result);
      console.log(`[SUCCESS] ${label} -> ${secureUrl}`);
    } catch (error) {
      failed += 1;
      const result = {
        status: "failure",
        table: source.table,
        column: source.column,
        id: row.id,
        sourceUrl,
        error: error?.message || String(error),
      };
      results.push(result);
      console.error(`[FAILURE] ${label}: ${result.error}`);
    }
  }

  if (pending > 0 || rows.length > 0) {
    console.log(
      `[${source.table}.${source.column}] rows=${rows.length} pending=${pending} ` +
        `succeeded=${succeeded} failed=${failed}`,
    );
  }
  return { pending, succeeded, failed };
}

async function writeLog() {
  await fs.mkdir(logDirectory, { recursive: true });
  await fs.writeFile(
    logPath,
    results.map((result) => JSON.stringify(result)).join("\n") +
      (results.length ? "\n" : ""),
    "utf8",
  );
}

async function main() {
  console.log(
    `[Migration] mode=${applyChanges ? "APPLY" : "DRY-RUN"} ` +
      `database=${serviceRoleKey ? "service-role" : "anon"} ` +
      `cloudinary=${CLOUDINARY_CLOUD_NAME}/${CLOUDINARY_UPLOAD_PRESET}`,
  );

  if (!verifyOnly) {
    for (const source of MEDIA_SOURCES) {
      await migrateSource(source);
    }
    await writeLog();
    console.log(`[Migration] Per-record log: ${logPath}`);
  }

  const verification = await verifyDatabase();
  if (applyChanges && (verification.supabaseCount > 0 || verification.brokenCloudinaryCount > 0)) {
    console.error("[Migration] Verification failed; review the per-record log before retrying.");
    process.exitCode = 2;
  } else {
    console.log("[Migration] Verification passed.");
  }
}

main().catch((error) => {
  console.error(`[Migration] Fatal error: ${error?.message || error}`);
  process.exitCode = 1;
});