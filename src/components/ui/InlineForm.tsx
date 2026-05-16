import { useRef, useEffect } from "react";

interface InlineFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  submitLabel?: string;
}

export function InlineForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder = "输入名称...",
  autoFocus = true,
  submitLabel = "确定",
}: InlineFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className="flex items-center gap-1.5">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder={placeholder}
        className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-[var(--text-sm)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)]"
      />
      <button
        onClick={onSubmit}
        disabled={!value.trim()}
        className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-2 py-1 text-[var(--text-xs)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
      >
        {submitLabel}
      </button>
      <button
        onClick={onCancel}
        className="rounded-[var(--radius-sm)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        取消
      </button>
    </div>
  );
}
