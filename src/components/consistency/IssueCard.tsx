import type { ConsistencyIssue } from '../../types/project';

const TYPE_LABELS: Record<string, string> = {
  character_conflict: '角色矛盾',
  timeline_error: '时间线',
  setting_conflict: '设定冲突',
  plot_logic: '情节逻辑',
  detail_omission: '细节遗漏',
  foreshadowing_conflict: '伏笔冲突',
  name_mismatch: '名称问题',
};

const TYPE_COLORS: Record<string, string> = {
  character_conflict: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  timeline_error: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  setting_conflict: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  plot_logic: 'bg-red-500/15 text-red-400 border-red-500/20',
  detail_omission: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
  foreshadowing_conflict: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  name_mismatch: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
};

const SEVERITY_DOTS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-gray-400',
};

interface Props {
  issue: ConsistencyIssue;
  onUpdate: (id: string, data: Partial<ConsistencyIssue>) => void;
  onDelete: (id: string) => void;
  onNavigateToChapter?: (chapterId: string) => void;
}

export function IssueCard({ issue, onUpdate, onDelete, onNavigateToChapter }: Props) {
  const typeColor = TYPE_COLORS[issue.type] ?? 'bg-white/10 text-white/50 border-white/10';
  const severityDot = SEVERITY_DOTS[issue.severity] ?? 'bg-gray-400';

  return (
    <div className={`rounded-lg border p-2.5 ${typeColor}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${severityDot}`} />
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/10">
          {TYPE_LABELS[issue.type] ?? issue.type}
        </span>
        {issue.chapterId && onNavigateToChapter && (
          <button
            onClick={() => onNavigateToChapter(issue.chapterId!)}
            className="text-[10px] opacity-60 hover:opacity-100 hover:underline"
          >
            跳转到章节
          </button>
        )}
        <span className="flex-1" />
        <span className="text-[10px] opacity-40">{issue.source === 'ai' ? 'AI' : issue.source === 'name_scanner' ? '扫描' : '手动'}</span>
      </div>
      <p className="text-xs font-medium mb-0.5">{issue.title}</p>
      {issue.description && (
        <p className="text-[11px] leading-relaxed opacity-80">{issue.description}</p>
      )}
      {issue.suggestion && (
        <p className="mt-1 text-[11px] opacity-60 border-t border-current/10 pt-1">
          建议：{issue.suggestion}
        </p>
      )}
      <div className="flex items-center gap-1 mt-1.5">
        {issue.status === 'open' && (
          <>
            <button onClick={() => onUpdate(issue.id, { status: 'acknowledged' })} className="rounded px-1.5 py-0.5 text-[10px] bg-white/10 hover:bg-white/20">确认</button>
            <button onClick={() => onUpdate(issue.id, { status: 'fixed' })} className="rounded px-1.5 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">已修</button>
            <button onClick={() => onUpdate(issue.id, { status: 'dismissed' })} className="rounded px-1.5 py-0.5 text-[10px] bg-white/5 hover:bg-white/10">忽略</button>
          </>
        )}
        {issue.status === 'acknowledged' && (
          <>
            <button onClick={() => onUpdate(issue.id, { status: 'fixed' })} className="rounded px-1.5 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">已修</button>
            <button onClick={() => onUpdate(issue.id, { status: 'dismissed' })} className="rounded px-1.5 py-0.5 text-[10px] bg-white/5 hover:bg-white/10">忽略</button>
          </>
        )}
        <span className="flex-1" />
        <button onClick={() => onDelete(issue.id)} className="rounded px-1.5 py-0.5 text-[10px] text-red-400/60 hover:text-red-400 hover:bg-red-500/10">删除</button>
      </div>
    </div>
  );
}
