import { useEditorStore } from "@/stores/editorStore";

export function CrashRecoveryBanner() {
  const crashSnapshot = useEditorStore((s) => s.crashSnapshot);
  const recoverFromCrash = useEditorStore((s) => s.recoverFromCrash);
  const dismissCrashRecovery = useEditorStore((s) => s.dismissCrashRecovery);

  if (!crashSnapshot) return null;

  const time = new Date(crashSnapshot.timestamp);
  const timeStr = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-[var(--text-sm)] dark:border-amber-800 dark:bg-amber-950/50">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-amber-600 dark:text-amber-400">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span className="text-amber-800 dark:text-amber-200">
        发现未保存的草稿（{crashSnapshot.wordCount} 字，保存于 {timeStr}）
      </span>
      <div className="ml-auto flex gap-2">
        <button
          onClick={recoverFromCrash}
          className="rounded bg-amber-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
        >
          恢复草稿
        </button>
        <button
          onClick={dismissCrashRecovery}
          className="rounded bg-transparent px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/50 transition-colors"
        >
          忽略
        </button>
      </div>
    </div>
  );
}
