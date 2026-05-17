import { useEffect, useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useConsistencyStore } from '../../stores/consistencyStore';
import { IssueCard } from './IssueCard';
import type { ConsistencyIssue, ConsistencyStatus } from '../../types/project';

type FilterTab = 'all' | ConsistencyStatus;

const STATUS_TABS: Array<{ key: FilterTab; label: string; color?: string }> = [
  { key: 'all', label: '全部' },
  { key: 'open', label: '待处理', color: 'bg-red-500' },
  { key: 'acknowledged', label: '已确认', color: 'bg-yellow-500' },
  { key: 'fixed', label: '已修复', color: 'bg-emerald-500' },
  { key: 'dismissed', label: '已忽略', color: 'bg-gray-500' },
];

export function ConsistencyPanel() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const { issues, counts, loading, fetchIssues, fetchCounts, updateIssue, deleteIssue, scanNames } = useConsistencyStore();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (currentProject) {
      fetchCounts(currentProject.id);
    }
  }, [currentProject, fetchCounts]);

  useEffect(() => {
    if (currentProject) {
      const status = activeTab === 'all' ? undefined : activeTab;
      fetchIssues(currentProject.id, status);
    }
  }, [currentProject, activeTab, fetchIssues]);

  if (!currentProject) return null;

  const handleUpdate = async (id: string, data: Partial<ConsistencyIssue>) => {
    await updateIssue(currentProject.id, id, data);
  };

  const handleDelete = async (id: string) => {
    await deleteIssue(currentProject.id, id);
  };

  const handleScanNames = async () => {
    setScanning(true);
    try {
      await scanNames(currentProject.id);
    } finally {
      setScanning(false);
    }
  };

  const total = counts.open + counts.acknowledged + counts.fixed + counts.dismissed;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
        <span className="text-[var(--text-xs)] text-[var(--color-text-secondary)]">
          一致性检查
          {total > 0 && <span className="ml-1 text-[var(--color-text-muted)]">({total})</span>}
        </span>
        <button
          onClick={handleScanNames}
          disabled={scanning}
          className="rounded bg-[var(--color-primary)] px-2 py-1 text-[var(--text-xs)] text-white hover:opacity-90 disabled:opacity-50"
        >
          {scanning ? '扫描中...' : '扫描名称'}
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--color-border)] overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[var(--text-xs)] whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]'
            }`}
          >
            {tab.label}
            {tab.key !== 'all' && counts[tab.key as ConsistencyStatus] > 0 && (
              <span className="inline-flex items-center justify-center h-3.5 min-w-[14px] rounded-full text-[9px] bg-white/10 px-1">
                {counts[tab.key as ConsistencyStatus]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Issue list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {loading && issues.length === 0 && (
          <div className="py-8 text-center text-[var(--text-xs)] text-[var(--color-text-muted)]">加载中...</div>
        )}
        {!loading && issues.length === 0 && (
          <div className="py-8 text-center text-[var(--text-xs)] text-[var(--color-text-muted)]">
            {total === 0 ? '暂无一致性问题，点击「扫描名称」检测角色名问题' : '当前过滤条件下没有问题'}
          </div>
        )}
        {issues.map((issue) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}
