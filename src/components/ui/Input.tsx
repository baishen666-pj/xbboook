import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, ...rest }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[var(--text-sm)] text-[var(--color-text-secondary)]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={[
            "w-full rounded-[var(--radius-md)] border border-[var(--color-border)]",
            "bg-[var(--color-surface-2)] text-[var(--color-text-primary)]",
            "px-3 py-2 text-[var(--text-sm)] min-h-[36px]",
            "placeholder:text-[var(--color-text-muted)]",
            "transition-colors duration-[var(--duration-fast)]",
            "focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]",
            error ? "border-[var(--color-error)]" : "",
            className,
          ].join(" ")}
          {...rest}
        />
        {error && (
          <span id={`${inputId}-error`} className="text-[var(--text-xs)] text-[var(--color-error)]" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
