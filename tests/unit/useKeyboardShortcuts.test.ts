/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ---------- Mocks ----------

const mockToggleLeftPanel = vi.fn();
const mockToggleRightPanel = vi.fn();
const mockToggleFullscreen = vi.fn();
const mockToggleSearch = vi.fn();
const mockToggleAiPanel = vi.fn();
const mockEditorSaveContent = vi.fn();
const mockEditorMarkSaved = vi.fn();
const mockToast = vi.fn();
const mockChapterServiceSave = vi.fn();

let uiStoreState: {
  isFullscreen: boolean;
  toggleLeftPanel: typeof mockToggleLeftPanel;
  toggleRightPanel: typeof mockToggleRightPanel;
  toggleFullscreen: typeof mockToggleFullscreen;
  toggleSearch: typeof mockToggleSearch;
};

let aiStoreState: {
  togglePanel: typeof mockToggleAiPanel;
};

let editorStoreState: {
  activeChapterId: string | null;
  isDirty: boolean;
  isSaving: boolean;
  content: string;
  saveContent: typeof mockEditorSaveContent;
  markSaved: typeof mockEditorMarkSaved;
};

let projectStoreState: {
  currentProject: { id: string } | null;
};

vi.mock("@/stores/uiStore", () => {
  return {
    useUiStore: Object.assign(
      (selector: (s: any) => any) => selector(uiStoreState),
      { getState: () => uiStoreState }
    ),
  };
});

vi.mock("@/stores/aiStore", () => {
  return {
    useAiStore: Object.assign(
      (selector: (s: any) => any) => selector(aiStoreState),
      { getState: () => aiStoreState }
    ),
  };
});

vi.mock("@/stores/editorStore", () => {
  return {
    useEditorStore: Object.assign(
      (selector: (s: any) => any) => selector(editorStoreState),
      {
        getState: () => editorStoreState,
        setState: (partial: Partial<typeof editorStoreState>) => {
          editorStoreState = { ...editorStoreState, ...partial };
        },
      }
    ),
  };
});

vi.mock("@/stores/projectStore", () => {
  return {
    useProjectStore: Object.assign(
      (_selector: (s: any) => any) => _selector(projectStoreState),
      { getState: () => projectStoreState }
    ),
  };
});

vi.mock("@/services/chapterService", () => ({
  chapterService: {
    saveContent: (...args: any[]) => mockChapterServiceSave(...args),
  },
}));

vi.mock("@/stores/toastStore", () => ({
  toast: (...args: any[]) => mockToast(...args),
}));

// ---------- Import after mocks ----------

import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

// ---------- Helpers ----------

