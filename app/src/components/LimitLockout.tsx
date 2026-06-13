import { useEffect, useState } from "react";
import { Ban } from "lucide-react";
import { onLimitReached } from "../lib/api";
import type { LimitReached } from "../lib/types";
import { formatDuration } from "../lib/format";

/**
 * Strict daily-limit lockout. When the collector reports that a **strict** limit
 * was reached, this covers the System Trace window with a blocking overlay the
 * user must acknowledge - a forceful interruption rather than a quiet toast.
 *
 * We deliberately do NOT kill the offending app's process (System Trace's
 * "nudge, don't kill" philosophy and a hard OS block needs elevation); instead
 * the collector brings this window to the foreground so the reminder is
 * unmissable. Medium and soft limits are unaffected (they stay quiet / nudge).
 */
export function LimitLockout() {
  const [hit, setHit] = useState<LimitReached | null>(null);

  useEffect(() => {
    let un = () => {};
    onLimitReached((l) => {
      if (l.strictness === "strict") setHit(l);
    }).then((u) => (un = u));
    return () => un();
  }, []);

  if (!hit) return null;

  const over = Math.max(0, hit.used_ms - hit.daily_ms);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-bg/95 px-6 backdrop-blur"
      role="alertdialog"
      aria-modal="true"
      aria-label="Daily limit reached"
    >
      <span
        className="flex h-16 w-16 items-center justify-center rounded-full bg-negative/15 text-negative"
        aria-hidden
      >
        <Ban className="h-8 w-8" />
      </span>
      <div className="max-w-md text-center">
        <h2 className="text-h1 text-text">Daily limit reached</h2>
        <p className="mt-2 text-body text-text-muted">
          You&apos;ve hit your strict daily limit for{" "}
          <span className="font-medium text-text">{hit.display_name}</span> -{" "}
          {formatDuration(hit.used_ms)} of {formatDuration(hit.daily_ms)}
          {over > 0 ? ` (${formatDuration(over)} over)` : ""}. Consider stepping
          away from it for the rest of today.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setHit(null)}
        className="rounded-md bg-negative px-5 py-2 text-body-strong text-white"
      >
        I understand
      </button>
    </div>
  );
}
