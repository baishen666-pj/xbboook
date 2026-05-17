import { useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type { SceneWithPov, SceneStatus } from '@/types/project';

const MOODS = ['tense', 'romantic', 'action', 'calm', 'mystery', 'horror', 'comedy', 'sad'];
const TIMES = ['morning', 'afternoon', 'evening', 'night', 'dawn', 'midnight'];
const STATUSES: Array<{ value: SceneStatus; label: string }> = [
  { value: 'draft', label: '草稿' },
  { value: 'writing', label: '写作中' },
  { value: 'revising', label: '修改中' },
  { value: 'done', label: '完成' },
];

interface SceneFormProps {
  scene: SceneWithPov | null;
  projectId: string;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

export function SceneForm({ scene, projectId, onSubmit, onCancel }: SceneFormProps) {
  const chapters = useProjectStore((s) => s.chapters);
  const characters = useProjectStore((s) => s.characters);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState(scene?.title ?? '');
  const [chapterId, setChapterId] = useState(scene?.chapterId ?? (chapters[0]?.id ?? ''));
  const [summary, setSummary] = useState(scene?.summary ?? '');
  const [mood, setMood] = useState(scene?.mood ?? '');
  const [location, setLocation] = useState(scene?.location ?? '');
  const [timeOfDay, setTimeOfDay] = useState(scene?.timeOfDay ?? '');
  const [povCharacterId, setPovCharacterId] = useState(scene?.povCharacterId ?? '');
  const [status, setStatus] = useState<SceneStatus>(scene?.status ?? 'draft');
  const [tagsInput, setTagsInput] = useState(scene?.tags?.join(', ') ?? '');
  const [notes, setNotes] = useState(scene?.notes ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !chapterId) return;

    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await onSubmit({
        title: title.trim(),
        chapterId,
        summary,
        mood,
        location,
        timeOfDay,
        povCharacterId: povCharacterId || null,
        status,
        tags,
        notes,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 shadow-2xl max-h-[85vh] overflow-y-auto"
      >
        <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
          {scene ? '编辑场景' : '新建场景'}
        </h3>

        <div className="space-y-3">
          {/* Title */}
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">场景标题 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
              placeholder="例：雨夜相遇"
              required
            />
          </div>

          {/* Chapter */}
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">所属章节 *</label>
            <select
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
              required
            >
              <option value="">选择章节</option>
              {chapters.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.title}</option>
              ))}
            </select>
          </div>

          {/* Summary */}
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">场景概要</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] resize-none"
              rows={3}
              placeholder="简要描述这个场景发生的事..."
            />
          </div>

          {/* Mood + Time row */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">氛围</label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
              >
                <option value="">选择氛围</option>
                {MOODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">时间段</label>
              <select
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
              >
                <option value="">选择时间</option>
                {TIMES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Location + POV */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">地点</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
                placeholder="例：城北酒馆"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">视角角色</label>
              <select
                value={povCharacterId}
                onChange={(e) => setPovCharacterId(e.target.value)}
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
              >
                <option value="">选择角色</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">状态</label>
            <div className="flex gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  className={`rounded px-2 py-1 text-xs transition-colors ${
                    status === s.value
                      ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">标签（逗号分隔）</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
              placeholder="例：关键转折, 高潮, 对决"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">备注</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] resize-none"
              rows={2}
              placeholder="场景备注..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)]"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={submitting || !title.trim() || !chapterId}
            className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? '保存中...' : scene ? '更新' : '创建'}
          </button>
        </div>
      </form>
    </div>
  );
}
