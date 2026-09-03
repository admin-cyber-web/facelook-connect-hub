#!/usr/bin/env node

/**
 * Repeatable authenticated mobile performance profile.
 *
 * This intentionally accepts a Playwright storage-state file instead of
 * credentials. It never creates accounts, mutates application data, or
 * falls back to the guest/login screen. See docs/mobile-performance-profile.md.
 */

import { chromium, devices } from "playwright";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const DEFAULT_BASE_URL = "http://127.0.0.1:5000";
const DEFAULT_OUTPUT_DIR = "reports/mobile-performance";
const DEFAULT_IDLE_MS = 5 * 60 * 1000;
const DEFAULT_SETTLE_MS = 2_000;
const DEFAULT_FLOW_MS = 4_000;

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith("--")) continue;
  const [key, inlineValue] = arg.slice(2).split("=", 2);
  args.set(key, inlineValue ?? process.argv[++i]);
}

const label = args.get("label") || process.env.PERF_LABEL || "profile";
const baseURL = args.get("base-url") || process.env.PERF_BASE_URL || DEFAULT_BASE_URL;
const storageStatePath =
  args.get("storage-state") ||
  process.env.PERF_STORAGE_STATE ||
  "artifacts/performance/auth-state.json";
const outputDir = args.get("output-dir") || process.env.PERF_OUTPUT_DIR || DEFAULT_OUTPUT_DIR;
const idleMs = Number(args.get("idle-ms") || process.env.PERF_IDLE_MS || DEFAULT_IDLE_MS);
const settleMs = Number(args.get("settle-ms") || process.env.PERF_SETTLE_MS || DEFAULT_SETTLE_MS);
const flowMs = Number(args.get("flow-ms") || process.env.PERF_FLOW_MS || DEFAULT_FLOW_MS);
const headless = !args.has("headed");

if (!Number.isFinite(idleMs) || idleMs < 0) {
  throw new Error("PERF_IDLE_MS/--idle-ms must be a non-negative number.");
}

