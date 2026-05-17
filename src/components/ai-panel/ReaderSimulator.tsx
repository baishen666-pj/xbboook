// @ts-nocheck
import { useState, useCallback } from "react";
import { analysisService } from "@/services/analysisService";

const READER_TYPES = [
  { id: "shuangwen_fan", name: "爽文爱好者", icon: "🔥", desc: "追求爽感、节奏快、打脸升级" },
  { id: "literature_fan", name: "文艺读者", icon: "📚", desc: "注重文笔、深度、情感" },
  { id: "critic", name: "挑刺读者", icon: "🔬", desc: "逻辑严密、设定严谨" },
  { id: "female_reader", name: "女性向读者", icon: "🌸", desc: "注重情感描写、角色魅力" },
  { id: "casual", name: "休闲读者", icon: "☕", desc: "轻松有趣、不太烧脑" },
  { id: "veteran", name: "老书虫", icon: "🦉", desc: "阅书无数、一眼看穿套路" },
];

export function ReaderSimulator({ projectId }: { projectId: string }) {
  const [readerType, setReaderType] = useState("shuangwen_fan");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSimulate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    const res = await analysisService.run(projectId, "reader-simulate");
    if (res.success && res.data) {
      const r = res.data.result as Record<string, any>;
      setResult(r);
    } else {
      setError(res.error || "模拟失败");
    }
    setLoading(false);
  }, [projectId]);

  const current = READER_TYPES.find((t) => t.id === readerType)!;

  return (
    <div className="p-3 space-y-3">
      {/* Reader type selector */}
      <div className="flex flex-wrap gap-1">
        {READER_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setReaderType(t.id)}
            className={`rounded px-2 py-1 text-[var(--text-xs)] transition-colors ${
              readerType === t.id
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:opacity-80"
            }`}
            title={t.desc}
          >
            {t.icon} {t.name}
          </button>
        ))}
      </div>

      {/* Simulate button */}
      <button
        onClick={() => void handleSimulate()}
        disabled={loading}
        className="w-full rounded px-3 py-1.5 text-[var(--text-sm)] bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {loading ? "模拟中...（需要 10-30 秒）" : `${current.icon} 以「${current.name}」视角阅读`}
      </button>

      {error && (
        <div className="rounded bg-red-500/10 px-2.5 py-1.5 text-[var(--text-xs)] text-red-400">{error}</div>
      )}

      {result && <ReaderResultView data={result} readerType={readerType} />}
    </div>
  );
}

function ReaderResultView({ data, readerType }: { data: Record<string, any>; readerType: string }) {
  const profile = (data.reader_profile || {}) as Record<string, any>;
  const scores = (data.scores || {}) as Record<string, number>;
  const feedback = (data.feedback || {}) as Record<string, string[]>;
  const suggestions = (data.suggestions || []) as string[];
  const memorable = (data.memorable_moments || []) as string[];
  const overallScore = data.overall_score as number || 0;
  const quitRisk = data.quit_risk as string || "low";

  const scoreEntries = Object.entries(scores);
  const maxScore = Math.max(...scoreEntries.map(([, v]) => v), 1);

  return (
    <div className="space-y-3 text-[var(--text-xs)]">
      {/* Overall */}
      <div className="flex items-center gap-3">
        <div className={`text-2xl font-bold ${overallScore >= 8 ? "text-green-400" : overallScore >= 6 ? "text-yellow-400" : "text-red-400"}`}>
          {overallScore}
        </div>
        <div>
          <div className="text-[var(--color-text-primary)] font-medium">
            {quitRisk === "high" ? "高风险弃读" : quitRisk === "medium" ? "可能弃读" : "愿意继续读"}
          </div>
          <div className="text-[var(--color-text-muted)]">{data.one_liner as string}</div>
        </div>
      </div>

      {/* Score bars */}
      {scoreEntries.length > 0 && (
        <div className="space-y-1">
          {scoreEntries.map(([key, val]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-16 text-[var(--color-text-muted)] text-right">{scoreLabel(key)}</span>
              <div className="flex-1 h-2 bg-[var(--color-surface-hover)] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${val >= 8 ? "bg-green-500" : val >= 6 ? "bg-yellow-500" : "bg-red-500"}`}
                  style={{ width: `${(val / 10) * 100}%` }}
                />
              </div>
              <span className="w-6 text-right text-[var(--color-text-secondary)]">{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Quit risk warning */}
      {quitRisk !== "low" && data.quit_reason && (
        <div className="rounded bg-red-500/10 border border-red-500/20 px-2 py-1.5">
          <div className="text-red-400 font-medium">弃读预警</div>
          <div className="text-[var(--color-text-secondary)]">{data.quit_reason as string}</div>
        </div>
      )}

      {/* Feedback */}
      <div className="grid grid-cols-2 gap-2">
        {feedback.loved?.length > 0 && (
          <div className="rounded bg-green-500/5 p-2">
            <div className="text-green-400 font-medium mb-0.5">喜欢</div>
            {feedback.loved.map((s, i) => <div key={i} className="text-[var(--color-text-secondary)]">• {s}</div>)}
          </div>
        )}
        {feedback.hated?.length > 0 && (
          <div className="rounded bg-red-500/5 p-2">
            <div className="text-red-400 font-medium mb-0.5">不喜欢</div>
            {feedback.hated.map((s, i) => <div key={i} className="text-[var(--color-text-secondary)]">• {s}</div>)}
          </div>
        )}
        {feedback.confused?.length > 0 && (
          <div className="rounded bg-yellow-500/5 p-2">
            <div className="text-yellow-400 font-medium mb-0.5">困惑</div>
            {feedback.confused.map((s, i) => <div key={i} className="text-[var(--color-text-secondary)]">• {s}</div>)}
          </div>
        )}
        {feedback.boring?.length > 0 && (
          <div className="rounded bg-gray-500/5 p-2">
            <div className="text-gray-400 font-medium mb-0.5">无聊</div>
            {feedback.boring.map((s, i) => <div key={i} className="text-[var(--color-text-secondary)]">• {s}</div>)}
          </div>
        )}
      </div>

      {/* Memorable moments */}
      {memorable.length > 0 && (
        <div>
          <div className="text-[var(--color-text-primary)] font-medium">印象深刻的场景</div>
          {memorable.map((m, i) => <div key={i} className="text-[var(--color-text-secondary)] pl-2">• {m}</div>)}
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div>
          <div className="text-[var(--color-text-primary)] font-medium">改进建议</div>
          {suggestions.map((s, i) => <div key={i} className="text-[var(--color-text-secondary)] pl-2">• {s}</div>)}
        </div>
      )}
    </div>
  );
}

function scoreLabel(key: string): string {
  const labels: Record<string, string> = {
    opening_hook: "开篇吸引",
    pacing: "节奏",
    character: "角色",
    dialogue: "对话",
    worldbuilding: "世界观",
    emotion: "情感",
    readability: "可读性",
  };
  return labels[key] || key;
}
