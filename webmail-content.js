const WEBMAIL_PROVIDERS = [
  {
    id: "gmail",
    hosts: ["mail.google.com"],
    messageSelectors: [
      "div[role='main'] .adn",
      "div[role='main'] .ii.gt",
      "div[role='main'] [data-message-id]"
    ],
    subjectSelectors: ["h2.hP", "div[role='main'] h2"],
    senderSelectors: ["span[email]", ".gD[email]", "span.gD"],
    dateSelectors: ["span.g3", "span[title][alt]"],
    attachmentSelectors: [
      ".aQH span[title]",
      ".aZo[download_url]",
      ".aQy",
      "span[aria-label*='Attachment']",
      "div[aria-label*='Attachment']"
    ]
  },
  {
    id: "outlook",
    hosts: ["outlook.live.com", "outlook.office.com"],
    messageSelectors: [
      "div[role='main'] div[aria-label='Message body']",
      "div[role='main'] [data-app-section='ReadingPane']",
      "div[role='main']"
    ],
    subjectSelectors: [
      "div[role='main'] [role='heading'][aria-level='1']",
      "div[role='main'] h1"
    ],
    senderSelectors: [
      "div[role='main'] [title*='@']",
      "div[role='main'] span[title*='@']"
    ],
    dateSelectors: ["div[role='main'] time", "div[role='main'] [title]"],
    attachmentSelectors: [
      "div[role='main'] [aria-label*='attachment']",
      "div[role='main'] [title*='.pdf']",
      "div[role='main'] [title*='.zip']",
      "div[role='main'] [title*='.doc']",
      "div[role='main'] [title*='.xls']",
      "div[role='main'] [title*='.exe']"
    ]
  },
  {
    id: "icloud",
    hosts: ["www.icloud.com", "icloud.com"],
    requireMessageRoot: true,
    messageSelectors: [
      "[data-testid*='thread-detail-pane'] [role='article']",
      "[data-testid*='thread-detail-pane'] [aria-label*='message' i]",
      "[data-testid*='thread-detail-pane'] [class*='message']",
      "[data-testid*='thread-detail-pane']",
      "[class*='thread-detail-pane'] [role='article']",
      "[class*='thread-detail-pane'] [aria-label*='message' i]",
      "[class*='thread-detail-pane'] [class*='message']",
      "[class*='thread-detail-pane']"
    ],
    subjectSelectors: [
      "[data-testid*='thread-detail-pane'] [role='heading'][aria-level='1']",
      "[data-testid*='thread-detail-pane'] h1",
      "[data-testid*='thread-detail-pane'] h2",
      "[class*='thread-detail-pane'] [role='heading'][aria-level='1']",
      "[class*='thread-detail-pane'] h1",
      "[class*='thread-detail-pane'] h2"
    ],
    senderSelectors: [
      "[data-testid*='thread-detail-pane'] [title*='@']",
      "[data-testid*='thread-detail-pane'] [aria-label*='@']",
      "[data-testid*='thread-detail-pane'] a[href^='mailto:']",
      "[class*='thread-detail-pane'] [title*='@']",
      "[class*='thread-detail-pane'] [aria-label*='@']",
      "[class*='thread-detail-pane'] a[href^='mailto:']"
    ],
    dateSelectors: [
      "[data-testid*='thread-detail-pane'] time",
      "[data-testid*='thread-detail-pane'] [datetime]",
      "[data-testid*='thread-detail-pane'] [title]",
      "[class*='thread-detail-pane'] time",
      "[class*='thread-detail-pane'] [datetime]",
      "[class*='thread-detail-pane'] [title]"
    ],
    attachmentSelectors: [
      "[data-testid*='thread-detail-pane'] [aria-label*='attachment' i]",
      "[data-testid*='thread-detail-pane'] [title*='.pdf' i]",
      "[data-testid*='thread-detail-pane'] [title*='.zip' i]",
      "[data-testid*='thread-detail-pane'] [title*='.doc' i]",
      "[data-testid*='thread-detail-pane'] [title*='.xls' i]",
      "[data-testid*='thread-detail-pane'] [title*='.exe' i]",
      "[class*='thread-detail-pane'] [aria-label*='attachment' i]",
      "[class*='thread-detail-pane'] [title*='.pdf' i]",
      "[class*='thread-detail-pane'] [title*='.zip' i]",
      "[class*='thread-detail-pane'] [title*='.doc' i]",
      "[class*='thread-detail-pane'] [title*='.xls' i]",
      "[class*='thread-detail-pane'] [title*='.exe' i]"
    ]
  },
  {
    id: "yahoo",
    hosts: ["mail.yahoo.com"],
    messageSelectors: [
      "div[data-test-id='message-view-body-content']",
      "div[data-test-id='message-view']",
      "div[role='main']"
    ],
    subjectSelectors: [
      "div[data-test-id='message-view-subject']",
      "div[role='main'] h1",
      "div[role='main'] h2"
    ],
    senderSelectors: [
      "span[data-test-id='message-from']",
      "div[data-test-id='message-view'] [title*='@']"
    ],
    dateSelectors: ["time", "div[data-test-id='message-view'] [title]"],
    attachmentSelectors: [
      "div[data-test-id*='attachment']",
      "button[data-test-id*='attachment']",
      "[aria-label*='attachment']"
    ]
  },
  {
    id: "proton",
    hosts: ["app.proton.me"],
    messageSelectors: [
      ".message-content",
      ".message-container",
      "main"
    ],
    subjectSelectors: ["h1", "[data-testid='message-header:subject']"],
    senderSelectors: [
      "[data-testid='message-header:sender']",
      "[title*='@']"
    ],
    dateSelectors: ["time", "[data-testid='message-header:date']"],
    attachmentSelectors: [
      "[data-testid*='attachment']",
      ".attachment",
      "[aria-label*='attachment']"
    ]
  }
];

