import { useRef, useCallback, useEffect } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { analyticsService } from "@/services/analyticsService";
import { countMixedText } from "@/lib/word-count";

export function useSessionTracker() {
  const sessionIdRef = useRef<string | null>(null);
  const projectIdRef = useRef<string | null>(null);
  const wordsStartRef = useRef(0);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const content = useEditorStore((s) => s.content);
  const currentProject = useProjectStore((s) => s.currentProject);

  const startSession = useCallback(async () => {
    if (!currentProject || !activeChapterId) return;

    if (sessionIdRef.current && projectIdRef.current) {
      await analyticsService.endSession(
        projectIdRef.current,
        sessionIdRef.current,
        countMixedText(content).words,
      );
    }

    const words = countMixedText(content).words;
    const res = await analyticsService.startSession(currentProject.id, {
      chapterId: activeChapterId,
      wordsStart: words,
    });

    if (res.success && res.data) {
      sessionIdRef.current = res.data.id;
      projectIdRef.current = currentProject.id;
      wordsStartRef.current = words;
    }
  }, [currentProject, activeChapterId, content]);

  const endSession = useCallback(async () => {
    if (!sessionIdRef.current || !projectIdRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    await analyticsService.endSession(
      projectIdRef.current,
      sessionIdRef.current,
      countMixedText(content).words,
    );
    sessionIdRef.current = null;
  }, [content]);

  useEffect(() => {
    if (activeChapterId && currentProject) {
      const timeout = setTimeout(() => startSession(), 5000);
      return () => clearTimeout(timeout);
    }
    endSession();
  }, [activeChapterId, currentProject, startSession, endSession]);

  useEffect(() => {
    return () => {
      endSession();
    };
  }, [endSession]);
}
