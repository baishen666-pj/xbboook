import { useState } from 'react';
import { DeleteButton } from '@/components/ui/DeleteButton';
import type { SceneWithPov, SceneStatus } from '@/types/project';

const STATUS_COLORS: Record<SceneStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-500/10', text: 'text-gray-400', label: '草稿' },
  writing: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: '写作' },
  revising: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: '修改' },
  done: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: '完成' },
};

const MOOD_COLORS: Record<string, string> = {
  tense: 'text-red-400',
  romantic: 'text-pink-400',
  action: 'text-orange-400',
  calm: 'text-cyan-400',
  mystery: 'text-purple-400',
  horror: 'text-gray-500',
  comedy: 'text-yellow-400',
  sad: 'text-blue-400',
};

const TIME_LABELS: Record<string, string> = {
  morning: '清晨',
  afternoon: '午后',
  evening: '傍晚',
  night: '深夜',
  dawn: '黎明',
  midnight: '子夜',
};

interface SceneCardProps {
  scene: SceneWithPov;
  chapterTitle: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: SceneStatus) => void;
}

export function SceneCard({ scene, chapterTitle, onEdit, onDelete, onStatusChange }: SceneCardProps) {
  const [expanded, setExpanded] = useState(false);
  const statusStyle = STATUS_COLORS[scene.status];

  return (
    <div className="group rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2.5 transition-colors hover:bg-[var(--color-surface-3)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          {/* Header line */}
          <div className="flex items-center gap-2">
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${statusStyle.bg} ${statusStyle.text}`}>
              {statusStyle.label}
            </span>
            <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
              {scene.title}
            </span>
            {scene.wordCount > 0 && (
              <span className="shrink-0 text-[10px] text-[var(--color-text-muted)]">
                {scene.wordCount} 字
              </span>
            )}
          </div>

          {/* Quick info line */}
          {!expanded && (
            <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
              {scene.mood && (
                <span className={MOOD_COLORS[scene.mood] ?? ''}>{scene.mood}</span>
              )}
              {scene.location && <span>{scene.location}</span>}
              {scene.timeOfDay && <span>{TIME_LABELS[scene.timeOfDay] ?? scene.timeOfDay}</span>}
              {scene.povName && <span>视角: {scene.povName}</span>}
            </div>
          )}

          {/* Expanded details */}
          {expanded && (
            <div className="mt-2 space-y-2">
              {scene.summary && (
                <p className="text-xs text-[var(--color-text-muted)] whitespace-pre-wrap leading-relaxed">
                  {scene.summary}
                </p>
              )}

              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                {scene.mood && (
                  <div className="flex items-center gap-1">
                    <span className="text-[var(--color-text-muted)]">氛围:</span>
                    <span className={MOOD_COLORS[scene.mood] ?? ''}>{scene.mood}</span>
                  </div>
                )}
                {scene.location && (
                  <div className="flex items-center gap-1">
                    <span className="text-[var(--color-text-muted)]">地点:</span>
                    <span>{scene.location}</span>
                  </div>
                )}
                {scene.timeOfDay && (
                  <div className="flex items-center gap-1">
                    <span className="text-[var(--color-text-muted)]">时间:</span>
                    <span>{TIME_LABELS[scene.timeOfDay] ?? scene.timeOfDay}</span>
                  </div>
                )}
                {scene.povName && (
                  <div className="flex items-center gap-1">
                    <span className="text-[var(--color-text-muted)]">视角:</span>
                    <span>{scene.povName}</span>
                  </div>
                )}
              </div>

              {/* Tags */}
              {scene.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {scene.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-[var(--color-surface-1)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Notes */}
              {scene.notes && (
                <div className="rounded bg-[var(--color-surface-1)] p-1.5 text-[10px] text-[var(--color-text-muted)] whitespace-pre-wrap">
                  {scene.notes}
                </div>
              )}

              {/* Status change buttons */}
              <div className="flex gap-1.5 pt-1">
                {(['draft', 'writing', 'revising', 'done'] as SceneStatus[])
                  .filter((s) => s !== scene.status)
                  .map((s) => (
                    <button
                      key={s}
                      onClick={(e) => { e.stopPropagation(); onStatusChange(s); }}
                      className={`rounded border px-2 py-0.5 text-[10px] transition-colors ${
                        STATUS_COLORS[s].bg.includes('emerald')
                          ? 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                          : STATUS_COLORS[s].bg.includes('blue')
                            ? 'border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
                            : STATUS_COLORS[s].bg.includes('amber')
                              ? 'border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                              : 'border-gray-500/20 text-gray-400 hover:bg-gray-500/20'
                      }`}
                    >
                      标记{STATUS_COLORS[s].label}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-secondary)]"
            title="编辑"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M8.5 1.5l2 2-7 7H1.5V8.5l7-7z" />
            </svg>
          </button>
          <DeleteButton onDelete={onDelete} />
        </div>
      </div>
    </div>
  );
}
