import { useRef, useCallback, useEffect } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { analyticsService } from "@/services/analyticsService";
import { countMixedText } from "@/lib/word-count";

export function useSessionTracker() {
  const sessionIdRef = useRef<string | null>(null);
  const projectIdRef = useRef<string | null>(null);
  const contentRef = useRef<string>("");

  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const content = useEditorStore((s) => s.content);
  const currentProject = useProjectStore((s) => s.currentProject);

  contentRef.current = content;

  const endCurrentSession = useCallback(async () => {
    if (!sessionIdRef.current || !projectIdRef.current) return;
    const words = countMixedText(contentRef.current).words;
    await analyticsService.endSession(
      projectIdRef.current,
      sessionIdRef.current,
      words,
    );
    sessionIdRef.current = null;
  }, []);

  useEffect(() => {
    if (!activeChapterId || !currentProject) {
      endCurrentSession();
      return;
    }

    const startSession = async () => {
      await endCurrentSession();

      const words = countMixedText(contentRef.current).words;
      const res = await analyticsService.startSession(currentProject.id, {
        chapterId: activeChapterId,
        wordsStart: words,
      });

      if (res.success && res.data) {
        sessionIdRef.current = res.data.id;
        projectIdRef.current = currentProject.id;
      }
    };

    const timeout = setTimeout(() => startSession(), 3000);
    return () => clearTimeout(timeout);
  }, [activeChapterId, currentProject, endCurrentSession]);

  useEffect(() => {
    return () => {
      if (sessionIdRef.current && projectIdRef.current) {
        const words = countMixedText(contentRef.current).words;
        analyticsService.endSession(
          projectIdRef.current,
          sessionIdRef.current,
          words,
        );
      }
    };
  }, []);
}
