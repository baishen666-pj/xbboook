import { memo, useMemo } from "react";

interface ConsistencyIssue {
  type: string;
  description: string;
  chapterRef: string;
  suggestion: string;
}

interface Props {
  content: string;
}

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

  if (issues.length === 0) {
    return (
      <div className="px-3 py-2 text-sm text-emerald-400 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
        未发现一致性问题，全文逻辑自洽。
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-white/40 px-1">发现 {issues.length} 个潜在问题</div>
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
