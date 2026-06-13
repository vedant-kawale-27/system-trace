/**
 * OS notification glue. The collector (Rust) shows reminder notifications
 * (break due, limit reached, distraction nudge). Clicking one used to do
 * nothing; here we register a single global notification-action handler so that
 * clicking any notification brings System Trace to the foreground - the same on
 * every platform. We also make sure permission is granted so notifications can
 * appear at all.
 */

import { isTauri, focusMainWindow } from "./api";

let initialized = false;

export async function initNotifications(): Promise<void> {
  if (!isTauri || initialized) return;
  initialized = true;

  const plugin = await import("@tauri-apps/plugin-notification");

  // Ensure we're allowed to show notifications (no-op if already granted).
  try {
    let granted = await plugin.isPermissionGranted();
    if (!granted) {
      granted = (await plugin.requestPermission()) === "granted";
    }
  } catch {
    // Permission querying is best-effort; the collector still tries to notify.
  }

  // The key fix: when the user clicks/activates any of our notifications, focus
  // the main window instead of doing nothing.
  try {
    await plugin.onAction(() => {
      focusMainWindow().catch(() => {});
    });
  } catch {
    // Older plugin builds may not expose onAction; ignore rather than break.
  }
}
