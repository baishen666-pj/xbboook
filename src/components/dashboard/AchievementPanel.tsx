import { useState, useEffect, useCallback } from "react";
import { useProjectStore } from "@/stores/projectStore";

interface EarnedAchievement {
  id: string;
  badge_type: string;
  earned_at: string;
  metadata: string | null;
}

interface BadgeDefinition {
  type: string;
  name: string;
  description: string;
  icon: string;
}

interface AchievementData {
  earned: EarnedAchievement[];
  definitions: BadgeDefinition[];
}

export function AchievementPanel() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const [data, setData] = useState<AchievementData | null>(null);

  const fetchAchievements = useCallback(async () => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/achievements`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch { /* ignore */ }
  }, [currentProject]);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  if (!data) return null;

  const earnedTypes = new Set(data.earned.map((a) => a.badge_type));
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
