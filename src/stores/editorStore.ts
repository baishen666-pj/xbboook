import { create } from "zustand";
import type { Editor } from "@tiptap/react";

interface EditorState {
  activeChapterId: string | null;
  content: string;
  selectedText: string;
  isDirty: boolean;
  dirtyAt: number | null;
  lastSavedAt: Date | null;
  isSaving: boolean;
  editorInstance: Editor | null;
}

interface EditorActions {
  openChapter: (chapterId: string, content: string) => void;
  updateContent: (text: string) => void;
  saveContent: () => void;
  setSelectedText: (text: string) => void;
  clearChapter: () => void;
  markSaved: () => void;
  setEditor: (editor: Editor | null) => void;
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

    openChapter: (chapterId, content) => {
      set({
        activeChapterId: chapterId,
        content,
        isDirty: false,
        dirtyAt: null,
        selectedText: "",
        lastSavedAt: null,
      });
    },

    updateContent: (text) => {
      set((s) => ({
        content: text,
        isDirty: true,
        dirtyAt: s.dirtyAt ?? Date.now(),
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
  })
);
