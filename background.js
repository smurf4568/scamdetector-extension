const DEFAULT_API_BASE = "https://scanner.seanforeman.org";
const API_BASE_URL_KEY = "apiBaseUrl";
const SESSION_STATE_KEY = "tabScanState";
const AUTO_SCAN_ENABLED_KEY = "autoScanEnabled";
const inFlightScans = new Map();
const pendingScans = new Map();
const iconCache = new Map();

function getViewerCountry() {
  const language = ((self.navigator && self.navigator.language) || "en-US").toUpperCase();
  const parts = language.split(/[-_]/);
  return parts.length > 1 ? parts[parts.length - 1] : "US";
}

function normalizeApiBase(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) {
    return DEFAULT_API_BASE;
  }

  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("API URL must use http or https.");
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "");
  } catch (_error) {
    throw new Error("Enter a valid API base URL, for example https://scanner.example.com");
  }
}

function getVerdictClassName(verdict) {
  const normalized = String(verdict || "").toLowerCase();
  if (normalized === "likely scam") {
    return "likely-scam";
  }
  if (normalized === "suspicious") {
    return "suspicious";
  }
  return "low-risk";
}

function getScannableUrl(rawUrl) {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch (_error) {
    return null;
  }
}

function getWebmailProvider(rawUrl) {
  if (!rawUrl) {
    return null;
  }

  try {
    const hostname = new URL(rawUrl).hostname;
    if (hostname === "mail.google.com") {
      return "gmail";
    }
    if (hostname === "outlook.live.com" || hostname === "outlook.office.com") {
      return "outlook";
    }
    if (hostname === "www.icloud.com" || hostname === "icloud.com") {
      return "icloud";
    }
    if (hostname === "mail.yahoo.com") {
      return "yahoo";
    }
    if (hostname === "app.proton.me") {
      return "proton";
    }
  } catch (_error) {
    return null;
  }

  return null;
}

function getEmailScanUrl(tab, extractedEmail) {
  const provider = extractedEmail && extractedEmail.provider ? extractedEmail.provider : getWebmailProvider(tab && tab.url);
  const subject = extractedEmail && extractedEmail.subject ? extractedEmail.subject : "";
  const pageUrl = (extractedEmail && extractedEmail.page_url) || (tab && tab.url) || "";
  return `email:${provider || "webmail"}:${pageUrl}:${subject}`;
}

function parseApiResponse(response) {
  return response.text().then((rawBody) => {
    if (!rawBody) {
      return {};
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("application/json")) {
      return JSON.parse(rawBody);
    }

    try {
      return JSON.parse(rawBody);
    } catch (_error) {
      return { detail: rawBody.trim() };
    }
  });
}

function queryTabs(queryInfo) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query(queryInfo, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(tabs || []);
    });
  });
}

function getTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(tab);
    });
  });
}

function setBadgeText(details) {
  return chrome.action.setBadgeText(details);
}

function setIcon(details) {
  return chrome.action.setIcon(details);
}

function setBadgeBackgroundColor(details) {
  return chrome.action.setBadgeBackgroundColor(details);
}

function setTitle(details) {
  return chrome.action.setTitle(details);
}

function openPopup() {
  if (!chrome.action.openPopup) {
    return Promise.resolve();
  }

  try {
    const result = chrome.action.openPopup();
    if (result && typeof result.then === "function") {
      return result.catch(() => undefined);
    }
    return Promise.resolve();
  } catch (_error) {
    return Promise.resolve();
  }
}

function getIconPalette(iconState) {
  if (iconState === "low-risk") {
    return {
      background: "#1f7a35",
      border: "#0f4a27",
      text: "#f4fff6"
    };
  }
  if (iconState === "suspicious") {
    return {
      background: "#d88a16",
      border: "#8a4b05",
      text: "#fff8ed"
    };
  }
  if (iconState === "likely-scam") {
    return {
      background: "#b42318",
      border: "#7a1a12",
      text: "#fff5f5"
    };
  }
  if (iconState === "scanning") {
    return {
      background: "#64748b",
      border: "#475569",
      text: "#f8fafc"
    };
  }
  return {
    background: "#ffffff",
    border: "#64748b",
    text: "#1f2937"
  };
}

