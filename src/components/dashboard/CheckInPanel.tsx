import { useState, useEffect, useCallback } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { fetchCalendar, fetchCheckinStats, createCheckin, type CheckinDay, type CheckinStats } from "@/services/checkinService";

export function CheckInPanel() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const [todayCheckIn, setTodayCheckIn] = useState<CheckinDay | null>(null);
  const [stats, setStats] = useState<CheckinStats | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [justCheckedIn, setJustCheckedIn] = useState(false);
  const [newAchievements, setNewAchievements] = useState<Array<{ badgeType: string }>>([]);

  const projectId = currentProject?.id;

  const fetchToday = useCallback(async () => {
    if (!projectId) return;
    try {
      const days = await fetchCalendar(projectId, new Date().getFullYear());
      const today = new Date().toISOString().slice(0, 10);
      const todayData = days.find((c) => c.date === today);
      setTodayCheckIn(todayData || null);
    } catch { /* ignore */ }
  }, [projectId]);

  const fetchStatsData = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await fetchCheckinStats(projectId);
      if (data) setStats(data);
    } catch { /* ignore */ }
  }, [projectId]);

  useEffect(() => {
    fetchToday();
    fetchStatsData();
  }, [fetchToday, fetchStatsData]);

  const handleCheckIn = async () => {
    if (!projectId || loading) return;
    setLoading(true);
    try {
      const data = await createCheckin(projectId, note || undefined);
      if (data) {
        setTodayCheckIn(data.checkIn);
        setJustCheckedIn(true);
        setNewAchievements(data.newAchievements || []);
        fetchStatsData();
        setNote("");
        setTimeout(() => setJustCheckedIn(false), 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const hasCheckedIn = todayCheckIn?.date === today;

  return (
    <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">每日打卡</h3>
        {stats && (
          <span className="text-xs text-[var(--color-text-muted)]">
            连续 {stats.currentStreak} 天
          </span>
        )}
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-[var(--color-primary)]">{stats.currentStreak}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">当前连续</div>
          </div>
          <div>
            <div className="text-lg font-bold text-[var(--color-text-primary)]">{stats.longestStreak}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">最长连续</div>
          </div>
          <div>
            <div className="text-lg font-bold text-[var(--color-text-primary)]">{stats.totalCheckIns}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">累计打卡</div>
          </div>
          <div>
            <div className="text-lg font-bold text-[var(--color-text-primary)]">
              {(stats.totalWords / 1000).toFixed(1)}k
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)]">打卡总字数</div>
          </div>
        </div>
      )}

      {hasCheckedIn ? (
        <div className="rounded-lg bg-[var(--color-success)]/10 px-3 py-2 text-center">
          <div className="text-sm text-[var(--color-success)] font-medium">
            {justCheckedIn ? "打卡成功！" : "今日已打卡"}
          </div>
          {todayCheckIn && (
            <div className="text-xs text-[var(--color-text-muted)] mt-1">
              今日 {todayCheckIn.wordsToday} 字
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="今日写作心得（可选）"
            className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-xs text-[var(--color-text-primary)] resize-none"
            rows={2}
          />
          <button
            onClick={handleCheckIn}
            disabled={loading}
            className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {loading ? "打卡中..." : "今日打卡"}
          </button>
        </div>
      )}

      {newAchievements.length > 0 && (
        <div className="rounded-lg bg-[var(--color-warning)]/10 px-3 py-2">
          <div className="text-xs font-medium text-[var(--color-warning)]">解锁新成就！</div>
          {newAchievements.map((a, i) => (
            <div key={i} className="text-xs text-[var(--color-text-secondary)] mt-1">
              {a.badgeType}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
