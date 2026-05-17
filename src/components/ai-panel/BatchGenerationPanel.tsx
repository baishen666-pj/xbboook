import { useState, useCallback, useRef, useEffect } from 'react';
import { batchGenerationService, type BatchPlan, type BatchPlanChapter } from '@/services/batchGenerationService';

interface Props {
  projectId: string;
}

type Phase = 'config' | 'executing' | 'done';

interface ChapterProgress {
  title: string;
  status: 'pending' | 'generating' | 'checking' | 'revising' | 'done' | 'error';
  wordCount: number;
  error?: string;
}

export function BatchGenerationPanel({ projectId }: Props) {
  const [phase, setPhase] = useState<Phase>('config');
  const [plan, setPlan] = useState<BatchPlan | null>(null);
  const [temperature, setTemperature] = useState(0.8);
  const [chapterProgress, setChapterProgress] = useState<ChapterProgress[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [totalWords, setTotalWords] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const abortRef = useRef<{ abort: () => void } | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleGeneratePlan = useCallback(async () => {
    try {
      setError(null);
      const result = await batchGenerationService.generatePlan(projectId, { temperature });
      setPlan(result);
      setChapterProgress(
        result.chapters.map((ch) => ({
          title: ch.title,
          status: 'pending' as const,
          wordCount: 0,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate plan');
    }
  }, [projectId, temperature]);

  const handleStartExecution = useCallback(() => {
    if (!plan) return;

    setPhase('executing');
    setError(null);
    setTotalWords(0);
    setCompletedCount(0);
    setFailedCount(0);
    setIsPaused(false);

    const stream = batchGenerationService.executeStream(
      projectId,
      plan,
      undefined,
      (event) => {
        setChapterProgress((prev) => {
          const next = [...prev];
          const idx = event.chapterIndex;

          if (idx >= 0 && idx < next.length) {
            const chapter = { ...next[idx]! };

            switch (event.type) {
              case 'chapter_start':
                chapter.status = 'generating';
                break;
              case 'consistency_check':
                chapter.status = 'checking';
                break;
              case 'chapter_revise':
                chapter.status = 'revising';
                break;
              case 'chapter_done': {
                chapter.status = 'done';
                const data = event.data as { wordCount?: number; totalWords?: number; progress?: number };
                chapter.wordCount = data?.wordCount ?? 0;
                if (data?.totalWords) setTotalWords(data.totalWords);
                if (data?.progress) setCompletedCount(data.progress);
                break;
              }
              case 'batch_error': {
                const errData = event.data as { error?: string; paused?: boolean };
                if (errData?.paused) {
                  setIsPaused(true);
                  chapter.status = 'pending';
                } else {
                  chapter.status = 'error';
                  chapter.error = errData?.error;
                  setFailedCount((f) => f + 1);
                }
                break;
              }
            }

            next[idx] = chapter;
          }

          if (event.type === 'batch_done') {
            const data = event.data as {
              totalChapters?: number;
              totalWords?: number;
              completedChapters?: number;
              failedChapters?: number;
            };
            if (data?.totalWords) setTotalWords(data.totalWords);
            if (data?.completedChapters) setCompletedCount(data.completedChapters);
            if (data?.failedChapters) setFailedCount(data.failedChapters);
          }

          return next;
        });
      },
      (err) => {
        setError(err);
        if (phase === 'executing') setPhase('done');
      },
      () => {
        setPhase('done');
      },
    );

    abortRef.current = stream;
  }, [plan, projectId, phase]);

  const handlePause = useCallback(async () => {
    if (!jobId) {
      abortRef.current?.abort();
      setIsPaused(true);
      return;
    }
    try {
      await batchGenerationService.pause(projectId, jobId);
      setIsPaused(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause');
    }
  }, [jobId, projectId]);

  const handleCancel = useCallback(async () => {
    abortRef.current?.abort();
    if (jobId) {
      try {
        await batchGenerationService.cancel(projectId, jobId);
      } catch {
        // ignore
      }
    }
    setPhase('config');
    setPlan(null);
    setJobId(null);
    setError(null);
    setIsPaused(false);
  }, [jobId, projectId]);

  const handleReset = useCallback(() => {
    setPhase('config');
    setPlan(null);
    setJobId(null);
    setError(null);
    setChapterProgress([]);
    setTotalWords(0);
    setCompletedCount(0);
    setFailedCount(0);
    setIsPaused(false);
  }, []);

  const totalChapters = plan?.chapters.length ?? 0;
  const progressPercent = totalChapters > 0 ? Math.round((completedCount / totalChapters) * 100) : 0;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">批量生章</h3>
        {phase !== 'config' && (
          <button
            onClick={handleReset}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            重新配置
          </button>
        )}
      </div>

      {/* Config phase */}
      {phase === 'config' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">
              Temperature: {temperature.toFixed(1)}
            </label>
            <input
              type="range"
              min="0.1"
              max="1.5"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-[var(--color-primary)]"
            />
            <div className="flex justify-between text-xs text-white/30 mt-0.5">
              <span>保守</span>
              <span>创意</span>
            </div>
          </div>

          {!plan ? (
            <button
              onClick={handleGeneratePlan}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              生成计划
            </button>
          ) : (
            <>
              <div className="bg-white/5 rounded-lg p-3 space-y-1.5">
                <p className="text-xs text-[var(--color-text-muted)]">
                  已识别 {plan.chapters.length} 个待生成章节
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {plan.chapters.map((ch: BatchPlanChapter, i: number) => (
                    <div
                      key={ch.outlineNodeId}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="text-white/40 w-5 shrink-0">{i + 1}.</span>
                      <span className="text-white/70 truncate">{ch.title}</span>
                      {ch.synopsis && (
                        <span className="text-white/30 truncate hidden sm:inline">
                          - {ch.synopsis.slice(0, 40)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPlan(null);
                    setChapterProgress([]);
                  }}
                  className="flex-1 px-3 py-2 rounded-lg bg-white/5 text-[var(--color-text-muted)] text-sm hover:bg-white/10 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleStartExecution}
                  disabled={plan.chapters.length === 0}
                  className="flex-1 px-3 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  开始生成 ({plan.chapters.length} 章)
                </button>
              </div>
            </>
          )}

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>
      )}

      {/* Execution phase */}
      {phase === 'executing' && (
        <div className="space-y-3">
          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] mb-1">
              <span>{completedCount} / {totalChapters} 章节</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Chapter list */}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {chapterProgress.map((ch, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/5"
              >
                <ChapterStatusIcon status={ch.status} />
                <span className="text-xs text-white/70 flex-1 truncate">{ch.title}</span>
                {ch.wordCount > 0 && (
                  <span className="text-xs text-white/30">{ch.wordCount} 字</span>
                )}
                {ch.error && (
                  <span className="text-xs text-red-400 truncate max-w-24">{ch.error}</span>
                )}
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            {!isPaused && (
              <button
                onClick={handlePause}
                className="flex-1 px-3 py-2 rounded-lg bg-amber-500/20 text-amber-300 text-sm hover:bg-amber-500/30 transition-colors"
              >
                暂停
              </button>
            )}
            <button
              onClick={handleCancel}
              className="flex-1 px-3 py-2 rounded-lg bg-red-500/20 text-red-300 text-sm hover:bg-red-500/30 transition-colors"
            >
              取消
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>
      )}

      {/* Done phase */}
      {phase === 'done' && (
        <div className="space-y-3">
          <div className="bg-white/5 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-white/80">批量生成完成</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-[var(--color-primary)]">{completedCount}</div>
                <div className="text-xs text-white/40">已完成</div>
              </div>
              <div>
                <div className="text-lg font-bold text-white/80">{totalWords.toLocaleString()}</div>
                <div className="text-xs text-white/40">总字数</div>
              </div>
              <div>
                <div className={`text-lg font-bold ${failedCount > 0 ? 'text-red-400' : 'text-white/40'}`}>{failedCount}</div>
                <div className="text-xs text-white/40">失败</div>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <button
            onClick={handleReset}
            className="w-full px-3 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            再次批量生成
          </button>
        </div>
      )}
    </div>
  );
}

function ChapterStatusIcon({ status }: { status: ChapterProgress['status'] }) {
  switch (status) {
    case 'pending':
      return (
        <div className="w-4 h-4 rounded-full border border-white/20 shrink-0" />
      );
    case 'generating':
      return (
        <div className="w-4 h-4 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin shrink-0" />
      );
    case 'checking':
      return (
        <div className="w-4 h-4 rounded-full bg-amber-400/60 animate-pulse shrink-0" />
      );
    case 'revising':
      return (
        <div className="w-4 h-4 rounded-full bg-orange-400/60 animate-pulse shrink-0" />
      );
    case 'done':
      return (
        <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'error':
      return (
        <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
  }
}
