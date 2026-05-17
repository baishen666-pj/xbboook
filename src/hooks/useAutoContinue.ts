import { useState, useCallback, useRef } from "react";
import { fetchAutoContinue } from "@/services/aiService";

const IDLE_TIMEOUT_MS = 30_000;

interface AutoContinueState {
  suggestion: string | null;
  isGenerating: boolean;
  error: string | null;
}

export function useAutoContinue(
  projectId: string | undefined,
  chapterId: string | undefined,
) {
  const [state, setState] = useState<AutoContinueState>({
    suggestion: null,
    isGenerating: false,
    error: null,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastContentRef = useRef<string>("");

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const clearSuggestion = useCallback(() => {
    cancel();
    setState({ suggestion: null, isGenerating: false, error: null });
  }, [cancel]);

  const generate = useCallback(
    async (currentContent: string, direction?: "forward" | "scene" | "dialogue") => {
      if (!projectId || !chapterId) return;

      cancel();
      abortRef.current = new AbortController();

      setState((prev) => ({ ...prev, isGenerating: true, error: null }));

      try {
        const result = await fetchAutoContinue(
          projectId,
          chapterId,
          currentContent,
          direction,
        );
        setState({ suggestion: result.continuation, isGenerating: false, error: null });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setState({
          suggestion: null,
          isGenerating: false,
          error: err instanceof Error ? err.message : "续写失败",
        });
      }
    },
    [projectId, chapterId, cancel],
  );

  const scheduleAutoContinue = useCallback(
    (currentContent: string) => {
      cancel();

      if (!projectId || !chapterId || currentContent.length < 200) return;

      // Don't re-trigger if content hasn't changed significantly
      if (Math.abs(currentContent.length - lastContentRef.current.length) < 50) return;
      lastContentRef.current = currentContent;

      timerRef.current = setTimeout(() => {
        void generate(currentContent);
      }, IDLE_TIMEOUT_MS);
    },
    [projectId, chapterId, generate, cancel],
  );

  return {
    suggestion: state.suggestion,
    isGenerating: state.isGenerating,
    error: state.error,
    generate,
    scheduleAutoContinue,
    clearSuggestion,
    cancel,
  };
}
