interface CollapsibleSectionProps {
  title: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}

export function CollapsibleSection({ title, isOpen, onToggle, children, badge, actions }: CollapsibleSectionProps) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 bg-[var(--color-surface-2)] px-3 py-2 text-left hover:bg-[var(--color-surface-3)] transition-colors"
        aria-expanded={isOpen}
      >
        <svg
          width="12" height="12" viewBox="0 0 12 12"
          className={`text-[var(--color-text-muted)] transition-transform ${isOpen ? "rotate-90" : ""}`}
          fill="none" stroke="currentColor" strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M4 2l4 4-4 4" />
        </svg>
        <span className="flex-1 text-[var(--text-sm)] font-medium text-[var(--color-text-primary)] truncate">
          {title}
        </span>
        {badge}
        {actions}
      </button>
      {isOpen && (
        <div className="border-t border-[var(--color-border)]">
          {children}
        </div>
      )}
    </div>
  );
}
