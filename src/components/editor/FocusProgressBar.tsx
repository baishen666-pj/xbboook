import { useState, useEffect } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { analyticsService } from "@/services/analyticsService";

export function FocusProgressBar() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const [todayWords, setTodayWords] = useState(0);
  const [dailyTarget, setDailyTarget] = useState(0);

  useEffect(() => {
    if (!currentProject) return;
    analyticsService.getTodayStats(currentProject.id).then((res) => {
      if (res.success && res.data) {
        setTodayWords(res.data.words);
        setDailyTarget(res.data.dailyTarget);
      }
    }).catch(() => {});
    const id = setInterval(() => {
      analyticsService.getTodayStats(currentProject.id).then((res) => {
        if (res.success && res.data) {
          setTodayWords(res.data.words);
          setDailyTarget(res.data.dailyTarget);
        }
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, [currentProject]);

  if (dailyTarget <= 0) return null;

  const progress = Math.min((todayWords / dailyTarget) * 100, 100);
  const targetMet = todayWords >= dailyTarget;

  return (
    <div className="h-0.5 w-full bg-white/5">
      <div
        className={`h-full transition-all duration-500 ${targetMet ? "bg-[var(--color-success)]" : "bg-[var(--color-primary)]"}`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
