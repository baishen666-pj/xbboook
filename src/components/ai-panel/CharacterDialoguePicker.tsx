import { useAiStore } from "@/stores/aiStore";
import { useProjectStore } from "@/stores/projectStore";

export function CharacterDialoguePicker() {
  const characters = useProjectStore((s) => s.characters);
  const character1Id = useAiStore((s) => s.dialogueCharacter1Id);
  const character2Id = useAiStore((s) => s.dialogueCharacter2Id);
  const setCharacter1 = useAiStore((s) => s.setDialogueCharacter1);
  const setCharacter2 = useAiStore((s) => s.setDialogueCharacter2);

  if (characters.length < 2) {
    return (
      <div className="border-b border-white/5 px-4 py-2 text-xs text-white/30">
        至少需要 2 个角色才能使用角色对话模拟
      </div>
    );
  }

  const availableFor2 = characters.filter((c) => c.id !== character1Id);
  const availableFor1 = characters.filter((c) => c.id !== character2Id);

  return (
    <div className="border-b border-white/5 px-4 py-2 flex items-center gap-2">
      <span className="text-xs text-white/40 shrink-0">角色A</span>
      <select
        value={character1Id ?? ""}
        onChange={(e) => setCharacter1(e.target.value || null)}
        className="flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]/50"
      >
        <option value="">选择角色</option>
        {availableFor1.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}{c.roleType !== 'supporting' ? ` (${c.roleType})` : ''}
          </option>
        ))}
      </select>

      <span className="text-xs text-white/30 shrink-0">vs</span>

      <span className="text-xs text-white/40 shrink-0">角色B</span>
      <select
        value={character2Id ?? ""}
        onChange={(e) => setCharacter2(e.target.value || null)}
        className="flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]/50"
      >
        <option value="">选择角色</option>
        {availableFor2.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}{c.roleType !== 'supporting' ? ` (${c.roleType})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
