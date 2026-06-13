/* Popup: show today's per-site time and export/clear it. */

function todayKey() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fmt(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

async function load() {
  const { days = {} } = await chrome.storage.local.get("days");
  const today = days[todayKey()] || {};
  const rows = Object.entries(today).sort((a, b) => b[1] - a[1]);

  const list = document.getElementById("list");
  const empty = document.getElementById("empty");
  list.innerHTML = "";
  if (rows.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  for (const [domain, ms] of rows) {
    const li = document.createElement("li");
    const d = document.createElement("span");
    d.className = "domain";
    d.textContent = domain;
    const t = document.createElement("span");
    t.className = "dur";
    t.textContent = fmt(ms);
    li.append(d, t);
    list.append(li);
  }
}

document.getElementById("export").addEventListener("click", async () => {
  const { days = {} } = await chrome.storage.local.get("days");
  // Shape mirrors System Trace's per-app-per-day model: each site is an
  // "app" keyed "site:<domain>" so the desktop import can fold it in.
  const out = [];
  for (const [day, bucket] of Object.entries(days)) {
    for (const [domain, ms] of Object.entries(bucket)) {
      out.push({
        app_key: `site:${domain}`,
        display_name: domain,
        day,
        total_ms: ms,
      });
    }
  }
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `system-trace-sites-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

document.getElementById("clear").addEventListener("click", async () => {
  await chrome.storage.local.set({ days: {} });
  load();
});

load();
