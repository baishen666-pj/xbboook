import { useEffect, useRef } from "react";

export interface ContextMenuState {
  x: number;
  y: number;
  type: "node" | "edge";
  id: string;
}

interface NodeMenuProps {
  type: "node";
  onEdit: (characterId: string) => void;
  onAddRelation: (characterId: string) => void;
  onDelete: (characterId: string) => void;
}

interface EdgeMenuProps {
  type: "edge";
  onEdit: (relationId: string) => void;
  onDelete: (relationId: string) => void;
}

type MenuActions = NodeMenuProps | EdgeMenuProps;

interface Props extends ContextMenuState {
  actions: MenuActions;
  onClose: () => void;
}

export function GraphContextMenu({ x, y, type, id, actions, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const items = type === "node"
    ? [
        { label: "编辑角色", action: () => { (actions as NodeMenuProps).onEdit(id); onClose(); } },
        { label: "添加关系", action: () => { (actions as NodeMenuProps).onAddRelation(id); onClose(); } },
        { label: "删除角色", action: () => { (actions as NodeMenuProps).onDelete(id); onClose(); }, danger: true },
      ]
    : [
        { label: "编辑关系", action: () => { (actions as EdgeMenuProps).onEdit(id); onClose(); } },
        { label: "删除关系", action: () => { (actions as EdgeMenuProps).onDelete(id); onClose(); }, danger: true },
      ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[120px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] py-1 shadow-xl"
      style={{ left: x, top: y }}
      role="menu"
    >
      {items.map((item) => (
        <button
          key={item.label}
          role="menuitem"
          onClick={item.action}
          className={`w-full px-3 py-1.5 text-left text-[var(--text-xs)] transition-colors hover:bg-[var(--color-surface-1)] ${
            "danger" in item && item.danger ? "text-red-400" : "text-[var(--color-text-secondary)]"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
