import { useState, useCallback, useRef } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { useAgentStore } from '@/stores/agentStore';
import * as agentService from '@/services/agentService';

interface Props {
  projectId: string;
}

const STATUS_LABELS: Record<string, string> = {
  idle: '空闲',
  planning: '规划中',
  drafting: '撰写中',
  reviewing: '自审中',
  revising: '修订中',
  paused: '已暂停',
  completed: '已完成',
  failed: '失败',
};

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-gray-500',
  planning: 'bg-blue-500',
  drafting: 'bg-green-500',
  reviewing: 'bg-yellow-500',
  revising: 'bg-orange-500',
  paused: 'bg-amber-500',
  completed: 'bg-emerald-500',
  failed: 'bg-red-500',
};

export function AgentWritingPanel({ projectId }: Props) {
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const { activeSession, isRunning, updateSession, addLog, setRunning, setActiveSession, reset } = useAgentStore();

  const [targetWords, setTargetWords] = useState(2500);
  const [maxIterations, setMaxIterations] = useState(3);
  const [strictness, setStrictness] = useState<'low' | 'medium' | 'high'>('medium');
  const [enableRevision, setEnableRevision] = useState(true);
  const [customInstructions, setCustomInstructions] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const handleStart = useCallback(async () => {
    if (!activeChapterId) return;

    try {
      const session = await agentService.createAgentSession(projectId, activeChapterId, {
        maxIterations,
        draftTargetWords: targetWords,
        reviewStrictness: strictness,
        enableSelfRevision: enableRevision,
        customInstructions: customInstructions || undefined,
      });

      setActiveSession(session.id);
      setRunning(true);
      addLog('info', `会话创建: ${session.id.slice(0, 8)}`);

      const controller = new AbortController();
      abortRef.current = controller;

      for await (const event of agentService.runAgentSession(projectId, session.id, controller.signal)) {
        const d = event.data;

        if (event.type === 'status_change') {
          updateSession({ status: String(d.status || ''), currentStep: String(d.status || ''), iteration: Number(d.iteration ?? 0) });
          addLog('status', STATUS_LABELS[String(d.status)] || String(d.status));
        } else if (event.type === 'decision') {
          if (d.decisionType === 'plan') {
            updateSession({ planPreview: String(d.chapterGoal || ''), iteration: Number(d.iteration ?? 0) });
            addLog('plan', `规划: ${d.chapterGoal} (${d.sceneCount}个场景)`);
          } else if (d.decisionType === 'revision') {
            addLog('revision', `修订完成: ${d.wordCount}字`);
          }
        } else if (event.type === 'draft_progress') {
          updateSession({ draftPreview: `${String(d.wordCount || 0)}字 / 场景${Number(d.sceneIndex ?? 0) + 1}` });
        } else if (event.type === 'review_result') {
          updateSession({ reviewScore: Number(d.score ?? 0), reviewPassed: Boolean(d.passed) });
          addLog('review', `评分: ${d.score}/10 ${d.passed ? '✓' : '✗'} (${d.issueCount}个问题)`);
        } else if (event.type === 'done') {
          updateSession({ status: 'completed', currentStep: '完成' });
          addLog('done', `完成! ${d.wordCount}字, ${d.iterations}轮, 评分${d.score}`);
          setRunning(false);
        } else if (event.type === 'error') {
          updateSession({ status: 'failed', currentStep: String(d.error || 'error') });
          addLog('error', String(d.error || '未知错误'));
          setRunning(false);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      addLog('error', err instanceof Error ? err.message : 'Unknown error');
      setRunning(false);
    }
  }, [projectId, activeChapterId, maxIterations, targetWords, strictness, enableRevision, customInstructions, setActiveSession, setRunning, updateSession, addLog]);

  const handlePause = useCallback(async () => {
    if (!activeSession.id) return;
    try {
      await agentService.pauseAgentSession(projectId, activeSession.id);
      addLog('info', '已暂停');
      setRunning(false);
    } catch (err) {
      addLog('error', '暂停失败');
    }
  }, [projectId, activeSession.id, addLog, setRunning]);

  const handleCancel = useCallback(async () => {
    abortRef.current?.abort();
    if (activeSession.id) {
      await agentService.cancelAgentSession(projectId, activeSession.id).catch(() => {});
    }
    reset();
  }, [projectId, activeSession.id, reset]);

  return (
    <div className="p-3 space-y-3 text-sm">
      {/* Config */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">代理写作配置</h4>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--color-text-muted)]">目标字数</span>
            <input
              type="number"
              value={targetWords}
              onChange={(e) => setTargetWords(Number(e.target.value))}
              className="rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-[var(--color-text-primary)]"
              disabled={isRunning}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--color-text-muted)]">最大迭代</span>
            <input
              type="number"
              value={maxIterations}
              onChange={(e) => setMaxIterations(Number(e.target.value))}
              className="rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-[var(--color-text-primary)]"
              min={1} max={5}
              disabled={isRunning}
            />
          </label>
        </div>

        <div className="flex gap-2">
          <select
            value={strictness}
            onChange={(e) => setStrictness(e.target.value as 'low' | 'medium' | 'high')}
            className="rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-[var(--color-text-primary)]"
            disabled={isRunning}
          >
            <option value="low">宽松审查</option>
            <option value="medium">标准审查</option>
            <option value="high">严格审查</option>
          </select>
          <label className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
            <input
              type="checkbox"
              checked={enableRevision}
              onChange={(e) => setEnableRevision(e.target.checked)}
              disabled={isRunning}
            />
            自动修订
          </label>
        </div>

        <textarea
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          placeholder="自定义写作指令（可选）"
          className="w-full rounded bg-white/5 border border-white/10 px-2 py-1 text-xs text-[var(--color-text-primary)] placeholder-white/20"
          rows={2}
          disabled={isRunning}
        />
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {!isRunning ? (
          <button
            onClick={handleStart}
            disabled={!activeChapterId}
            className="flex-1 rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {activeSession.status === 'paused' ? '恢复写作' : '启动代理'}
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="flex-1 rounded bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            暂停
          </button>
        )}
        {(isRunning || activeSession.id) && (
          <button
            onClick={handleCancel}
            className="rounded bg-red-600/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-600/30"
          >
            取消
          </button>
        )}
      </div>

      {/* Status */}
      {activeSession.id && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${STATUS_COLORS[activeSession.status] || 'bg-gray-500'}`} />
            <span className="text-xs text-[var(--color-text-primary)]">
              {STATUS_LABELS[activeSession.status] || activeSession.status}
              {activeSession.currentStep && ` — ${activeSession.currentStep}`}
            </span>
            <span className="ml-auto text-xs text-[var(--color-text-muted)]">
              第{activeSession.iteration + 1}/{activeSession.maxIterations}轮
            </span>
          </div>

          {activeSession.reviewScore > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--color-text-muted)]">评分:</span>
              <span className={activeSession.reviewPassed ? 'text-emerald-400' : 'text-yellow-400'}>
                {activeSession.reviewScore}/10 {activeSession.reviewPassed ? '✓' : '✗'}
              </span>
            </div>
          )}

          {/* Progress steps */}
          <div className="flex gap-1">
            {['planning', 'drafting', 'reviewing', 'revising', 'completed'].map((step) => (
              <div
                key={step}
                className={`h-1 flex-1 rounded-full ${
                  activeSession.status === step || (activeSession.status === 'completed' && step !== 'revising')
                    ? 'bg-[var(--color-primary)]'
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Log */}
      {activeSession.logs.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded bg-black/20 p-2 space-y-0.5">
          {activeSession.logs.map((log, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <span className="text-[var(--color-text-muted)] shrink-0">
                {new Date(log.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className={
                log.type === 'error' ? 'text-red-400' :
                log.type === 'done' ? 'text-emerald-400' :
                log.type === 'plan' ? 'text-blue-400' :
                log.type === 'review' ? 'text-yellow-400' :
                'text-[var(--color-text-muted)]'
              }>
                {log.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
