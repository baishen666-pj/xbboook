import { useState, useCallback } from "react";
import { useProjectStore } from "@/stores/projectStore";

type WizardStep = "concept" | "genre" | "characters" | "world" | "plot" | "review";

interface StepResult {
  content: string;
  loading: boolean;
}

const STEPS: Array<{ key: WizardStep; label: string; icon: string }> = [
  { key: "concept", label: "故事概念", icon: "💡" },
  { key: "genre", label: "类型风格", icon: "🎭" },
  { key: "characters", label: "角色设计", icon: "👥" },
  { key: "world", label: "世界观", icon: "🌍" },
  { key: "plot", label: "情节大纲", icon: "📐" },
  { key: "review", label: "汇总确认", icon: "✅" },
];

const SKILL_MAP: Record<string, string> = {
  genre: "outline-wizard-genre",
  characters: "outline-wizard-characters",
  world: "outline-wizard-world",
  plot: "outline-wizard-plot",
};

export function OutlineWizard({ onClose }: { onClose?: () => void }) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const [step, setStep] = useState<WizardStep>("concept");
  const [concept, setConcept] = useState("");
  const [results, setResults] = useState<Record<string, StepResult>>({});
  const [error, setError] = useState<string | null>(null);

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  const generateStep = useCallback(
    async (targetStep: WizardStep) => {
      if (!currentProject) return;
      const skillId = SKILL_MAP[targetStep];
      if (!skillId) return;

      setResults((prev) => ({ ...prev, [targetStep]: { content: prev[targetStep]?.content || "", loading: true } }));
      setError(null);

      // Build context from previous steps
      const contextParts: string[] = [`故事概念: ${concept}`];
      if (results.genre?.content) contextParts.push(`类型风格:\n${results.genre.content}`);
      if (results.characters?.content) contextParts.push(`角色设计:\n${results.characters.content}`);
      if (results.world?.content) contextParts.push(`世界观:\n${results.world.content}`);

      try {
        const res = await fetch("/api/ai/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: currentProject.id,
            skillId,
            customInstruction: contextParts.join("\n\n"),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "生成失败");
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("无法读取流");

        const decoder = new TextDecoder();
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  fullContent += data.content;
                  setResults((prev) => ({
                    ...prev,
                    [targetStep]: { content: fullContent, loading: true },
                  }));
                }
              } catch { /* skip malformed SSE */ }
            }
          }
        }

        setResults((prev) => ({
          ...prev,
          [targetStep]: { content: fullContent, loading: false },
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "生成失败");
        setResults((prev) => ({
          ...prev,
          [targetStep]: { ...prev[targetStep]!, loading: false },
        }));
      }
    },
    [currentProject, concept, results],
  );

  const handleNext = () => {
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) {
      const nextStep = STEPS[nextIndex].key;
      setStep(nextStep);
      if (nextStep !== "review" && !results[nextStep]?.content) {
        generateStep(nextStep);
      }
    }
  };

  const handlePrev = () => {
    if (stepIndex > 0) {
      setStep(STEPS[stepIndex - 1].key);
    }
  };

  const handleSave = async () => {
    if (!currentProject) return;
    // Save concept as outline
    const parts = [
      concept && `## 故事概念\n${concept}`,
      results.genre?.content && `## 类型风格\n${results.genre.content}`,
      results.characters?.content && `## 角色设计\n${results.characters.content}`,
      results.world?.content && `## 世界观\n${results.world.content}`,
      results.plot?.content && `## 情节大纲\n${results.plot.content}`,
    ].filter(Boolean);

    try {
      await fetch(`/api/projects/${currentProject.id}/outlines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `AI大纲 - ${concept.slice(0, 30)}`,
          content: parts.join("\n\n"),
          level: 0,
        }),
      });
      onClose?.();
    } catch { /* ignore */ }
  };

  const isGenerating = results[step]?.loading;
  const currentContent = results[step]?.content || "";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">AI 大纲向导</h2>
        {onClose && (
          <button onClick={onClose} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            x
          </button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--color-border)]">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => {
              if (i <= stepIndex || results[s.key]?.content) setStep(s.key);
            }}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition-colors ${
              i === stepIndex
                ? "bg-[var(--color-primary)] text-white"
                : results[s.key]?.content
                  ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                  : "text-[var(--color-text-muted)]"
            }`}
          >
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-4">
        {step === "concept" && (
          <div className="space-y-3">
            <label className="text-xs text-[var(--color-text-secondary)]">
              用一句话描述你的故事概念
            </label>
            <textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="例如：一个普通高中生意外获得了穿越时空的能力，在各个历史节点修复被篡改的关键事件..."
              className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm text-[var(--color-text-primary)] resize-none"
              rows={4}
            />
          </div>
        )}

        {step !== "concept" && step !== "review" && (
          <div className="space-y-2">
            {isGenerating && !currentContent && (
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <div className="animate-spin h-3 w-3 border-2 border-[var(--color-primary)] border-t-transparent rounded-full" />
                AI 正在生成...
              </div>
            )}
            <pre className="whitespace-pre-wrap text-xs text-[var(--color-text-secondary)] font-sans leading-relaxed">
              {currentContent}
            </pre>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            {STEPS.slice(1, -1).map((s) =>
              results[s.key]?.content ? (
                <div key={s.key} className="space-y-1">
                  <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">
                    {s.icon} {s.label}
                  </h4>
                  <pre className="whitespace-pre-wrap text-[11px] text-[var(--color-text-secondary)] font-sans leading-relaxed rounded-lg bg-[var(--color-bg-secondary)] p-3">
                    {results[s.key]!.content}
                  </pre>
                </div>
              ) : null,
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 py-1 text-xs text-[var(--color-error)]">{error}</div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-2">
        <button
          onClick={handlePrev}
          disabled={stepIndex === 0}
          className="rounded px-3 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-30"
        >
          上一步
        </button>
        <div className="flex gap-2">
          {step !== "concept" && step !== "review" && !results[step]?.content && (
            <button
              onClick={() => generateStep(step)}
              disabled={isGenerating}
              className="rounded px-3 py-1 text-xs text-[var(--color-primary)] hover:opacity-80"
            >
              {isGenerating ? "生成中..." : "重新生成"}
            </button>
          )}
          {step === "review" ? (
            <button
              onClick={handleSave}
              className="rounded bg-[var(--color-success)] px-4 py-1 text-xs text-white hover:opacity-90"
            >
              保存到大纲
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={step === "concept" ? !concept.trim() : isGenerating}
              className="rounded bg-[var(--color-primary)] px-4 py-1 text-xs text-white hover:opacity-90 disabled:opacity-40"
            >
              下一步
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
