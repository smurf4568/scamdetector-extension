const pageUrlEl = document.getElementById("page-url");
const apiBaseInput = document.getElementById("api-base-input");
const saveApiBaseButton = document.getElementById("save-api-base-button");
const scanButton = document.getElementById("scan-button");
const safeSiteButton = document.getElementById("safe-site-button");
const reportIssueButton = document.getElementById("report-issue-button");
const autoScanCheckbox = document.getElementById("auto-scan-checkbox");
const rescanCheckbox = document.getElementById("rescan-checkbox");
const resultEl = document.getElementById("result");
const resultIconEl = document.getElementById("result-icon");
const resultPromptEl = document.getElementById("result-prompt");
const resultCaptionEl = document.getElementById("result-caption");
const riskScoreEl = document.getElementById("risk-score");
const verdictEl = document.getElementById("verdict");
const reasonsEl = document.getElementById("reasons");
const statusEl = document.getElementById("status");

let activeTabUrl = null;
let activeTabId = null;
let activeScanMode = "page";
let autoScanEnabled = false;
let apiBase = "https://scanner.seanforeman.org";
const RESULT_STATE_CLASSES = ["result--low-risk", "result--suspicious", "result--likely-scam"];
const VALUE_STATE_CLASSES = ["value--low-risk", "value--suspicious", "value--likely-scam"];
const ISSUE_URL_BASE = "https://github.com/smurf4568/scam_detector/issues/new";

function setStatus(message) {
  statusEl.textContent = message || "";
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

function getVerdictDisplay(verdictClass, scanType) {
  const target = scanType === "email" ? "email" : "page";
  if (verdictClass === "likely-scam") {
    return {
      icon: "👎",
      prompt: "High risk. Avoid engaging without verification.",
      caption: `Multiple warning signs were detected in this ${target}.`
    };
  }
  if (verdictClass === "suspicious") {
    return {
      icon: "✋",
      prompt: "Proceed carefully and double-check the claims.",
      caption: `Some indicators suggest the ${target} needs closer review.`
    };
  }
  return {
    icon: "👍",
    prompt: scanType === "email" ? "Looks okay to read." : "Looks okay to browse.",
    caption: "No strong scam indicators were triggered."
  };
}

function renderResult(data) {
  const verdictClass = getVerdictClassName(data.verdict);
  const verdictDisplay = getVerdictDisplay(verdictClass, data.scan_type || activeScanMode);

  resultEl.classList.remove(...RESULT_STATE_CLASSES);
  riskScoreEl.classList.remove(...VALUE_STATE_CLASSES);
  verdictEl.classList.remove(...VALUE_STATE_CLASSES);

  resultEl.classList.add(`result--${verdictClass}`);
  riskScoreEl.classList.add(`value--${verdictClass}`);
  verdictEl.classList.add(`value--${verdictClass}`);
  resultIconEl.textContent = verdictDisplay.icon;
  resultPromptEl.textContent = verdictDisplay.prompt;
  resultCaptionEl.textContent = verdictDisplay.caption;
  riskScoreEl.textContent = String(data.risk_score);
  verdictEl.textContent = data.verdict;
  reasonsEl.innerHTML = "";

  const reasons = Array.isArray(data.reasons) ? data.reasons : [];
  if (reasons.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No suspicious indicators were triggered.";
    reasonsEl.appendChild(item);
  } else {
    reasons.forEach((reason) => {
      const item = document.createElement("li");
      item.textContent = reason;
      reasonsEl.appendChild(item);
    });
  }

  resultEl.classList.remove("hidden");
}

function buildSafeSiteResult(hostname) {
  return {
    risk_score: 0,
    verdict: "Low Risk",
    reasons: [`This site is on your safe list: ${hostname}`],
    highlights: []
  };
}

function setActionDisabled(disabled) {
  scanButton.disabled = disabled;
  safeSiteButton.disabled = disabled || activeScanMode === "email";
}

function buildIssueUrl() {
  const issueBody = [
    "## Issue summary",
    "",
    "Describe the problem you ran into.",
    "",
    "## Context",
    "",
    `- Page URL: ${activeTabUrl || "Not available"}`,
    `- Extension page: ${window.location.href}`,
    "",
    "## Steps to reproduce",
    "",
    "1. Open the affected page.",
    "2. Open the Scam Detector popup.",
    "3. Describe what happened."
  ].join("\n");

  const params = new URLSearchParams({
    title: "Extension issue report",
    body: issueBody
  });
  return `${ISSUE_URL_BASE}?${params.toString()}`;
}

function reportIssue() {
  chrome.tabs.create({ url: buildIssueUrl() }, () => {
    if (chrome.runtime.lastError) {
      setStatus("Could not open the GitHub issue form.");
      return;
    }
    setStatus("Opened GitHub issue form for developer notification.");
  });
}

function applyHighlights(tabId, highlights) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: (items) => {
          const CLASS_NAME = "scam-detector-highlight";
          document.querySelectorAll("." + CLASS_NAME).forEach((node) => {
            const parent = node.parentNode;
            if (!parent) {
              return;
            }
            parent.replaceChild(document.createTextNode(node.textContent), node);
            parent.normalize();
          });

          const snippets = (items || [])
            .map((item) => (item && item.snippet ? item.snippet.trim() : ""))
            .filter(Boolean);

          if (!snippets.length) {
            return 0;
          }

          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
              if (!node.nodeValue || !node.nodeValue.trim()) {
                return NodeFilter.FILTER_REJECT;
              }
              const parentTag = node.parentElement && node.parentElement.tagName;
              if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(parentTag)) {
                return NodeFilter.FILTER_REJECT;
              }
              return NodeFilter.FILTER_ACCEPT;
            }
          });

          let count = 0;
          while (walker.nextNode() && count < 10) {
            const node = walker.currentNode;
            const text = node.nodeValue;
            const lowerText = text.toLowerCase();
            const snippet = snippets.find((candidate) => lowerText.includes(candidate.toLowerCase()));
            if (!snippet) {
              continue;
            }

            const index = lowerText.indexOf(snippet.toLowerCase());
            if (index === -1) {
              continue;
            }

            const before = text.slice(0, index);
            const match = text.slice(index, index + snippet.length);
            const after = text.slice(index + snippet.length);
            const fragment = document.createDocumentFragment();
            if (before) {
              fragment.appendChild(document.createTextNode(before));
            }
            const mark = document.createElement("mark");
            mark.className = CLASS_NAME;
            mark.textContent = match;
            mark.style.background = "#ffe66d";
            mark.style.color = "#1f2933";
            mark.style.padding = "0 2px";
            mark.style.borderRadius = "3px";
            fragment.appendChild(mark);
            if (after) {
              fragment.appendChild(document.createTextNode(after));
            }
            node.parentNode.replaceChild(fragment, node);
            count += 1;
          }

          const firstHighlight = document.querySelector("." + CLASS_NAME);
          if (firstHighlight) {
            firstHighlight.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          return count;
        },
        args: [highlights]
      },
      (results) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(results && results[0] ? results[0].result : 0);
      }
    );
  });
}

