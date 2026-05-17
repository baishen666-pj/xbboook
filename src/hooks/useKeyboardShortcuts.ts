import { useEffect } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useUiStore } from "@/stores/uiStore";
import { useAiStore } from "@/stores/aiStore";
import { useProjectStore } from "@/stores/projectStore";
import { chapterService } from "@/services/chapterService";
import { toast } from "@/stores/toastStore";

export function useKeyboardShortcuts() {
  const toggleLeftPanel = useUiStore((s) => s.toggleLeftPanel);
  const toggleRightPanel = useUiStore((s) => s.toggleRightPanel);
  const toggleFullscreen = useUiStore((s) => s.toggleFullscreen);
  const toggleFocusMode = useUiStore((s) => s.toggleFocusMode);
  const toggleSearch = useUiStore((s) => s.toggleSearch);
  const toggleCommandPalette = useUiStore((s) => s.toggleCommandPalette);
  const togglePanel = useAiStore((s) => s.togglePanel);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;

      // Ctrl+K — command palette
      if (mod && e.key === "k") {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }

      // Ctrl+S — save current chapter
      if (mod && e.key === "s") {
        e.preventDefault();
        const state = useEditorStore.getState();
        const projectId = useProjectStore.getState().currentProject?.id;
        if (state.activeChapterId && state.isDirty && !state.isSaving && projectId) {
          useEditorStore.getState().saveContent();
          chapterService.saveContent(projectId, state.activeChapterId, state.content).then((res) => {
            if (res.success) {
              useEditorStore.getState().markSaved();
              toast("success", "已保存");
            } else {
              useEditorStore.setState({ isSaving: false, isDirty: true });
              toast("error", "保存失败");
            }
          }).catch(() => {
            useEditorStore.setState({ isSaving: false, isDirty: true });
            toast("error", "保存失败");
          });
        }
        return;
      }

      // Ctrl+Shift+F — toggle search
      if (mod && e.shiftKey && e.key === "F") {
        e.preventDefault();
        toggleSearch();
        return;
      }

      // Ctrl+Shift+H — toggle fullscreen
      if (mod && e.shiftKey && e.key === "H") {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      // F11 or Ctrl+Shift+Z — toggle focus mode
      if (e.key === "F11" || (mod && e.shiftKey && (e.key === "z" || e.key === "Z"))) {
        e.preventDefault();
        toggleFocusMode();
        return;
      }

      // Ctrl+B — toggle left sidebar
      if (mod && e.key === "b" && !e.shiftKey) {
        e.preventDefault();
        toggleLeftPanel();
        return;
      }

      // Ctrl+Shift+A — toggle AI panel
      if (mod && e.shiftKey && (e.key === "A" || e.key === "a")) {
        e.preventDefault();
        togglePanel();
        toggleRightPanel();
        return;
      }

      // Escape — close modals / exit fullscreen
      if (e.key === "Escape") {
        const uiState = useUiStore.getState();
        if (uiState.isFullscreen) {
          toggleFullscreen();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleLeftPanel, toggleRightPanel, toggleFullscreen, toggleFocusMode, toggleSearch, toggleCommandPalette, togglePanel]);
}
