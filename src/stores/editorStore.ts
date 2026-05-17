import { create } from "zustand";
import type { Editor } from "@tiptap/react";
import { editorSnapshot, type EditorSnapshot } from "@/services/editorSnapshot";

interface EditorState {
  activeChapterId: string | null;
  content: string;
  selectedText: string;
  isDirty: boolean;
  dirtyAt: number | null;
  lastSavedAt: Date | null;
  isSaving: boolean;
  editorInstance: Editor | null;
  crashSnapshot: EditorSnapshot | null;
  isCheckingCrash: boolean;
  aiEditSnapshotVersionId: string | null;
  aiEditSnapshotAt: number | null;
}

interface EditorActions {
  openChapter: (chapterId: string, content: string) => void;
  updateContent: (text: string) => void;
  saveContent: () => void;
  setSelectedText: (text: string) => void;
  clearChapter: () => void;
  markSaved: () => void;
  setEditor: (editor: Editor | null) => void;
  checkCrashRecovery: (chapterId: string, currentContent: string) => Promise<void>;
  recoverFromCrash: () => void;
  dismissCrashRecovery: () => void;
  setAiEditSnapshot: (versionId: string | null) => void;
  clearAiEditSnapshot: () => void;
}

export const useEditorStore = create<EditorState & EditorActions>(
  (set) => ({
    activeChapterId: null,
    content: "",
    selectedText: "",
    isDirty: false,
    dirtyAt: null,
    lastSavedAt: null,
    isSaving: false,
    editorInstance: null,
    crashSnapshot: null,
    isCheckingCrash: false,
    aiEditSnapshotVersionId: null,
    aiEditSnapshotAt: null,

    openChapter: (chapterId, content) => {
      set({
        activeChapterId: chapterId,
        content,
        isDirty: false,
        dirtyAt: null,
        selectedText: "",
        lastSavedAt: null,
        aiEditSnapshotVersionId: null,
        aiEditSnapshotAt: null,
      });
    },

    updateContent: (text) => {
      set((s) => ({
        content: text,
        isDirty: true,
        dirtyAt: s.dirtyAt ?? Date.now(),
        aiEditSnapshotVersionId: null,
        aiEditSnapshotAt: null,
      }));
    },

    saveContent: () => {
      set({ isSaving: true, isDirty: false, dirtyAt: null });
    },

    setSelectedText: (text) => {
      set({ selectedText: text });
    },

    clearChapter: () => {
      set({
        activeChapterId: null,
        content: "",
        isDirty: false,
        dirtyAt: null,
        selectedText: "",
      });
    },

    markSaved: () => {
      set({ isSaving: false, isDirty: false, dirtyAt: null, lastSavedAt: new Date() });
    },

    setEditor: (editor) => {
      set({ editorInstance: editor });
    },

    checkCrashRecovery: async (chapterId, currentContent) => {
      set({ isCheckingCrash: true });
      const snapshot = await editorSnapshot.load(chapterId);
      if (snapshot && snapshot.content !== currentContent && snapshot.content.length > 0) {
        set({ crashSnapshot: snapshot, isCheckingCrash: false });
      } else {
        set({ crashSnapshot: null, isCheckingCrash: false });
      }
    },

    recoverFromCrash: () => {
      const { crashSnapshot } = useEditorStore.getState();
      if (crashSnapshot) {
        set({ content: crashSnapshot.content, isDirty: true, dirtyAt: Date.now(), crashSnapshot: null });
      }
    },

    dismissCrashRecovery: () => {
      set({ crashSnapshot: null });
    },

    setAiEditSnapshot: (versionId) => {
      set({ aiEditSnapshotVersionId: versionId, aiEditSnapshotAt: versionId ? Date.now() : null });
    },

    clearAiEditSnapshot: () => {
      set({ aiEditSnapshotVersionId: null, aiEditSnapshotAt: null });
    },
  })
);
