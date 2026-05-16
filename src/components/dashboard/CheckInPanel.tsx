import { useState, useEffect, useCallback } from "react";
import { useProjectStore } from "@/stores/projectStore";

interface CheckInData {
  id: string;
  date: string;
  words_today: number;
  note: string | null;
}

interface CheckInStats {
  totalCheckIns: number;
  totalWords: number;
  currentStreak: number;
  longestStreak: number;
}

export function CheckInPanel() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const [todayCheckIn, setTodayCheckIn] = useState<CheckInData | null>(null);
  const [stats, setStats] = useState<CheckInStats | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [justCheckedIn, setJustCheckedIn] = useState(false);
  const [newAchievements, setNewAchievements] = useState<Array<{ badge_type: string }>>([]);

  const projectId = currentProject?.id;

  const fetchToday = useCallback(async () => {
    if (!projectId) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/projects/${projectId}/checkins/calendar?year=${new Date().getFullYear()}`);
      if (res.ok) {
        const data = await res.json();
        const todayData = data.data?.find((c: CheckInData) => c.date === today);
        setTodayCheckIn(todayData || null);
      }
    } catch { /* ignore */ }
  }, [projectId]);

  const fetchStats = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/checkins/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.data);
      }
    } catch { /* ignore */ }
  }, [projectId]);

  useEffect(() => {
    fetchToday();
    fetchStats();
  }, [fetchToday, fetchStats]);

  const handleCheckIn = async () => {
    if (!projectId || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/checkins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setTodayCheckIn(data.data.checkIn);
        setJustCheckedIn(true);
        setNewAchievements(data.data.newAchievements || []);
        fetchStats();
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
              今日 {todayCheckIn.words_today} 字
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
              {a.badge_type}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
