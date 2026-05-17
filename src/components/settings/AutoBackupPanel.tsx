import { useState, useEffect } from 'react';
import { autoBackupService, type SnapshotInfo } from '@/services/autoBackupService';

interface AutoBackupPanelProps {
  projectId: string;
}

export function AutoBackupPanel({ projectId }: AutoBackupPanelProps) {
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => {
    autoBackupService.listSnapshots(projectId).then((res) => {
      if (res.success && res.data) setSnapshots(res.data);
    }).catch(() => {});
  };

  useEffect(load, [projectId]);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const res = await autoBackupService.createSnapshot(projectId);
      if (res.success && res.data) {
        setMessage(`快照创建成功: ${res.data.totalRows} 条数据`);
        load();
      } else {
        setError(res.error || '创建失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (filename: string) => {
    if (!confirm('确定要恢复到此快照？当前数据将被覆盖。')) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await autoBackupService.restore(projectId, filename);
      if (res.success) {
        setMessage(`已恢复 ${res.data.restoredTables} 个数据表`);
      } else {
        setError(res.error || '恢复失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-text-primary)]">数据快照 ({snapshots.length})</span>
        <button onClick={handleCreate} disabled={creating}
          className="rounded bg-[var(--color-primary)] px-2 py-1 text-[10px] text-white hover:opacity-90 disabled:opacity-40">
          {creating ? '创建中...' : '+ 创建快照'}
        </button>
      </div>

      {error && <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">{error}</div>}
      {message && <div className="rounded bg-green-500/10 p-2 text-xs text-green-400">{message}</div>}

      {snapshots.length === 0 ? (
        <div className="py-4 text-center text-xs text-[var(--color-text-muted)]">暂无快照</div>
      ) : (
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {snapshots.map((s) => (
            <div key={s.filename} className="flex items-center gap-2 rounded border border-[var(--color-border)] p-2">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-[var(--color-text-primary)] truncate">{s.filename}</div>
                <div className="text-[9px] text-[var(--color-text-muted)]">
                  {formatDate(s.createdAt)} · {formatSize(s.size)}
                </div>
              </div>
              <button onClick={() => handleRestore(s.filename)} disabled={loading}
                className="shrink-0 rounded px-2 py-1 text-[10px] text-[var(--color-text-muted)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] disabled:opacity-40">
                恢复
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
