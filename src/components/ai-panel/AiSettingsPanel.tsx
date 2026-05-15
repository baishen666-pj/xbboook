import { useState, useEffect } from "react";
import { fetchStatus, updateAiConfig } from "@/services/aiService";

export function AiSettingsPanel() {
  const [open, setOpen] = useState(false);
  const [model, setModel] = useState("");
  const [status, setStatus] = useState<{ configured: boolean; model: string } | null>(null);

  useEffect(() => {
    fetchStatus().then((s) => {
      setStatus(s);
      setModel(s.model);
    });
  }, []);

  const handleSave = async () => {
    await updateAiConfig({ model });
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-md p-1 text-white/30 hover:bg-white/5 hover:text-white/60 transition-colors"
        title="AI 设置"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="2.5" />
          <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 w-64 rounded-lg border border-white/10 bg-[oklch(0.18_0_0)] p-3 shadow-xl">
          <div className="text-xs text-white/40 mb-2">AI 配置</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${status?.configured ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-white/60">{status?.configured ? "已连接" : "未配置"}</span>
            </div>
            <label className="block">
              <span className="text-xs text-white/40">模型</span>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setOpen(false)}
                className="rounded px-2 py-1 text-xs text-white/40 hover:bg-white/5"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="rounded bg-[var(--color-primary)] px-2 py-1 text-xs text-white"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
