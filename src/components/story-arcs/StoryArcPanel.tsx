import { useEffect, useState } from 'react';
import { useStoryArcStore } from '../../stores/storyArcStore.js';
import { useProjectStore } from '../../stores/projectStore.js';

const STATUS_LABELS: Record<string, string> = {
  planned: '计划中',
  active: '进行中',
  completed: '已完成',
  abandoned: '已废弃',
};

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-blue-500/20 text-blue-400',
  active: 'bg-green-500/20 text-green-400',
  completed: 'bg-gray-500/20 text-gray-400',
  abandoned: 'bg-red-500/20 text-red-400',
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: '关键',
  high: '高',
  normal: '普通',
  low: '低',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  normal: 'text-gray-400',
  low: 'text-gray-500',
};

const THREAD_STATUS_LABELS: Record<string, string> = {
  open: '开放',
  resolved: '已解决',
  dormant: '休眠',
  abandoned: '废弃',
};

export function StoryArcPanel() {
  const currentProjectId = useProjectStore((s) => s.currentProject?.id);
  const { arcs, threads, isLoading, fetchArcs, fetchThreads, createArc, createThread, updateArc, updateThread, deleteArc, deleteThread } = useStoryArcStore();
  const [showNewArc, setShowNewArc] = useState(false);
  const [newArcName, setNewArcName] = useState('');
  const [expandedArc, setExpandedArc] = useState<string | null>(null);
  const [showNewThread, setShowNewThread] = useState<string | null>(null);
  const [newThreadName, setNewThreadName] = useState('');

  useEffect(() => {
    if (currentProjectId) {
      fetchArcs(currentProjectId);
      fetchThreads(currentProjectId);
    }
  }, [currentProjectId, fetchArcs, fetchThreads]);

  const handleCreateArc = async () => {
    if (!currentProjectId || !newArcName.trim()) return;
    await createArc(currentProjectId, { name: newArcName.trim() });
    setNewArcName('');
    setShowNewArc(false);
  };

  const handleCreateThread = async (arcId: string) => {
    if (!currentProjectId || !newThreadName.trim()) return;
    await createThread(currentProjectId, { name: newThreadName.trim(), arcId });
    setNewThreadName('');
    setShowNewThread(null);
  };

  const handleCycleArcStatus = async (arcId: string, currentStatus: string) => {
    const order = ['planned', 'active', 'completed', 'abandoned'] as const;
    const idx = order.indexOf(currentStatus as any);
    const next = order[(idx + 1) % order.length];
    await updateArc(arcId, { status: next });
  };

  const handleCycleThreadStatus = async (threadId: string, currentStatus: string) => {
    const order = ['open', 'resolved', 'dormant', 'abandoned'] as const;
    const idx = order.indexOf(currentStatus as any);
    const next = order[(idx + 1) % order.length];
    await updateThread(threadId, { status: next });
  };

  const arcThreads = (arcId: string) => threads.filter((t) => t.arc_id === arcId);
  const unassignedThreads = threads.filter((t) => !t.arc_id);

  if (isLoading) {
    return <div className="p-4 text-gray-500">加载中...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <h2 className="text-sm font-semibold text-gray-200">故事弧线</h2>
        <button
          onClick={() => setShowNewArc(true)}
          className="text-xs px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          + 弧线
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {showNewArc && (
          <div className="flex gap-1 p-2 bg-white/5 rounded">
            <input
              value={newArcName}
              onChange={(e) => setNewArcName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateArc()}
              placeholder="弧线名称"
              className="flex-1 bg-transparent text-sm text-gray-200 outline-none placeholder:text-gray-500"
              autoFocus
            />
            <button onClick={handleCreateArc} className="text-xs text-indigo-400 hover:text-indigo-300">确认</button>
            <button onClick={() => { setShowNewArc(false); setNewArcName(''); }} className="text-xs text-gray-500 hover:text-gray-400">取消</button>
          </div>
        )}

        {arcs.map((arc) => (
          <div key={arc.id} className="rounded bg-white/5">
            <div
              className="flex items-center gap-2 p-2 cursor-pointer hover:bg-white/5 rounded transition-colors"
              onClick={() => setExpandedArc(expandedArc === arc.id ? null : arc.id)}
            >
              <span className="text-gray-500 text-xs">{expandedArc === arc.id ? '▼' : '▶'}</span>
              <span className="flex-1 text-sm text-gray-200 truncate">{arc.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleCycleArcStatus(arc.id, arc.status); }}
                className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLORS[arc.status] || ''}`}
              >
                {STATUS_LABELS[arc.status] || arc.status}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteArc(arc.id); }}
                className="text-gray-600 hover:text-red-400 text-xs transition-colors"
              >
                ×
              </button>
            </div>

            {expandedArc === arc.id && (
              <div className="pl-6 pr-2 pb-2 space-y-1">
                {arcThreads(arc.id).map((thread) => (
                  <div key={thread.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-white/5">
                    <span className={`text-[10px] ${PRIORITY_COLORS[thread.priority] || ''}`}>
                      {PRIORITY_LABELS[thread.priority] || thread.priority}
                    </span>
                    <span className="flex-1 text-xs text-gray-300 truncate">{thread.name}</span>
                    <button
                      onClick={() => handleCycleThreadStatus(thread.id, thread.status)}
                      className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {THREAD_STATUS_LABELS[thread.status] || thread.status}
                    </button>
                    <button
                      onClick={() => deleteThread(thread.id)}
                      className="text-gray-600 hover:text-red-400 text-xs transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {showNewThread === arc.id ? (
                  <div className="flex gap-1 p-1">
                    <input
                      value={newThreadName}
                      onChange={(e) => setNewThreadName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateThread(arc.id)}
                      placeholder="线索名称"
                      className="flex-1 bg-transparent text-xs text-gray-200 outline-none placeholder:text-gray-500"
                      autoFocus
                    />
                    <button onClick={() => handleCreateThread(arc.id)} className="text-xs text-indigo-400">确认</button>
                    <button onClick={() => { setShowNewThread(null); setNewThreadName(''); }} className="text-xs text-gray-500">取消</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewThread(arc.id)}
                    className="text-xs text-gray-500 hover:text-gray-400 px-1 py-0.5 transition-colors"
                  >
                    + 添加线索
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {unassignedThreads.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/10">
            <p className="text-[10px] text-gray-500 px-2 mb-1">未分配线索</p>
            {unassignedThreads.map((thread) => (
              <div key={thread.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-white/5">
                <span className={`text-[10px] ${PRIORITY_COLORS[thread.priority] || ''}`}>
                  {PRIORITY_LABELS[thread.priority] || thread.priority}
                </span>
                <span className="flex-1 text-xs text-gray-400 truncate">{thread.name}</span>
                <button
                  onClick={() => handleCycleThreadStatus(thread.id, thread.status)}
                  className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {THREAD_STATUS_LABELS[thread.status] || thread.status}
                </button>
                <button
                  onClick={() => deleteThread(thread.id)}
                  className="text-gray-600 hover:text-red-400 text-xs transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {arcs.length === 0 && unassignedThreads.length === 0 && !showNewArc && (
          <p className="text-xs text-gray-500 text-center py-8">暂无故事弧线，点击上方按钮创建</p>
        )}
      </div>
    </div>
  );
}