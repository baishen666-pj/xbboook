import { useState, useCallback, useEffect } from 'react';
import * as fpService from '@/services/styleFingerprintService';

interface Props {
  projectId: string;
}

export function StyleFingerprintPanel({ projectId }: Props) {
  const [fingerprint, setFingerprint] = useState<fpService.StyleFingerprint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadFingerprint = useCallback(async () => {
    try {
      const fp = await fpService.getStyleFingerprint(projectId);
      setFingerprint(fp);
    } catch { /* no fingerprint yet */ }
  }, [projectId]);

  useEffect(() => { loadFingerprint(); }, [loadFingerprint]);

  const handleExtract = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const fp = await fpService.extractStyleFingerprint(projectId);
      setFingerprint(fp);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提取失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const handleDelete = useCallback(async () => {
    try {
      await fpService.deleteStyleFingerprint(projectId);
      setFingerprint(null);
    } catch { /* ignore */ }
  }, [projectId]);

  const fp = fingerprint;

  return (
    <div className="p-3 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">风格学习</h4>
        <div className="flex gap-1">
          <button
            onClick={handleExtract}
            disabled={loading}
            className="rounded bg-[var(--color-primary)] px-2 py-1 text-xs text-white hover:opacity-90 disabled:opacity-40"
          >
            {loading ? '分析中...' : fp ? '重新学习' : '学习风格'}
          </button>
          {fp && (
            <button onClick={handleDelete} className="rounded bg-red-600/20 px-2 py-1 text-xs text-red-400 hover:bg-red-600/30">
              删除
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {fp && (
        <div className="space-y-3">
          {/* Summary */}
          <p className="text-xs text-[var(--color-text-primary)]">{fp.summary}</p>

          {/* Narrative habits */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[var(--color-text-muted)]">视角: </span>
              <span className="text-[var(--color-text-primary)]">{fp.narrativeHabits.povType}</span>
            </div>
            <div>
              <span className="text-[var(--color-text-muted)]">时态: </span>
              <span className="text-[var(--color-text-primary)]">{fp.narrativeHabits.tensePreference}</span>
            </div>
            <div>
              <span className="text-[var(--color-text-muted)]">场景过渡: </span>
              <span className="text-[var(--color-text-primary)]">{fp.narrativeHabits.sceneTransitionStyle}</span>
            </div>
            <div>
              <span className="text-[var(--color-text-muted)]">情感表达: </span>
              <span className="text-[var(--color-text-primary)]">{fp.narrativeHabits.emotionalExpression}</span>
            </div>
          </div>

          {/* Rhythm */}
          <div>
            <span className="text-xs text-[var(--color-text-muted)]">节奏档案</span>
            <div className="grid grid-cols-2 gap-1 mt-1 text-xs">
              <span className="text-[var(--color-text-muted)]">平均句长: <span className="text-[var(--color-text-primary)]">{fp.rhythmProfile.avgSentenceLength}字</span></span>
              <span className="text-[var(--color-text-muted)]">平均段长: <span className="text-[var(--color-text-primary)]">{Math.round(fp.rhythmProfile.avgParagraphLength)}字</span></span>
              <span className="text-[var(--color-text-muted)]">对话比例: <span className="text-[var(--color-text-primary)]">{Math.round(fp.rhythmProfile.dialogueProportion * 100)}%</span></span>
              <span className="text-[var(--color-text-muted)]">句长方差: <span className="text-[var(--color-text-primary)]">{fp.rhythmProfile.sentenceVariance}</span></span>
            </div>
          </div>

          {/* Sentence patterns */}
          {fp.sentencePatterns.length > 0 && (
            <div>
              <span className="text-xs text-[var(--color-text-muted)]">常用句式</span>
              <div className="mt-1 space-y-1">
                {fp.sentencePatterns.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-[var(--color-text-primary)]">{p.type}</span>
                    <span className="text-[var(--color-text-muted)]">({p.frequency}次/千字)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top phrases */}
          {fp.vocabularyProfile.topPhrases.length > 0 && (
            <div>
              <span className="text-xs text-[var(--color-text-muted)]">高频用语</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {fp.vocabularyProfile.topPhrases.slice(0, 15).map((phrase, i) => (
                  <span key={i} className="rounded bg-white/5 px-1.5 py-0.5 text-xs text-[var(--color-text-primary)]">{phrase}</span>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-[var(--color-text-muted)]">
            基于 {fp.sampleSize} 个章节分析
          </div>
        </div>
      )}

      {!fp && !loading && (
        <p className="text-xs text-[var(--color-text-muted)]">
          点击"学习风格"分析已有章节的写作风格，AI 将在后续写作中模仿你的笔触。
        </p>
      )}
    </div>
  );
}