function getProvider() {
  const hostname = window.location.hostname;
  return WEBMAIL_PROVIDERS.find((provider) =>
    provider.hosts.some((host) => hostname === host || hostname.endsWith("." + host))
  ) || null;
}

function getProviderDocument(provider) {
  if (provider && provider.id === "icloud") {
    const iframe = document.querySelector("iframe[data-name='mail2'], iframe[src*='/applications/mail2/']");
    if (iframe && iframe.contentDocument) {
      return iframe.contentDocument;
    }
  }
  return document;
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function queryFirstText(selectors, root = document) {
  for (const selector of selectors || []) {
    const node = root.querySelector(selector);
    const text = normalizeText(node && node.textContent);
    if (text) {
      return text;
    }
  }
  return "";
}

function queryFirstAttribute(selectors, attributes, root = document) {
  for (const selector of selectors || []) {
    const node = root.querySelector(selector);
    if (!node) {
      continue;
    }
    for (const attribute of attributes) {
      const value = normalizeText(node.getAttribute(attribute));
      if (value) {
        return value;
      }
    }
  }
  return "";
}

function isLikelyIcloudMessagePane(item, viewportWidth = 0) {
  const text = normalizeText(item.node.textContent);
  const lowerText = text.toLowerCase();
  const hasMessageSignal =
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text) ||
    item.node.querySelector("a[href^='mailto:'], time, [datetime], [title*='@'], [aria-label*='@']");
  const hasMailboxListSignal = /\b(inbox|archive|junk|trash|sent|drafts|flagged|all mail|delete|reply all|compose)\b/i.test(text);
  const isRightPane = !viewportWidth || item.rect.left > viewportWidth * 0.45;
  return Boolean(
    hasMessageSignal &&
    isRightPane &&
    item.textLength > 40 &&
    item.rect.width > 260 &&
    item.rect.height > 160 &&
    !hasMailboxListSignal &&
    !lowerText.includes("cryptocurrency")
  );
}

function getIcloudHeuristicMessageRoot(rootDocument = document) {
  const view = rootDocument.defaultView || window;
  const viewportWidth =
    view.innerWidth ||
    rootDocument.documentElement.clientWidth ||
    window.innerWidth ||
    document.documentElement.clientWidth ||
    0;
  const nodes = Array.from(rootDocument.querySelectorAll(
    [
      "[role='main'] [role='region']",
      "[role='main'] [role='group']",
      "[role='main'] [role='article']",
      "[role='main'] section",
      "[role='main'] div"
    ].join(",")
  ));
  const candidates = nodes
    .map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        node,
        rect,
        textLength: normalizeText(node.textContent).length
      };
    })
    .filter((item) => item.rect.width > 0 && item.rect.height > 0 && isLikelyIcloudMessagePane(item, viewportWidth))
    .sort((a, b) => b.rect.right - a.rect.right || b.textLength - a.textLength);

  return candidates.find((item) => !viewportWidth || item.rect.left > viewportWidth * 0.45)?.node ||
    (candidates.length ? candidates[0].node : null);
}

function getVisibleMessageRoot(provider, rootDocument = document) {
  for (const selector of provider.messageSelectors || []) {
    const nodes = Array.from(rootDocument.querySelectorAll(selector));
    const visibleNodes = nodes
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          node,
          rect,
          textLength: normalizeText(node.textContent).length
        };
      })
      .filter((item) => item.rect.width > 0 && item.rect.height > 0 && item.textLength > 20)
      .sort((a, b) => {
        if (provider.id === "icloud") {
          return b.rect.right - a.rect.right || b.textLength - a.textLength;
        }
        return b.textLength - a.textLength;
      });

    if (visibleNodes.length) {
      return visibleNodes[0].node;
    }
  }
  if (provider.id === "icloud") {
    return getIcloudHeuristicMessageRoot(rootDocument);
  }
  return provider.requireMessageRoot ? null : rootDocument.body;
}