function getActiveTabState() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "GET_ACTIVE_TAB_SCAN_STATE" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response || !response.ok) {
        reject(new Error((response && response.error) || "No active tab URL found."));
        return;
      }

      resolve(response);
    });
  });
}

async function loadActiveTab() {
  try {
    const payload = await getActiveTabState();
    activeTabId = payload.tab.id;
    activeTabUrl = payload.tab.url;
    activeScanMode = payload.scanMode || "page";
    autoScanEnabled = Boolean(payload.autoScanEnabled);
    autoScanCheckbox.checked = autoScanEnabled;
    pageUrlEl.textContent = activeTabUrl;
    scanButton.textContent = activeScanMode === "email" ? "Scan Email On Screen" : "Scan This Page";
    safeSiteButton.disabled = activeScanMode === "email";

    if (payload.state && payload.state.url === activeTabUrl && (!payload.state.scan_type || payload.state.scan_type === activeScanMode)) {
      applyState(payload.state);
    } else if (activeScanMode === "email") {
      resultEl.classList.add("hidden");
      setStatus("Open an email message, then scan the email on screen.");
      setActionDisabled(false);
    } else if (autoScanEnabled) {
      setStatus("Scanning...");
      setActionDisabled(true);
      await requestScan(false);
    } else {
      resultEl.classList.add("hidden");
      setStatus("On-demand mode is enabled. Click 'Scan This Page' to run a scan.");
      setActionDisabled(false);
    }
  } catch (error) {
    setStatus(error.message);
    setActionDisabled(true);
  }
}

async function loadSettings() {
  try {
    const response = await sendRuntimeMessage({
      type: "GET_SETTINGS"
    });
    autoScanEnabled = Boolean(response.autoScanEnabled);
    apiBase = response.apiBase || apiBase;
    autoScanCheckbox.checked = autoScanEnabled;
    apiBaseInput.value = apiBase;
  } catch (error) {
    setStatus(error.message);
  }
}

