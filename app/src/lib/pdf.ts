/**
 * Client-side PDF report export. Builds a one-page summary of the current
 * Reports view (day or week/month range) with jsPDF, then writes it to a
 * user-chosen path through the native save dialog + a small Rust write command.
 * No network, no email - purely local, matching the rest of the app.
 */

import { save } from "@tauri-apps/plugin-dialog";
import { getDayOverview, getRangeOverview, isTauri, saveReportPdf } from "./api";
import { formatDuration } from "./format";

type Mode = "day" | "week" | "month";

interface ReportOpts {
  mode: Mode;
  from: string;
  to: string;
  label: string;
}

const MARGIN = 48;
const ACCENT: [number, number, number] = [45, 212, 191];
const MUTED: [number, number, number] = [110, 120, 130];

export async function downloadReportPdf(opts: ReportOpts): Promise<string> {
  // Lazy-load jsPDF so it isn't in the startup bundle (keeps the always-on
  // footprint lean; it's only needed when the user actually exports).
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = MARGIN;

  const heading = (text: string, size: number, color: [number, number, number] = [20, 24, 28]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(text, MARGIN, y);
  };
  const line = (text: string, size = 10, color: [number, number, number] = [40, 46, 52]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(text, MARGIN, y);
  };

  // Header.
  heading("System Trace", 20);
  y += 20;
  heading(opts.label, 13, ACCENT);
  y += 16;
  line(
    `${opts.mode[0].toUpperCase()}${opts.mode.slice(1)} report - generated ${new Date().toLocaleString()}`,
    9,
    MUTED,
  );
  y += 24;

  // Build a list of "label: value" rows plus a ranked list, depending on mode.
  let topApps: { display_name: string; total_ms: number }[] = [];
  let categories: { name: string; total_ms: number }[] = [];

  if (opts.mode === "day") {
    const d = await getDayOverview(opts.from);
    heading("Summary", 13);
    y += 18;
    line(`Total screen time:  ${formatDuration(d.total_ms)}`);
    y += 15;
    line(`vs the day before:  ${d.delta_vs_yesterday_ms >= 0 ? "+" : ""}${formatDuration(Math.abs(d.delta_vs_yesterday_ms))}`);
    y += 15;
    line(`Longest session:  ${formatDuration(d.longest_session_ms)}${d.longest_session_app ? ` (${d.longest_session_app})` : ""}`);
    y += 15;
    line(`App switches:  ${d.app_switches}`);
    y += 26;
    topApps = d.top_apps;
    categories = d.by_category;
  } else {
    const r = await getRangeOverview(opts.from, opts.to);
    const tracked = r.by_day.filter((x) => x.total_ms > 0).length;
    heading("Summary", 13);
    y += 18;
    line(`Total screen time:  ${formatDuration(r.total_ms)}`);
    y += 15;
    line(`Daily average:  ${formatDuration(r.daily_average_ms)}`);
    y += 15;
    line(`vs previous period:  ${r.total_ms - r.prev_total_ms >= 0 ? "+" : ""}${formatDuration(Math.abs(r.total_ms - r.prev_total_ms))}`);
    y += 15;
    line(`Days tracked:  ${tracked}`);
    y += 26;
    topApps = r.top_apps;
    categories = r.by_category;
  }

  // Top apps as a simple labelled bar chart.
  const drawRanked = (title: string, rows: { label: string; total_ms: number }[]) => {
    heading(title, 13);
    y += 16;
    const max = Math.max(1, ...rows.map((x) => x.total_ms));
    const barX = MARGIN + 160;
    const barMaxW = pageW - MARGIN - barX - 80;
    doc.setFontSize(10);
    for (const row of rows.slice(0, 12)) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 46, 52);
      doc.text(row.label.length > 26 ? row.label.slice(0, 25) + "…" : row.label, MARGIN, y);
      doc.setFillColor(...ACCENT);
      const w = Math.max(2, (row.total_ms / max) * barMaxW);
      doc.rect(barX, y - 8, w, 9, "F");
      doc.setTextColor(...MUTED);
      doc.text(formatDuration(row.total_ms), barX + barMaxW + 10, y);
      y += 18;
    }
    y += 10;
  };

  if (topApps.length) {
    drawRanked(
      "Top apps",
      topApps.map((a) => ({ label: a.display_name, total_ms: a.total_ms })),
    );
  }
  if (categories.length) {
    drawRanked(
      "Categories",
      categories.map((c) => ({ label: c.name, total_ms: c.total_ms })),
    );
  }

  // Footer.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    "Generated locally by System Trace. No data leaves your computer.",
    MARGIN,
    doc.internal.pageSize.getHeight() - 28,
  );

  const bytes = Array.from(new Uint8Array(doc.output("arraybuffer") as ArrayBuffer));

  if (!isTauri) {
    doc.save(`system-trace-report-${opts.from}.pdf`);
    return "Report downloaded.";
  }

  const path = await save({
    defaultPath: `system-trace-report-${opts.from}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!path) return "";
  const n = await saveReportPdf(path, bytes);
  return `Saved ${(n / 1024).toFixed(0)} KB PDF.`;
}
