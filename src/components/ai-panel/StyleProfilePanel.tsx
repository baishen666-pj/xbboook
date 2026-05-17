import { useEffect } from "react";
import { useStyleAnalysis } from "@/hooks/useStyleAnalysis";
import { StyleRadarChart } from "./StyleRadarChart";

export function StyleProfilePanel() {
  const { profile, isAnalyzing, error, loadProfile, analyzeStyle } = useStyleAnalysis();

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[var(--text-sm)] font-medium text-[var(--color-text-primary)]">
          写作风格档案
        </h3>
        <button
          onClick={() => void analyzeStyle()}
          disabled={isAnalyzing}
          className="rounded px-2 py-1 text-[var(--text-xs)] bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isAnalyzing ? "分析中..." : profile ? "重新分析" : "分析风格"}
        </button>
      </div>

      {error && (
        <div className="rounded bg-red-500/10 px-2.5 py-1.5 text-[var(--text-xs)] text-red-400">
          {error}
        </div>
      )}

      {profile ? (
        <>
          {/* Radar chart */}
          <div className="flex justify-center">
            <StyleRadarChart dimensions={profile.dimensions} size={220} />
          </div>

          {/* Summary */}
          {profile.summary && (
            <div className="text-[var(--text-xs)] text-[var(--color-text-secondary)] text-center italic">
              {profile.summary}
            </div>
          )}

          {/* Keywords */}
          {profile.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center">
              {profile.keywords.map((kw) => (
                <span
                  key={kw}
                  className="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-[var(--text-xs)] text-[var(--color-primary)]"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}

          {/* Last analyzed */}
          <div className="text-[10px] text-[var(--color-text-muted)] text-center">
            上次分析: {new Date(profile.lastAnalyzedAt).toLocaleString("zh-CN")}
          </div>
        </>
      ) : !isAnalyzing ? (
        <div className="py-6 text-center text-[var(--text-xs)] text-[var(--color-text-muted)]">
          点击"分析风格"开始分析你的写作风格
        </div>
      ) : null}
    </div>
  );
}
