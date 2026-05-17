import { useState, useEffect } from 'react';
import { turningPointService, TURN_TYPE_LABELS, SEVERITY_LABELS, type TurningPoint } from '@/services/turningPointService';

interface TurningPointPanelProps {
  projectId: string;
}

const TYPE_COLORS: Record<string, string> = {
  reversal: 'bg-orange-500/20 text-orange-400',
  revelation: 'bg-purple-500/20 text-purple-400',
  sacrifice: 'bg-red-500/20 text-red-400',
  betrayal: 'bg-red-500/20 text-red-400',
  growth: 'bg-green-500/20 text-green-400',
  crisis: 'bg-yellow-500/20 text-yellow-400',
  climax: 'bg-pink-500/20 text-pink-400',
  other: 'bg-blue-500/20 text-blue-400',
};

const SEVERITY_COLORS: Record<string, string> = {
  minor: 'text-[var(--color-text-muted)]',
  moderate: 'text-yellow-400',
  major: 'text-orange-400',
  critical: 'text-red-400',
};

export function TurningPointPanel({ projectId }: TurningPointPanelProps) {
  const [points, setPoints] = useState<TurningPoint[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState('reversal');
  const [formSeverity, setFormSeverity] = useState('major');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    turningPointService.list(projectId).then((res) => {
      if (res.success && res.data) setPoints(res.data);
    }).catch(() => {});
  };

  useEffect(load, [projectId]);

  const handleCreate = async () => {
    if (!formTitle.trim()) return;
    const res = await turningPointService.create(projectId, {
      title: formTitle.trim(),
      description: formDesc.trim() || undefined,
      turnType: formType,
      severity: formSeverity,
    });
    if (res.success && res.data) {
      setPoints((prev) => [...prev, res.data!]);
    }
    setFormTitle('');
    setFormDesc('');
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    const res = await turningPointService.remove(projectId, id);
    if (res.success) setPoints((prev) => prev.filter((p) => p.id !== id));
  };

  const handleToggleForeshadow = async (point: TurningPoint, field: 'foreshadowPlanted' | 'foreshadowResolved') => {
    const res = await turningPointService.update(projectId, point.id, {
      ...point,
      [field]: !point[field],
    } as any);
    if (res.success && res.data) {
      setPoints((prev) => prev.map((p) => p.id === point.id ? res.data! : p));
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await turningPointService.analyze(projectId);
      if (res.success && res.data) {
        setAnalysis(res.data);
      } else {
        setError(res.error || '分析失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--color-text-primary)]">剧情转折点 ({points.length})</span>
        <div className="flex gap-1">
          <button
            onClick={handleAnalyze}
            disabled={analyzing || points.length === 0}
            className="rounded px-2 py-1 text-[10px] text-[var(--color-text-muted)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] disabled:opacity-40"
          >
            {analyzing ? '分析中...' : 'AI分析'}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="rounded bg-[var(--color-primary)] px-2 py-1 text-[10px] text-white hover:opacity-90"
          >
            + 添加
          </button>
        </div>
      </div>

      {/* Points List */}
      {points.length === 0 ? (
        <div className="py-6 text-center text-xs text-[var(--color-text-muted)]">暂无转折点</div>
      ) : (
        <div className="space-y-1.5">
          {points.map((point) => (
            <div key={point.id} className="group rounded border border-[var(--color-border)] p-2">
              <div className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${TYPE_COLORS[point.turnType] || TYPE_COLORS.other}`}>
                  {TURN_TYPE_LABELS[point.turnType] || point.turnType}
                </span>
                <span className={`text-[10px] ${SEVERITY_COLORS[point.severity] || ''}`}>
                  {SEVERITY_LABELS[point.severity] || point.severity}
                </span>
                <span className="flex-1 text-xs text-[var(--color-text-primary)] truncate">{point.title}</span>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleToggleForeshadow(point, 'foreshadowPlanted')}
                    className={`rounded px-1 py-0.5 text-[10px] ${point.foreshadowPlanted ? 'bg-green-500/20 text-green-400' : 'text-[var(--color-text-muted)]'}`}
                    title="伏笔已埋"
                  >🌱</button>
                  <button
                    onClick={() => handleToggleForeshadow(point, 'foreshadowResolved')}
                    className={`rounded px-1 py-0.5 text-[10px] ${point.foreshadowResolved ? 'bg-blue-500/20 text-blue-400' : 'text-[var(--color-text-muted)]'}`}
                    title="伏笔已回收"
                  >✅</button>
                  <button
                    onClick={() => handleDelete(point.id)}
                    className="rounded px-1 py-0.5 text-[10px] text-[var(--color-text-muted)] hover:text-red-400"
                  >×</button>
                </div>
              </div>
              {point.description && (
                <div className="mt-1 text-[10px] text-[var(--color-text-muted)] line-clamp-2">{point.description}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Analysis Result */}
      {analysis && (
        <div className="rounded border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-[var(--color-primary)]">AI 分析结果</span>
            <span className="text-[10px] text-[var(--color-primary)]">评分: {analysis.score ?? analysis.consistency_score}</span>
          </div>
          {analysis.pacing_analysis && <div className="text-[10px] text-[var(--color-text-secondary)]">节奏: {analysis.pacing_analysis}</div>}
          {analysis.foreshadow_analysis && <div className="text-[10px] text-[var(--color-text-secondary)]">伏笔: {analysis.foreshadow_analysis}</div>}
          {analysis.suggestions?.length > 0 && (
            <div className="text-[10px] text-[var(--color-text-muted)]">
              {analysis.suggestions.map((s: string, i: number) => <div key={i}>• {s}</div>)}
            </div>
          )}
          {analysis.unresolved?.length > 0 && (
            <div className="text-[10px] text-yellow-400">
              未回收伏笔: {analysis.unresolved.join('、')}
            </div>
          )}
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="space-y-2 rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2">
          <input
            type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
            placeholder="转折点标题" autoFocus
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
          />
          <textarea
            value={formDesc} onChange={(e) => setFormDesc(e.target.value)}
            placeholder="描述..." rows={2}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none"
          />
          <div className="flex gap-2">
            <select value={formType} onChange={(e) => setFormType(e.target.value)}
              className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs text-[var(--color-text-primary)]">
              {Object.entries(TURN_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={formSeverity} onChange={(e) => setFormSeverity(e.target.value)}
              className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs text-[var(--color-text-primary)]">
              {Object.entries(SEVERITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setShowForm(false)} className="flex-1 rounded px-2 py-1 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)]">取消</button>
            <button onClick={handleCreate} disabled={!formTitle.trim()} className="flex-1 rounded bg-[var(--color-primary)] px-2 py-1 text-xs text-white disabled:opacity-40">添加</button>
          </div>
        </div>
      )}

      {error && <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">{error}</div>}
    </div>
  );
}
