import type { CharacterRelation, Character } from "@/types/project";
import { ROLE_LABELS } from "@/lib/role-types";
import { DeleteButton } from "@/components/ui/DeleteButton";

interface Props {
  relation: CharacterRelation;
  characters: Character[];
  onEdit: (relation: CharacterRelation) => void;
  onDelete: (relation: CharacterRelation) => void;
  onClose: () => void;
}

export function RelationshipDetail({ relation, characters, onEdit, onDelete, onClose }: Props) {
  const charA = characters.find((c) => c.id === relation.characterAId);
  const charB = characters.find((c) => c.id === relation.characterBId);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[var(--text-sm)] font-medium text-[var(--color-text-primary)]">关系详情</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-secondary)]"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2.5">
            <div className="flex-1 text-center">
              <div className="text-[var(--text-sm)] font-medium text-[var(--color-text-primary)]">{charA?.name ?? "未知"}</div>
              {charA && (
                <div className="text-[10px] text-[var(--color-text-muted)]">{ROLE_LABELS[charA.roleType] ?? charA.roleType}</div>
              )}
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <div className="text-[var(--text-xs)] text-[var(--color-primary)] font-medium">{relation.relationType}</div>
              <svg width="20" height="8" viewBox="0 0 20 8" fill="none" stroke="currentColor" strokeWidth="1" className="text-[var(--color-text-muted)]">
                <path d="M0 4h20M16 0l4 4-4 4" />
              </svg>
            </div>
            <div className="flex-1 text-center">
              <div className="text-[var(--text-sm)] font-medium text-[var(--color-text-primary)]">{charB?.name ?? "未知"}</div>
              {charB && (
                <div className="text-[10px] text-[var(--color-text-muted)]">{ROLE_LABELS[charB.roleType] ?? charB.roleType}</div>
              )}
            </div>
          </div>

          {relation.description && (
            <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2">
              <div className="text-[10px] text-[var(--color-text-muted)] mb-1">描述</div>
              <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] leading-relaxed">{relation.description}</p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <DeleteButton onDelete={() => onDelete(relation)} size="sm" />
            <button
              onClick={() => onEdit(relation)}
              className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-[var(--text-xs)] text-white hover:opacity-90"
            >
              编辑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
