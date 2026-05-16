import type { CharacterRelation, Character } from "@/types/project";
import { ROLE_LABELS } from "@/lib/role-types";

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
        className="w-full max-w-sm rounded-xl border border-white/10 bg-[oklch(0.16_0_0)] p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white/80">关系详情</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-white/30 hover:bg-white/5 hover:text-white/60"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded border border-white/5 bg-white/[0.02] px-3 py-2.5">
            <div className="flex-1 text-center">
              <div className="text-sm font-medium text-white/80">{charA?.name ?? "未知"}</div>
              {charA && (
                <div className="text-[10px] text-white/30">{ROLE_LABELS[charA.roleType] ?? charA.roleType}</div>
              )}
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <div className="text-xs text-[var(--color-primary)] font-medium">{relation.relationType}</div>
              <svg width="20" height="8" viewBox="0 0 20 8" fill="none" stroke="currentColor" strokeWidth="1" className="text-white/20">
                <path d="M0 4h20M16 0l4 4-4 4" />
              </svg>
            </div>
            <div className="flex-1 text-center">
              <div className="text-sm font-medium text-white/80">{charB?.name ?? "未知"}</div>
              {charB && (
                <div className="text-[10px] text-white/30">{ROLE_LABELS[charB.roleType] ?? charB.roleType}</div>
              )}
            </div>
          </div>

          {relation.description && (
            <div className="rounded border border-white/5 bg-white/[0.02] px-3 py-2">
              <div className="text-[10px] text-white/30 mb-1">描述</div>
              <p className="text-xs text-white/60 leading-relaxed">{relation.description}</p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={() => onDelete(relation)}
              className="rounded px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
            >
              删除
            </button>
            <button
              onClick={() => onEdit(relation)}
              className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs text-white hover:opacity-90"
            >
              编辑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
