import { useState, useEffect, useRef, useCallback } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { analyticsService } from "@/services/analyticsService";
import { toast } from "@/stores/toastStore";

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
  const content = useEditorStore((s) => s.content);
  const [elapsed, setElapsed] = useState(0);
  const [isWriting, setIsWriting] = useState(false);
  const [todayWords, setTodayWords] = useState(0);
  const [dailyTarget, setDailyTarget] = useState(0);
  const [sessionWords, setSessionWords] = useState(0);
  const startRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wordsAtStartRef = useRef<number>(0);
  const sessionIdRef = useRef<string | null>(null);
  const goalShownRef = useRef(false);

  // Fetch today's stats periodically
  useEffect(() => {
    if (!currentProject) return;
    const id = setInterval(() => {
      analyticsService.getTodayStats(currentProject.id).then((res) => {
        if (res.success && res.data) {
          setTodayWords(res.data.words);
          setDailyTarget(res.data.dailyTarget);
        }
      }).catch((err) => { console.warn("[Timer] Stats fetch failed:", err); });
    }, 30000);
    analyticsService.getTodayStats(currentProject.id).then((res) => {
      if (res.success && res.data) {
        setTodayWords(res.data.words);
        setDailyTarget(res.data.dailyTarget);
      }
    }).catch((err) => { console.warn("[Timer] Initial stats fetch failed:", err); });
    return () => clearInterval(id);
  }, [currentProject]);

  // Start a DB session when writing begins
  const startDbSession = useCallback(async () => {
    if (!currentProject || !activeChapterId || sessionIdRef.current) return;
    const wordCount = useEditorStore.getState().content.length;
    try {
      const res = await analyticsService.startSession(currentProject.id, {
        chapterId: activeChapterId,
        wordsStart: wordCount,
      });
      if (res.success && res.data) {
        sessionIdRef.current = res.data.id;
      }
    } catch {
      // Non-critical — don't block writing
    }
  }, [currentProject, activeChapterId]);

  // End the DB session when writing pauses
  const endDbSession = useCallback(async (wordsEnd: number) => {
    if (!currentProject || !sessionIdRef.current) return;
    const sid = sessionIdRef.current;
    sessionIdRef.current = null;
    try {
      await analyticsService.endSession(currentProject.id, sid, wordsEnd);
      // Refresh today's stats after session ends
      const statsRes = await analyticsService.getTodayStats(currentProject.id);
      if (statsRes.success && statsRes.data) {
        setTodayWords(statsRes.data.words);
        setDailyTarget(statsRes.data.dailyTarget);
        // Check goal
        if (
          statsRes.data.dailyTarget > 0 &&
          statsRes.data.words >= statsRes.data.dailyTarget &&
          !goalShownRef.current
        ) {
          goalShownRef.current = true;
          toast("success", `今日目标达成！已写 ${statsRes.data.words} 字`, 5000);
        }
      }
    } catch {
      // Non-critical
    }
  }, [currentProject]);

  // Auto-start timer when typing
  const handleActivity = useCallback(() => {
    if (!activeChapterId) return;
    if (!isWriting) {
      setIsWriting(true);
      startRef.current = Date.now();
      const wordCount = content.length;
      wordsAtStartRef.current = wordCount;
      void startDbSession();

      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startRef.current);
        const currentWords = useEditorStore.getState().content.length;
        setSessionWords(Math.max(0, currentWords - wordsAtStartRef.current));
      }, 1000);
    }
  }, [activeChapterId, isWriting, content, startDbSession]);

  useEffect(() => {
    if (!activeChapterId) return;
    handleActivity();
  }, [content, activeChapterId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pause after 30s of inactivity — end DB session
  useEffect(() => {
    if (!isWriting) return;
    const timeout = setTimeout(() => {
      setIsWriting(false);
      if (timerRef.current) clearInterval(timerRef.current);
      const currentWords = useEditorStore.getState().content.length;
      void endDbSession(currentWords);
    }, 30000);
    return () => clearTimeout(timeout);
  }, [content, isWriting, endDbSession]);

  // Cleanup on unmount or chapter change
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (sessionIdRef.current) {
        const currentWords = useEditorStore.getState().content.length;
        void endDbSession(currentWords);
      }
    };
  }, [activeChapterId, endDbSession]);

  // Reset goal notification on new day
  useEffect(() => {
    goalShownRef.current = false;
  }, [dailyTarget]);

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
