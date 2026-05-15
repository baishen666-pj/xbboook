import type { Character } from "@/types/project";
import { ROLE_LABELS } from "@/lib/role-types";

interface Props {
  character: Character;
  onEdit: () => void;
  onDelete: () => void;
}

const ROLE_COLORS: Record<string, string> = {
  protagonist: "bg-amber-500/20 text-amber-400",
  supporting: "bg-blue-500/20 text-blue-400",
  antagonist: "bg-red-500/20 text-red-400",
  minor: "bg-white/10 text-white/40",
};

export function CharacterCard({ character, onEdit, onDelete }: Props) {
  const roleLabel = ROLE_LABELS[character.roleType] || character.roleType;
  const roleColor = ROLE_COLORS[character.roleType] || "bg-white/10 text-white/40";

  return (
    <div className="group rounded-lg border border-white/5 bg-white/[0.02] p-2.5 transition-colors hover:bg-white/[0.04]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white/80 truncate">{character.name}</span>
            {character.nickname && (
              <span className="text-xs text-white/30">「{character.nickname}」</span>
            )}
            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${roleColor}`}>
              {roleLabel}
            </span>
          </div>
          {character.personality && (
            <p className="mt-1 text-xs text-white/30 line-clamp-2">{character.personality}</p>
          )}
        </div>

        <div className="shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="rounded p-1 text-white/30 hover:bg-white/5 hover:text-white/60"
            title="编辑"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M8.5 1.5l2 2-7 7H1.5V8.5l7-7z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1 text-white/30 hover:bg-red-500/10 hover:text-red-400"
            title="删除"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
