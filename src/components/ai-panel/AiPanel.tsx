import { useState } from "react";
import { useAiStore } from "@/stores/aiStore";
import { AiChatList } from "./AiChatList";
import { AiChatInput } from "./AiChatInput";
import { AiSkillPicker } from "./AiSkillPicker";
import { AiSettingsPanel } from "./AiSettingsPanel";
import { CharacterDialoguePicker } from "./CharacterDialoguePicker";
import { DialogueSimulator } from "./DialogueSimulator";
import { ContextHints } from "./ContextHints";
import { ContextConfigPanel } from "./ContextConfigPanel";
import { StyleProfilePanel } from "./StyleProfilePanel";

export function AiPanel() {
  const activeSkillId = useAiStore((s) => s.activeSkillId);
  const skills = useAiStore((s) => s.skills);
  const activeSkill = skills.find((s) => s.id === activeSkillId);
  const [showContextConfig, setShowContextConfig] = useState(false);
  const [showStyleProfile, setShowStyleProfile] = useState(false);

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
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowContextConfig(!showContextConfig)}
            className={`rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors ${showContextConfig ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]" : ""}`}
            title="上下文管理"
            aria-label="上下文管理"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 3h4M6 8h4M6 13h4M3 3h1v1H3zM3 8h1v1H3zM3 13h1v1H3z" />
            </svg>
          </button>
          <button
            onClick={() => setShowStyleProfile(!showStyleProfile)}
            className={`rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors ${showStyleProfile ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]" : ""}`}
            title="风格档案"
            aria-label="风格档案"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polygon points="8,1 10,6 15,6.5 11,10 12.5,15 8,12 3.5,15 5,10 1,6.5 6,6" />
            </svg>
          </button>
          <AiSettingsPanel />
        </div>
      </div>

      {/* Context config (collapsible) */}
      {showContextConfig && (
        <div className="border-b border-[var(--color-border)]">
          <ContextConfigPanel onClose={() => setShowContextConfig(false)} />
        </div>
      )}

      {/* Skill picker */}
      <AiSkillPicker />

      {/* Context hints */}
      <ContextHints />

      {/* Style profile (collapsible) */}
      {showStyleProfile && (
        <div className="border-b border-[var(--color-border)]">
          <StyleProfilePanel />
        </div>
      )}

      {/* Character dialogue picker (only for character-dialogue skill) */}
      {activeSkillId === "character-dialogue" && <CharacterDialoguePicker />}
      {activeSkillId === "character-dialogue" && <DialogueSimulator />}

      {/* Chat area */}
      <AiChatList />

      {/* Input */}
      <AiChatInput />
    </div>
  );
}
