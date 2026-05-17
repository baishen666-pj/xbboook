// @ts-nocheck — API response generic typing issues
import { useState } from "react";
import { apiClient } from "@/services/apiClient";

type Tab = "webhooks" | "notion" | "feishu" | "automations";

interface Props {
  projectId: string;
}

export function IntegrationPanel({ projectId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("webhooks");

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "webhooks", label: "Webhook" },
    { id: "notion", label: "Notion" },
    { id: "feishu", label: "飞书" },
    { id: "automations", label: "自动化" },
  ];

  return (
    <div className="p-3 space-y-3">
      <div className="text-xs font-medium text-[var(--color-text-primary)]">第三方集成</div>

      <div className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded px-2 py-1 text-[10px] transition-colors ${
              activeTab === tab.id
                ? "bg-[var(--color-primary)] text-white"
                : "bg-white/5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "webhooks" && <WebhooksTab projectId={projectId} />}
      {activeTab === "notion" && <NotionTab projectId={projectId} />}
      {activeTab === "feishu" && <FeishuTab projectId={projectId} />}
      {activeTab === "automations" && <AutomationsTab projectId={projectId} />}
    </div>
  );
}

function WebhooksTab({ projectId }: { projectId: string }) {
  const [webhooks, setWebhooks] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["chapter:update"]);

  const events = [
    "chapter:create", "chapter:update", "chapter:delete",
    "project:create", "export:complete", "checkin:after", "ai:response",
  ];

  async function load() {
    setLoading(true);
    const res = await apiClient.get(`/webhooks?projectId=${projectId}`);
    if (res.success && res.data) setWebhooks(res.data);
    setLoading(false);
  }

  useState(() => { void load(); });

  async function create() {
    if (!name || !url) return;
    const res = await apiClient.post("/webhooks", { name, url, events: selectedEvents, projectId });
    if (res.success) {
      setShowForm(false);
      setName("");
      setUrl("");
      await load();
    }
  }

  async function remove(id: string) {
    await apiClient.delete(`/webhooks/${id}`);
    await load();
  }

  async function test(id: string) {
    await apiClient.post(`/webhooks/${id}/test`);
  }

  if (loading) return <div className="text-[10px] text-[var(--color-text-muted)]">加载中...</div>;

  return (
    <div className="space-y-2">
      {webhooks.map((wh) => (
        <div key={wh.id} className="rounded bg-[var(--color-surface-hover)] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-[var(--color-text-primary)]">{wh.name}</span>
            <div className="flex gap-1">
              <button onClick={() => void test(wh.id)} className="text-[9px] text-blue-400 hover:underline">测试</button>
              <button onClick={() => void remove(wh.id)} className="text-[9px] text-red-400 hover:underline">删除</button>
            </div>
          </div>
          <div className="text-[9px] text-[var(--color-text-muted)] mt-0.5 truncate">{wh.url}</div>
          <div className="flex gap-1 mt-1 flex-wrap">
            {wh.events.map((e: string) => (
              <span key={e} className="text-[8px] rounded bg-white/5 px-1 py-0.5 text-[var(--color-text-secondary)]">{e}</span>
            ))}
          </div>
          <span className={`text-[9px] ${wh.enabled ? "text-green-400" : "text-yellow-400"}`}>
            {wh.enabled ? "已启用" : "已禁用"}
          </span>
        </div>
      ))}

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="text-[10px] text-[var(--color-primary)] hover:underline"
        >
          + 添加 Webhook
        </button>
      )}

      {showForm && (
        <div className="rounded bg-[var(--color-surface-hover)] p-2 space-y-1.5">
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="名称" className="w-full rounded bg-white/5 px-2 py-1 text-[10px] text-[var(--color-text-primary)] outline-none"
          />
          <input
            value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/webhook" className="w-full rounded bg-white/5 px-2 py-1 text-[10px] text-[var(--color-text-primary)] outline-none"
          />
          <div className="flex flex-wrap gap-1">
            {events.map((e) => (
              <button
                key={e}
                onClick={() => setSelectedEvents((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e])}
                className={`text-[8px] rounded px-1 py-0.5 ${
                  selectedEvents.includes(e) ? "bg-[var(--color-primary)] text-white" : "bg-white/5 text-[var(--color-text-muted)]"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => void create()} className="text-[10px] text-[var(--color-primary)] hover:underline">创建</button>
            <button onClick={() => setShowForm(false)} className="text-[10px] text-[var(--color-text-muted)] hover:underline">取消</button>
          </div>
        </div>
      )}
    </div>
  );
}

function NotionTab({ projectId }: { projectId: string }) {
  const [token, setToken] = useState("");
  const [databaseId, setDatabaseId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  async function validate() {
    const res = await apiClient.post(`/projects/${projectId}/notion/validate`, { token });
    setStatus(res.data?.valid ? "Token 有效" : "Token 无效");
  }

  async function save() {
    await apiClient.post(`/projects/${projectId}/notion`, { notionToken: token, databaseId, syncMode: "all" });
    setStatus("配置已保存");
  }

  async function sync() {
    setSyncing(true);
    const res = await apiClient.post(`/projects/${projectId}/notion/sync`);
    setStatus(res.success ? `同步完成: ${res.data?.synced} 章节` : "同步失败");
    setSyncing(false);
  }

  return (
    <div className="space-y-2">
      <div className="text-[10px] text-[var(--color-text-muted)]">
        将章节同步到 Notion 数据库，需要提供 Notion Integration Token
      </div>
      <input
        value={token} onChange={(e) => setToken(e.target.value)}
        placeholder="ntn_xxx (Notion Integration Token)" type="password"
        className="w-full rounded bg-white/5 px-2 py-1 text-[10px] text-[var(--color-text-primary)] outline-none"
      />
      <input
        value={databaseId} onChange={(e) => setDatabaseId(e.target.value)}
        placeholder="Database ID"
        className="w-full rounded bg-white/5 px-2 py-1 text-[10px] text-[var(--color-text-primary)] outline-none"
      />
      <div className="flex gap-2">
        <button onClick={() => void validate()} className="text-[10px] text-[var(--color-primary)] hover:underline">验证</button>
        <button onClick={() => void save()} className="text-[10px] text-[var(--color-primary)] hover:underline">保存</button>
        <button onClick={() => void sync()} disabled={syncing} className="text-[10px] text-green-400 hover:underline disabled:opacity-50">
          {syncing ? "同步中..." : "立即同步"}
        </button>
      </div>
      {status && <div className="text-[9px] text-[var(--color-text-secondary)]">{status}</div>}
    </div>
  );
}

function FeishuTab({ projectId }: { projectId: string }) {
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [docToken, setDocToken] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  async function validate() {
    const res = await apiClient.post(`/projects/${projectId}/feishu/validate`, { appId, appSecret });
    setStatus(res.data?.valid ? "凭证有效" : "凭证无效");
  }

  async function save() {
    await apiClient.post(`/projects/${projectId}/feishu`, { appId, appSecret, docToken, syncMode: "all" });
    setStatus("配置已保存");
  }

  async function sync() {
    setSyncing(true);
    const res = await apiClient.post(`/projects/${projectId}/feishu/sync`);
    setStatus(res.success ? `同步完成: ${res.data?.synced} 章节` : "同步失败");
    setSyncing(false);
  }

  return (
    <div className="space-y-2">
      <div className="text-[10px] text-[var(--color-text-muted)]">
        将章节同步到飞书文档，需要飞书自建应用的 App ID/Secret 和文档 Token
      </div>
      <input
        value={appId} onChange={(e) => setAppId(e.target.value)}
        placeholder="cli_xxx (App ID)"
        className="w-full rounded bg-white/5 px-2 py-1 text-[10px] text-[var(--color-text-primary)] outline-none"
      />
      <input
        value={appSecret} onChange={(e) => setAppSecret(e.target.value)}
        placeholder="App Secret" type="password"
        className="w-full rounded bg-white/5 px-2 py-1 text-[10px] text-[var(--color-text-primary)] outline-none"
      />
      <input
        value={docToken} onChange={(e) => setDocToken(e.target.value)}
        placeholder="文档 Token"
        className="w-full rounded bg-white/5 px-2 py-1 text-[10px] text-[var(--color-text-primary)] outline-none"
      />
      <div className="flex gap-2">
        <button onClick={() => void validate()} className="text-[10px] text-[var(--color-primary)] hover:underline">验证</button>
        <button onClick={() => void save()} className="text-[10px] text-[var(--color-primary)] hover:underline">保存</button>
        <button onClick={() => void sync()} disabled={syncing} className="text-[10px] text-green-400 hover:underline disabled:opacity-50">
          {syncing ? "同步中..." : "立即同步"}
        </button>
      </div>
      {status && <div className="text-[9px] text-[var(--color-text-secondary)]">{status}</div>}
    </div>
  );
}

function AutomationsTab({ projectId }: { projectId: string }) {
  const [rules, setRules] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("chapter:update");
  const [actionType, setActionType] = useState("webhook:send");
  const [actionUrl, setActionUrl] = useState("");

  const triggers = [
    "chapter:create", "chapter:update", "chapter:delete",
    "project:create", "checkin:after", "export:complete", "wordcount:threshold",
  ];
  const actions = ["webhook:send", "notion:sync", "feishu:sync", "notify:log", "chapter:tag", "export:auto"];

  async function load() {
    setLoading(true);
    const res = await apiClient.get(`/projects/${projectId}/automations`);
    if (res.success && res.data) setRules(res.data);
    setLoading(false);
  }

  useState(() => { void load(); });

  async function create() {
    if (!name) return;
    const res = await apiClient.post(`/projects/${projectId}/automations`, {
      name,
      trigger: { type: triggerType },
      action: { type: actionType, config: actionType === "webhook:send" ? { url: actionUrl } : {} },
    });
    if (res.success) {
      setShowForm(false);
      setName("");
      await load();
    }
  }

  async function toggle(id: string, enabled: boolean) {
    await apiClient.put(`/projects/${projectId}/automations/${id}`, { enabled: !enabled });
    await load();
  }

  async function remove(id: string) {
    await apiClient.delete(`/projects/${projectId}/automations/${id}`);
    await load();
  }

  if (loading) return <div className="text-[10px] text-[var(--color-text-muted)]">加载中...</div>;

  return (
    <div className="space-y-2">
      {rules.map((rule) => (
        <div key={rule.id} className="rounded bg-[var(--color-surface-hover)] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-[var(--color-text-primary)]">{rule.name}</span>
            <div className="flex gap-1">
              <button onClick={() => void toggle(rule.id, rule.enabled)} className={`text-[9px] ${rule.enabled ? "text-green-400" : "text-yellow-400"}`}>
                {rule.enabled ? "启用" : "禁用"}
              </button>
              <button onClick={() => void remove(rule.id)} className="text-[9px] text-red-400 hover:underline">删除</button>
            </div>
          </div>
          <div className="text-[9px] text-[var(--color-text-muted)] mt-0.5">
            当 <span className="text-blue-400">{rule.trigger?.type}</span> → 执行 <span className="text-green-400">{rule.action?.type}</span>
          </div>
          {rule.runCount > 0 && (
            <div className="text-[8px] text-[var(--color-text-muted)]">已执行 {rule.runCount} 次</div>
          )}
        </div>
      ))}

      {!showForm && (
        <button onClick={() => setShowForm(true)} className="text-[10px] text-[var(--color-primary)] hover:underline">
          + 创建自动化规则
        </button>
      )}

      {showForm && (
        <div className="rounded bg-[var(--color-surface-hover)] p-2 space-y-1.5">
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="规则名称" className="w-full rounded bg-white/5 px-2 py-1 text-[10px] text-[var(--color-text-primary)] outline-none"
          />
          <div>
            <div className="text-[9px] text-[var(--color-text-muted)] mb-0.5">触发条件</div>
            <select
              value={triggerType} onChange={(e) => setTriggerType(e.target.value)}
              className="w-full rounded bg-white/5 px-2 py-1 text-[10px] text-[var(--color-text-primary)] outline-none"
            >
              {triggers.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[9px] text-[var(--color-text-muted)] mb-0.5">执行动作</div>
            <select
              value={actionType} onChange={(e) => setActionType(e.target.value)}
              className="w-full rounded bg-white/5 px-2 py-1 text-[10px] text-[var(--color-text-primary)] outline-none"
            >
              {actions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {actionType === "webhook:send" && (
            <input
              value={actionUrl} onChange={(e) => setActionUrl(e.target.value)}
              placeholder="Webhook URL" className="w-full rounded bg-white/5 px-2 py-1 text-[10px] text-[var(--color-text-primary)] outline-none"
            />
          )}
          <div className="flex gap-2">
            <button onClick={() => void create()} className="text-[10px] text-[var(--color-primary)] hover:underline">创建</button>
            <button onClick={() => setShowForm(false)} className="text-[10px] text-[var(--color-text-muted)] hover:underline">取消</button>
          </div>
        </div>
      )}
    </div>
  );
}
