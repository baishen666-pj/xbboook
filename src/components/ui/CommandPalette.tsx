import { useEffect, useRef, useCallback } from "react";
import { useUiStore } from "@/stores/uiStore";
import { useCommands, useCommandPalette } from "@/hooks/useCommandPalette";

export function CommandPalette() {
  const isOpen = useUiStore((s) => s.isCommandPaletteOpen);
  const close = useUiStore((s) => s.closeCommandPalette);
  const commands = useCommands();
  const { query, setQuery, filtered, activeIndex, setActiveIndex, moveUp, moveDown, execute, reset, GROUP_LABEL } = useCommandPalette(commands);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      reset();
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen, reset]);

  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveUp();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      moveDown();
    } else if (e.key === "Enter") {
      e.preventDefault();
      execute();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }, [moveUp, moveDown, execute, close]);

  if (!isOpen) return null;

  let currentGroup = "";

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[20vh]" role="dialog" aria-modal="true" aria-label="命令面板">
      <div className="absolute inset-0 bg-black/50" onClick={close} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-2xl animate-[fadeIn_100ms_var(--ease-out)]">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" aria-hidden="true">
            <circle cx="7" cy="7" r="5" />
            <path d="M11 11l3 3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="输入命令..."
            className="flex-1 bg-transparent text-[var(--text-sm)] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
            aria-label="搜索命令"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-activedescendant={filtered[activeIndex] ? `cmd-${filtered[activeIndex].id}` : undefined}
          />
          <kbd className="rounded border border-[var(--color-border)] px-1 py-0.5 font-mono text-[10px] text-[var(--color-text-muted)]">Esc</kbd>
        </div>

        <div
          id="command-list"
          ref={listRef}
          role="listbox"
          className="max-h-64 overflow-y-auto p-1"
        >
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-[var(--text-sm)] text-[var(--color-text-muted)]">
              无匹配命令
            </div>
          )}
          {filtered.map((cmd, i) => {
            const showGroup = cmd.group !== currentGroup;
            if (showGroup) currentGroup = cmd.group;
            return (
              <div key={cmd.id}>
                {showGroup && (
                  <div className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                    {GROUP_LABEL[cmd.group] ?? cmd.group}
                  </div>
                )}
                <button
                  id={`cmd-${cmd.id}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onClick={() => { close(); cmd.action(); }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={[
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors",
                    i === activeIndex
                      ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]",
                  ].join(" ")}
                >
                  <span className="flex-1 text-[var(--text-sm)]">{cmd.label}</span>
                  {cmd.shortcut && (
                    <kbd className="rounded border border-[var(--color-border)] px-1 py-0.5 font-mono text-[10px] text-[var(--color-text-muted)]">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="border-t border-[var(--color-border)] px-3 py-1.5 flex items-center gap-3 text-[10px] text-[var(--color-text-muted)]">
          <span>↑↓ 导航</span>
          <span>↵ 执行</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </div>
  );
}
