import { useState, useEffect } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { analyticsService } from "@/services/analyticsService";

export function WritingGoalPanel() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const [dailyTarget, setDailyTarget] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!currentProject) return;
    analyticsService.getTodayStats(currentProject.id).then((res) => {
      if (res.success && res.data) setDailyTarget(res.data.dailyTarget);
    }).catch((err) => { console.warn("[WritingGoal] Load failed:", err); });
  }, [currentProject]);

  const handleSave = async () => {
    if (!currentProject) return;
    const res = await fetch(`/api/projects/${currentProject.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daily_target: dailyTarget }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  if (!currentProject) return null;

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-medium text-[var(--color-text-primary)]">写作目标</h3>

      <div>
        <label className="block text-xs text-[var(--color-text-muted)] mb-1">每日字数目标</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={dailyTarget}
            onChange={(e) => setDailyTarget(Math.max(0, parseInt(e.target.value) || 0))}
            min={0}
            step={100}
            className="w-32 rounded border border-[var(--color-border)] bg-[var(--color-surface-0)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]/50"
            placeholder="0"
          />
          <span className="text-xs text-[var(--color-text-muted)]">字/天</span>
        </div>
        <div className="flex gap-1 mt-2">
          {[500, 1000, 2000, 3000, 5000].map((v) => (
            <button
              key={v}
              onClick={() => setDailyTarget(v)}
              className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                dailyTarget === v
                  ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)]"
              }`}
            >
              {v >= 1000 ? `${v / 1000}k` : v}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm text-white hover:opacity-90 transition-opacity"
      >
        {saved ? "已保存" : "保存"}
      </button>
    </div>
  );
}
