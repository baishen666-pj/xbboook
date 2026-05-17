import { useState, useEffect, useCallback } from "react";
import { publishService, type PublishTarget } from "@/services/publishService";

const PLATFORM_ICONS: Record<string, string> = {
  wechat: "💬",
  zhihu: "🔵",
  jianshu: "📝",
  csdn: "💻",
  custom: "🔧",
};

interface Props {
  projectId: string;
}

export function PublishPanel({ projectId }: Props) {
  const [targets, setTargets] = useState<PublishTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const loadTargets = useCallback(async () => {
    setLoading(true);
    const res = await publishService.list(projectId);
    if (res.success && res.data) setTargets(res.data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void loadTargets();
  }, [loadTargets]);

  const handleDelete = async (id: string) => {
    const res = await publishService.delete(projectId, id);
    if (res.success) setTargets(prev => prev.filter(t => t.id !== id));
  };

  const handleExport = async (target: PublishTarget) => {
    const res = await publishService.export(projectId, target.id);
    if (res.success && res.data) {
      window.open(res.data.exportUrl, "_blank");
      void loadTargets();
    }
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[var(--text-sm)] font-medium text-[var(--color-text-primary)]">
          多平台发布
        </h3>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded px-2 py-1 text-[var(--text-xs)] bg-[var(--color-primary)] text-white hover:opacity-90"
        >
          + 添加平台
        </button>
      </div>

      {loading ? (
        <div className="py-4 text-center text-[var(--text-xs)] text-[var(--color-text-muted)]">加载中...</div>
      ) : targets.length === 0 ? (
        <div className="py-4 text-center text-[var(--text-xs)] text-[var(--color-text-muted)]">
          暂无发布配置。点击"添加平台"开始。
        </div>
      ) : (
        <div className="space-y-1.5">
          {targets.map(target => (
            <div key={target.id} className="rounded bg-[var(--color-surface-hover)] p-2 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{PLATFORM_ICONS[target.platform] ?? "🔧"}</span>
                  <div>
                    <div className="text-[var(--text-xs)] font-medium text-[var(--color-text-primary)]">
                      {target.name}
                    </div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">
                      {target.platformLabel || target.platform}
                      {target.lastPublishedAt && (
                        <> · 上次发布: {new Date(target.lastPublishedAt).toLocaleDateString("zh-CN")}</>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => void handleExport(target)}
                    className="rounded px-2 py-1 text-[var(--text-xs)] bg-[var(--color-primary)] text-white hover:opacity-90"
                  >
                    导出
                  </button>
                  <button
                    onClick={() => void handleDelete(target.id)}
                    className="rounded px-1.5 py-1 text-[var(--text-xs)] text-red-400 hover:bg-red-500/10"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateTargetForm
          onSave={async (data) => {
            await publishService.create(projectId, data);
            setShowCreate(false);
            await loadTargets();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

function CreateTargetForm({
  onSave,
  onCancel,
}: {
  onSave: (data: { name: string; platform: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("wechat");
  const [saving, setSaving] = useState(false);

  const PLATFORMS = [
    { value: "wechat", label: "微信公众号" },
    { value: "zhihu", label: "知乎" },
    { value: "jianshu", label: "简书" },
    { value: "csdn", label: "CSDN" },
    { value: "custom", label: "自定义" },
  ];

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name, platform });
    setSaving(false);
  };

  return (
    <div className="rounded border border-[var(--color-primary)]/30 bg-[var(--color-surface)] p-2 space-y-2">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full rounded bg-[var(--color-surface-hover)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-primary)] outline-none"
        placeholder="配置名称"
      />
      <select
        value={platform}
        onChange={e => setPlatform(e.target.value)}
        className="w-full rounded bg-[var(--color-surface-hover)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-primary)] outline-none"
      >
        {PLATFORMS.map(p => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
      <div className="flex gap-1 justify-end">
        <button onClick={onCancel} className="rounded px-2 py-1 text-[var(--text-xs)] bg-[var(--color-surface-hover)] hover:opacity-80">取消</button>
        <button
          onClick={() => void handleSubmit()}
          disabled={saving || !name.trim()}
          className="rounded px-2 py-1 text-[var(--text-xs)] bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "保存中..." : "添加"}
        </button>
      </div>
    </div>
  );
}
