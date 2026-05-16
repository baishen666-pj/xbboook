import { useAiStore } from "@/stores/aiStore";
import { AiChatList } from "./AiChatList";
import { AiChatInput } from "./AiChatInput";
import { AiSkillPicker } from "./AiSkillPicker";
import { AiSettingsPanel } from "./AiSettingsPanel";
import { CharacterDialoguePicker } from "./CharacterDialoguePicker";
import { ContextHints } from "./ContextHints";

export function AiPanel() {
  const activeSkillId = useAiStore((s) => s.activeSkillId);
  const skills = useAiStore((s) => s.skills);
  const activeSkill = skills.find((s) => s.id === activeSkillId);

  return (
    <div className="flex h-full flex-col bg-[var(--color-surface-1)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            AI 助手
          </span>
          {activeSkill && (
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/50">
              {activeSkill.icon} {activeSkill.name}
            </span>
          )}
        </div>
        <AiSettingsPanel />
      </div>

      {/* Skill picker */}
      <AiSkillPicker />

      {/* Context hints */}
      <ContextHints />

      {/* Character dialogue picker (only for character-dialogue skill) */}
      {activeSkillId === "character-dialogue" && <CharacterDialoguePicker />}

      {/* Chat area */}
      <AiChatList />

      {/* Input */}
      <AiChatInput />
    </div>
  );
}
