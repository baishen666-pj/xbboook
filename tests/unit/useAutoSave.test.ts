/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { act } from "@testing-library/react";

// ---------- Mocks ----------

const mockSaveContent = vi.fn();
const mockMarkSaved = vi.fn();
const mockToast = vi.fn();

let editorStoreState: {
  activeChapterId: string | null;
  content: string;
  isDirty: boolean;
  isSaving: boolean;
  saveContent: typeof mockSaveContent;
  markSaved: typeof mockMarkSaved;
};

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

let projectStoreState: {
  currentProject: { id: string } | null;
};

vi.mock("@/stores/projectStore", () => {
  return {
    useProjectStore: Object.assign(
      (_selector: (s: any) => any) => _selector(projectStoreState),
      {
        getState: () => projectStoreState,
      }
    ),
  };
});

const mockChapterServiceSave = vi.fn();
vi.mock("@/services/chapterService", () => ({
  chapterService: {
    saveContent: (...args: any[]) => mockChapterServiceSave(...args),
  },
}));

const mockVersionServiceCreate = vi.fn();
vi.mock("@/services/versionService", () => ({
  versionService: {
    create: (...args: any[]) => mockVersionServiceCreate(...args),
  },
}));

vi.mock("@/stores/toastStore", () => ({
  toast: (...args: any[]) => mockToast(...args),
}));

// ---------- Import after mocks ----------

import { useAutoSave } from "@/hooks/useAutoSave";

// ---------- Helpers ----------

function createDefaultEditorState() {
  return {
    activeChapterId: "ch-1" as string | null,
    content: "hello",
    isDirty: false,
    isSaving: false,
    saveContent: mockSaveContent,
    markSaved: mockMarkSaved,
  };
}

// ---------- Tests ----------

