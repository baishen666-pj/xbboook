import { useState, useEffect, useCallback, useRef } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { chapterService } from "@/services/chapterService";
import { Button } from "@/components/ui/Button";

type ChapterPolishStatus = "pending" | "processing" | "done" | "error";

interface ChapterPolishState {
  chapterId: string;
  title: string;
  status: ChapterPolishStatus;
  polishedContent: string | null;
  error: string | null;
  applied: boolean;
}

interface BatchPolishPanelProps {
  onClose: () => void;
}

export function BatchPolishPanel({ onClose }: BatchPolishPanelProps) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const chapters = useProjectStore((s) => s.chapters);
  const selectedChapterIds = useProjectStore((s) => s.selectedChapterIds);
  const clearChapterSelection = useProjectStore((s) => s.clearChapterSelection);
  const abortRef = useRef<AbortController | null>(null);
  const [chapterStates, setChapterStates] = useState<ChapterPolishState[]>(() =>
    selectedChapterIds.map((id) => {
      const chapter = chapters.find((c) => c.id === id);
      return {
        chapterId: id,
        title: chapter?.title ?? id,
        status: "pending",
        polishedContent: null,
        error: null,
        applied: false,
      };
    })
  );
  const [isRunning, setIsRunning] = useState(true);
  const [isComplete, setIsComplete] = useState(false);

  const updateChapterState = useCallback(
    (chapterId: string, update: Partial<ChapterPolishState>) => {
      setChapterStates((prev) =>
        prev.map((cs) =>
          cs.chapterId === chapterId ? { ...cs, ...update } : cs
        )
      );
    },
    []
  );

  useEffect(() => {
    if (!currentProject) return;

    const controller = new AbortController();
    abortRef.current = controller;

    async function runBatchPolish() {
      try {
        const response = await fetch("/api/ai/batch-polish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: currentProject!.id,
            chapterIds: selectedChapterIds,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await response.text();
          setChapterStates((prev) =>
            prev.map((cs) =>
              cs.status === "pending"
                ? { ...cs, status: "error", error: `请求失败: ${text.slice(0, 100)}` }
                : cs
            )
          );
          setIsRunning(false);
          setIsComplete(true);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              continue;
            }
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === "chapter_progress") {
                  const { chapterId, status, content, error } = data;
                  const update: Partial<ChapterPolishState> = { status: status as ChapterPolishStatus };
                  if (content) update.polishedContent = content;
                  if (error) update.error = error;
                  updateChapterState(chapterId, update);
                }

                if (data.type === "all_done") {
                  setIsRunning(false);
                  setIsComplete(true);
                }
              } catch {
                // skip malformed data lines
              }
            }
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Unknown error";
        setChapterStates((prev) =>
          prev.map((cs) =>
            cs.status === "pending"
              ? { ...cs, status: "error", error: message }
              : cs
          )
        );
        setIsRunning(false);
        setIsComplete(true);
      }
    }

    void runBatchPolish();

    return () => {
      controller.abort();
    };
  }, [currentProject, selectedChapterIds, updateChapterState]);

  const doneCount = chapterStates.filter((cs) => cs.status === "done").length;
  const totalCount = chapterStates.length;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  function handleCancel() {
    abortRef.current?.abort();
    setIsRunning(false);
    onClose();
  }

  async function handleApply(chapterId: string, content: string) {
    if (!currentProject) return;
    const res = await chapterService.saveContent(currentProject.id, chapterId, content);
    if (res.success) {
      updateChapterState(chapterId, { applied: true });
    }
  }

  function handleIgnore(chapterId: string) {
    updateChapterState(chapterId, { applied: true });
  }

  function handleClose() {
    clearChapterSelection();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            批量润色
          </h2>
          {!isRunning && (
            <button
              onClick={handleClose}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4l10 10M14 4L4 14" />
              </svg>
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="px-5 pt-4">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] mb-1.5">
            <span>{isRunning ? "正在处理..." : isComplete ? "处理完成" : "已取消"}</span>
            <span>{doneCount} / {totalCount}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[var(--color-surface-3)]">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Chapter list */}
        <div className="max-h-80 overflow-y-auto px-5 py-3">
          {chapterStates.map((cs) => (
            <div
              key={cs.chapterId}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 mb-1 hover:bg-[var(--color-surface-2)] transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <StatusIcon status={cs.status} />
                <span className="truncate text-sm text-[var(--color-text-primary)]">
                  {cs.title}
                </span>
              </div>

              {cs.status === "done" && !cs.applied && (
                <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void handleApply(cs.chapterId, cs.polishedContent ?? "")}
                  >
                    应用
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleIgnore(cs.chapterId)}
                  >
                    忽略
                  </Button>
                </div>
              )}

              {cs.status === "done" && cs.applied && (
                <span className="text-xs text-[var(--color-success)] flex-shrink-0 ml-2">
                  已应用
                </span>
              )}

              {cs.status === "error" && cs.error && (
                <span className="text-xs text-[var(--color-error)] truncate max-w-[120px] ml-2" title={cs.error}>
                  {cs.error}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--color-border)] px-5 py-3 flex items-center justify-between">
          {isRunning ? (
            <Button variant="danger" size="sm" onClick={handleCancel}>
              取消
            </Button>
          ) : (
            <>
              <span className="text-xs text-[var(--color-text-muted)]">
                {isComplete ? `完成 ${doneCount}/${totalCount} 个章节` : "已取消"}
              </span>
              <Button variant="primary" size="sm" onClick={handleClose}>
                关闭
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: ChapterPolishStatus }) {
  switch (status) {
    case "pending":
      return (
        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-3)]" />
      );
    case "processing":
      return (
        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
          <svg
            className="animate-spin"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
          >
            <circle
              cx="8"
              cy="8"
              r="6"
              stroke="var(--color-primary)"
              strokeWidth="2"
              strokeDasharray="12 6"
            />
          </svg>
        </span>
      );
    case "done":
      return (
        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-success)]">
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2">
            <path d="M2 6l3 3 5-5" />
          </svg>
        </span>
      );
    case "error":
      return (
        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-error)]">
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2">
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </span>
      );
  }
}
