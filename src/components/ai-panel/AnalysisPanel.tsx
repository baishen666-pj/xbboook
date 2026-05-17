// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { analysisService, type QuickStats } from "@/services/analysisService";

interface AnalysisTypeInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
}

const ANALYSIS_TYPES: AnalysisTypeInfo[] = [
  { id: "story-analysis", name: "故事结构", icon: "📐", description: "三幕结构、转折点、高潮" },
  { id: "pacing-analysis", name: "节奏分析", icon: "📊", description: "节奏检测、拖沓段落" },
  { id: "emotion-arc", name: "情感曲线", icon: "📈", description: "情感走向、强度曲线" },
  { id: "character-arc", name: "角色弧线", icon: "🎭", description: "角色成长、变化轨迹" },
  { id: "outline-generate", name: "大纲生成", icon: "🗺️", description: "反向生成结构化大纲" },
];

interface Props {
  projectId: string;
}

export function AnalysisPanel({ projectId }: Props) {
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [selectedType, setSelectedType] = useState<string>("story-analysis");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    const res = await analysisService.quickStats(projectId);
    if (res.success && res.data) setStats(res.data);
  }, [projectId]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    setResult(null);

    const res = await analysisService.run(projectId, selectedType);
    if (res.success && res.data) {
      setResult(res.data.result);
    } else {
      setError(res.error || "分析失败");
    }
    setAnalyzing(false);
  };

  const renderResult = () => {
    if (!result || typeof result !== "object") return null;
    const r = result as Record<string, any>;

    // Story structure
    if (r.acts) {
      return <StoryStructureView data={r} />;
    }
    // Pacing
    if (r.chapter_analyses) {
      return <PacingView data={r} />;
    }
    // Emotion arc
    if (r.chapters && Array.isArray(r.chapters) && (r.chapters[0] as Record<string, any>)?.dominant_emotion) {
      return <EmotionArcView data={r} />;
    }
    // Character arc
    if (r.characters && Array.isArray(r.characters)) {
      return <CharacterArcView data={r} />;
    }
    // Outline
    if (r.volumes) {
      return <OutlineView data={r} />;
    }
    // Fallback
    return <pre className="text-[var(--text-xs)] text-[var(--color-text-secondary)] whitespace-pre-wrap overflow-auto max-h-60">{JSON.stringify(result, null, 2)}</pre>;
  };

  return (
    <div className="p-3 space-y-3">
      {/* Quick stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded bg-[var(--color-surface-hover)] p-2 text-center">
            <div className="text-[var(--text-lg)] font-bold text-[var(--color-primary)]">{stats.totalChapters}</div>
            <div className="text-[var(--text-xs)] text-[var(--color-text-muted)]">章节</div>
          </div>
          <div className="rounded bg-[var(--color-surface-hover)] p-2 text-center">
            <div className="text-[var(--text-lg)] font-bold text-[var(--color-primary)]">{(stats.totalWords / 10000).toFixed(1)}万</div>
            <div className="text-[var(--text-xs)] text-[var(--color-text-muted)]">总字数</div>
          </div>
          <div className="rounded bg-[var(--color-surface-hover)] p-2 text-center">
            <div className="text-[var(--text-lg)] font-bold text-[var(--color-primary)]">{stats.avgWordsPerChapter}</div>
            <div className="text-[var(--text-xs)] text-[var(--color-text-muted)]">字/章</div>
          </div>
        </div>
      )}

      {/* Word distribution chart */}
      {stats && stats.chapters.length > 0 && (
        <div className="rounded bg-[var(--color-surface-hover)] p-2">
          <div className="text-[var(--text-xs)] text-[var(--color-text-muted)] mb-1">章节字数分布</div>
          <WordBarChart chapters={stats.chapters} />
        </div>
      )}

      {/* Analysis type selector */}
      <div className="flex flex-wrap gap-1">{" "}
        {ANALYSIS_TYPES.map(t => (
          <button
            key={t.id}
            onClick={() => setSelectedType(t.id)}
            className={`rounded px-2 py-1 text-[var(--text-xs)] transition-colors ${
              selectedType === t.id
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:opacity-80"
            }`}
            title={t.description}
          >
            {String(t.icon)} {t.name}
          </button>
        ))}
      </div>

      {/* Analyze button */}
      <button
        onClick={() => void handleAnalyze()}
        disabled={analyzing}
        className="w-full rounded px-3 py-1.5 text-[var(--text-sm)] bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {analyzing ? "分析中...（可能需要 10-30 秒）" : `开始${ANALYSIS_TYPES.find(t => t.id === selectedType)?.name || "分析"}`}
      </button>

      {/* Error */}
      {error && (
        <div className="rounded bg-red-500/10 px-2.5 py-1.5 text-[var(--text-xs)] text-red-400">{error}</div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded border border-[var(--color-border)] p-2 space-y-2">
          <div className="text-[var(--text-xs)] font-medium text-[var(--color-text-primary)]">
            {ANALYSIS_TYPES.find(t => t.id === selectedType)?.icon} 分析结果
          </div>
          {renderResult()}
        </div>
      )}
    </div>
  );
}

