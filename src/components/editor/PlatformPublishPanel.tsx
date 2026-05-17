import { useState, useEffect } from 'react';
import { platformPublishService, type PlatformInfo, type PlatformConfig } from '@/services/platformPublishService';

interface Props { projectId: string; }

const PLATFORM_LIST = [
  { id: 'qidian', name: '起点', icon: 'Q' },
  { id: 'fanqie', name: '番茄', icon: 'F' },
  { id: 'jinjiang', name: '晋江', icon: 'J' },
  { id: 'zongheng', name: '纵横', icon: 'Z' },
  { id: 'generic', name: '通用', icon: 'G' },
];

export function PlatformPublishPanel({ projectId }: Props) {
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [configs, setConfigs] = useState<PlatformConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [configForm, setConfigForm] = useState({ maxLength: '', indent: '' });

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [platsRes, cfgsRes] = await Promise.all([
        platformPublishService.getPlatforms(),
        platformPublishService.getConfigs(projectId),
      ]);
      if (platsRes.success && platsRes.data) setPlatforms(platsRes.data);
      if (cfgsRes.success && cfgsRes.data) setConfigs(cfgsRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const getConfig = (platformId: string): PlatformConfig | undefined =>
    configs.find((c) => c.platform === platformId);

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '从未导出';
    try {
      return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const handleExport = async (platformId: string) => {
    setExporting(platformId);
    setError(null);
    try {
      const url = platformPublishService.getExportUrl(projectId, platformId);
      window.open(url, '_blank');
      setTimeout(async () => {
        await loadData();
        setExporting(null);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
      setExporting(null);
    }
  };

  const openConfig = (platformId: string) => {
    const existing = getConfig(platformId);
    const cfg = existing?.config as Record<string, unknown> | undefined;
    setConfigForm({
      maxLength: String(cfg?.maxLength ?? ''),
      indent: String(cfg?.indent ?? ''),
    });
    setConfiguring(platformId);
  };

  const saveConfig = async () => {
    if (!configuring) return;
    setLoading(true);
    setError(null);
    try {
      const config: Record<string, unknown> = {};
      if (configForm.maxLength) config.maxLength = Number(configForm.maxLength);
      if (configForm.indent) config.indent = configForm.indent;
      const res = await platformPublishService.saveConfig(projectId, { platform: configuring, config });
      if (res.success) {
        setConfiguring(null);
        await loadData();
      } else {
        setError(res.error || '保存失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const deleteConfig = async (platformId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await platformPublishService.deleteConfig(projectId, platformId);
      if (res.success) {
        await loadData();
      } else {
        setError(res.error || '删除失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading && platforms.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-[var(--color-text-muted)]">
        加载中...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">{error}</div>}

      {/* Config modal */}
      {configuring && (
        <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-[var(--color-text-primary)]">
              配置 - {PLATFORM_LIST.find((p) => p.id === configuring)?.name ?? configuring}
            </div>
            <button
              onClick={() => setConfiguring(null)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-xs"
            >
              x
            </button>
          </div>

          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">最大字数</div>
            <input
              value={configForm.maxLength}
              onChange={(e) => setConfigForm((f) => ({ ...f, maxLength: e.target.value }))}
              placeholder="例如: 3000000"
              type="number"
              className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">缩进方式</div>
            <input
              value={configForm.indent}
              onChange={(e) => setConfigForm((f) => ({ ...f, indent: e.target.value }))}
              placeholder="例如: 2spaces / tab / 4spaces"
              className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          <div className="flex gap-1">
            <button
              onClick={saveConfig}
              disabled={loading}
              className="flex-1 rounded bg-[var(--color-primary)] py-1 text-xs text-white hover:opacity-90 disabled:opacity-40"
            >
              {loading ? '保存中...' : '保存'}
            </button>
            <button
              onClick={() => setConfiguring(null)}
              className="rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-muted)]"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Platform cards */}
      <div className="space-y-2">
        {PLATFORM_LIST.map((plat) => {
          const config = getConfig(plat.id);
          const isExporting = exporting === plat.id;

          return (
            <div key={plat.id} className="rounded border border-[var(--color-border)] p-2">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--color-primary)]/10 text-[10px] font-bold text-[var(--color-primary)]">
                  {plat.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-[var(--color-text-primary)]">{plat.name}</div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">
                    {formatDate(config?.lastExportAt ?? null)}
                  </div>
                </div>
              </div>

              <div className="flex gap-1">
                <button
                  onClick={() => handleExport(plat.id)}
                  disabled={isExporting}
                  className="flex-1 rounded bg-[var(--color-primary)] py-1 text-xs text-white hover:opacity-90 disabled:opacity-40"
                >
                  {isExporting ? '导出中...' : '导出'}
                </button>
                <button
                  onClick={() => openConfig(plat.id)}
                  className="rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                >
                  配置
                </button>
                {config && (
                  <button
                    onClick={() => deleteConfig(plat.id)}
                    className="rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-muted)] hover:text-red-400"
                  >
                    删除
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
