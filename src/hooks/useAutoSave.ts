import { useEffect, useRef } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { chapterService } from "@/services/chapterService";
import { versionService } from "@/services/versionService";

const DEBOUNCE_MS = 1000;
const PERIODIC_MS = 30_000;
const MIN_VERSION_INTERVAL_MS = 5 * 60 * 1000;

export function useAutoSave(): void {
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const content = useEditorStore((s) => s.content);
  const isDirty = useEditorStore((s) => s.isDirty);
  const isSaving = useEditorStore((s) => s.isSaving);
  const markSaved = useEditorStore((s) => s.markSaved);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const periodicRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastVersionTimeRef = useRef<number>(0);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

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
    const projectId = useProjectStore.getState().currentProject?.id;
    if (!projectId) return;
    const res = await chapterService.saveContent(projectId, chapterId, text);
    if (res.success) {
      markSaved();

      const now = Date.now();
      if (now - lastVersionTimeRef.current >= MIN_VERSION_INTERVAL_MS) {
        lastVersionTimeRef.current = now;
        void versionService.create(projectId, chapterId).catch(() => {});
      }
    } else {
      useEditorStore.setState({ isSaving: false, isDirty: true });
    }
  }
}
