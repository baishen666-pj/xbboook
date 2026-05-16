/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { act } from "@testing-library/react";

// ---------- Mocks ----------

const mockOpenChapter = vi.fn();
const mockEditorOpenChapter = vi.fn();

let projectStoreState: {
  openChapter: typeof mockOpenChapter;
};

vi.mock("@/stores/projectStore", () => {
  return {
    useProjectStore: (_selector: (s: any) => any) => _selector(projectStoreState),
  };
});

vi.mock("@/stores/editorStore", () => {
  return {
    useEditorStore: {
      getState: () => ({
        openChapter: mockEditorOpenChapter,
      }),
    },
  };
});

// ---------- Import after mocks ----------

import { useChapterContent } from "@/hooks/useChapterContent";

// ---------- Tests ----------

describe("useChapterContent", () => {
  beforeEach(() => {
    mockOpenChapter.mockReset();
    mockEditorOpenChapter.mockReset();
    projectStoreState = { openChapter: mockOpenChapter };
  });

  // ---- Happy path ----

  it("loadChapter 应获取章节数据并打开编辑器", async () => {
    const chapter = { id: "ch-42", content: "章节内容..." };
    mockOpenChapter.mockResolvedValueOnce(chapter);

    const { result } = renderHook(() => useChapterContent());

    await act(async () => {
      await result.current.loadChapter("ch-42");
    });

    expect(mockOpenChapter).toHaveBeenCalledWith("ch-42");
    expect(mockEditorOpenChapter).toHaveBeenCalledWith("ch-42", "章节内容...");
  });

  it("loadChapter 返回的章节 id 应正确传给 editorStore", async () => {
    const chapter = { id: "abc-123", content: "测试内容" };
    mockOpenChapter.mockResolvedValueOnce(chapter);

    const { result } = renderHook(() => useChapterContent());

    await act(async () => {
      await result.current.loadChapter("abc-123");
    });

    expect(mockEditorOpenChapter).toHaveBeenCalledWith("abc-123", "测试内容");
  });

  // ---- openChapter 返回 null ----

  it("openChapter 返回 null 时不应调用 editorStore.openChapter", async () => {
    mockOpenChapter.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useChapterContent());

    await act(async () => {
      await result.current.loadChapter("ch-nonexistent");
    });

    expect(mockOpenChapter).toHaveBeenCalledWith("ch-nonexistent");
    expect(mockEditorOpenChapter).not.toHaveBeenCalled();
  });

  // ---- openChapter 抛出异常 ----

  it("openChapter 抛出异常时 loadChapter 应冒泡错误", async () => {
    mockOpenChapter.mockRejectedValueOnce(new Error("网络错误"));

    const { result } = renderHook(() => useChapterContent());

    await expect(
      act(async () => {
        await result.current.loadChapter("ch-err");
      })
    ).rejects.toThrow("网络错误");

    expect(mockEditorOpenChapter).not.toHaveBeenCalled();
  });

  // ---- 空内容 ----

  it("章节内容为空字符串时应正常处理", async () => {
    const chapter = { id: "ch-empty", content: "" };
    mockOpenChapter.mockResolvedValueOnce(chapter);

    const { result } = renderHook(() => useChapterContent());

    await act(async () => {
      await result.current.loadChapter("ch-empty");
    });

    expect(mockEditorOpenChapter).toHaveBeenCalledWith("ch-empty", "");
  });

  // ---- 多次调用 ----

  it("连续调用 loadChapter 应按序执行", async () => {
    const ch1 = { id: "ch-1", content: "内容1" };
    const ch2 = { id: "ch-2", content: "内容2" };
    mockOpenChapter
      .mockResolvedValueOnce(ch1)
      .mockResolvedValueOnce(ch2);

    const { result } = renderHook(() => useChapterContent());

    await act(async () => {
      await result.current.loadChapter("ch-1");
      await result.current.loadChapter("ch-2");
    });

    expect(mockOpenChapter).toHaveBeenCalledTimes(2);
    expect(mockEditorOpenChapter).toHaveBeenCalledTimes(2);
    expect(mockEditorOpenChapter).toHaveBeenNthCalledWith(1, "ch-1", "内容1");
    expect(mockEditorOpenChapter).toHaveBeenNthCalledWith(2, "ch-2", "内容2");
  });

  // ---- 返回值稳定性 ----

  it("多次渲染 loadChapter 引用应保持稳定", () => {
    const { result, rerender } = renderHook(() => useChapterContent());
    const firstRef = result.current.loadChapter;

    rerender();
    const secondRef = result.current.loadChapter;

    // 因为 useCallback 依赖 openChapterInStore (mock) 不变，引用应该稳定
    expect(firstRef).toBe(secondRef);
  });
});
