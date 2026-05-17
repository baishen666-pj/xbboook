import { useState, useCallback, useEffect } from 'react';
import * as spService from '@/services/storyPlannerService';

interface Props {
  projectId: string;
}

const TYPE_LABELS: Record<string, string> = {
  arc: '故事弧',
  volume: '卷',
  chapter_group: '章节组',
  milestone: '里程碑',
};

const STATUS_COLORS: Record<string, string> = {
  planned: 'text-gray-400',
  in_progress: 'text-blue-400',
  completed: 'text-emerald-400',
  abandoned: 'text-red-400',
};

export function StoryPlannerPanel({ projectId }: Props) {
  const [plans, setPlans] = useState<spService.StoryPlan[]>([]);
  const [pacing, setPacing] = useState<spService.PacingSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const loadPlans = useCallback(async () => {
    try {
      const data = await spService.getStoryPlans(projectId);
      setPlans(data);
    } catch { /* ignore */ }
  }, [projectId]);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  const handleGenerate = useCallback(async (scope: string) => {
    setGenerating(true);
    setError('');
    try {
      await spService.generateStoryPlan(projectId, scope);
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setGenerating(false);
    }
  }, [projectId, loadPlans]);

  const handleDelete = useCallback(async (planId: string) => {
    try {
      await spService.deleteStoryPlan(projectId, planId);
      await loadPlans();
    } catch { /* ignore */ }
  }, [projectId, loadPlans]);

  const handlePacing = useCallback(async () => {
    setLoading(true);
    try {
      const arcs = plans.filter(p => p.plan_type === 'arc');
      if (arcs.length > 0) {
        const data = await spService.analyzePacing(projectId, arcs[0]!.id);
        setPacing(data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [projectId, plans]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Build tree from flat list

  const renderPlanTree = (parentId: string | null, depth = 0) => {
    const children = plans.filter(p => p.parent_id === parentId);
    if (children.length === 0) return null;

    return children.map(plan => {
      const hasChildren = plans.some(p => p.parent_id === plan.id);
      const isExpanded = expandedIds.has(plan.id);
      const targetData = JSON.parse(plan.target_data || '{}');

      return (
        <div key={plan.id}>
          <div
            className="flex items-center gap-1 py-1 px-2 hover:bg-white/5 rounded cursor-pointer text-xs"
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => hasChildren && toggleExpand(plan.id)}
          >
            {hasChildren && (
              <span className="text-[var(--color-text-muted)] text-[10px]">
                {isExpanded ? '▼' : '▶'}
              </span>
            )}
            <span className={`text-[var(--color-text-primary)]`}>{plan.title}</span>
            <span className="text-[var(--color-text-muted)]">({TYPE_LABELS[plan.plan_type]})</span>
            <span className={`ml-auto ${STATUS_COLORS[plan.status] || 'text-gray-400'}`}>
              {plan.status}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(plan.id); }}
              className="ml-1 text-red-400 hover:text-red-300"
            >
              ×
            </button>
          </div>

          {/* Target data preview */}
          {isExpanded && (targetData.theme || targetData.conflictCore || targetData.keyEvents) && (
            <div className="px-4 pb-1 text-xs text-[var(--color-text-muted)]" style={{ paddingLeft: `${depth * 16 + 24}px` }}>
              {targetData.theme && <div>主题: {targetData.theme}</div>}
              {targetData.conflictCore && <div>冲突: {targetData.conflictCore}</div>}
              {targetData.keyEvents?.length > 0 && <div>事件: {targetData.keyEvents.join('、')}</div>}
            </div>
          )}

          {isExpanded && renderPlanTree(plan.id, depth + 1)}
        </div>
      );
    });
  };

  const maxTension = Math.max(...pacing.map(p => p.tension), 1);

  return (
    <div className="p-3 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">长篇规划</h4>
        <div className="flex gap-1">
          <select
            onChange={(e) => e.target.value && handleGenerate(e.target.value)}
            disabled={generating}
            className="rounded bg-[var(--color-primary)] px-2 py-1 text-xs text-white border-none disabled:opacity-40"
            defaultValue=""
          >
            <option value="" disabled>{generating ? '生成中...' : '生成规划'}</option>
            <option value="full_novel">整部小说</option>
            <option value="next_volume">下一卷</option>
            <option value="next_arc">下一弧</option>
          </select>
          {plans.length > 0 && (
            <button
              onClick={handlePacing}
              disabled={loading}
              className="rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-[var(--color-text-primary)] hover:bg-white/10"
            >
              节奏分析
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Plan tree */}
      {plans.length > 0 ? (
        <div className="space-y-0.5">
          {renderPlanTree(null)}
        </div>
      ) : (
        <p className="text-xs text-[var(--color-text-muted)]">
          点击"生成规划"让 AI 分析项目并创建分层叙事规划。
        </p>
      )}

      {/* Pacing chart */}
      {pacing.length > 0 && (
        <div>
          <span className="text-xs text-[var(--color-text-muted)]">节奏曲线</span>
          <div className="mt-1 flex items-end gap-px h-20 bg-black/10 rounded overflow-hidden">
            {pacing.map((p, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end min-w-0">
                <div
                  className="bg-blue-400/60 w-full rounded-t-sm"
                  style={{ height: `${(p.tension / maxTension) * 100}%` }}
                  title={`${p.chapterTitle}: 张力${p.tension} 情感${p.emotion} 动作${p.action}`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-0.5">
            <span>{pacing[0]?.chapterTitle}</span>
            <span>{pacing[pacing.length - 1]?.chapterTitle}</span>
          </div>
        </div>
      )}
    </div>
  );
}