function applyState(state) {
  if (!state) {
    setStatus("Waiting for scan result...");
    resultEl.classList.add("hidden");
    setActionDisabled(false);
    return;
  }

  if (state.status === "scanning") {
    resultEl.classList.add("hidden");
    setStatus("Scanning...");
    setActionDisabled(true);
    return;
  }

  if (state.status === "error") {
    resultEl.classList.add("hidden");
    setStatus(state.error || "Scan failed.");
    setActionDisabled(false);
    return;
  }

  renderResult(state);
  setStatus("");
  setActionDisabled(false);
  if (activeTabId && Array.isArray(state.highlights) && state.highlights.length) {
    applyHighlights(activeTabId, state.highlights)
      .then((highlightCount) => {
        if (highlightCount > 0) {
          setStatus("Highlighted relevant sections on the page.");
        }
      })
      .catch(() => undefined);
  }
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response || !response.ok) {
        reject(new Error((response && response.error) || "Extension request failed."));
        return;
      }

      resolve(response);
    });
  });
}

async function requestScan(rescan) {
  if (!activeTabUrl) {
    setStatus(activeScanMode === "email" ? "No webmail tab available to scan." : "No page URL available to scan.");
    return;
  }

  resultEl.classList.add("hidden");
  setActionDisabled(true);
  setStatus("Scanning...");

  try {
    const response = await sendRuntimeMessage({
      type: activeScanMode === "email" ? "SCAN_ACTIVE_EMAIL" : "SCAN_ACTIVE_TAB",
      rescan: Boolean(rescan)
    });
    applyState(response.state);
  } catch (error) {
    setStatus(error.message);
    setActionDisabled(false);
  }
}

async function whitelistActiveSite() {
  if (!activeTabUrl) {
    setStatus("No page URL available to whitelist.");
    return;
  }

  setActionDisabled(true);
  setStatus("Saving site to safe list...");

  try {
    const response = await sendRuntimeMessage({
      type: "WHITELIST_ACTIVE_SITE"
    });
    renderResult(buildSafeSiteResult(response.payload.hostname));
    setStatus(
      response.payload.status === "already_whitelisted"
        ? `Already on your safe list: ${response.payload.hostname}`
        : `Added to your safe list: ${response.payload.hostname}`
    );
  } catch (error) {
    setStatus(error.message);
  } finally {
    setActionDisabled(false);
  }
}

async function updateAutoScanMode() {
  autoScanCheckbox.disabled = true;
  setStatus("Saving scan mode...");

  try {
    const response = await sendRuntimeMessage({
      type: "SET_AUTO_SCAN_MODE",
      enabled: autoScanCheckbox.checked
    });

    autoScanEnabled = Boolean(response.autoScanEnabled);
    autoScanCheckbox.checked = autoScanEnabled;

    if (response.state && response.state.url === activeTabUrl) {
      applyState(response.state);
      return;
    }

    if (autoScanEnabled) {
      setStatus("Auto-scan is enabled for new pages.");
    } else {
      setStatus("On-demand mode is enabled.");
    }
  } catch (error) {
    autoScanCheckbox.checked = autoScanEnabled;
    setStatus(error.message);
  } finally {
    autoScanCheckbox.disabled = false;
  }
}

async function saveApiBase() {
  const nextApiBase = apiBaseInput.value.trim();
  apiBaseInput.disabled = true;
  saveApiBaseButton.disabled = true;
  setStatus("Saving API URL...");

  try {
    const response = await sendRuntimeMessage({
      type: "SET_API_BASE",
      apiBase: nextApiBase
    });
    apiBase = response.apiBase;
    apiBaseInput.value = apiBase;
    setStatus(`API URL saved: ${apiBase}`);
  } catch (error) {
    setStatus(error.message);
  } finally {
    apiBaseInput.disabled = false;
    saveApiBaseButton.disabled = false;
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (
    message.type !== "TAB_SCAN_UPDATED" ||
    !message.state ||
    message.tabId !== activeTabId ||
    message.state.url !== activeTabUrl
  ) {
    return;
  }

  applyState(message.state);
});

scanButton.addEventListener("click", () => requestScan(rescanCheckbox.checked));
safeSiteButton.addEventListener("click", whitelistActiveSite);
reportIssueButton.addEventListener("click", reportIssue);
autoScanCheckbox.addEventListener("change", updateAutoScanMode);
saveApiBaseButton.addEventListener("click", saveApiBase);

Promise.all([loadSettings(), loadActiveTab()]).catch((error) => {
  setStatus(error.message);
});
