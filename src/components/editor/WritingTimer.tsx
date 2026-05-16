import { useState, useEffect, useRef, useCallback } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { analyticsService } from "@/services/analyticsService";

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function WritingTimer() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const [elapsed, setElapsed] = useState(0);
  const [isWriting, setIsWriting] = useState(false);
  const [todayWords, setTodayWords] = useState(0);
  const [dailyTarget, setDailyTarget] = useState(0);
  const [sessionWords, setSessionWords] = useState(0);
  const startRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wordsAtStartRef = useRef<number>(0);

  // Fetch today's stats
  useEffect(() => {
    if (!currentProject) return;
    const id = setInterval(() => {
      analyticsService.getTodayStats(currentProject.id).then((res) => {
        if (res.success && res.data) {
          setTodayWords(res.data.words);
          setDailyTarget(res.data.dailyTarget);
        }
      }).catch(() => {});
    }, 30000);
    // Initial fetch
    analyticsService.getTodayStats(currentProject.id).then((res) => {
      if (res.success && res.data) {
        setTodayWords(res.data.words);
        setDailyTarget(res.data.dailyTarget);
      }
    }).catch(() => {});
    return () => clearInterval(id);
  }, [currentProject]);

  // Track word count for session
  const content = useEditorStore((s) => s.content);

  // Auto-start timer when typing
  const handleActivity = useCallback(() => {
    if (!activeChapterId) return;

    if (!isWriting) {
      setIsWriting(true);
      startRef.current = Date.now();
      const wordCount = content.length;
      wordsAtStartRef.current = wordCount;

      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startRef.current);
        const currentWords = useEditorStore.getState().content.length;
        setSessionWords(Math.max(0, currentWords - wordsAtStartRef.current));
      }, 1000);
    }
  }, [activeChapterId, isWriting, content]);

  // Listen for typing activity via editor store changes
  useEffect(() => {
    if (!activeChapterId) return;
    handleActivity();
  }, [content, activeChapterId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pause after 30s of inactivity
  useEffect(() => {
    if (!isWriting) return;
    const timeout = setTimeout(() => {
      setIsWriting(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }, 30000);
    return () => clearTimeout(timeout);
  }, [content, isWriting]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!activeChapterId) return null;

  const targetMet = dailyTarget > 0 && todayWords >= dailyTarget;
  const progress = dailyTarget > 0 ? Math.min((todayWords / dailyTarget) * 100, 100) : 0;

  return (
    <div className="flex items-center gap-3 text-[var(--text-xs)]">
      {/* Timer */}
      <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${isWriting ? "bg-[var(--color-primary)] animate-[pulse-subtle_1.5s_ease-in-out_infinite]" : "bg-[var(--color-text-muted)]/30"}`} />
        <span className="font-mono tabular-nums">{formatTime(elapsed)}</span>
        {sessionWords > 0 && (
          <span className="text-[var(--color-primary)]">+{sessionWords}字</span>
        )}
      </div>

      {/* Daily progress */}
      {dailyTarget > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                targetMet ? "bg-[var(--color-success)]" : "bg-[var(--color-primary)]"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className={targetMet ? "text-[var(--color-success)]" : "text-[var(--color-text-muted)]"}>
            {todayWords}/{dailyTarget}
          </span>
          {targetMet && <span className="text-[var(--color-success)]">✓</span>}
        </div>
      )}
    </div>
  );
}
