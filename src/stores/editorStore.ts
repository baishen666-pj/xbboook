import { create } from "zustand";
import type { Editor } from "@tiptap/react";

interface EditorState {
  activeChapterId: string | null;
  content: string;
  selectedText: string;
  isDirty: boolean;
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
    lastSavedAt: null,
    isSaving: false,
    editorInstance: null,

    openChapter: (chapterId, content) => {
      set({
        activeChapterId: chapterId,
        content,
        isDirty: false,
        selectedText: "",
        lastSavedAt: null,
      });
    },

    updateContent: (text) => {
      set({ content: text, isDirty: true });
    },

    saveContent: () => {
      set({ isSaving: true, isDirty: false });
    },

    setSelectedText: (text) => {
      set({ selectedText: text });
    },

    clearChapter: () => {
      set({
        activeChapterId: null,
        content: "",
        isDirty: false,
        selectedText: "",
      });
    },

    markSaved: () => {
      set({ isSaving: false, isDirty: false, lastSavedAt: new Date() });
    },

    setEditor: (editor) => {
      set({ editorInstance: editor });
    },
  })
);
