import { useMemo, useState, useCallback } from "react";
import { useUiStore } from "@/stores/uiStore";
import { useEditorStore } from "@/stores/editorStore";
import { useAiStore } from "@/stores/aiStore";
import { useProjectStore } from "@/stores/projectStore";
import { useChapterContent } from "@/hooks/useChapterContent";

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  group: "action" | "nav" | "ai" | "settings";
  action: () => void;
  visible?: () => boolean;
}

const GROUP_ORDER: Record<string, number> = { action: 0, nav: 1, ai: 2, settings: 3 };
const GROUP_LABEL: Record<string, string> = { action: "操作", nav: "导航", ai: "AI", settings: "设置" };

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function useCommands() {
  const toggleSearch = useUiStore((s) => s.toggleSearch);
  const toggleFullscreen = useUiStore((s) => s.toggleFullscreen);
  const toggleFocusMode = useUiStore((s) => s.toggleFocusMode);
  const toggleLeftPanel = useUiStore((s) => s.toggleLeftPanel);
  const toggleRightPanel = useUiStore((s) => s.toggleRightPanel);
  const setActiveSkill = useAiStore((s) => s.setActiveSkill);
  const openPanel = useAiStore((s) => s.openPanel);
  const createChapter = useProjectStore((s) => s.createChapter);
  const { loadChapter } = useChapterContent();

  return useMemo<Command[]>(() => [
    {
      id: "new-chapter",
      label: "新建章节",
      group: "action",
      shortcut: "",
      action: () => void createChapter("default", undefined).then((ch) => {
        if (ch) void loadChapter(ch.id);
      }),
    },
    {
      id: "save",
      label: "保存",
      group: "action",
      shortcut: "Ctrl+S",
      visible: () => {
        const s = useEditorStore.getState();
        return !!s.activeChapterId && s.isDirty && !s.isSaving;
      },
      action: () => {
        useEditorStore.getState().saveContent();
        const s = useEditorStore.getState();
        const pid = useProjectStore.getState().currentProject?.id;
        if (pid && s.activeChapterId) {
          void import("@/services/chapterService").then(({ chapterService }) => {
            chapterService.saveContent(pid, s.activeChapterId!, s.content).then((res) => {
              if (res.success) {
                useEditorStore.getState().markSaved();
              }
            });
          });
        }
      },
    },
    {
      id: "export",
      label: "导出",
      group: "action",
      action: () => useUiStore.setState({} as Record<string, unknown>),
    },
    {
      id: "toggle-fullscreen",
      label: "全屏",
      group: "action",
      shortcut: "F11",
      action: toggleFullscreen,
    },
    {
      id: "toggle-focus",
      label: "专注模式",
      group: "action",
      shortcut: "Ctrl+Shift+Z",
      action: toggleFocusMode,
    },
    {
      id: "toggle-sidebar",
      label: "侧边栏",
      group: "nav",
      shortcut: "Ctrl+B",
      action: toggleLeftPanel,
    },
    {
      id: "search",
      label: "搜索",
      group: "nav",
      shortcut: "Ctrl+Shift+F",
      action: toggleSearch,
    },
    {
      id: "ai-panel",
      label: "AI 面板",
      group: "nav",
      shortcut: "Ctrl+Shift+A",
      action: () => { openPanel(); toggleRightPanel(); },
    },
    {
      id: "ai-continue",
      label: "AI 续写",
      group: "ai",
      visible: () => !!useEditorStore.getState().activeChapterId,
      action: () => {
        openPanel();
        toggleRightPanel();
        setActiveSkill("continue");
      },
    },
    {
      id: "ai-polish",
      label: "AI 润色",
      group: "ai",
      visible: () => !!useEditorStore.getState().activeChapterId,
      action: () => {
        openPanel();
        toggleRightPanel();
        setActiveSkill("polish");
      },
    },
    {
      id: "ai-rewrite",
      label: "AI 改写",
      group: "ai",
      visible: () => !!useEditorStore.getState().activeChapterId,
      action: () => {
        openPanel();
        toggleRightPanel();
        setActiveSkill("rewrite");
      },
    },
  ], [toggleSearch, toggleFullscreen, toggleFocusMode, toggleLeftPanel, toggleRightPanel, setActiveSkill, openPanel, createChapter, loadChapter]);
}

export function useCommandPalette(commands: Command[]) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands.filter((c) => c.visible?.() !== false);
    return commands
      .filter((c) => c.visible?.() !== false && fuzzyMatch(query, c.label))
      .sort((a, b) => {
        const aExact = a.label.toLowerCase().includes(query.toLowerCase()) ? 0 : 1;
        const bExact = b.label.toLowerCase().includes(query.toLowerCase()) ? 0 : 1;
        return aExact - bExact || (GROUP_ORDER[a.group] ?? 0) - (GROUP_ORDER[b.group] ?? 0);
      });
  }, [commands, query]);

  const moveUp = useCallback(() => {
    setActiveIndex((i) => (i > 0 ? i - 1 : filtered.length - 1));
  }, [filtered.length]);

  const moveDown = useCallback(() => {
    setActiveIndex((i) => (i < filtered.length - 1 ? i + 1 : 0));
  }, [filtered.length]);

  const execute = useCallback(() => {
    const cmd = filtered[activeIndex];
    if (cmd) {
      useUiStore.getState().closeCommandPalette();
      cmd.action();
    }
  }, [filtered, activeIndex]);

  const reset = useCallback(() => {
    setQuery("");
    setActiveIndex(0);
  }, []);

  return { query, setQuery, filtered, activeIndex, setActiveIndex, moveUp, moveDown, execute, reset, GROUP_LABEL };
}