async function requireFile(path) {
  try {
    await stat(path);
  } catch {
    throw new Error(
      [
        `Authenticated storage state not found: ${path}`,
        "",
        "Run this profile with a Playwright storage-state JSON exported from an",
        "authenticated test browser. Do not use credentials in this script.",
        "The profiler refuses to continue without that file so guest traffic is",
        "never reported as authenticated traffic.",
      ].join("\n"),
    );
  }
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function isSupabaseRequest(request) {
  const url = new URL(request.url());
  const configuredOrigin = process.env.VITE_SUPABASE_URL;
  if (configuredOrigin && url.origin === configuredOrigin.replace(/\/$/, "")) return true;
  return (
    url.pathname.startsWith("/rest/v1/") ||
    url.pathname.startsWith("/realtime/v1/") ||
    url.pathname.startsWith("/storage/v1/") ||
    url.pathname.startsWith("/auth/v1/")
  );
}

async function getCpuMetrics(cdp) {
  const response = await cdp.send("Performance.getMetrics");
  return Object.fromEntries(
    response.metrics.map((metric) => [metric.name, metric.value]),
  );
}

async function getMediaSnapshot(page) {
  return page.evaluate(() => {
    const media = [...document.querySelectorAll("video, audio")];
    const active = media.filter((element) => {
      const mediaElement = element;
      return !mediaElement.paused && !mediaElement.ended && mediaElement.readyState > 0;
    });
    return {
      elements: media.length,
      active: active.length,
      videos: media.filter((element) => element.tagName === "VIDEO").length,
      activeVideos: active.filter((element) => element.tagName === "VIDEO").length,
      currentSources: active
        .map((element) => element.currentSrc || element.src)
        .filter(Boolean)
        .slice(0, 20),
    };
  });
}

async function getRealtimeSnapshot(page) {
  return page.evaluate(() => {
    const state = window.__mobilePerformanceRealtime;
    return state
      ? {
          socketsOpened: state.socketsOpened,
          socketsClosed: state.socketsClosed,
          activeSockets: state.activeSockets,
          joins: state.joins,
          leaves: state.leaves,
          activeTopics: [...state.activeTopics],
          messagesSent: state.messagesSent,
          messagesReceived: state.messagesReceived,
        }
      : null;
  });
}

function installRealtimeProbe(page) {
  return page.addInitScript(() => {
    const state = {
      socketsOpened: 0,
      socketsClosed: 0,
      activeSockets: 0,
      joins: 0,
      leaves: 0,
      activeTopics: new Set(),
      messagesSent: 0,
      messagesReceived: 0,
    };
    window.__mobilePerformanceRealtime = state;

    const NativeWebSocket = window.WebSocket;
    const recordFrame = (payload, direction) => {
      if (direction === "sent") state.messagesSent += 1;
      else state.messagesReceived += 1;
      if (typeof payload !== "string") return;
      try {
        const parsed = JSON.parse(payload);
        if (!Array.isArray(parsed)) return;
        const topic = parsed[0];
        const event = parsed[2];
        if (event === "phx_join") {
          state.joins += 1;
          state.activeTopics.add(topic);
        } else if (event === "phx_leave") {
          state.leaves += 1;
          state.activeTopics.delete(topic);
        }
      } catch {
        // Non-JSON WebSocket frames are not Realtime protocol frames.
      }
    };

    function InstrumentedWebSocket(url, protocols) {
      const socket =
        protocols === undefined
          ? new NativeWebSocket(url)
          : new NativeWebSocket(url, protocols);
      state.socketsOpened += 1;
      state.activeSockets += 1;
      socket.addEventListener("close", () => {
        state.socketsClosed += 1;
        state.activeSockets = Math.max(0, state.activeSockets - 1);
      });
      const nativeSend = socket.send.bind(socket);
      socket.send = (payload) => {
        recordFrame(payload, "sent");
        return nativeSend(payload);
      };
      socket.addEventListener("message", (event) => recordFrame(event.data, "received"));
      return socket;
    }
    InstrumentedWebSocket.prototype = NativeWebSocket.prototype;
    Object.defineProperties(InstrumentedWebSocket, {
      CONNECTING: { value: NativeWebSocket.CONNECTING },
      OPEN: { value: NativeWebSocket.OPEN },
      CLOSING: { value: NativeWebSocket.CLOSING },
      CLOSED: { value: NativeWebSocket.CLOSED },
    });
    window.WebSocket = InstrumentedWebSocket;
  });
}

async function visibleButton(page, name, description) {
  const buttons = page.getByRole("button", { name });
  if (await buttons.count() === 0 || !await buttons.first().isVisible().catch(() => false)) {
    throw new Error(`Required control not found for ${description}: ${String(name)}`);
  }
  return buttons.first();
}

async function openNav(page, feature) {
  const menu = await visibleButton(page, /open menu/i, `${feature} navigation menu`);
  await menu.click();
  const item = await visibleButton(page, new RegExp(`^${feature}$`, "i"), `${feature} navigation`);
  await item.click();
  await sleep(settleMs);
}

async function assertAuthenticated(page) {
  await page.waitForLoadState("domcontentloaded");
  await sleep(settleMs);
  const loginButton = page.getByRole("button", { name: /^log in$/i });
  if (await loginButton.count() > 0 && await loginButton.first().isVisible().catch(() => false)) {
    throw new Error(
      "The supplied storage state did not authenticate the app; login screen is visible.",
    );
  }
  const navigation = page.getByRole("button", { name: /open menu/i });
  if (await navigation.count() === 0) {
    throw new Error("Authenticated navigation was not found after loading the app.");
  }
}

async function createSampler(page, cdp, networkEvents, mediaSamples, realtimeSamples) {
  const startedAt = Date.now();
  const sample = async () => {
    try {
      const [cpu, media, realtime] = await Promise.all([
        getCpuMetrics(cdp),
        getMediaSnapshot(page),
        getRealtimeSnapshot(page),
      ]);
      mediaSamples.push({ atMs: Date.now() - startedAt, ...media });
      if (realtime) {
        realtimeSamples.push({ atMs: Date.now() - startedAt, ...realtime });
      }
      return cpu;
    } catch {
      return null;
    }
  };
  const initialCpu = await sample();
  const timer = setInterval(() => void sample(), 1_000);
  return {
    startedAt,
    initialCpu,
    stop: async () => {
      clearInterval(timer);
      const finalCpu = await sample();
      const elapsedMs = Math.max(1, Date.now() - startedAt);
      const taskDelta = Math.max(
        0,
        (finalCpu?.TaskDuration ?? 0) - (initialCpu?.TaskDuration ?? 0),
      );
      return {
        elapsedMs,
        supabaseRequests: networkEvents.length,
        supabaseRequestTypes: networkEvents.reduce((counts, event) => {
          counts[event.type] = (counts[event.type] || 0) + 1;
          return counts;
        }, {}),
        responseBytes: networkEvents.reduce((total, event) => total + event.responseBytes, 0),
        failedRequests: networkEvents.filter((event) => event.failed).length,
        cpu: {
          taskDurationMs: Math.round(taskDelta * 1_000),
          mainThreadBusyPercent: Number(
            Math.min(100, (taskDelta / (elapsedMs / 1_000)) * 100).toFixed(2),
          ),
          scriptDurationMs: Math.round(
            Math.max(
              0,
              ((finalCpu?.ScriptDuration ?? 0) - (initialCpu?.ScriptDuration ?? 0)) * 1_000,
            ),
          ),
        },
        media: {
          maxElements: Math.max(0, ...mediaSamples.map((sampleValue) => sampleValue.elements)),
          maxActive: Math.max(0, ...mediaSamples.map((sampleValue) => sampleValue.active)),
          maxVideos: Math.max(0, ...mediaSamples.map((sampleValue) => sampleValue.videos)),
          maxActiveVideos: Math.max(
            0,
            ...mediaSamples.map((sampleValue) => sampleValue.activeVideos),
          ),
          samples: mediaSamples,
        },
        realtime: {
          maxActiveSockets: Math.max(
            0,
            ...realtimeSamples.map((sampleValue) => sampleValue.activeSockets || 0),
          ),
          maxActiveTopics: Math.max(
            0,
            ...realtimeSamples.map((sampleValue) => sampleValue.activeTopics?.length || 0),
          ),
          maxJoins: Math.max(0, ...realtimeSamples.map((sampleValue) => sampleValue.joins || 0)),
          maxLeaves: Math.max(0, ...realtimeSamples.map((sampleValue) => sampleValue.leaves || 0)),
          samples: realtimeSamples,
        },
      };
    },
  };
}

async function run() {
  await requireFile(storageStatePath);
  const storageState = JSON.parse(await readFile(storageStatePath, "utf8"));
  let browser;
  try {
    browser = await chromium.launch({ headless });
  } catch (error) {
    if (String(error?.message || error).includes("Executable doesn't exist")) {
      throw new Error(
        [
          "Playwright Chromium is not installed in this environment.",
          "Install it once with: npx playwright install chromium",
          "Then rerun the exact same authenticated profile command.",
        ].join("\n"),
      );
    }
    throw error;
  }
  const context = await browser.newContext({
    ...devices["iPhone 13"],
    storageState,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  try {
    await cdp.send("Media.enable");
  } catch {
    // Media domain is not available in every Chromium build; DOM media
    // snapshots remain the authoritative cross-browser fallback.
  }
  await installRealtimeProbe(page);

  const networkEvents = [];
  const mediaSamples = [];
  const realtimeSamples = [];
  page.on("request", (request) => {
    if (!isSupabaseRequest(request)) return;
    const url = new URL(request.url());
    networkEvents.push({
      at: new Date().toISOString(),
      method: request.method(),
      type: url.pathname.split("/")[1] || "unknown",
      url: `${url.origin}${url.pathname}`,
      responseBytes: 0,
      failed: false,
    });
  });
  page.on("response", (response) => {
    const request = response.request();
    if (!isSupabaseRequest(request)) return;
    const event = networkEvents.findLast(
      (candidate) =>
        candidate.method === request.method() &&
        candidate.url === `${new URL(request.url()).origin}${new URL(request.url()).pathname}` &&
        candidate.responseBytes === 0,
    );
    if (event) {
      const contentLength = Number(response.headers()["content-length"] || 0);
      event.responseBytes = Number.isFinite(contentLength) ? contentLength : 0;
    }
  });
  page.on("requestfailed", (request) => {
    if (!isSupabaseRequest(request)) return;
    const url = new URL(request.url());
    const event = networkEvents.findLast(
      (candidate) =>
        candidate.method === request.method() &&
        candidate.url === `${url.origin}${url.pathname}` &&
        !candidate.failed,
    );
    if (event) event.failed = true;
  });

  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await assertAuthenticated(page);

  const sampler = await createSampler(
    page,
    cdp,
    networkEvents,
    mediaSamples,
    realtimeSamples,
  );
  const stages = [];
  const stage = async (name, action) => {
    const beforeRequests = networkEvents.length;
    const beforeCpu = await getCpuMetrics(cdp);
    const beforeRealtime = await getRealtimeSnapshot(page);
    const beforeMediaLength = mediaSamples.length;
    await action();
    await sleep(flowMs);
    const afterCpu = await getCpuMetrics(cdp);
    const afterRealtime = await getRealtimeSnapshot(page);
    stages.push({
      name,
      supabaseRequests: networkEvents.length - beforeRequests,
      cpuTaskDurationMs: Math.round(
        Math.max(0, afterCpu.TaskDuration - beforeCpu.TaskDuration) * 1_000,
      ),
      realtime: {
        before: beforeRealtime,
        after: afterRealtime,
      },
      mediaSamples: mediaSamples.slice(beforeMediaLength),
    });
  };

  const idleStartRequests = networkEvents.length;
  await sleep(idleMs);
  stages.push({
    name: `idle-${idleMs}ms`,
    supabaseRequests: networkEvents.length - idleStartRequests,
    realtime: await getRealtimeSnapshot(page),
    media: await getMediaSnapshot(page),
  });

  await stage("chat-open-close", async () => {
    const chat = page.getByRole("banner").locator("button").nth(3);
    if (await chat.count() === 0 || !await chat.isVisible().catch(() => false)) {
      throw new Error("Required control not found for chat open.");
    }
    await chat.click();
    await page.getByRole("button", { name: /close chat/i }).click();
  });
  await stage("story-viewer", async () => {
    const chat = page.getByRole("banner").locator("button").nth(3);
    await chat.click();
    const storyTab = await visibleButton(page, /^Story$/i, "story tab");
    await storyTab.click();
    const story = page.locator("div.grid.grid-cols-2 button").first();
    if (await story.count() === 0 || !await story.isVisible().catch(() => false)) {
      throw new Error("No friend story is available to open in the story viewer.");
    }
    await story.click();
    const close = page.locator('div[class*="z-[400]"] button').last();
    if (await close.count() === 0) throw new Error("Story viewer close control not found.");
    await close.click().catch(() => page.keyboard.press("Escape"));
    await page.getByRole("button", { name: /close chat/i }).click();
  });
  await stage("circle-feed-scroll", async () => {
    await openNav(page, "Circle");
    const scrollArea = page.locator(".overflow-y-auto").first();
    if (await scrollArea.count() === 0) throw new Error("Circle feed scroll area not found.");
    await scrollArea.evaluate((element) => element.scrollTo({ top: element.scrollHeight / 2 }));
  });
  await stage("flicks-scroll", async () => {
    await openNav(page, "Flicks");
    const scrollArea = page.locator(".overflow-y-auto").first();
    if (await scrollArea.count() === 0) throw new Error("Flicks scroll area not found.");
    await scrollArea.evaluate((element) => element.scrollTo({ top: element.scrollHeight / 2 }));
  });
  await stage("camera-background-foreground", async () => {
    await openNav(page, "Snapy");
    const camera = page.getByText(/camera|snapy/i).first();
    if (await camera.count() === 0) throw new Error("Snapy camera control not found.");
    await camera.click().catch(() => {});
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
  });
  await stage("notification-resume", async () => {
    await openNav(page, "Fame");
    const bell = page.getByRole("banner").locator("button").nth(2);
    if (await bell.count() === 0) throw new Error("Notification control not found.");
    await bell.click();
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await bell.click();
  });

  const totals = await sampler.stop();
  const result = {
    schemaVersion: 1,
    label,
    capturedAt: new Date().toISOString(),
    baseURL,
    device: "iPhone 13 emulation (Chromium)",
    authenticated: true,
    idleMs,
    flowMs,
    settleMs,
    stages,
    totals,
    realtime: await getRealtimeSnapshot(page),
  };
  await mkdir(resolve(outputDir), { recursive: true });
  const outputPath = resolve(outputDir, `${label}-${Date.now()}.json`);
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`Profile written: ${outputPath}`);
  console.log(
    JSON.stringify(
      {
        label,
        supabaseRequests: totals.supabaseRequests,
        responseBytes: totals.responseBytes,
        mainThreadBusyPercent: totals.cpu.mainThreadBusyPercent,
        maxRealtimeTopics: result.totals.realtime.maxActiveTopics,
        maxActiveMedia: totals.media.maxActive,
        maxActiveVideos: totals.media.maxActiveVideos,
      },
      null,
      2,
    ),
  );
  await browser.close();
}

run().catch((error) => {
  console.error(`Mobile performance profile failed: ${error.message}`);
  process.exitCode = 1;
});