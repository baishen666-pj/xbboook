import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export function NetworkStatusIndicator() {
  const { isOnline, pendingCount, isReplaying } = useNetworkStatus();

  if (isReplaying) {
    return (
      <span className="flex items-center gap-1.5 text-[var(--text-xs)] text-[var(--color-primary)]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-primary)] animate-[pulse-subtle_1.5s_ease-in-out_infinite]" />
        同步中...
      </span>
    );
  }

  if (!isOnline) {
    return (
      <span className="flex items-center gap-1.5 text-[var(--text-xs)] text-[var(--color-warning)]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-warning)]" />
        离线{pendingCount > 0 ? ` · ${pendingCount} 待同步` : ""}
      </span>
    );
  }

  return null;
}
