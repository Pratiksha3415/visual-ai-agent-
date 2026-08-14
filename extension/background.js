// background.js
// Transparency by design:
//  - Monitoring is OFF by default. The user must explicitly enable it from the popup.
//  - The action badge always reflects current state ("ON" green / "OFF" grey).
//  - Every event queued for upload is also mirrored into local storage so the
//    user can inspect exactly what has been / will be sent, from the popup.

const DEFAULT_SETTINGS = {
  monitoringEnabled: false,
  captureScreenshots: false,
  screenshotIntervalSec: 30,
  backendUrl: "http://localhost:8787/events",
  apiKey: "",
  batchSize: 20,
  batchIntervalSec: 10,
};

let settings = { ...DEFAULT_SETTINGS };
let eventQueue = [];
let screenshotTimer = null;
let flushTimer = null;

async function loadSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  settings = { ...DEFAULT_SETTINGS, ...stored };
  return settings;
}

async function saveSettings(partial) {
  settings = { ...settings, ...partial };
  await chrome.storage.local.set(partial);
  applyMonitoringState();
  return settings;
}

function updateBadge() {
  if (settings.monitoringEnabled) {
    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#1a9c4b" });
  } else {
    chrome.action.setBadgeText({ text: "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: "#9a9a9a" });
  }
}

function nowIso() {
  return new Date().toISOString();
}

async function enqueueEvent(event) {
  if (!settings.monitoringEnabled) return; // hard stop if disabled
  const enriched = { ...event, ts: nowIso(), id: crypto.randomUUID() };
  eventQueue.push(enriched);

  // Mirror to a capped local log for user-facing transparency (last 200 events).
  const { recentEvents = [] } = await chrome.storage.local.get("recentEvents");
  const updated = [enriched, ...recentEvents].slice(0, 200);
  await chrome.storage.local.set({ recentEvents: updated });

  if (eventQueue.length >= settings.batchSize) {
    flushQueue();
  }
}

async function flushQueue() {
  if (eventQueue.length === 0) return;
  const batch = eventQueue.splice(0, eventQueue.length);
  try {
    const res = await fetch(settings.backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
      },
      body: JSON.stringify({ events: batch }),
    });
    if (!res.ok) throw new Error(`Backend responded ${res.status}`);
  } catch (err) {
    // On failure, put events back so nothing is silently lost.
    eventQueue = [...batch, ...eventQueue];
    console.warn("[visual-ai-agent] flush failed, will retry:", err.message);
  }
}

function startFlushTimer() {
  stopFlushTimer();
  flushTimer = setInterval(flushQueue, settings.batchIntervalSec * 1000);
}
function stopFlushTimer() {
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = null;
}

async function captureScreenshotTick() {
  if (!settings.monitoringEnabled || !settings.captureScreenshots) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab || !tab.windowId) return;
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 40 });
    enqueueEvent({
      type: "screenshot",
      url: tab.url,
      title: tab.title,
      tabId: tab.id,
      dataUrl, // consider uploading to object storage instead of inlining, in production
    });
  } catch (err) {
    // Common benign cause: chrome:// pages or no active tab permission.
    console.debug("[visual-ai-agent] screenshot skipped:", err.message);
  }
}

function startScreenshotTimer() {
  stopScreenshotTimer();
  if (settings.captureScreenshots) {
    screenshotTimer = setInterval(captureScreenshotTick, settings.screenshotIntervalSec * 1000);
  }
}
function stopScreenshotTimer() {
  if (screenshotTimer) clearInterval(screenshotTimer);
  screenshotTimer = null;
}

function applyMonitoringState() {
  updateBadge();
  if (settings.monitoringEnabled) {
    startFlushTimer();
    startScreenshotTimer();
  } else {
    stopFlushTimer();
    stopScreenshotTimer();
    eventQueue = [];
  }
}

// ---- Browser activity listeners ----

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    enqueueEvent({ type: "tab_activated", tabId, url: tab.url, title: tab.title });
  } catch (_) {}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    enqueueEvent({ type: "tab_updated", tabId, url: tab.url, title: tab.title });
  }
});

chrome.tabs.onCreated.addListener((tab) => {
  enqueueEvent({ type: "tab_created", tabId: tab.id, url: tab.url, title: tab.title });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  enqueueEvent({ type: "tab_closed", tabId });
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    enqueueEvent({ type: "window_blur" });
  } else {
    enqueueEvent({ type: "window_focus", windowId });
  }
});

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId === 0) {
    enqueueEvent({ type: "navigation", url: details.url, tabId: details.tabId });
  }
});

// ---- Messaging with popup / options / content script ----

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case "GET_SETTINGS":
        sendResponse(await loadSettings());
        break;
      case "SET_SETTINGS":
        sendResponse(await saveSettings(message.payload));
        break;
      case "GET_RECENT_EVENTS": {
        const { recentEvents = [] } = await chrome.storage.local.get("recentEvents");
        sendResponse(recentEvents);
        break;
      }
      case "CLEAR_EVENTS":
        await chrome.storage.local.set({ recentEvents: [] });
        sendResponse({ ok: true });
        break;
      case "CONTENT_EVENT":
        // Events forwarded from content.js (e.g. significant clicks, form focus - no keystrokes/values captured)
        enqueueEvent({ ...message.payload, url: sender.tab?.url, title: sender.tab?.title, tabId: sender.tab?.id });
        sendResponse({ ok: true });
        break;
      default:
        sendResponse({ ok: false, error: "unknown message type" });
    }
  })();
  return true; // keep channel open for async sendResponse
});

// ---- Init ----
loadSettings().then(applyMonitoringState);
