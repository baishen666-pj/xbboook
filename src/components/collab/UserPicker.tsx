import { useState } from "react";
import { collabService } from "@/services/collabService";
import { useCollabStore, setStoredUserId } from "@/stores/collabStore";

interface Props {
  onComplete: () => void;
}

export function UserPicker({ onComplete }: Props) {
  const setCurrentUser = useCollabStore((s) => s.setCurrentUser);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !displayName.trim()) return;

    setLoading(true);
    setError(null);
    const res = await collabService.identify({ username: username.trim(), displayName: displayName.trim() });

    if (res.success && res.data) {
      setCurrentUser(res.data);
      setStoredUserId(res.data.id);
      onComplete();
    } else {
      setError(res.error ?? "创建用户失败");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-80 rounded-xl border border-white/10 bg-[oklch(0.16_0_0)] p-6 shadow-2xl">
        <h2 className="mb-4 text-sm font-semibold text-white/80">选择你的身份</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] text-white/40">用户名</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="输入用户名"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 outline-none focus:border-[oklch(0.65_0.18_250)]"
              maxLength={20}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-white/40">显示名称</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="输入显示名称"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 outline-none focus:border-[oklch(0.65_0.18_250)]"
              maxLength={30}
            />
          </div>
          {error && <div className="text-xs text-red-400">{error}</div>}
          <button
            type="submit"
            disabled={loading || !username.trim() || !displayName.trim()}
            className="w-full rounded-lg bg-[oklch(0.65_0.18_250)] py-2 text-xs font-medium text-white transition-colors hover:bg-[oklch(0.7_0.18_250)] disabled:opacity-40"
          >
            {loading ? "处理中..." : "确认"}
          </button>
        </form>
      </div>
    </div>
  );
}