function WordBarChart({ chapters }: { chapters: Array<{ wordCount: number; title: string }> }) {
  const maxWords = Math.max(...chapters.map(c => c.wordCount), 1);
  return (
    <div className="flex items-end gap-px h-12">
      {chapters.slice(0, 50).map((c, i) => (
        <div
          key={i}
          className="flex-1 bg-[var(--color-primary)] rounded-t-sm min-w-[2px] transition-all hover:opacity-80"
          style={{ height: `${(c.wordCount / maxWords) * 100}%` }}
          title={`${c.title}: ${c.wordCount}字`}
        />
      ))}
    </div>
  );
}

function StoryStructureView({ data }: { data: Record<string, any> }) {
  const acts = (data.acts as Array<Record<string, any>>) || [];
  const turningPoints = (data.turning_points as Array<Record<string, any>>) || [];
  const strengths = (data.strengths as string[]) || [];
  const weaknesses = (data.weaknesses as string[]) || [];
  const suggestions = (data.suggestions as string[]) || [];

  return (
    <div className="space-y-2 text-[var(--text-xs)]">
      {data.structure_type && (
        <div className="text-[var(--color-text-primary)] font-medium">结构类型: {data.structure_type as string}</div>
      )}
      {acts.map((act, i) => (
        <div key={i} className="rounded bg-[var(--color-surface-hover)] p-1.5">
          <div className="font-medium text-[var(--color-text-primary)]">{act.name as string}</div>
          <div className="text-[var(--color-text-secondary)]">{act.description as string}</div>
          {act.chapters && <div className="text-[var(--color-text-muted)]">章节: {act.chapters as string}</div>}
        </div>
      ))}
      {turningPoints.length > 0 && (
        <div>
          <div className="font-medium text-[var(--color-text-primary)]">转折点</div>
          {turningPoints.map((tp, i) => (
            <div key={i} className="text-[var(--color-text-secondary)] pl-2">• {tp.name as string} ({tp.location as string}): {tp.description as string}</div>
          ))}
        </div>
      )}
      {renderList("优点", strengths)}
      {renderList("问题", weaknesses)}
      {renderList("建议", suggestions)}
    </div>
  );
}

function PacingView({ data }: { data: Record<string, any> }) {
  const chapters = (data.chapter_analyses as Array<Record<string, any>>) || [];
  const suggestions = [data.improvement_plan as string].filter(Boolean);

  return (
    <div className="space-y-2 text-[var(--text-xs)]">
      {data.overall_pacing && (
        <div className="text-[var(--color-text-primary)] font-medium">整体节奏: {data.overall_pacing as string}</div>
      )}
      {typeof data.balance_score === "number" && (
        <div>平衡度: {data.balance_score}/10</div>
      )}
      {chapters.map((ch, i) => (
        <div key={i} className="rounded bg-[var(--color-surface-hover)] p-1.5">
          <div className="flex justify-between">
            <span className="font-medium text-[var(--color-text-primary)]">{ch.chapter as string}</span>
            <span className={`px-1 rounded text-[9px] ${
              ch.pacing === "快" ? "bg-green-500/20 text-green-400" :
              ch.pacing === "慢" ? "bg-yellow-500/20 text-yellow-400" :
              "bg-blue-500/20 text-blue-400"
            }`}>{ch.pacing as string}</span>
          </div>
          {ch.suggestion && <div className="text-[var(--color-text-muted)]">{ch.suggestion as string}</div>}
        </div>
      ))}
      {renderList("改进方案", suggestions)}
    </div>
  );
}

