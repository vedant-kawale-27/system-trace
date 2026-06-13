import { useEffect, useState } from "react";
import { Target, Plus, Trash2, Flame } from "lucide-react";
import { getApps, getAppGoals, removeAppGoal, setAppGoal } from "../lib/api";
import type { AppGoal, AppInfo, GoalKind } from "../lib/types";
import { Card, CardTitle, EmptyState, cx } from "./ui";
import { formatDuration } from "../lib/format";

function ratio(g: AppGoal): { pct: number; met: boolean; color: string } {
  const pct = g.daily_ms > 0 ? Math.min(100, (g.today_ms / g.daily_ms) * 100) : 0;
  if (g.kind === "under") {
    const met = g.today_ms <= g.daily_ms;
    return { pct, met, color: pct < 80 ? "bg-accent" : pct < 100 ? "bg-warning" : "bg-negative" };
  }
  const met = g.today_ms >= g.daily_ms;
  return { pct, met, color: met ? "bg-positive" : "bg-accent" };
}

export function AppGoals() {
  const [goals, setGoals] = useState<AppGoal[]>([]);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [appId, setAppId] = useState<string>("");
  const [mins, setMins] = useState(60);
  const [kind, setKind] = useState<GoalKind>("under");

  function reload() {
    getAppGoals().then(setGoals).catch(() => {});
  }

  useEffect(() => {
    reload();
    getApps().then(setApps).catch(() => {});
  }, []);

  async function addGoal() {
    if (appId === "") return;
    await setAppGoal({ app_id: Number(appId), daily_ms: mins * 60_000, kind });
    reload();
    setAppId("");
  }

  async function dropGoal(id: number) {
    await removeAppGoal(id);
    setGoals((g) => g.filter((x) => x.app_id !== id));
  }

  const taken = new Set(goals.map((g) => g.app_id));
  const available = apps.filter((a) => !taken.has(a.id));

  return (
    <div className="space-y-2">
      <CardTitle>App goals</CardTitle>
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as GoalKind)}
            className="rounded-md border border-border bg-bg px-2 py-1.5 text-body text-text"
          >
            <option value="under">Stay under</option>
            <option value="over">Reach at least</option>
          </select>
          <select
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            className="rounded-md border border-border bg-bg px-2 py-1.5 text-body text-text"
          >
            <option value="">Choose an app</option>
            {available.map((a) => (
              <option key={a.id} value={a.id}>
                {a.display_name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={5}
              max={1440}
              value={mins}
              onChange={(e) => setMins(Number(e.target.value))}
              className="w-20 rounded-md border border-border bg-bg px-2 py-1.5 text-body text-text"
            />
            <span className="text-body text-text-muted">min/day</span>
          </div>
          <button
            type="button"
            onClick={addGoal}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-body-strong text-white"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add goal
          </button>
        </div>

        {goals.length === 0 ? (
          <EmptyState
            icon={<Target className="h-7 w-7" />}
            title="No app goals yet"
            description="Set a daily target on a specific app to track it over time."
          />
        ) : (
          <ul className="space-y-3">
            {goals.map((g) => {
              const r = ratio(g);
              return (
                <li key={g.app_id}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-body">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium text-text">{g.display_name}</span>
                      <span className="text-label text-text-muted">
                        {g.kind === "under" ? "stay under" : "reach at least"}
                      </span>
                      {g.streak_days > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-label text-warning"
                          title={`${g.streak_days}-day streak`}
                        >
                          <Flame className="h-3 w-3" aria-hidden />
                          {g.streak_days}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className={cx("font-medium", r.met ? "text-positive" : "text-text")}>
                        {formatDuration(g.today_ms)} / {formatDuration(g.daily_ms)}
                      </span>
                      <button
                        type="button"
                        onClick={() => dropGoal(g.app_id)}
                        className="text-text-muted hover:text-negative"
                        aria-label={`Remove goal for ${g.display_name}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
                    <div
                      className={cx("h-full rounded-full", r.color)}
                      style={{ width: `${r.pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
