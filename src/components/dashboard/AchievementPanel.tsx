import { useState, useEffect, useCallback } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { fetchAchievements, type AchievementData } from "@/services/achievementService";

export function AchievementPanel() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const [data, setData] = useState<AchievementData | null>(null);

  const loadAchievements = useCallback(async () => {
    if (!currentProject) return;
    try {
      const result = await fetchAchievements(currentProject.id);
      if (result) setData(result);
    } catch { /* ignore */ }
  }, [currentProject]);

  useEffect(() => {
    loadAchievements();
  }, [loadAchievements]);

  if (!data) return null;

  const earnedTypes = new Set(data.earned.map((a) => a.badgeType));
  const earnedCount = data.earned.length;
  const totalCount = data.definitions.length;

  return (
    <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">成就</h3>
        <span className="text-xs text-[var(--color-text-muted)]">
          {earnedCount}/{totalCount}
        </span>
      </div>

      <div className="w-full h-1.5 rounded-full bg-[var(--color-border)]">
        <div
          className="h-full rounded-full bg-[var(--color-primary)] transition-all"
          style={{ width: `${totalCount > 0 ? (earnedCount / totalCount) * 100 : 0}%` }}
        />
      </div>

      <div className="grid grid-cols-5 gap-2">
        {data.definitions.map((badge) => {
          const isEarned = earnedTypes.has(badge.type);
          return (
            <div
              key={badge.type}
              title={`${badge.name}: ${badge.description}${isEarned ? " (已解锁)" : " (未解锁)"}`}
              className={`flex flex-col items-center gap-0.5 rounded-lg p-1.5 text-center transition-all ${
                isEarned
                  ? "bg-[var(--color-success)]/10"
                  : "opacity-30 grayscale"
              }`}
            >
              <span className="text-base">{badge.icon}</span>
              <span className="text-[9px] text-[var(--color-text-secondary)] leading-tight truncate w-full">
                {badge.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
