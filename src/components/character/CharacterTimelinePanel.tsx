import { useState, useEffect } from 'react';
import { characterTimelineService, type TimelineEvent } from '@/services/characterTimelineService';

interface CharacterBrief { id: string; name: string }

interface CharacterTimelinePanelProps {
  projectId: string;
  characters: CharacterBrief[];
}

export function CharacterTimelinePanel({ projectId, characters }: CharacterTimelinePanelProps) {
  const [selectedCharId, setSelectedCharId] = useState<string>('');
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formTime, setFormTime] = useState('');
  const [conflicts, setConflicts] = useState<any>(null);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    if (!selectedCharId) {
      characterTimelineService.list(projectId).then((res) => {
        if (res.success && res.data) setEvents(res.data);
      }).catch(() => {});
      return;
    }
    characterTimelineService.list(projectId, selectedCharId).then((res) => {
      if (res.success && res.data) setEvents(res.data);
    }).catch(() => {});
  }, [projectId, selectedCharId]);

  const handleCreate = async () => {
    if (!formTitle.trim() || !selectedCharId) return;
    const res = await characterTimelineService.create(projectId, {
      characterId: selectedCharId,
      eventTitle: formTitle.trim(),
      eventDescription: formDesc.trim() || undefined,
      storyTime: formTime.trim() || undefined,
    });
    if (res.success && res.data) {
      setEvents((prev) => [...prev, res.data!]);
    }
    setFormTitle('');
    setFormDesc('');
    setFormTime('');
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    const res = await characterTimelineService.remove(projectId, id);
    if (res.success) setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const handleDetectConflicts = async () => {
    setDetecting(true);
    try {
      const res = await characterTimelineService.detectConflicts(projectId);
      if (res.success && res.data) setConflicts(res.data);
    } catch {}
    setDetecting(false);
  };

  const charName = (id: string) => characters.find((c) => c.id === id)?.name ?? '未知';

  return (
    <div className="space-y-3">
      {/* Character filter */}
      <div className="flex items-center gap-2">
        <select
          value={selectedCharId}
          onChange={(e) => setSelectedCharId(e.target.value)}
          className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1 text-xs text-[var(--color-text-primary)]"
        >
          <option value="">全部角色</option>
          {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={handleDetectConflicts} disabled={detecting}
          className="rounded px-2 py-1 text-[10px] text-[var(--color-text-muted)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] disabled:opacity-40">
          {detecting ? '检测中...' : 'AI冲突检测'}
        </button>
        <button onClick={() => { if (selectedCharId) setShowForm(true); }}
          disabled={!selectedCharId}
          className="rounded bg-[var(--color-primary)] px-2 py-1 text-[10px] text-white disabled:opacity-40">+ 添加事件</button>
      </div>

      {/* Timeline */}
      {events.length === 0 ? (
        <div className="py-6 text-center text-xs text-[var(--color-text-muted)]">暂无时间线事件</div>
      ) : (
        <div className="space-y-1">
          {events.map((ev) => (
            <div key={ev.id} className="group flex items-start gap-2 rounded border border-[var(--color-border)] p-2">
              <div className="shrink-0 mt-0.5 h-2 w-2 rounded-full bg-[var(--color-primary)]" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  {!selectedCharId && (
                    <span className="text-[10px] text-purple-400">{charName(ev.characterId)}</span>
                  )}
                  {ev.storyTime && (
                    <span className="text-[10px] text-[var(--color-text-muted)]">{ev.storyTime}</span>
                  )}
                </div>
                <div className="text-xs text-[var(--color-text-primary)]">{ev.eventTitle}</div>
                {ev.eventDescription && (
                  <div className="text-[10px] text-[var(--color-text-muted)] line-clamp-2">{ev.eventDescription}</div>
                )}
              </div>
              <button onClick={() => handleDelete(ev.id)}
                className="shrink-0 text-[10px] text-[var(--color-text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100">×</button>
            </div>
          ))}
        </div>
      )}

      {/* Conflicts */}
      {conflicts && conflicts.conflicts?.length > 0 && (
        <div className="rounded border border-red-500/30 bg-red-500/5 p-2 space-y-1">
          <div className="text-[10px] font-medium text-red-400">检测到冲突</div>
          {conflicts.conflicts.map((c: any, i: number) => (
            <div key={i} className="text-[10px] text-[var(--color-text-secondary)]">
              <span className="text-red-400">{c.characters?.join(' ↔ ')}</span>：{c.description}
            </div>
          ))}
        </div>
      )}
      {conflicts && !conflicts.conflicts?.length && (
        <div className="rounded bg-green-500/10 p-2 text-[10px] text-green-400">未发现时间线冲突</div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="space-y-2 rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2">
          <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="事件标题" autoFocus
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none" />
          <input type="text" value={formTime} onChange={(e) => setFormTime(e.target.value)} placeholder="故事内时间（如：第三天清晨）"
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none" />
          <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="事件描述..." rows={2}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none" />
          <div className="flex gap-1">
            <button onClick={() => setShowForm(false)} className="flex-1 rounded px-2 py-1 text-xs text-[var(--color-text-muted)]">取消</button>
            <button onClick={handleCreate} disabled={!formTitle.trim()} className="flex-1 rounded bg-[var(--color-primary)] px-2 py-1 text-xs text-white disabled:opacity-40">添加</button>
          </div>
        </div>
      )}
    </div>
  );
}
