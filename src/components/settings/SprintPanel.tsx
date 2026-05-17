import { useState, useEffect, useRef } from 'react';
import { writingSprintService } from '@/services/writingSprintService';
import type { WritingSprint, SprintStatEntry } from '@/services/writingSprintService';

interface SprintPanelProps {
  projectId: string;
}

const TYPE_OPTIONS = [
  { value: 'pomodoro', label: '番茄钟' },
  { value: 'sprint', label: '冲刺' },
  { value: 'marathon', label: '马拉松' },
  { value: 'custom', label: '自定义' },
];

const DEFAULT_STATUS_STYLE = { bg: 'bg-gray-500/10', text: 'text-gray-400', label: '未知' };

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  planned: { bg: 'bg-gray-500/10', text: 'text-gray-400', label: '计划中' },
  active: { bg: 'bg-green-500/10', text: 'text-green-400', label: '进行中' },
  paused: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', label: '已暂停' },
  completed: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: '已完成' },
  abandoned: { bg: 'bg-red-500/10', text: 'text-red-400', label: '已放弃' },
};

export function SprintPanel({ projectId }: SprintPanelProps) {
  const [sprints, setSprints] = useState<WritingSprint[]>([]);
  const [stats, setStats] = useState<SprintStatEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Create form
  const [type, setType] = useState('pomodoro');
  const [duration, setDuration] = useState(25);
  const [targetWords, setTargetWords] = useState(500);

  // Active sprint controls
  const [actualWords, setActualWords] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sprintsRes, statsRes] = await Promise.all([
        writingSprintService.list(projectId),
        writingSprintService.getStats(projectId, 7),
      ]);
      if (sprintsRes.success && sprintsRes.data) setSprints(sprintsRes.data);
      if (statsRes.success && statsRes.data) setStats(statsRes.data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const activeSprint = sprints.find((s) => s.status === 'active');
  const pausedSprint = sprints.find((s) => s.status === 'paused');

  // Timer logic
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!activeSprint?.startedAt) return;

    const started = new Date(activeSprint.startedAt).getTime();
    const totalMs = activeSprint.durationMinutes * 60 * 1000;

    const tick = () => {
      const elapsed = Date.now() - started;
      const remaining = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
      setRemainingSeconds(remaining);
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeSprint]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCreate = async () => {
    await writingSprintService.create(projectId, {
      type,
      durationMinutes: duration,
      targetWords,
    });
    loadData();
  };

  const handleStart = async (sprintId: string) => {
    await writingSprintService.start(projectId, sprintId);
    loadData();
  };

  const handlePause = async () => {
    if (!activeSprint) return;
    await writingSprintService.pause(projectId, activeSprint.id);
    loadData();
  };

  const handleResume = async () => {
    if (!pausedSprint) return;
    await writingSprintService.resume(projectId, pausedSprint.id);
    loadData();
  };

  const handleComplete = async (sprintId: string) => {
    await writingSprintService.complete(projectId, sprintId, {
      actualWords: parseInt(actualWords) || 0,
    });
    setActualWords('');
    loadData();
  };

  const handleAbandon = async (sprintId: string) => {
    await writingSprintService.abandon(projectId, sprintId);
    loadData();
  };

  const displaySprint = activeSprint ?? pausedSprint;

  return (
    <div className="flex flex-col h-full">
      {/* Active/Paused sprint */}
      {displaySprint && (
        <div className="border-b border-[var(--color-border)] p-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">冲刺进行中</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_STYLES[displaySprint.status]?.bg ?? ''} ${STATUS_STYLES[displaySprint.status]?.text ?? ''}`}>
              {STATUS_STYLES[displaySprint.status]?.label ?? displaySprint.status}
            </span>
          </div>
          <div className="flex items-center justify-center">
            <span className="text-2xl font-mono font-bold text-[var(--color-text-primary)]">
              {activeSprint ? formatTime(remainingSeconds) : formatTime(displaySprint.durationMinutes * 60)}
            </span>
          </div>
          <div className="flex items-center justify-center gap-1 text-[10px] text-[var(--color-text-muted)]">
            <span>{TYPE_OPTIONS.find((t) => t.value === displaySprint.type)?.label}</span>
            <span>|</span>
            <span>目标 {displaySprint.targetWords} 字</span>
          </div>
          <div className="flex items-center gap-1">
            {activeSprint && (
              <button onClick={handlePause} className="flex-1 rounded bg-yellow-500/20 text-yellow-400 px-2 py-1 text-xs hover:opacity-80 transition-opacity">
                暂停
              </button>
            )}
            {pausedSprint && (
              <button onClick={handleResume} className="flex-1 rounded bg-green-500/20 text-green-400 px-2 py-1 text-xs hover:opacity-80 transition-opacity">
                继续
              </button>
            )}
            <button onClick={() => handleComplete(displaySprint.id)} className="flex-1 rounded bg-blue-500/20 text-blue-400 px-2 py-1 text-xs hover:opacity-80 transition-opacity">
              完成
            </button>
            <button onClick={() => handleAbandon(displaySprint.id)} className="flex-1 rounded bg-red-500/20 text-red-400 px-2 py-1 text-xs hover:opacity-80 transition-opacity">
              放弃
            </button>
          </div>
          {/* Actual words input for completion */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={actualWords}
              onChange={(e) => setActualWords(e.target.value)}
              placeholder="实际字数"
              className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-0)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]/50"
            />
            <button
              onClick={() => handleComplete(displaySprint.id)}
              className="rounded bg-[var(--color-primary)] px-2 py-1 text-xs text-white hover:opacity-90 transition-opacity"
            >
              确认完成
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      {!displaySprint && (
        <div className="border-b border-[var(--color-border)] p-2 space-y-2">
          <div className="text-sm font-medium text-[var(--color-text-primary)]">新建冲刺</div>
          <div className="flex items-center gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-0)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]/50"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[var(--color-text-muted)]">时长</span>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                className="w-16 rounded border border-[var(--color-border)] bg-[var(--color-surface-0)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]/50"
              />
              <span className="text-[10px] text-[var(--color-text-muted)]">分钟</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[var(--color-text-muted)]">目标</span>
              <input
                type="number"
                value={targetWords}
                onChange={(e) => setTargetWords(Math.max(0, parseInt(e.target.value) || 0))}
                min={0}
                className="w-16 rounded border border-[var(--color-border)] bg-[var(--color-surface-0)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]/50"
              />
              <span className="text-[10px] text-[var(--color-text-muted)]">字</span>
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={isLoading}
            className="w-full rounded bg-[var(--color-primary)] px-3 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            创建冲刺
          </button>
        </div>
      )}

      {/* History */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* Planned sprints - quick start */}
        {sprints.filter((s) => s.status === 'planned').map((sprint) => (
          <div key={sprint.id} className="flex items-center justify-between rounded border border-[var(--color-border)] p-1.5">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${(STATUS_STYLES.planned ?? DEFAULT_STATUS_STYLE).bg} ${(STATUS_STYLES.planned ?? DEFAULT_STATUS_STYLE).text}`}>
                {(STATUS_STYLES.planned ?? DEFAULT_STATUS_STYLE).label}
              </span>
              <span className="text-[10px] text-[var(--color-text-primary)]">
                {TYPE_OPTIONS.find((t) => t.value === sprint.type)?.label} | {sprint.durationMinutes}分钟 | {sprint.targetWords}字
              </span>
            </div>
            <button
              onClick={() => handleStart(sprint.id)}
              className="rounded bg-green-500/20 text-green-400 px-2 py-0.5 text-[10px] hover:opacity-80 transition-opacity"
            >
              开始
            </button>
          </div>
        ))}

        {/* Past sprints */}
        {sprints.filter((s) => s.status !== 'planned' && s.status !== 'active' && s.status !== 'paused').map((sprint) => {
          const style = STATUS_STYLES[sprint.status] ?? DEFAULT_STATUS_STYLE;
          return (
            <div key={sprint.id} className="flex items-center justify-between rounded border border-[var(--color-border)] p-1.5">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
                  {style.label}
                </span>
                <span className="text-[10px] text-[var(--color-text-primary)]">
                  {TYPE_OPTIONS.find((t) => t.value === sprint.type)?.label} | {sprint.actualWords}/{sprint.targetWords}字
                </span>
              </div>
              <span className="text-[10px] text-[var(--color-text-muted)]">
                {new Date(sprint.createdAt).toLocaleDateString()}
              </span>
            </div>
          );
        })}

        {sprints.length === 0 && !isLoading && (
          <div className="py-4 text-center text-xs text-[var(--color-text-muted)]">暂无冲刺记录</div>
        )}

        {/* Stats */}
        {stats.length > 0 && (
          <div className="rounded border border-[var(--color-border)] p-2 space-y-1">
            <div className="text-[10px] text-[var(--color-text-muted)]">近7天统计</div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded bg-[var(--color-surface-1)] p-1.5 text-center">
                <div className="text-xs font-medium text-[var(--color-text-primary)]">
                  {stats.reduce((sum, s) => sum + s.totalSprints, 0)}
                </div>
                <div className="text-[10px] text-[var(--color-text-muted)]">冲刺数</div>
              </div>
              <div className="rounded bg-[var(--color-surface-1)] p-1.5 text-center">
                <div className="text-xs font-medium text-[var(--color-text-primary)]">
                  {stats.reduce((sum, s) => sum + s.totalMinutes, 0)}
                </div>
                <div className="text-[10px] text-[var(--color-text-muted)]">分钟</div>
              </div>
              <div className="rounded bg-[var(--color-surface-1)] p-1.5 text-center">
                <div className="text-xs font-medium text-[var(--color-text-primary)]">
                  {stats.reduce((sum, s) => sum + s.totalWords, 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-[var(--color-text-muted)]">字数</div>
              </div>
              <div className="rounded bg-[var(--color-surface-1)] p-1.5 text-center">
                <div className="text-xs font-medium text-[var(--color-text-primary)]">
                  {Math.max(...stats.map((s) => s.bestWpm))}
                </div>
                <div className="text-[10px] text-[var(--color-text-muted)]">最高WPM</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
