import { useState, useEffect } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { contentAnalysisService, type ContentAnalysis } from "@/services/contentAnalysisService";

function MetricCard({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string | number;
  unit?: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="text-[10px] text-white/25">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-lg font-semibold" style={{ color }}>{value}</span>
        {unit && <span className="text-[10px] text-white/25">{unit}</span>}
      </div>
    </div>
  );
}

function ParagraphChart({ lengths }: { lengths: number[] }) {
  if (lengths.length === 0) return null;
  const max = Math.max(...lengths, 1);
  return (
    <div className="flex items-end gap-px h-16">
      {lengths.slice(0, 50).map((len, i) => (
        <div
          key={i}
          className="flex-1 rounded-t bg-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/60 transition-colors"
          style={{ height: `${Math.max(2, (len / max) * 64)}px` }}
          title={`${len} 字`}
        />
      ))}
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 7) return "#4ade80";
  if (score >= 4) return "#facc15";
  return "#f87171";
}

export function ContentInsightPanel() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const [analysis, setAnalysis] = useState<ContentAnalysis | null>(null);

  useEffect(() => {
    if (!currentProject) return;
    const controller = new AbortController();
    contentAnalysisService
      .getAnalysis(currentProject.id, activeChapterId ?? undefined)
      .then((data) => {
        if (!controller.signal.aborted) setAnalysis(data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [currentProject, activeChapterId]);

  if (!analysis) {
    return (
      <div className="py-6 text-center text-xs text-white/20">
        加载中...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="可读性"
          value={analysis.readabilityScore}
          unit="/ 10"
          color={scoreColor(analysis.readabilityScore)}
        />
        <MetricCard
          label="节奏感"
          value={analysis.rhythmScore}
          unit="/ 10"
          color={scoreColor(analysis.rhythmScore)}
        />
        <MetricCard
          label="对话占比"
          value={analysis.dialogueRatio}
          unit="%"
          color="#60a5fa"
        />
        <MetricCard
          label="词汇多样性"
          value={analysis.vocabularyDiversity}
          unit="%"
          color="#a78bfa"
        />
      </div>

      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-white/25">段落分析</span>
          <span className="text-[10px] text-white/20">
            均长 {analysis.avgParagraphLength} 字 · 最长 {analysis.longestParagraph} · 最短 {analysis.shortestParagraph}
          </span>
        </div>
        <ParagraphChart lengths={analysis.paragraphLengths} />
      </div>
    </div>
  );
}
