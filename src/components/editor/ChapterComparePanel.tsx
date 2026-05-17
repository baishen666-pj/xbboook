import { useState } from 'react';
import { chapterCompareService, type CompareResult } from '@/services/chapterCompareService';

interface ChapterOption {
  id: string;
  title: string;
}

interface ChapterComparePanelProps {
  projectId: string;
  chapters: Array<ChapterOption>;
}

interface DiffLine {
  type: 'same' | 'added' | 'removed';
  text: string;
}

function simpleDiff(linesA: string[], linesB: string[]): DiffLine[] {
  const result: DiffLine[] = [];
  const setA = new Set(linesA);
  const setB = new Set(linesB);
  const seen = new Set<string>();

  for (const line of linesA) {
    if (seen.has(line)) continue;
    seen.add(line);
    if (setB.has(line)) {
      result.push({ type: 'same', text: line });
    } else {
      result.push({ type: 'removed', text: line });
    }
  }

  for (const line of linesB) {
    if (seen.has(line)) continue;
    seen.add(line);
    if (!setA.has(line)) {
      result.push({ type: 'added', text: line });
    }
  }

  return result;
}

export function ChapterComparePanel({ projectId, chapters }: ChapterComparePanelProps) {
  const [chapterIdA, setChapterIdA] = useState<string>(chapters[0]?.id ?? '');
  const [chapterIdB, setChapterIdB] = useState<string>(chapters[1]?.id ?? '');
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    if (!chapterIdA || !chapterIdB) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await chapterCompareService.compare(projectId, { chapterIdA, chapterIdB });
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error || '对比失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const diffA = result ? simpleDiff(result.textA.split('\n'), result.textB.split('\n')) : [];

  return (
    <div className="space-y-3">
      {/* Chapter selectors */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] text-[var(--color-text-muted)] mb-1">章节 A</div>
          <select
            value={chapterIdA}
            onChange={(e) => setChapterIdA(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1 text-[10px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]/50"
          >
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.title}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-[10px] text-[var(--color-text-muted)] mb-1">章节 B</div>
          <select
            value={chapterIdB}
            onChange={(e) => setChapterIdB(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1 text-[10px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]/50"
          >
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Compare button */}
      <button
        onClick={handleCompare}
        disabled={loading || !chapterIdA || !chapterIdB}
        className="w-full rounded px-3 py-1.5 text-[10px] font-medium bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
      >
        {loading ? '对比中...' : '对比'}
      </button>

      {/* Error */}
      {error && (
        <div className="rounded bg-red-500/10 border border-red-500/20 px-2 py-1.5 text-[10px] text-red-400">
          {error}
        </div>
      )}

      {/* Diff result */}
      {result && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-[10px] font-medium text-[var(--color-text-secondary)] truncate">
              {result.titleA}
            </div>
            <div className="text-[10px] font-medium text-[var(--color-text-secondary)] truncate">
              {result.titleB}
            </div>
          </div>

          <div className="rounded border border-[var(--color-border)] overflow-hidden max-h-64 overflow-y-auto">
            {diffA.map((line, i) => (
              <div
                key={i}
                className={`px-2 py-0.5 text-[10px] font-mono leading-relaxed ${
                  line.type === 'removed'
                    ? 'bg-red-500/10 text-red-400'
                    : line.type === 'added'
                      ? 'bg-green-500/10 text-green-400'
                      : 'text-[var(--color-text-secondary)]'
                }`}
              >
                <span className="inline-block w-4 text-[9px] text-[var(--color-text-muted)]">
                  {line.type === 'removed' ? '-' : line.type === 'added' ? '+' : ' '}
                </span>
                {line.text || ' '}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 text-[9px] text-[var(--color-text-muted)]">
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-2 rounded-sm bg-red-500/10 border border-red-500/20" />
              <span>仅 A</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-2 rounded-sm bg-green-500/10 border border-green-500/20" />
              <span>仅 B</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-2 rounded-sm bg-[var(--color-surface-1)]" />
              <span>相同</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