function EmotionArcView({ data }: { data: Record<string, any> }) {
  const chapters = (data.chapters as Array<Record<string, any>>) || [];
  const peaks = (data.emotional_peaks as Array<Record<string, any>>) || [];
  const valleys = (data.emotional_valleys as Array<Record<string, any>>) || [];
  const suggestions = (data.suggestions as string[]) || [];

  return (
    <div className="space-y-2 text-[var(--text-xs)]">
      {data.overall_arc && (
        <div className="text-[var(--color-text-primary)] font-medium">整体走向: {data.overall_arc as string}</div>
      )}
      {/* Emotion chart */}
      {chapters.length > 0 && (
        <div className="flex items-end gap-1 h-16">
          {chapters.map((ch, i) => {
            const intensity = (ch.intensity as number) || 5;
            const hue = intensity >= 7 ? "0" : intensity >= 5 ? "40" : "210";
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className="w-full rounded-t-sm min-w-[4px]"
                  style={{
                    height: `${intensity * 10}%`,
                    backgroundColor: `hsl(${hue}, 70%, 55%)`,
                  }}
                  title={`${ch.title as string}: ${ch.dominant_emotion as string} (${intensity})`}
                />
                <span className="text-[8px] text-[var(--color-text-muted)] truncate max-w-[20px]">{i + 1}</span>
              </div>
            );
          })}
        </div>
      )}
      {peaks.length > 0 && (
        <div>
          <div className="font-medium text-red-400">情感高峰</div>
          {peaks.map((p, i) => <div key={i} className="pl-2 text-[var(--color-text-secondary)]">• {p.chapter as string}: {p.emotion as string} ({p.intensity as number}/10)</div>)}
        </div>
      )}
      {valleys.length > 0 && (
        <div>
          <div className="font-medium text-blue-400">情感低谷</div>
          {valleys.map((v, i) => <div key={i} className="pl-2 text-[var(--color-text-secondary)]">• {v.chapter as string}: {v.emotion as string} ({v.intensity as number}/10)</div>)}
        </div>
      )}
      {renderList("建议", suggestions)}
    </div>
  );
}

function CharacterArcView({ data }: { data: Record<string, any> }) {
  const characters = (data.characters as Array<Record<string, any>>) || [];
  const interactions = (data.interactions as Array<Record<string, any>>) || [];
  const suggestions = (data.suggestions as string[]) || [];

  return (
    <div className="space-y-2 text-[var(--text-xs)]">
      {characters.map((char, i) => (
        <div key={i} className="rounded bg-[var(--color-surface-hover)] p-1.5">
          <div className="flex justify-between items-center">
            <span className="font-medium text-[var(--color-text-primary)]">{char.name as string}</span>
            <span className="text-[9px] rounded px-1 bg-purple-500/20 text-purple-400">{char.arc_type as string}</span>
          </div>
          {char.stages && (char.stages as Array<Record<string, any>>).map((s, j) => (
            <div key={j} className="pl-2 text-[var(--color-text-secondary)]">
              <span className="text-[var(--color-text-muted)]">{s.chapter_range as string}:</span> {s.state as string}
            </div>
          ))}
          {typeof char.growth_score === "number" && (
            <div className="text-[var(--color-text-muted)]">成长度: {char.growth_score}/10 · 一致性: {char.consistency_score}/10</div>
          )}
        </div>
      ))}
      {interactions.length > 0 && (
        <div>
          <div className="font-medium text-[var(--color-text-primary)]">角色互动</div>
          {interactions.map((inter, i) => (
            <div key={i} className="text-[var(--color-text-secondary)] pl-2">
              {(inter.characters as string[]).join(" ↔ ")}: {inter.dynamic as string}
            </div>
          ))}
        </div>
      )}
      {renderList("建议", suggestions)}
    </div>
  );
}

function OutlineView({ data }: { data: Record<string, any> }) {
  const volumes = (data.volumes as Array<Record<string, any>>) || [];
  const missing = (data.missing_beats as string[]) || [];

  return (
    <div className="space-y-2 text-[var(--text-xs)]">
      {data.overall_structure && (
        <div className="text-[var(--color-text-primary)] font-medium">{data.overall_structure as string}</div>
      )}
      {volumes.map((vol, i) => (
        <div key={i} className="rounded border border-[var(--color-border)] p-1.5">
          <div className="font-medium text-[var(--color-text-primary)]">{vol.title as string}</div>
          {vol.theme && <div className="text-[var(--color-text-muted)]">主题: {vol.theme as string}</div>}
          {(vol.chapters as Array<Record<string, any>>)?.map((ch, j) => (
            <div key={j} className="pl-2 py-0.5">
              <span className="text-[var(--color-text-primary)]">{ch.title as string}</span>
              <div className="text-[var(--color-text-secondary)]">{ch.summary as string}</div>
            </div>
          ))}
        </div>
      ))}
      {renderList("缺失节拍", missing)}
    </div>
  );
}

function renderList(title: string, items: string[]) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="font-medium text-[var(--color-text-primary)]">{title}</div>
      {items.map((item, i) => (
        <div key={i} className="text-[var(--color-text-secondary)] pl-2">• {item}</div>
      ))}
    </div>
  );
}
