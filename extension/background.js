/*
 * System Trace per-site tracker (browser side).
 *
 * The desktop app can only see "you used Chrome"; the OS doesn't expose the
 * active URL to an outside process. This service worker runs inside the browser,
 * where it CAN see the focused tab, and accumulates per-domain active time into
 * the extension's local storage. Nothing is sent anywhere - the popup lets you
 * see today's per-site time and export it as JSON to merge into System Trace.
 *
 * Privacy: we store only the domain (e.g. "youtube.com"), never full URLs, page
 * content, or history.
 */

const IDLE_SECONDS = 60; // treat the user as idle after this much no input

// In-memory pointer to the session currently being timed.
let current = { domain: null, since: 0 };

function domainOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function todayKey() {
  // Local YYYY-MM-DD.
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function now() {
  return Date.now();
}

// Add elapsed time for the current domain to today's bucket, then reset.
async function flush() {
  if (!current.domain || !current.since) {
    current.since = now();
    return;
  }
  const elapsed = Math.max(0, now() - current.since);
  current.since = now();
  if (elapsed < 1000) return;

  const day = todayKey();
  const store = await chrome.storage.local.get("days");
  const days = store.days || {};
  const bucket = days[day] || {};
  bucket[current.domain] = (bucket[current.domain] || 0) + elapsed;
  days[day] = bucket;
  await chrome.storage.local.set({ days });
}

async function setCurrent(domain) {
  await flush();
  current = { domain, since: now() };
}

async function activeDomain() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || !tab.url) return null;
  return domainOf(tab.url);
}

async function refresh() {
  const idleState = await chrome.idle.queryState(IDLE_SECONDS);
  if (idleState !== "active") {
    await setCurrent(null);
    return;
  }
  await setCurrent(await activeDomain());
}

// React to the events that change which site is in front.
chrome.tabs.onActivated.addListener(refresh);
chrome.tabs.onUpdated.addListener((_id, info) => {
  if (info.url || info.status === "complete") refresh();
});
chrome.windows.onFocusChanged.addListener(refresh);
chrome.idle.onStateChanged.addListener(refresh);

// A periodic tick both flushes accrued time and re-checks the active tab, so a
// long read on one page is still counted even with no events.
chrome.alarms.create("tick", { periodInMinutes: 0.25 });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "tick") refresh();
});

refresh();
