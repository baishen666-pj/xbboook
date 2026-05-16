import { useState, useEffect, useCallback } from "react";
import { useToastStore } from "@/stores/toastStore";

const ICONS: Record<string, string> = {
  success: "✓",
  error: "✗",
  warning: "⚠",
  info: "ℹ",
};

const COLORS: Record<string, string> = {
  success: "bg-[oklch(0.5_0.15_145)] text-white",
  error: "bg-[oklch(0.55_0.2_25)] text-white",
  warning: "bg-[oklch(0.7_0.15_85)] text-black/80",
  info: "bg-[oklch(0.5_0.12_250)] text-white",
};

const ROLE_MAP: Record<string, "status" | "alert"> = {
  success: "status",
  info: "status",
  error: "alert",
  warning: "alert",
};

function ToastItem({ id, type, message }: { id: string; type: string; message: string }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => removeToast(id), 200);
  }, [id, removeToast]);

  useEffect(() => {
    const duration = useToastStore.getState().toasts.find((t) => t.id === id)?.duration ?? 3000;
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => removeToast(id), 200);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, removeToast]);

  return (
    <div
      role={ROLE_MAP[type] ?? "status"}
      aria-live={type === "error" || type === "warning" ? "assertive" : "polite"}
      className={`pointer-events-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm shadow-lg ${
        isExiting ? "toast-exit" : "toast-enter"
      } ${COLORS[type]}`}
      onClick={handleClose}
    >
      <span className="text-base" aria-hidden="true">{ICONS[type]}</span>
      <span>{message}</span>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-14 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      aria-label="通知"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} id={t.id} type={t.type} message={t.message} />
      ))}
    </div>
  );
}
