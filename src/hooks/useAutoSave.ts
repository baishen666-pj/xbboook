import { useEffect, useRef } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { chapterService } from "@/services/chapterService";

const DEBOUNCE_MS = 1000;
const PERIODIC_MS = 30_000;

export function useAutoSave(): void {
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const content = useEditorStore((s) => s.content);
  const isDirty = useEditorStore((s) => s.isDirty);
  const isSaving = useEditorStore((s) => s.isSaving);
  const markSaved = useEditorStore((s) => s.markSaved);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const periodicRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!activeChapterId) return;

    periodicRef.current = setInterval(() => {
      const state = useEditorStore.getState();
      if (state.activeChapterId && state.isDirty && !state.isSaving) {
        void saveContent(state.activeChapterId, state.content);
      }
    }, PERIODIC_MS);

    return () => {
      if (periodicRef.current) clearInterval(periodicRef.current);
    };
  }, [activeChapterId]);

  useEffect(() => {
    if (!isDirty || !activeChapterId || isSaving) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const state = useEditorStore.getState();
      if (state.activeChapterId && state.isDirty) {
        void saveContent(state.activeChapterId, state.content);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isDirty, content, activeChapterId, isSaving]);

  async function saveContent(chapterId: string, text: string): Promise<void> {
    useEditorStore.getState().saveContent();
    const res = await chapterService.saveContent(chapterId, text);
    if (res.success) {
      markSaved();
    } else {
      useEditorStore.setState({ isSaving: false, isDirty: true });
    }
  }
}
