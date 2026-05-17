import { memo, useMemo, useState, useCallback } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { consistencyService } from "@/services/consistencyService";
import type { ConsistencyIssueType } from "@/types/project";

interface ConsistencyIssue {
  type: string;
  description: string;
  chapterRef: string;
  suggestion: string;
}

interface Props {
  content: string;
}

const TYPE_MAP: Record<string, string> = {
  "角色矛盾": "character_conflict",
  "时间线错误": "timeline_error",
  "设定冲突": "setting_conflict",
  "情节逻辑": "plot_logic",
  "细节遗漏": "detail_omission",
};

const TYPE_COLORS: Record<string, string> = {
  "角色矛盾": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "时间线错误": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "设定冲突": "bg-purple-500/15 text-purple-400 border-purple-500/20",
  "情节逻辑": "bg-red-500/15 text-red-400 border-red-500/20",
  "细节遗漏": "bg-teal-500/15 text-teal-400 border-teal-500/20",
};

const DEFAULT_COLOR = "bg-white/10 text-white/50 border-white/10";

function parseIssues(content: string): ConsistencyIssue[] {
  try {
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const data = JSON.parse(cleaned);
    if (data.issues && Array.isArray(data.issues)) return data.issues;
  } catch {
    // not valid JSON
  }
  return [];
}

export const ConsistencyReport = memo(function ConsistencyReport({ content }: Props) {
  const issues = useMemo(() => parseIssues(content), [content]);
  const currentProject = useProjectStore((s) => s.currentProject);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(async () => {
    if (!currentProject || issues.length === 0) return;
    setSaving(true);
    try {
      await consistencyService.bulkCreate(
        currentProject.id,
        issues.map((i) => ({
          type: (TYPE_MAP[i.type] ?? "plot_logic") as ConsistencyIssueType,
          severity: "medium" as const,
          title: i.description.slice(0, 100),
          description: i.description,
          suggestion: i.suggestion,
        })),
      );
      setSaved(true);
    } catch {
      // save failed silently
    } finally {
      setSaving(false);
    }
  }, [currentProject, issues]);

  if (issues.length === 0) {
    return (
      <div className="px-3 py-2 text-sm text-emerald-400 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
        未发现一致性问题，全文逻辑自洽。
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40 px-1">发现 {issues.length} 个潜在问题</span>
        {currentProject && (
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={`rounded px-2 py-1 text-[10px] transition-colors ${
              saved
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
          >
            {saved ? "已保存" : saving ? "保存中..." : "保存到问题列表"}
          </button>
        )}
      </div>
      {issues.map((issue, i) => (
        <div
          key={i}
          className={`rounded-lg border p-2.5 ${
            TYPE_COLORS[issue.type] || DEFAULT_COLOR
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/10">
              {issue.type}
            </span>
            {issue.chapterRef && (
              <span className="text-[10px] opacity-60">第「{issue.chapterRef}」章</span>
            )}
          </div>
          <p className="text-xs leading-relaxed">{issue.description}</p>
          {issue.suggestion && (
            <p className="mt-1 text-[11px] opacity-70 border-t border-current/10 pt-1">
              建议：{issue.suggestion}
            </p>
          )}
        </div>
      ))}
    </div>
  );
});
