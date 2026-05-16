import { useState, useEffect, useCallback } from "react";
import {
  backupService,
  type BackupInfo,
  type BackupConfig,
} from "@/services/backupService";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return iso;
  }
}

export function BackupPanel() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [config, setConfig] = useState<BackupConfig>({
    enabled: true,
    intervalHours: 6,
    keepCount: 7,
  });
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [backupRes, configRes] = await Promise.all([
      backupService.listBackups(),
      backupService.getConfig(),
    ]);
    if (backupRes.success && backupRes.data) {
      setBackups(backupRes.data);
    }
    if (configRes.success && configRes.data) {
      setConfig(configRes.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const flash = (ok: boolean, text: string) => {
    setMessage({ ok, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCreate = async () => {
    setCreating(true);
    const res = await backupService.createBackup();
    if (res.success) {
      flash(true, "备份创建成功");
      await loadData();
    } else {
      flash(false, res.error || "创建备份失败");
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const res = await backupService.deleteBackup(id);
    if (res.success) {
      flash(true, "备份已删除");
      setBackups((prev) => prev.filter((b) => b.id !== id));
    } else {
      flash(false, res.error || "删除备份失败");
    }
    setDeletingId(null);
  };

  const handleConfigChange = async (patch: Partial<BackupConfig>) => {
    const updated = { ...config, ...patch };
    setConfig(updated);
    const res = await backupService.updateConfig(patch);
    if (!res.success) {
      flash(false, res.error || "保存配置失败");
      setConfig(config);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-xs text-white/30">
        加载中...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-white/80">数据备份</h2>
        <button
          onClick={() => void handleCreate()}
          disabled={creating}
          className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs text-white hover:brightness-110 disabled:opacity-50 transition-all"
        >
          {creating ? "备份中..." : "立即备份"}
        </button>
      </div>

      {/* Flash message */}
      {message && (
        <div
          className={`rounded border px-3 py-2 text-xs ${
            message.ok
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/20 bg-red-500/10 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Config section */}
      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 space-y-4">
        <h3 className="text-xs font-medium text-white/50">自动备份配置</h3>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => void handleConfigChange({ enabled: e.target.checked })}
              className="accent-[var(--color-primary)]"
            />
            <span className="text-xs text-white/60">启用自动备份</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs text-white/40">备份间隔</span>
            <select
              value={config.intervalHours}
              onChange={(e) =>
                void handleConfigChange({ intervalHours: Number(e.target.value) })
              }
              className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white appearance-none cursor-pointer"
            >
              <option value={1} className="bg-[oklch(0.15_0.01_260)]">每 1 小时</option>
              <option value={3} className="bg-[oklch(0.15_0.01_260)]">每 3 小时</option>
              <option value={6} className="bg-[oklch(0.15_0.01_260)]">每 6 小时</option>
              <option value={12} className="bg-[oklch(0.15_0.01_260)]">每 12 小时</option>
              <option value={24} className="bg-[oklch(0.15_0.01_260)]">每 24 小时</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-white/40">保留数量</span>
            <select
              value={config.keepCount}
              onChange={(e) =>
                void handleConfigChange({ keepCount: Number(e.target.value) })
              }
              className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white appearance-none cursor-pointer"
            >
              <option value={3} className="bg-[oklch(0.15_0.01_260)]">保留 3 份</option>
              <option value={5} className="bg-[oklch(0.15_0.01_260)]">保留 5 份</option>
              <option value={7} className="bg-[oklch(0.15_0.01_260)]">保留 7 份</option>
              <option value={14} className="bg-[oklch(0.15_0.01_260)]">保留 14 份</option>
              <option value={30} className="bg-[oklch(0.15_0.01_260)]">保留 30 份</option>
            </select>
          </label>
        </div>
      </div>

      {/* Backup list */}
      <div className="space-y-2">
        <h3 className="text-xs font-medium text-white/50">
          备份记录 ({backups.length})
        </h3>

        {backups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 py-8 text-center text-xs text-white/20">
            暂无备份记录
          </div>
        ) : (
          <div className="space-y-1">
            {backups.map((backup) => (
              <div
                key={backup.id}
                className="flex items-center gap-3 rounded border border-white/5 bg-white/[0.01] px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white/60 truncate">
                    {formatTime(backup.createdAt)}
                  </div>
                  <div className="text-[10px] text-white/25">
                    {formatBytes(backup.sizeBytes)}
                  </div>
                </div>
                <button
                  onClick={() => void handleDelete(backup.id)}
                  disabled={deletingId === backup.id}
                  className="flex-shrink-0 rounded px-2 py-1 text-[10px] text-white/30 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 disabled:opacity-30 transition-colors"
                >
                  {deletingId === backup.id ? "删除中..." : "删除"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