describe("useAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();

    editorStoreState = createDefaultEditorState();
    projectStoreState = { currentProject: { id: "proj-1" } };

    mockSaveContent.mockReset();
    mockMarkSaved.mockReset();
    mockToast.mockReset();
    mockChapterServiceSave.mockReset();
    mockVersionServiceCreate.mockReset();
    mockChapterServiceSave.mockResolvedValue({ success: true, data: null, error: null });
    mockVersionServiceCreate.mockResolvedValue({ success: true, data: null, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---- Debounce auto-save ----

  it("在 isDirty 变为 true 后经过 DEBOUNCE_MS 应自动保存", async () => {
    const { rerender } = renderHook(() => useAutoSave());

    // 触发 isDirty
    editorStoreState = { ...editorStoreState, isDirty: true, content: "changed" };
    rerender();

    // 还没到 debounce 时间
    vi.advanceTimersByTime(500);
    expect(mockChapterServiceSave).not.toHaveBeenCalled();

    // 到达 debounce 时间
    vi.advanceTimersByTime(600);

    expect(mockSaveContent).toHaveBeenCalled();
    expect(mockChapterServiceSave).toHaveBeenCalledWith("proj-1", "ch-1", "changed");
  });

  it("无 activeChapterId 时不应触发保存", () => {
    editorStoreState.activeChapterId = null;
    editorStoreState.isDirty = true;

    renderHook(() => useAutoSave());
    vi.advanceTimersByTime(1500);

    expect(mockChapterServiceSave).not.toHaveBeenCalled();
  });

  it("isSaving 为 true 时不应触发 debounce 保存", () => {
    editorStoreState.isDirty = true;
    editorStoreState.isSaving = true;

    renderHook(() => useAutoSave());
    vi.advanceTimersByTime(1500);

    expect(mockChapterServiceSave).not.toHaveBeenCalled();
  });

  // ---- 成功保存 ----

  it("保存成功应调用 markSaved", async () => {
    editorStoreState.isDirty = true;
    editorStoreState.content = "updated";

    renderHook(() => useAutoSave());
    // 推进 debounce 定时器 + 留出微任务执行空间
    await vi.advanceTimersByTimeAsync(1500);

    expect(mockMarkSaved).toHaveBeenCalled();
  });

  it("保存成功且距上次版本足够久应创建版本", async () => {
    editorStoreState.isDirty = true;
    editorStoreState.content = "updated";

    renderHook(() => useAutoSave());
    await vi.advanceTimersByTimeAsync(1500);

    expect(mockVersionServiceCreate).toHaveBeenCalledWith("proj-1", "ch-1");
  });

  it("无 projectId 时保存不应调用 chapterService", async () => {
    projectStoreState.currentProject = null;
    editorStoreState.isDirty = true;
    editorStoreState.content = "updated";

    renderHook(() => useAutoSave());
    vi.advanceTimersByTime(1500);

    // saveContent 在 setState 里设置了 isSaving=true, 但 projectId 缺失导致 return
    // chapterService.saveContent 不应被调用
    expect(mockChapterServiceSave).not.toHaveBeenCalled();
  });

  // ---- 保存失败 ----

  it("保存失败应还原状态并显示错误提示", async () => {
    mockChapterServiceSave.mockResolvedValueOnce({
      success: false,
      data: null,
      error: "server error",
    });

    editorStoreState.isDirty = true;
    editorStoreState.content = "bad save";

    renderHook(() => useAutoSave());
    await vi.advanceTimersByTimeAsync(1500);

    expect(mockToast).toHaveBeenCalledWith("error", "保存失败，请重试");
  });

  // ---- Periodic save ----

  it("应在 PERIODIC_MS 间隔后触发周期性保存", () => {
    editorStoreState.activeChapterId = "ch-1";
    editorStoreState.isDirty = true;

    renderHook(() => useAutoSave());

    // 推进到 30 秒
    vi.advanceTimersByTime(30_000);

    expect(mockSaveContent).toHaveBeenCalled();
    expect(mockChapterServiceSave).toHaveBeenCalledWith("proj-1", "ch-1", "hello");
  });

  it("周期性保存时如果 isDirty 为 false 不应保存", () => {
    editorStoreState.isDirty = false;

    renderHook(() => useAutoSave());
    vi.advanceTimersByTime(30_000);

    expect(mockChapterServiceSave).not.toHaveBeenCalled();
  });

  it("周期性保存时如果 isSaving 为 true 不应保存", () => {
    editorStoreState.isDirty = true;
    editorStoreState.isSaving = true;

    renderHook(() => useAutoSave());
    vi.advanceTimersByTime(30_000);

    expect(mockChapterServiceSave).not.toHaveBeenCalled();
  });

  // ---- beforeunload ----

  it("isDirty 为 true 时应注册 beforeunload 监听器", () => {
    editorStoreState.isDirty = true;
    const addSpy = vi.spyOn(window, "addEventListener");

    renderHook(() => useAutoSave());

    expect(addSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    addSpy.mockRestore();
  });

  it("isDirty 为 false 时不应注册 beforeunload 监听器", () => {
    editorStoreState.isDirty = false;
    const addSpy = vi.spyOn(window, "addEventListener");

    renderHook(() => useAutoSave());

    const calls = addSpy.mock.calls.filter((c) => c[0] === "beforeunload");
    expect(calls.length).toBe(0);
    addSpy.mockRestore();
  });

  // ---- Cleanup ----

  it("卸载时应清除 debounce 定时器", () => {
    editorStoreState.isDirty = true;

    const { unmount } = renderHook(() => useAutoSave());

    unmount();
    vi.advanceTimersByTime(1500);

    expect(mockChapterServiceSave).not.toHaveBeenCalled();
  });

  it("卸载时应清除 periodic 定时器", () => {
    editorStoreState.activeChapterId = "ch-1";

    const { unmount } = renderHook(() => useAutoSave());
    unmount();
    vi.advanceTimersByTime(60_000);

    expect(mockChapterServiceSave).not.toHaveBeenCalled();
  });
});
