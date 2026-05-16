import { useEffect, useState, useCallback } from 'react';
import { useStoryArcStore } from '../../stores/storyArcStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { InlineForm } from '@/components/ui/InlineForm';
import { DeleteButton } from '@/components/ui/DeleteButton';

type ArcStatus = 'planned' | 'active' | 'completed' | 'abandoned';
type ThreadStatus = 'open' | 'resolved' | 'dormant' | 'abandoned';
type Priority = 'critical' | 'high' | 'normal' | 'low';

const ARC_STATUS_ORDER: readonly ArcStatus[] = ['planned', 'active', 'completed', 'abandoned'] as const;
const ARC_STATUS_LABELS: Record<string, string> = { planned: '计划中', active: '进行中', completed: '已完成', abandoned: '已废弃' };
const DEFAULT_LABEL = '';
const ARC_STATUS_COLORS: Record<string, "blue" | "green" | "gray" | "red"> = { planned: 'blue', active: 'green', completed: 'gray', abandoned: 'red' };
const DEFAULT_ARC_COLOR: "blue" | "green" | "gray" | "red" = 'blue';

const THREAD_STATUS_ORDER: readonly ThreadStatus[] = ['open', 'resolved', 'dormant', 'abandoned'] as const;
const THREAD_STATUS_LABELS: Record<string, string> = { open: '开放', resolved: '已解决', dormant: '休眠', abandoned: '废弃' };
const THREAD_STATUS_COLORS: Record<string, "blue" | "green" | "gray" | "red"> = { open: 'blue', resolved: 'green', dormant: 'gray', abandoned: 'red' };
const DEFAULT_THREAD_COLOR: "blue" | "green" | "gray" | "red" = 'blue';

const PRIORITY_ORDER: readonly Priority[] = ['critical', 'high', 'normal', 'low'] as const;
const PRIORITY_LABELS: Record<string, string> = { critical: '关键', high: '高', normal: '普通', low: '低' };
const PRIORITY_COLORS: Record<string, "red" | "orange" | "gray" | "emerald"> = { critical: 'red', high: 'orange', normal: 'gray', low: 'emerald' };
const DEFAULT_PRIORITY_COLOR: "red" | "orange" | "gray" | "emerald" = 'gray';

