import { useState } from 'react';
import { chapterOpsService } from '@/services/chapterOpsService';

interface ChapterBrief {
  id: string;
  title: string;
  wordCount: number;
}

interface ChapterOpsPanelProps {
  projectId: string;
  chapters: ChapterBrief[];
  onDone: () => void;
}

export function ChapterOpsPanel({ projectId, chapters, onDone }: ChapterOpsPanelProps) {
  const [mode, setMode] = useState<'split' | 'merge'>('split');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [splitChapterId, setSplitChapterId] = useState<string>('');
  const [splitPositions, setSplitPositions] = useState('');
  const [mergeTitle, setMergeTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const toggleChapter = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : prev.length < 10 ? [...prev, id] : prev
    );
  };

  const handleSplit = async () => {
    if (!splitChapterId || !splitPositions.trim()) return;
    const points = splitPositions.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0);
    if (points.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const res = await chapterOpsService.split(projectId, splitChapterId, points);
      if (res.success && res.data) {
        setResult(`成功拆分为 ${res.data.splitCount} 个章节`);
      } else {
        setError(res.error || '拆分失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async () => {
    if (selectedIds.length < 2) return;

    setLoading(true);
    setError(null);
    try {
      const res = await chapterOpsService.merge(projectId, selectedIds, mergeTitle.trim() || undefined);
      if (res.success && res.data) {
        setResult(`成功合并 ${res.data.mergedCount} 个章节为「${res.data.title}」`);
      } else {
        setError(res.error || '合并失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Mode Tabs */}
      <div className="flex gap-1">
        <button
          onClick={() => { setMode('split'); setError(null); setResult(null); }}
          className={`flex-1 rounded py-1.5 text-xs transition-colors ${
            mode === 'split'
              ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
              : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)]'
          }`}
        >
          拆分章节
        </button>
        <button
          onClick={() => { setMode('merge'); setError(null); setResult(null); }}
          className={`flex-1 rounded py-1.5 text-xs transition-colors ${
            mode === 'merge'
              ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
              : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)]'
          }`}
        >
          合并章节
        </button>
      </div>

      {mode === 'split' ? (
        <div className="space-y-2">
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] mb-1">选择要拆分的章节</div>
            <select
              value={splitChapterId}
              onChange={(e) => setSplitChapterId(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
            >
              <option value="">选择章节</option>
              {chapters.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.title} ({ch.wordCount}字)</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] mb-1">拆分位置（字符位置，逗号分隔）</div>
            <input
              type="text"
              value={splitPositions}
              onChange={(e) => setSplitPositions(e.target.value)}
              placeholder="如：500,1200,2000"
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] mb-1">选择要合并的章节（按顺序）</div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {chapters.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => toggleChapter(ch.id)}
                  className={`w-full text-left rounded px-2 py-1.5 text-xs transition-colors ${
                    selectedIds.includes(ch.id)
                      ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)]'
                  }`}
                >
                  {ch.title} ({ch.wordCount}字)
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] mb-1">新标题（可选）</div>
            <input
              type="text"
              value={mergeTitle}
              onChange={(e) => setMergeTitle(e.target.value)}
              placeholder="留空则自动拼接"
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">{error}</div>
      )}
      {result && (
        <div className="rounded bg-green-500/10 p-2 text-xs text-green-400">{result}</div>
      )}

      <button
        onClick={mode === 'split' ? handleSplit : handleMerge}
        disabled={loading || (mode === 'split' ? !splitChapterId || !splitPositions.trim() : selectedIds.length < 2)}
        className="w-full rounded bg-[var(--color-primary)] py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-40"
      >
        {loading ? '处理中...' : mode === 'split' ? '拆分章节' : '合并章节'}
      </button>

      {result && (
        <button
          onClick={onDone}
          className="w-full rounded border border-[var(--color-border)] py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)]"
        >
          完成
        </button>
      )}
    </div>
  );
}
