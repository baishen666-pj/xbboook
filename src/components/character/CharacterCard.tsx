import type { Character } from "@/types/project";
import { ROLE_LABELS } from "@/lib/role-types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DeleteButton } from "@/components/ui/DeleteButton";

interface Props {
  character: Character;
  onEdit: () => void;
  onDelete: () => void;
}

const ROLE_COLORS: Record<string, "amber" | "blue" | "red" | "gray"> = {
  protagonist: "amber",
  supporting: "blue",
  antagonist: "red",
  minor: "gray",
};

export function CharacterCard({ character, onEdit, onDelete }: Props) {
  const roleLabel = ROLE_LABELS[character.roleType] || character.roleType;
  const roleColor = ROLE_COLORS[character.roleType] || "gray";

  return (
    <div className="group rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2.5 transition-colors hover:bg-[var(--color-surface-3)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-sm)] font-medium text-[var(--color-text-primary)] truncate">{character.name}</span>
            {character.nickname && (
              <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">「{character.nickname}」</span>
            )}
            <StatusBadge label={roleLabel} color={roleColor} size="xs" />
          </div>
          {character.personality && (
            <p className="mt-1 text-[var(--text-xs)] text-[var(--color-text-muted)] line-clamp-2">{character.personality}</p>
          )}
        </div>

        <div className="shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-secondary)]"
            title="编辑"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M8.5 1.5l2 2-7 7H1.5V8.5l7-7z" />
            </svg>
          </button>
          <DeleteButton onDelete={onDelete} />
        </div>
      </div>
    </div>
  );
}