function fireKeyDown(options: Partial<KeyboardEventInit> & { key: string }) {
  const event = new KeyboardEvent("keydown", {
    key: options.key,
    ctrlKey: options.ctrlKey ?? false,
    metaKey: options.metaKey ?? false,
    shiftKey: options.shiftKey ?? false,
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(event);
  return event;
}

// ---------- Tests ----------

describe("useKeyboardShortcuts", () => {
  beforeEach(() => {
    vi.useFakeTimers();

    uiStoreState = {
      isFullscreen: false,
      toggleLeftPanel: mockToggleLeftPanel,
      toggleRightPanel: mockToggleRightPanel,
      toggleFullscreen: mockToggleFullscreen,
      toggleSearch: mockToggleSearch,
    };

    aiStoreState = {
      togglePanel: mockToggleAiPanel,
    };

    editorStoreState = {
      activeChapterId: "ch-1",
      isDirty: true,
      isSaving: false,
      content: "some content",
      saveContent: mockEditorSaveContent,
      markSaved: mockEditorMarkSaved,
    };

    projectStoreState = {
      currentProject: { id: "proj-1" },
    };

    mockToggleLeftPanel.mockReset();
    mockToggleRightPanel.mockReset();
    mockToggleFullscreen.mockReset();
    mockToggleSearch.mockReset();
    mockToggleAiPanel.mockReset();
    mockEditorSaveContent.mockReset();
    mockEditorMarkSaved.mockReset();
    mockToast.mockReset();
    mockChapterServiceSave.mockReset();
    mockChapterServiceSave.mockResolvedValue({
      success: true,
      data: null,
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---- Ctrl+S ----

  it("Ctrl+S 在脏章节时应该保存", async () => {
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown({ key: "s", ctrlKey: true });
    await vi.advanceTimersByTimeAsync(0);

    expect(mockEditorSaveContent).toHaveBeenCalled();
    expect(mockChapterServiceSave).toHaveBeenCalledWith("proj-1", "ch-1", "some content");
  });

  it("Ctrl+S 在非脏章节时不应保存", () => {
    editorStoreState.isDirty = false;
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown({ key: "s", ctrlKey: true });

    expect(mockChapterServiceSave).not.toHaveBeenCalled();
  });

  it("Ctrl+S 在 isSaving 时不应重复保存", () => {
    editorStoreState.isSaving = true;
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown({ key: "s", ctrlKey: true });

    expect(mockChapterServiceSave).not.toHaveBeenCalled();
  });

  it("Ctrl+S 在无 activeChapterId 时不应保存", () => {
    editorStoreState.activeChapterId = null;
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown({ key: "s", ctrlKey: true });

    expect(mockChapterServiceSave).not.toHaveBeenCalled();
  });

  it("Ctrl+S 在无 projectId 时不应保存", () => {
    projectStoreState.currentProject = null;
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown({ key: "s", ctrlKey: true });

    expect(mockChapterServiceSave).not.toHaveBeenCalled();
  });

  it("Ctrl+S 保存失败应显示错误提示", async () => {
    mockChapterServiceSave.mockResolvedValueOnce({
      success: false,
      data: null,
      error: "fail",
    });

    renderHook(() => useKeyboardShortcuts());
    fireKeyDown({ key: "s", ctrlKey: true });
    await vi.advanceTimersByTimeAsync(0);

    expect(mockToast).toHaveBeenCalledWith("error", "保存失败");
  });

  it("Ctrl+S 网络异常应显示错误提示", async () => {
    mockChapterServiceSave.mockRejectedValueOnce(new Error("network"));

    renderHook(() => useKeyboardShortcuts());
    fireKeyDown({ key: "s", ctrlKey: true });
    await vi.advanceTimersByTimeAsync(0);

    expect(mockToast).toHaveBeenCalledWith("error", "保存失败");
  });

  it("Ctrl+S 应阻止默认行为", () => {
    renderHook(() => useKeyboardShortcuts());
    const event = fireKeyDown({ key: "s", ctrlKey: true });

    expect(event.defaultPrevented).toBe(true);
  });

  // ---- Ctrl+Shift+F ----

  it("Ctrl+Shift+F 应触发搜索切换", () => {
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown({ key: "F", ctrlKey: true, shiftKey: true });

    expect(mockToggleSearch).toHaveBeenCalled();
  });

  it("Ctrl+Shift+F 应阻止默认行为", () => {
    renderHook(() => useKeyboardShortcuts());
    const event = fireKeyDown({ key: "F", ctrlKey: true, shiftKey: true });

    expect(event.defaultPrevented).toBe(true);
  });

  // ---- Ctrl+Shift+H ----

  it("Ctrl+Shift+H 应触发全屏切换", () => {
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown({ key: "H", ctrlKey: true, shiftKey: true });

    expect(mockToggleFullscreen).toHaveBeenCalled();
  });

  // ---- Ctrl+B ----

  it("Ctrl+B 应切换左侧面板", () => {
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown({ key: "b", ctrlKey: true });

    expect(mockToggleLeftPanel).toHaveBeenCalled();
  });

  it("Ctrl+B 应阻止默认行为", () => {
    renderHook(() => useKeyboardShortcuts());
    const event = fireKeyDown({ key: "b", ctrlKey: true });

    expect(event.defaultPrevented).toBe(true);
  });

  it("Ctrl+Shift+B 不应触发左侧面板切换（shift 不在条件中）", () => {
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown({ key: "b", ctrlKey: true, shiftKey: true });

    // Ctrl+B 的条件要求 !e.shiftKey
    expect(mockToggleLeftPanel).not.toHaveBeenCalled();
  });

  // ---- Ctrl+Shift+A ----

  it("Ctrl+Shift+A 应切换 AI 面板和右侧面板", () => {
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown({ key: "A", ctrlKey: true, shiftKey: true });

    expect(mockToggleAiPanel).toHaveBeenCalled();
    expect(mockToggleRightPanel).toHaveBeenCalled();
  });

  it("Ctrl+Shift+a（小写）也应切换 AI 面板", () => {
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown({ key: "a", ctrlKey: true, shiftKey: true });

    expect(mockToggleAiPanel).toHaveBeenCalled();
    expect(mockToggleRightPanel).toHaveBeenCalled();
  });

  // ---- Escape ----

  it("Escape 在全屏时应退出全屏", () => {
    uiStoreState.isFullscreen = true;
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown({ key: "Escape" });

    expect(mockToggleFullscreen).toHaveBeenCalled();
  });

  it("Escape 在非全屏时不应触发全屏切换", () => {
    uiStoreState.isFullscreen = false;
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown({ key: "Escape" });

    expect(mockToggleFullscreen).not.toHaveBeenCalled();
  });

  // ---- 无效按键 ----

  it("无关快捷键不应触发任何动作", () => {
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown({ key: "x", ctrlKey: true });

    expect(mockToggleLeftPanel).not.toHaveBeenCalled();
    expect(mockToggleRightPanel).not.toHaveBeenCalled();
    expect(mockToggleFullscreen).not.toHaveBeenCalled();
    expect(mockToggleSearch).not.toHaveBeenCalled();
    expect(mockToggleAiPanel).not.toHaveBeenCalled();
    expect(mockChapterServiceSave).not.toHaveBeenCalled();
  });

  it("无修饰键的按键不应触发任何动作", () => {
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown({ key: "s" });
    fireKeyDown({ key: "b" });
    fireKeyDown({ key: "F" });

    expect(mockChapterServiceSave).not.toHaveBeenCalled();
    expect(mockToggleLeftPanel).not.toHaveBeenCalled();
    expect(mockToggleSearch).not.toHaveBeenCalled();
  });

  // ---- Meta 键（macOS）----

  it("Meta+S 应等同于 Ctrl+S", async () => {
    renderHook(() => useKeyboardShortcuts());

    fireKeyDown({ key: "s", metaKey: true });
    await vi.advanceTimersByTimeAsync(0);

    expect(mockChapterServiceSave).toHaveBeenCalledWith("proj-1", "ch-1", "some content");
  });

  // ---- Cleanup ----

  it("卸载后快捷键不应再触发", () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts());

    unmount();
    fireKeyDown({ key: "b", ctrlKey: true });

    expect(mockToggleLeftPanel).not.toHaveBeenCalled();
  });
});
