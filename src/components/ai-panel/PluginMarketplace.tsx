import { useState, useEffect } from "react";
import { apiClient } from "@/services/apiClient";

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
}

export function PluginMarketplace() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [skills, setSkills] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const [pluginsRes, skillsRes] = await Promise.all([
      apiClient.get<PluginInfo[]>("/plugins"),
      apiClient.get<Array<{ id: string; name: string; description: string }>>("/plugins/skills"),
    ]);
    if (pluginsRes.success && pluginsRes.data) setPlugins(pluginsRes.data);
    if (skillsRes.success && skillsRes.data) setSkills(skillsRes.data);
    setLoading(false);
  }

  if (loading) {
    return <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">加载中...</div>;
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-[var(--color-text-primary)]">
          插件市场 · {plugins.length} 个插件
        </div>
      </div>

      {plugins.length === 0 && (
        <div className="text-center py-6">
          <div className="text-2xl mb-2">🔌</div>
          <div className="text-xs text-[var(--color-text-muted)]">暂无已安装插件</div>
          <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
            将插件 JS 文件放入 server/plugins/ 目录即可加载
          </div>
        </div>
      )}

      {plugins.map((plugin) => (
        <div key={plugin.id} className="rounded bg-[var(--color-surface-hover)] p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">🔌</span>
              <span className="text-xs font-medium text-[var(--color-text-primary)]">{plugin.name}</span>
            </div>
            <span className="text-[10px] rounded px-1.5 py-0.5 bg-green-500/10 text-green-400">v{plugin.version}</span>
          </div>
          <div className="text-[10px] text-[var(--color-text-secondary)] mt-1">{plugin.description}</div>
          <div className="text-[9px] text-[var(--color-text-muted)] mt-1">ID: {plugin.id}</div>
        </div>
      ))}

      {skills.length > 0 && (
        <div>
          <div className="text-xs font-medium text-[var(--color-text-primary)] mb-1">插件技能</div>
          {skills.map((skill) => (
            <div key={skill.id} className="rounded bg-[var(--color-surface-hover)] p-2 mb-1">
              <div className="text-[10px] font-medium text-[var(--color-text-primary)]">{skill.name}</div>
              <div className="text-[9px] text-[var(--color-text-muted)]">{skill.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