export function StoryArcPanel() {
  const currentProjectId = useProjectStore((s) => s.currentProject?.id);
  const chapters = useProjectStore((s) => s.chapters);
  const store = useStoryArcStore();
  const { arcs, threads, isLoading, error, clearError } = store;

  const [showNewArc, setShowNewArc] = useState(false);
  const [newArcName, setNewArcName] = useState('');
  const [expandedArc, setExpandedArc] = useState<string | null>(null);
  const [showNewThread, setShowNewThread] = useState<string | null>(null);
  const [newThreadName, setNewThreadName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingDesc, setEditingDesc] = useState<string | null>(null);
  const [descValue, setDescValue] = useState('');

  useEffect(() => {
    if (currentProjectId) {
      store.fetchArcs(currentProjectId);
      store.fetchThreads(currentProjectId);
    }
  }, [currentProjectId]);

  const pid = currentProjectId ?? '';

  const handleCreateArc = useCallback(async () => {
    if (!pid || !newArcName.trim()) return;
    await store.createArc(pid, { name: newArcName.trim() });
    setNewArcName('');
    setShowNewArc(false);
  }, [pid, newArcName, store]);

  const handleCreateThread = useCallback(async (arcId: string) => {
    if (!pid || !newThreadName.trim()) return;
    await store.createThread(pid, { name: newThreadName.trim(), arcId });
    setNewThreadName('');
    setShowNewThread(null);
  }, [pid, newThreadName, store]);

  const cycleArcStatus = useCallback(async (arcId: string, current: string) => {
    const idx = ARC_STATUS_ORDER.indexOf(current as ArcStatus);
    await store.updateArc(pid, arcId, { status: ARC_STATUS_ORDER[(idx + 1) % ARC_STATUS_ORDER.length] });
  }, [pid, store]);

  const cycleThreadStatus = useCallback(async (threadId: string, current: string) => {
    const idx = THREAD_STATUS_ORDER.indexOf(current as ThreadStatus);
    await store.updateThread(pid, threadId, { status: THREAD_STATUS_ORDER[(idx + 1) % THREAD_STATUS_ORDER.length] });
  }, [pid, store]);

  const cyclePriority = useCallback(async (threadId: string, current: string) => {
    const idx = PRIORITY_ORDER.indexOf(current as Priority);
    await store.updateThread(pid, threadId, { priority: PRIORITY_ORDER[(idx + 1) % PRIORITY_ORDER.length] });
  }, [pid, store]);

  const startEdit = useCallback((id: string, name: string) => {
    setEditingId(id);
    setEditValue(name);
  }, []);

  const saveEdit = useCallback(async (type: 'arc' | 'thread', id: string) => {
    if (!editValue.trim()) { setEditingId(null); return; }
    if (type === 'arc') await store.updateArc(pid, id, { name: editValue.trim() });
    else await store.updateThread(pid, id, { name: editValue.trim() });
    setEditingId(null);
  }, [pid, editValue, store]);

  const startDescEdit = useCallback((id: string, desc: string | null) => {
    setEditingDesc(id);
    setDescValue(desc ?? '');
  }, []);

  const saveDesc = useCallback(async (arcId: string) => {
    await store.updateArc(pid, arcId, { description: descValue });
    setEditingDesc(null);
  }, [pid, descValue, store]);

  const arcThreads = (arcId: string) => threads.filter((t) => t.arc_id === arcId);
  const unassignedThreads = threads.filter((t) => !t.arc_id);

  const chapterLabel = (num: number | null) => {
    if (num == null) return '';
    const ch = chapters.find(c => c.sortOrder === num || parseInt(c.id) === num);
    return ch ? `Ch.${num} ${ch.title}` : `Ch.${num}`;
  };

  if (isLoading) {
    return <div className="p-4 text-[var(--color-text-muted)] text-[var(--text-sm)]">加载中...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 text-red-400 px-3 py-2 text-[var(--text-xs)]" role="alert">
          <span className="flex-1">{error}</span>
          <button onClick={clearError} className="text-red-400 hover:opacity-70">&times;</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
        <h2 className="text-[var(--text-sm)] font-semibold text-[var(--color-text-primary)]">故事弧线</h2>
        <button
          onClick={() => setShowNewArc(true)}
          className="text-[var(--text-xs)] px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--color-primary)] hover:opacity-90 text-white transition-opacity"
        >
          + 弧线
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {showNewArc && (
          <InlineForm
            value={newArcName}
            onChange={setNewArcName}
            onSubmit={handleCreateArc}
            onCancel={() => { setShowNewArc(false); setNewArcName(''); }}
            placeholder="弧线名称"
            submitLabel="创建"
          />
        )}

        {arcs.map((arc) => (
          <div key={arc.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
            {/* Arc header */}
            <div
              className="flex items-center gap-2 px-3 py-2 bg-[var(--color-surface-2)] cursor-pointer hover:bg-[var(--color-surface-3)] transition-colors"
              onClick={() => setExpandedArc(expandedArc === arc.id ? null : arc.id)}
              role="button"
              tabIndex={0}
              aria-expanded={expandedArc === arc.id}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedArc(expandedArc === arc.id ? null : arc.id); } }}
            >
              <svg
                width="12" height="12" viewBox="0 0 12 12"
                className={`text-[var(--color-text-muted)] transition-transform flex-shrink-0 ${expandedArc === arc.id ? 'rotate-90' : ''}`}
                fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"
              >
                <path d="M4 2l4 4-4 4" />
              </svg>

              {editingId === arc.id ? (
                <input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit('arc', arc.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onBlur={() => saveEdit('arc', arc.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[var(--text-sm)] text-[var(--color-text-primary)] outline-none"
                  autoFocus
                />
              ) : (
                <span
                  className="flex-1 text-[var(--text-sm)] text-[var(--color-text-primary)] truncate"
                  onDoubleClick={(e) => { e.stopPropagation(); startEdit(arc.id, arc.name); }}
                  title="双击编辑名称"
                >
                  {arc.name}
                </span>
              )}

              <button onClick={(e) => { e.stopPropagation(); cycleArcStatus(arc.id, arc.status); }} aria-label={`切换弧线状态: ${ARC_STATUS_LABELS[arc.status]}`}>
                <StatusBadge label={ARC_STATUS_LABELS[arc.status] ?? DEFAULT_LABEL} color={ARC_STATUS_COLORS[arc.status] ?? DEFAULT_ARC_COLOR} />
              </button>
              <DeleteButton
                onDelete={() => store.deleteArc(pid, arc.id)}
                confirmMessage={`删除弧线「${arc.name}」?`}
              />
            </div>

            {/* Arc expanded content */}
            {expandedArc === arc.id && (
              <div className="border-t border-[var(--color-border)] px-3 py-2 space-y-2 bg-[var(--color-surface-1)]">
                {/* Description */}
                {editingDesc === arc.id ? (
                  <div className="space-y-1">
                    <textarea
                      value={descValue}
                      onChange={(e) => setDescValue(e.target.value)}
                      placeholder="弧线描述..."
                      className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-muted)] outline-none resize-none"
                      rows={2}
                      autoFocus
                    />
                    <div className="flex gap-1">
                      <button onClick={() => saveDesc(arc.id)} className="text-[10px] text-[var(--color-primary)] hover:opacity-80">保存</button>
                      <button onClick={() => setEditingDesc(null)} className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">取消</button>
                    </div>
                  </div>
                ) : (
                  <p
                    className="text-[var(--text-xs)] text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-secondary)]"
                    onClick={() => startDescEdit(arc.id, arc.description)}
                    title="点击编辑描述"
                  >
                    {arc.description || '点击添加描述...'}
                  </p>
                )}

                {/* Chapter range */}
                {(arc.start_chapter != null || arc.end_chapter != null) && (
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    {chapterLabel(arc.start_chapter) || '未设置'} → {chapterLabel(arc.end_chapter) || '未设置'}
                  </p>
                )}

                {/* Threads */}
                {arcThreads(arc.id).map((thread) => (
                  <div key={thread.id} className="flex items-center gap-1.5 p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-2)] transition-colors">
                    <button onClick={() => cyclePriority(thread.id, thread.priority)} title="切换优先级" aria-label={`切换优先级: ${PRIORITY_LABELS[thread.priority]}`}>
                      <StatusBadge label={PRIORITY_LABELS[thread.priority] ?? DEFAULT_LABEL} color={PRIORITY_COLORS[thread.priority] ?? DEFAULT_PRIORITY_COLOR} />
                    </button>

                    {editingId === `t-${thread.id}` ? (
                      <input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit('thread', thread.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onBlur={() => saveEdit('thread', thread.id)}
                        className="flex-1 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-1 py-0.5 text-[var(--text-xs)] text-[var(--color-text-primary)] outline-none"
                        autoFocus
                      />
                    ) : (
                      <span
                        className="flex-1 text-[var(--text-xs)] text-[var(--color-text-secondary)] truncate"
                        onDoubleClick={() => startEdit(`t-${thread.id}`, thread.name)}
                        title="双击编辑名称"
                      >
                        {thread.name}
                      </span>
                    )}

                    <button onClick={() => cycleThreadStatus(thread.id, thread.status)} aria-label={`切换线索状态: ${THREAD_STATUS_LABELS[thread.status]}`}>
                      <StatusBadge label={THREAD_STATUS_LABELS[thread.status] ?? DEFAULT_LABEL} color={THREAD_STATUS_COLORS[thread.status] ?? DEFAULT_THREAD_COLOR} />
                    </button>
                    <DeleteButton onDelete={() => store.deleteThread(pid, thread.id)} />
                  </div>
                ))}

                {/* Add thread */}
                {showNewThread === arc.id ? (
                  <InlineForm
                    value={newThreadName}
                    onChange={setNewThreadName}
                    onSubmit={() => handleCreateThread(arc.id)}
                    onCancel={() => { setShowNewThread(null); setNewThreadName(''); }}
                    placeholder="线索名称"
                    submitLabel="添加"
                  />
                ) : (
                  <button
                    onClick={() => setShowNewThread(arc.id)}
                    className="text-[var(--text-xs)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] px-1 py-0.5 transition-colors"
                  >
                    + 添加线索
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Unassigned threads */}
        {unassignedThreads.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
            <p className="text-[10px] text-[var(--color-text-muted)] px-2 mb-1">未分配线索</p>
            {unassignedThreads.map((thread) => (
              <div key={thread.id} className="flex items-center gap-1.5 p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-2)] transition-colors">
                <button onClick={() => cyclePriority(thread.id, thread.priority)} aria-label={`切换优先级: ${PRIORITY_LABELS[thread.priority]}`}>
                  <StatusBadge label={PRIORITY_LABELS[thread.priority] ?? DEFAULT_LABEL} color={PRIORITY_COLORS[thread.priority] ?? DEFAULT_PRIORITY_COLOR} />
                </button>
                <span className="flex-1 text-[var(--text-xs)] text-[var(--color-text-muted)] truncate">{thread.name}</span>
                <button onClick={() => cycleThreadStatus(thread.id, thread.status)} aria-label={`切换线索状态: ${THREAD_STATUS_LABELS[thread.status]}`}>
                  <StatusBadge label={THREAD_STATUS_LABELS[thread.status] ?? DEFAULT_LABEL} color={THREAD_STATUS_COLORS[thread.status] ?? DEFAULT_THREAD_COLOR} />
                </button>
                <DeleteButton onDelete={() => store.deleteThread(pid, thread.id)} />
              </div>
            ))}
          </div>
        )}

        {arcs.length === 0 && unassignedThreads.length === 0 && !showNewArc && (
          <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] text-center py-8">暂无故事弧线，点击上方按钮创建</p>
        )}
      </div>
    </div>
  );
}
