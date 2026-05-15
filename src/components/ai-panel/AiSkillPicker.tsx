import { useAiStore } from "@/stores/aiStore";

export function AiSkillPicker() {
  const skills = useAiStore((s) => s.skills);
  const activeSkillId = useAiStore((s) => s.activeSkillId);
  const setActiveSkill = useAiStore((s) => s.setActiveSkill);

  if (skills.length === 0) return null;

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-white/5 px-3 py-2 scrollbar-none">
      {skills.map((skill) => (
        <button
          key={skill.id}
          onClick={() => setActiveSkill(skill.id)}
          className={`shrink-0 rounded-md px-2.5 py-1 text-xs transition-colors ${
            activeSkillId === skill.id
              ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)]"
              : "text-white/40 hover:bg-white/5 hover:text-white/60"
          }`}
          title={skill.description}
        >
          {skill.icon} {skill.name}
        </button>
      ))}
    </div>
  );
}
