import { useState, useEffect, useCallback } from "react";
import {
  fetchStatus,
  fetchProviders,
  updateAiConfig,
  testConnection,
  type AiStatus,
  type AiProvider,
} from "@/services/aiService";

export function AiSettingsPanel() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [providers, setProviders] = useState<AiProvider[]>([]);

  const [provider, setProvider] = useState("deepseek");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState(0.8);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const s = await fetchStatus();
      setStatus(s);
      setProvider(s.provider || "deepseek");
      setBaseUrl(s.baseUrl || "");
      setModel(s.model || "");
      setTemperature(s.temperature ?? 0.8);
      setMaxTokens(s.maxTokens ?? 4096);
      if (s.apiKeyHint) {
        setApiKey("");
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchProviders().then(setProviders).catch(() => {});
      loadStatus();
      setTestResult(null);
    }
  }, [open, loadStatus]);

  const handleProviderChange = (id: string) => {
    setProvider(id);
    const preset = providers.find((p) => p.id === id);
    if (preset && preset.id !== "custom") {
      setBaseUrl(preset.baseUrl);
      setModel(preset.defaultModel);
    }
    setTestResult(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {
        provider,
        baseUrl,
        model,
        temperature,
        maxTokens,
      };
      if (apiKey) {
        patch.apiKey = apiKey;
      }
      await updateAiConfig(patch);
      await loadStatus();
      setApiKey("");
    } catch {
      /* ignore */
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    // Save first if there are unsaved changes
    if (apiKey) {
      await updateAiConfig({ provider, apiKey, baseUrl, model, temperature, maxTokens });
      await loadStatus();
      setApiKey("");
    }

    try {
      const result = await testConnection();
      if (result.success) {
        setTestResult({ ok: true, msg: result.reply || "连接成功" });
      } else {
        setTestResult({ ok: false, msg: result.error || "连接失败" });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        msg: err instanceof Error ? err.message : "连接失败",
      });
    }
    setTesting(false);
  };

  const currentProvider = providers.find((p) => p.id === provider);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-md p-1 text-white/30 hover:bg-white/5 hover:text-white/60 transition-colors"
        title="AI 设置"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="8" cy="8" r="2.5" />
          <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-80 rounded-lg border border-white/10 bg-[oklch(0.15_0.01_260)] p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-white/80">AI 配置</span>
            <div className="flex items-center gap-1.5 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  status?.configured
                    ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
                    : "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]"
                }`}
              />
              <span className={status?.configured ? "text-emerald-400" : "text-red-400"}>
                {status?.configured ? "已连接" : "未配置"}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {/* Provider */}
            <label className="block">
              <span className="text-xs text-white/40">提供商</span>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white appearance-none cursor-pointer"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[oklch(0.15_0.01_260)]">
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            {/* API Key */}
            <label className="block">
              <span className="text-xs text-white/40">
                API Key{" "}
                {status?.apiKeyHint && (
                  <span className="text-white/25">({status.apiKeyHint})</span>
                )}
              </span>
              <div className="mt-1 relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={status?.apiKeyHint ? "输入新密钥替换" : "输入 API Key"}
                  className="w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 pr-8 text-xs text-white placeholder:text-white/20"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {showKey ? (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    ) : (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </label>

            {/* Base URL */}
            <label className="block">
              <span className="text-xs text-white/40">Base URL</span>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white font-mono"
              />
            </label>

            {/* Model */}
            <label className="block">
              <span className="text-xs text-white/40">模型</span>
              {currentProvider && currentProvider.models.length > 0 ? (
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white appearance-none cursor-pointer"
                >
                  {currentProvider.models.map((m) => (
                    <option key={m} value={m} className="bg-[oklch(0.15_0.01_260)]">
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white font-mono"
                />
              )}
            </label>

            {/* Temperature */}
            <label className="block">
              <div className="flex justify-between">
                <span className="text-xs text-white/40">温度</span>
                <span className="text-xs text-white/30">{temperature.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="mt-1 w-full accent-[var(--color-primary)]"
              />
            </label>

            {/* Max Tokens */}
            <label className="block">
              <span className="text-xs text-white/40">最大 Token 数</span>
              <input
                type="number"
                min="256"
                max="128000"
                step="256"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value) || 4096)}
                className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white"
              />
            </label>

            {/* Test Result */}
            {testResult && (
              <div
                className={`text-xs px-2 py-1.5 rounded ${
                  testResult.ok
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}
              >
                {testResult.ok ? `连接成功: ${testResult.msg}` : testResult.msg}
              </div>
            )}

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={handleTest}
                disabled={testing || !status?.configured}
                className="rounded border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {testing ? "测试中..." : "测试连接"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded px-3 py-1.5 text-xs text-white/40 hover:bg-white/5"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs text-white hover:brightness-110 disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