function drawIconImageData(size, iconState) {
  const palette = getIconPalette(iconState);
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext("2d");
  const lineWidth = Math.max(1, Math.round(size * 0.07));
  const points = [
    [size * 0.5, lineWidth * 0.9],
    [size * 0.86, size * 0.16],
    [size * 0.8, size * 0.57],
    [size * 0.5, size * 0.93],
    [size * 0.2, size * 0.57],
    [size * 0.14, size * 0.16]
  ];

  context.clearRect(0, 0, size, size);
  context.lineJoin = "round";
  context.lineCap = "round";
  context.shadowColor = "rgba(15, 23, 42, 0.22)";
  context.shadowBlur = Math.max(1, size * 0.06);
  context.shadowOffsetY = Math.max(1, size * 0.03);
  context.fillStyle = palette.background;
  context.strokeStyle = palette.border;
  context.lineWidth = lineWidth;
  context.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) {
      context.moveTo(x, y);
      return;
    }
    context.lineTo(x, y);
  });
  context.closePath();
  context.fill();
  context.stroke();

  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;
  context.fillStyle = palette.text;
  context.font = `800 ${Math.round(size * 0.32)}px Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("SD", size / 2, size * 0.48);

  return context.getImageData(0, 0, size, size);
}

function getIconImageData(iconState) {
  if (iconCache.has(iconState)) {
    return iconCache.get(iconState);
  }

  const imageData = {
    16: drawIconImageData(16, iconState),
    32: drawIconImageData(32, iconState),
    48: drawIconImageData(48, iconState),
    128: drawIconImageData(128, iconState)
  };
  iconCache.set(iconState, imageData);
  return imageData;
}

async function getStateMap() {
  const stored = await chrome.storage.session.get(SESSION_STATE_KEY);
  return stored[SESSION_STATE_KEY] || {};
}

async function getAutoScanEnabled() {
  const stored = await chrome.storage.local.get(AUTO_SCAN_ENABLED_KEY);
  return Boolean(stored[AUTO_SCAN_ENABLED_KEY]);
}

async function getApiBase() {
  const stored = await chrome.storage.local.get(API_BASE_URL_KEY);
  return normalizeApiBase(stored[API_BASE_URL_KEY] || DEFAULT_API_BASE);
}

async function setApiBase(apiBase) {
  const normalized = normalizeApiBase(apiBase);
  await chrome.storage.local.set({
    [API_BASE_URL_KEY]: normalized
  });
  return normalized;
}

async function setAutoScanEnabled(enabled) {
  await chrome.storage.local.set({
    [AUTO_SCAN_ENABLED_KEY]: Boolean(enabled)
  });
  return Boolean(enabled);
}

async function getTabState(tabId) {
  const stateMap = await getStateMap();
  return stateMap[String(tabId)] || null;
}

async function updateTabState(tabId, updater) {
  const stateMap = await getStateMap();
  const key = String(tabId);
  const nextValue = typeof updater === "function" ? updater(stateMap[key] || null) : updater;
  if (nextValue == null) {
    delete stateMap[key];
  } else {
    stateMap[key] = nextValue;
  }
  await chrome.storage.session.set({ [SESSION_STATE_KEY]: stateMap });
  return nextValue;
}

async function clearTabState(tabId) {
  await updateTabState(tabId, null);
}

async function broadcastTabUpdate(tabId) {
  const state = await getTabState(tabId);
  chrome.runtime.sendMessage({
    type: "TAB_SCAN_UPDATED",
    tabId,
    state
  }, () => void chrome.runtime.lastError);
}

async function setActionState(tabId, state) {
  if (!state || !state.url) {
    await setIcon({ tabId, imageData: getIconImageData("default") });
    await setBadgeText({ tabId, text: "" });
    await setTitle({ tabId, title: "Scam Detector" });
    return;
  }

  if (state.status === "scanning") {
    await setIcon({ tabId, imageData: getIconImageData("scanning") });
    await setBadgeText({ tabId, text: "…" });
    await setBadgeBackgroundColor({ tabId, color: "#64748b" });
    await setTitle({
      tabId,
      title: state.scan_type === "email" ? "Scam Detector: scanning email" : "Scam Detector: scanning page"
    });
    return;
  }

  if (state.status === "error") {
    await setIcon({ tabId, imageData: getIconImageData("scanning") });
    await setBadgeText({ tabId, text: "!" });
    await setBadgeBackgroundColor({ tabId, color: "#64748b" });
    await setTitle({ tabId, title: `Scam Detector: ${state.error || "scan failed"}` });
    return;
  }

  const verdictClass = getVerdictClassName(state.verdict);
  const colorByVerdict = {
    "low-risk": "#1f7a35",
    suspicious: "#b25b00",
    "likely-scam": "#b42318"
  };

  await setIcon({ tabId, imageData: getIconImageData(verdictClass) });
  await setBadgeText({ tabId, text: "S" });
  await setBadgeBackgroundColor({ tabId, color: colorByVerdict[verdictClass] || "#64748b" });
  await setTitle({
    tabId,
    title: `Scam Detector: ${state.verdict} (${state.risk_score})`
  });
}

async function updateStateAndBadge(tabId, state) {
  await updateTabState(tabId, state);
  await setActionState(tabId, state);
  await broadcastTabUpdate(tabId);
}

async function shouldAutoOpenPopup(tabId, state) {
  if (!state || state.status !== "complete") {
    return false;
  }
  if (getVerdictClassName(state.verdict) === "low-risk") {
    return false;
  }

  const previousState = await getTabState(tabId);
  return !previousState || previousState.lastAutoOpenedUrl !== state.url;
}

async function markAutoOpened(tabId, url) {
  const currentState = await getTabState(tabId);
  if (!currentState || currentState.url !== url) {
    return;
  }

  await updateStateAndBadge(tabId, {
    ...currentState,
    lastAutoOpenedUrl: url
  });
}

async function scanTab(tabId, options = {}) {
  const { rescan = false, openPopupOnWarning = false } = options;
  const tab = await getTab(tabId);
  const pageUrl = getScannableUrl(tab && tab.url);
  if (!pageUrl) {
    await clearTabState(tabId);
    await setActionState(tabId, null);
    return null;
  }

  const currentState = await getTabState(tabId);
  if (
    currentState &&
    currentState.status === "complete" &&
    currentState.url === pageUrl &&
    !rescan
  ) {
    return currentState;
  }

  if (inFlightScans.has(tabId)) {
    return inFlightScans.get(tabId);
  }

  const scanPromise = (async () => {
    await updateStateAndBadge(tabId, {
      ...(currentState || {}),
      url: pageUrl,
      status: "scanning",
      error: null
    });

    const apiBase = await getApiBase();
    const requestUrl = new URL(apiBase + "/scan");
    if (rescan) {
      requestUrl.searchParams.set("rescan", "true");
    }

    try {
      const response = await fetch(requestUrl.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: pageUrl,
          viewer_country: getViewerCountry()
        })
      });

      const payload = await parseApiResponse(response);
      if (!response.ok) {
        throw new Error(payload.detail || payload.message || "Scan failed.");
      }

      const nextState = {
        url: pageUrl,
        status: "complete",
        risk_score: payload.risk_score,
        verdict: payload.verdict,
        reasons: payload.reasons || [],
        highlights: payload.highlights || [],
        scannedAt: Date.now(),
        lastAutoOpenedUrl:
          currentState && currentState.url === pageUrl ? currentState.lastAutoOpenedUrl || null : null
      };

      const shouldOpen = openPopupOnWarning && (await shouldAutoOpenPopup(tabId, nextState));
      await updateStateAndBadge(tabId, nextState);

      if (shouldOpen) {
        await openPopup();
        await markAutoOpened(tabId, pageUrl);
      }

      return nextState;
    } catch (error) {
      const errorState = {
        url: pageUrl,
        status: "error",
        error:
          error.message === "Failed to fetch"
            ? `Could not reach the API at ${apiBase}.`
            : error.message
      };
      await updateStateAndBadge(tabId, errorState);
      return errorState;
    } finally {
      inFlightScans.delete(tabId);
    }
  })();

  inFlightScans.set(tabId, scanPromise);
  return scanPromise;
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function executeScript(tabId, files) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files
      },
      (results) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(results || []);
      }
    );
  });
}

async function extractEmailFromTab(tabId) {
  try {
    return await sendTabMessage(tabId, { type: "EXTRACT_EMAIL_ON_SCREEN" });
  } catch (_error) {
    await executeScript(tabId, ["webmail-content.js"]);
    return sendTabMessage(tabId, { type: "EXTRACT_EMAIL_ON_SCREEN" });
  }
}

async function scanEmailTab(tabId, options = {}) {
  const { rescan = false } = options;
  const tab = await getTab(tabId);
  const provider = getWebmailProvider(tab && tab.url);
  if (!provider) {
    throw new Error("This tab is not a supported webmail client.");
  }

  if (inFlightScans.has(tabId)) {
    return inFlightScans.get(tabId);
  }

  const scanPromise = (async () => {
    const currentState = await getTabState(tabId);
    await updateStateAndBadge(tabId, {
      ...(currentState || {}),
      url: tab.url,
      scan_type: "email",
      status: "scanning",
      error: null
    });

    const apiBase = await getApiBase();
    const requestUrl = new URL(apiBase + "/scan/email");
    if (rescan) {
      requestUrl.searchParams.set("rescan", "true");
    }

    try {
      const extracted = await extractEmailFromTab(tabId);
      if (!extracted || !extracted.ok || !extracted.email) {
        throw new Error((extracted && extracted.error) || "Could not read the email on screen.");
      }

      const email = extracted.email;
      const response = await fetch(requestUrl.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...email,
          viewer_country: getViewerCountry()
        })
      });

      const payload = await parseApiResponse(response);
      if (!response.ok) {
        throw new Error(payload.detail || payload.message || "Email scan failed.");
      }

      const nextState = {
        url: tab.url,
        scan_type: "email",
        email_scan_url: getEmailScanUrl(tab, email),
        email_provider: email.provider || provider,
        email_subject: email.subject || "",
        email_from: email.from_email || email.sender_text || "",
        status: "complete",
        risk_score: payload.risk_score,
        verdict: payload.verdict,
        reasons: payload.reasons || [],
        highlights: payload.highlights || [],
        scannedAt: Date.now(),
        lastAutoOpenedUrl:
          currentState && currentState.url === tab.url ? currentState.lastAutoOpenedUrl || null : null
      };

      await updateStateAndBadge(tabId, nextState);
      return nextState;
    } catch (error) {
      const errorState = {
        url: tab.url,
        scan_type: "email",
        status: "error",
        error:
          error.message === "Failed to fetch"
            ? `Could not reach the API at ${apiBase}.`
            : error.message
      };
      await updateStateAndBadge(tabId, errorState);
      return errorState;
    } finally {
      inFlightScans.delete(tabId);
    }
  })();

  inFlightScans.set(tabId, scanPromise);
  return scanPromise;
}

async function getActiveTab() {
  const tabs = await queryTabs({ active: true, currentWindow: true });
  if (!tabs.length) {
    return null;
  }
  return tabs[0];
}

function scheduleAutomaticScan(tabId, url) {
  const scannableUrl = getScannableUrl(url);
  if (!scannableUrl) {
    pendingScans.delete(tabId);
    clearTabState(tabId).catch(() => undefined);
    setActionState(tabId, null).catch(() => undefined);
    return;
  }

  if (getWebmailProvider(scannableUrl)) {
    if (pendingScans.has(tabId)) {
      clearTimeout(pendingScans.get(tabId));
    }
    pendingScans.delete(tabId);
    return;
  }

  if (pendingScans.has(tabId)) {
    clearTimeout(pendingScans.get(tabId));
  }

  const timer = setTimeout(() => {
    pendingScans.delete(tabId);
    getAutoScanEnabled()
      .then((enabled) => {
        if (!enabled) {
          return;
        }
        return scanTab(tabId, { rescan: false, openPopupOnWarning: true });
      })
      .catch(() => undefined);
  }, 600);

  pendingScans.set(tabId, timer);
}

async function whitelistActiveSite() {
  const activeTab = await getActiveTab();
  if (!activeTab || !getScannableUrl(activeTab.url)) {
    throw new Error("No page URL available to whitelist.");
  }

  const apiBase = await getApiBase();
  const response = await fetch(apiBase + "/safe-sites", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: activeTab.url
    })
  });

  const payload = await parseApiResponse(response);
  if (!response.ok) {
    throw new Error(payload.detail || payload.message || "Could not save safe site.");
  }

  const state = {
    url: activeTab.url,
    status: "complete",
    risk_score: 0,
    verdict: "Low Risk",
    reasons: [`This site is on your safe list: ${payload.hostname}`],
    highlights: [],
    scannedAt: Date.now(),
    lastAutoOpenedUrl: null
  };

  await updateStateAndBadge(activeTab.id, state);
  return payload;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.session.set({ [SESSION_STATE_KEY]: {} });
  chrome.storage.local.get([AUTO_SCAN_ENABLED_KEY, API_BASE_URL_KEY]).then((stored) => {
    const updates = {};
    if (typeof stored[AUTO_SCAN_ENABLED_KEY] === "undefined") {
      updates[AUTO_SCAN_ENABLED_KEY] = false;
    }
    if (typeof stored[API_BASE_URL_KEY] === "undefined") {
      updates[API_BASE_URL_KEY] = DEFAULT_API_BASE;
    }
    if (Object.keys(updates).length > 0) {
      return chrome.storage.local.set(updates);
    }
    return undefined;
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading") {
    clearTabState(tabId).catch(() => undefined);
    getAutoScanEnabled()
      .then((enabled) => {
        if (!enabled) {
          return setActionState(tabId, null);
        }
        if (getWebmailProvider(tab && tab.url)) {
          return setActionState(tabId, null);
        }
        return setActionState(tabId, {
          url: getScannableUrl(tab && tab.url),
          status: "scanning"
        });
      })
      .catch(() => undefined);
    return;
  }

  if (changeInfo.status === "complete") {
    scheduleAutomaticScan(tabId, tab && tab.url);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const state = await getTabState(tabId);
  await setActionState(tabId, state);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (pendingScans.has(tabId)) {
    clearTimeout(pendingScans.get(tabId));
    pendingScans.delete(tabId);
  }
  inFlightScans.delete(tabId);
  clearTabState(tabId).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === "GET_ACTIVE_TAB_SCAN_STATE") {
      const activeTab = await getActiveTab();
      if (!activeTab) {
        sendResponse({ ok: false, error: "No active tab URL found." });
        return;
      }

      sendResponse({
        ok: true,
        tab: {
          id: activeTab.id,
          url: activeTab.url
        },
        scanMode: getWebmailProvider(activeTab.url) ? "email" : "page",
        state: await getTabState(activeTab.id),
        autoScanEnabled: await getAutoScanEnabled()
      });
      return;
    }

    if (message.type === "GET_SETTINGS") {
      sendResponse({
        ok: true,
        autoScanEnabled: await getAutoScanEnabled(),
        apiBase: await getApiBase()
      });
      return;
    }

    if (message.type === "SET_API_BASE") {
      const apiBase = await setApiBase(message.apiBase);
      sendResponse({
        ok: true,
        apiBase
      });
      return;
    }

    if (message.type === "SET_AUTO_SCAN_MODE") {
      const autoScanEnabled = await setAutoScanEnabled(Boolean(message.enabled));
      let state = null;

      if (autoScanEnabled) {
        const activeTab = await getActiveTab();
        if (activeTab && getScannableUrl(activeTab.url)) {
          state = await scanTab(activeTab.id, {
            rescan: false,
            openPopupOnWarning: false
          });
        }
      }

      sendResponse({
        ok: true,
        autoScanEnabled,
        state
      });
      return;
    }

    if (message.type === "SCAN_ACTIVE_TAB") {
      const activeTab = await getActiveTab();
      if (!activeTab || !getScannableUrl(activeTab.url)) {
        sendResponse({ ok: false, error: "No page URL available to scan." });
        return;
      }

      const state = await scanTab(activeTab.id, {
        rescan: Boolean(message.rescan),
        openPopupOnWarning: false
      });
      sendResponse({ ok: true, state });
      return;
    }

    if (message.type === "SCAN_ACTIVE_EMAIL") {
      const activeTab = await getActiveTab();
      if (!activeTab || !getWebmailProvider(activeTab.url)) {
        sendResponse({ ok: false, error: "Open a supported webmail tab before scanning an email." });
        return;
      }

      const state = await scanEmailTab(activeTab.id, {
        rescan: Boolean(message.rescan)
      });
      sendResponse({ ok: true, state });
      return;
    }

    if (message.type === "WHITELIST_ACTIVE_SITE") {
      const payload = await whitelistActiveSite();
      sendResponse({ ok: true, payload });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message type." });
  })().catch((error) => {
    sendResponse({
      ok: false,
      error:
        error.message === "Failed to fetch"
          ? "Could not reach the configured API endpoint."
          : error.message
    });
  });

  return true;
});
