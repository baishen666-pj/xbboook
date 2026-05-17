import { useState, useCallback, useRef } from "react";
import { apiClient } from "@/services/apiClient";
import { useEditorStore } from "@/stores/editorStore";

interface Step {
  id: string;
  type: "generate" | "consistency_check" | "polish";
  chapterId?: string;
  chapterTitle?: string;
  status: "pending" | "running" | "done" | "skipped" | "error";
  result?: string;
  error?: string;
}

interface Job {
  id: string;
  status: "pending" | "running" | "paused" | "done" | "error";
  currentStep: number;
  totalSteps: number;
  steps: Step[];
}

export function OrchestratorPanel({ projectId }: { projectId: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const handleCreate = useCallback(async () => {
    const chapterId = useEditorStore.getState().activeChapterId;
    if (!chapterId) return;

    setLogs(["创建编排任务..."]);
    setJob(null);
    setRunning(false);

    const res = await apiClient.post<Job>(`/projects/${projectId}/orchestrator`, {
      chapterIds: [chapterId],
    });

    if (res.success && res.data) {
      setJob(res.data);
      setLogs((l) => [...l, `任务已创建: ${res.data!.totalSteps} 步`]);
    }
  }, [projectId]);

  const handleRun = useCallback(async () => {
    if (!job) return;

    setRunning(true);
    setLogs((l) => [...l, "开始执行..."]);
    abortRef.current = new AbortController();

    try {
      const response = await fetch(`/api/projects/${projectId}/orchestrator/${job.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        setLogs((l) => [...l, `错误: ${response.status}`]);
        setRunning(false);
        return;
      }

      const body = response.body;
      if (!body) { setRunning(false); return; }

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          let eventType = "";
          let dataStr = "";
          for (const line of part.split("\n")) {
            if (line.startsWith("event: ")) eventType = line.slice(7);
            else if (line.startsWith("data: ")) dataStr = line.slice(6);
          }
          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);
            if (eventType === "step_start") {
              const step = job.steps[data.stepIndex];
              setLogs((l) => [...l, `▶ 步骤 ${data.stepIndex + 1}: ${step?.chapterTitle || step?.type || ""}...`]);
            } else if (eventType === "step_done") {
              setLogs((l) => [...l, `✓ 步骤 ${data.stepIndex + 1} 完成`]);
              setJob((j) => j ? { ...j, steps: j.steps.map((s, i) => i === data.stepIndex ? { ...s, status: "done" as const } : s), currentStep: data.stepIndex + 1 } : j);
            } else if (eventType === "step_error") {
              setLogs((l) => [...l, `✗ 步骤 ${data.stepIndex + 1} 失败: ${data.error}`]);
            } else if (eventType === "job_done") {
              setLogs((l) => [...l, "=== 全部完成 ==="]);
              setJob((j) => j ? { ...j, status: "done" } : j);
            } else if (eventType === "paused") {
              setLogs((l) => [...l, "⏸ 已暂停"]);
              setJob((j) => j ? { ...j, status: "paused" } : j);
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setLogs((l) => [...l, `错误: ${err.message}`]);
      }
    }

    setRunning(false);
  }, [job, projectId]);

  const handlePause = useCallback(async () => {
    if (!job) return;
    await apiClient.post(`/projects/${projectId}/orchestrator/${job.id}/pause`, {});
    setLogs((l) => [...l, "请求暂停..."]);
  }, [job, projectId]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
    setLogs((l) => [...l, "已停止"]);
  }, []);

  return (
    <div className="p-3 space-y-3">
      {/* Create job */}
      {!job && (
        <button
          onClick={() => void handleCreate()}
          className="w-full rounded px-3 py-1.5 text-[var(--text-sm)] bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
        >
          为当前章节创建编排任务
        </button>
      )}

      {/* Job info */}
      {job && (
        <div className="space-y-2">
          {/* Progress */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-[var(--color-surface-hover)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--color-primary)] rounded-full transition-all"
                style={{ width: `${job.totalSteps > 0 ? (job.currentStep / job.totalSteps) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)]">{job.currentStep}/{job.totalSteps}</span>
          </div>

          {/* Steps list */}
          <div className="space-y-0.5">
            {job.steps.map((step) => (
              <div key={step.id} className="flex items-center gap-2 text-[10px]">
                <span className={step.status === "done" ? "text-green-400" : step.status === "running" ? "text-yellow-400" : step.status === "error" ? "text-red-400" : "text-[var(--color-text-muted)]"}>
                  {step.status === "done" ? "✓" : step.status === "running" ? "▶" : step.status === "error" ? "✗" : "○"}
                </span>
                <span className="text-[var(--color-text-secondary)]">
                  {step.type === "generate" ? `生成: ${step.chapterTitle}` : step.type === "consistency_check" ? "一致性检查" : `润色: ${step.chapterTitle}`}
                </span>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex gap-1">
            {!running && job.status !== "done" && (
              <button onClick={() => void handleRun()} className="flex-1 rounded px-2 py-1 text-xs bg-[var(--color-primary)] text-white hover:opacity-90">
                {job.status === "paused" ? "继续" : "开始执行"}
              </button>
            )}
            {running && (
              <>
                <button onClick={() => void handlePause()} className="flex-1 rounded px-2 py-1 text-xs bg-yellow-600 text-white hover:opacity-90">暂停</button>
                <button onClick={handleStop} className="flex-1 rounded px-2 py-1 text-xs bg-red-600 text-white hover:opacity-90">停止</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="rounded bg-[var(--color-surface-hover)] p-2 max-h-40 overflow-y-auto">
          {logs.map((log) => (
            <div key={log} className="text-[10px] text-[var(--color-text-muted)] font-mono">{log}</div>
          ))}
        </div>
      )}
    </div>
  );
}
