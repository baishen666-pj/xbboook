import { useCallback } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";

export function useChapterContent() {
  const openChapterInStore = useProjectStore((s) => s.openChapter);

  const loadChapter = useCallback(
    async (chapterId: string) => {
      const chapter = await openChapterInStore(chapterId);
      if (chapter) {
        useEditorStore.getState().openChapter(chapter.id, chapter.content);
      }
    },
    [openChapterInStore]
  );

  return { loadChapter };
}
