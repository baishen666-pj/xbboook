import { useState, useEffect, useRef } from "react";

interface DeleteButtonProps {
  onDelete: () => void;
  confirmMessage?: string;
  size?: "xs" | "sm";
}

export function DeleteButton({ onDelete, confirmMessage = "确认删除?", size = "xs" }: DeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (confirming) {
      timerRef.current = setTimeout(() => setConfirming(false), 2000);
      return () => clearTimeout(timerRef.current);
    }
  }, [confirming]);

  const sizeClass = size === "xs" ? "text-[10px] px-1 py-0.5" : "text-[var(--text-xs)] px-1.5 py-0.5";

  if (confirming) {
    return (
      <button
        onClick={() => { clearTimeout(timerRef.current); onDelete(); setConfirming(false); }}
        className={`${sizeClass} rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors`}
        title={confirmMessage}
      >
        确认
      </button>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className={`${sizeClass} rounded text-[var(--color-text-muted)] hover:bg-red-500/10 hover:text-red-400 transition-colors`}
      title="删除"
      aria-label="删除"
    >
      &times;
    </button>
  );
}