function parseEmailAddress(value) {
  const text = normalizeText(value);
  const angleMatch = text.match(/<([^<>@\s]+@[^<>\s]+)>/);
  if (angleMatch) {
    return angleMatch[1];
  }
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return emailMatch ? emailMatch[0] : "";
}

function parseDisplayName(value, email) {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }
  return normalizeText(text.replace(email || "", "").replace(/[<>()"]/g, ""));
}

function extractLinks(root) {
  const seen = new Set();
  return Array.from(root.querySelectorAll("a[href]"))
    .map((link) => {
      const href = link.href;
      if (!href || seen.has(href)) {
        return null;
      }
      seen.add(href);
      return {
        text: normalizeText(link.textContent).slice(0, 200),
        href
      };
    })
    .filter(Boolean)
    .slice(0, 40);
}

function parseFilename(value) {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }
  const match = text.match(/[^\s"'<>/\\]+\.(?:7z|ace|app|bat|cmd|com|docm|dotm|exe|gz|hta|html?|img|iso|jar|js|jse|lnk|msi|pdf|potm|ppam|ppsm|pptm|rar|scr|tar|vbe|vbs|wsf|xlam|xlsm|xltm|zip)\b/i);
  return match ? match[0] : "";
}

function extractAttachmentFromNode(node) {
  const candidates = [
    node.getAttribute("download"),
    node.getAttribute("title"),
    node.getAttribute("aria-label"),
    node.getAttribute("data-tooltip"),
    node.getAttribute("data-filename"),
    node.getAttribute("download_url"),
    node.textContent
  ];
  for (const candidate of candidates) {
    const filename = parseFilename(candidate);
    if (filename) {
      return {
        filename,
        content_type: "",
        size_bytes: 0
      };
    }
  }
  return null;
}

function extractAttachments(provider, root) {
  const seen = new Set();
  const selectors = [
    ...(provider.attachmentSelectors || []),
    "a[download]",
    "a[href][title]",
    "[aria-label*='attachment' i]",
    "[title*='.pdf' i]",
    "[title*='.zip' i]",
    "[title*='.doc' i]",
    "[title*='.xls' i]",
    "[title*='.exe' i]"
  ];
  return selectors
    .flatMap((selector) => Array.from((root || document).querySelectorAll(selector)))
    .map(extractAttachmentFromNode)
    .filter((attachment) => {
      if (!attachment || seen.has(attachment.filename.toLowerCase())) {
        return false;
      }
      seen.add(attachment.filename.toLowerCase());
      return true;
    })
    .slice(0, 20);
}

function trimBodyText(text) {
  const normalized = normalizeText(text);
  const forwardedIndex = normalized.search(/\b(forwarded message|original message)\b/i);
  const trimmed = forwardedIndex > 500 ? normalized.slice(0, forwardedIndex) : normalized;
  return trimmed.slice(0, 20000);
}

function extractEmailOnScreen() {
  const provider = getProvider();
  if (!provider) {
    return {
      ok: false,
      error: "This tab is not a supported webmail client."
    };
  }

  const providerDocument = getProviderDocument(provider);
  const root = getVisibleMessageRoot(provider, providerDocument);
  if (!root) {
    return {
      ok: false,
      error: "Open an email message before scanning."
    };
  }

  const senderRaw =
    queryFirstAttribute(provider.senderSelectors, ["email", "title", "aria-label"], root) ||
    queryFirstText(provider.senderSelectors, root) ||
    queryFirstAttribute(provider.senderSelectors, ["email", "title", "aria-label"], providerDocument);
  const fromEmail = parseEmailAddress(senderRaw);
  const fromName = parseDisplayName(senderRaw, fromEmail);
  const bodyText = trimBodyText(root ? root.textContent : "");

  if (!bodyText || bodyText.length < 20) {
    return {
      ok: false,
      error: "Open an email message before scanning."
    };
  }

  return {
    ok: true,
    email: {
      provider: provider.id,
      subject: queryFirstText(provider.subjectSelectors, providerDocument) || providerDocument.title || document.title,
      from_name: fromName,
      from_email: fromEmail,
      sender_text: senderRaw,
      reply_to: "",
      date_text:
        queryFirstAttribute(provider.dateSelectors, ["datetime", "title", "aria-label"], root) ||
        queryFirstText(provider.dateSelectors, root),
      body_text: bodyText,
      links: extractLinks(root),
      attachments: extractAttachments(provider, root),
      page_url: window.location.href
    }
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "EXTRACT_EMAIL_ON_SCREEN") {
    return false;
  }

  sendResponse(extractEmailOnScreen());
  return false;
});
