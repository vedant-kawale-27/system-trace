# System Trace browser extension (per-site time)

The System Trace desktop app tracks at the **app** level - it can see "you used
Chrome", but the operating system does not expose the active URL to an outside
program, so it can't tell *which sites* you spent time on. This small extension
runs **inside the browser**, where it can see the focused tab, and records
**per-domain** active time.

Privacy-first, like the rest of System Trace:

- Stores only the **domain** (e.g. `youtube.com`) - never full URLs, page
  content, or browsing history.
- All data stays in the browser's local storage. **Nothing is sent anywhere.**
- Counts time only while the tab is focused and you're not idle.

## Install (no store, no fee)

You don't need to publish or pay for anything - load it unpacked:

**Chrome / Edge / Brave**
1. Go to `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and pick this `extension/` folder.

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and pick `manifest.json` in this folder.

(Publishing to the Chrome Web Store has a one-time \$5 developer fee; Firefox and
Edge are free. Publishing is optional - loading unpacked is enough for personal
use.)

## Use

Click the toolbar icon to see today's per-site time. Two buttons:

- **Export JSON** - downloads today's (and prior days') per-site totals.
- **Clear** - wipes the stored per-site data.

The exported JSON uses System Trace's per-app-per-day shape, with each site keyed
as `site:<domain>` (e.g. `site:github.com`), so it can be folded into the desktop
app's data.

## Why exported-JSON rather than a live link to the app

The desktop app is deliberately **local-first with no network server**, and its
database now lives **encrypted in memory** while running. A live bridge
(native-messaging) would mean a second process writing to that encrypted store,
which is racy and outside the current design. Exporting a JSON the user folds in
keeps the privacy model intact and needs no extra permissions. A tighter,
opt-in live integration is a possible future enhancement.

> Note: this extension is a separate artifact from the Rust/React app and is
> verified by loading it in a real browser (it can't be exercised by the desktop
> app's automated tests).
