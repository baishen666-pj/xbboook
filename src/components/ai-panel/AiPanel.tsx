import { useState } from "react";
import { useAiStore } from "@/stores/aiStore";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { useAutoContinue } from "@/hooks/useAutoContinue";
import { AiChatList } from "./AiChatList";
import { AiChatInput } from "./AiChatInput";
import { AiSkillPicker } from "./AiSkillPicker";
import { AiSettingsPanel } from "./AiSettingsPanel";
import { CharacterDialoguePicker } from "./CharacterDialoguePicker";
import { DialogueSimulator } from "./DialogueSimulator";
import { ContextHints } from "./ContextHints";
import { ContextConfigPanel } from "./ContextConfigPanel";
import { StyleProfilePanel } from "./StyleProfilePanel";
import { MemoryPanel } from "./MemoryPanel";
import { AutoContinueSuggestion } from "./AutoContinueSuggestion";

export function AiPanel() {
  const activeSkillId = useAiStore((s) => s.activeSkillId);
  const skills = useAiStore((s) => s.skills);
  const activeSkill = skills.find((s) => s.id === activeSkillId);
  const currentProject = useProjectStore((s) => s.currentProject);
  const activeChapterId = useEditorStore((s) => s.activeChapterId);
  const editor = useEditorStore((s) => s.editorInstance);
  const [showContextConfig, setShowContextConfig] = useState(false);
  const [showStyleProfile, setShowStyleProfile] = useState(false);
  const [showMemory, setShowMemory] = useState(false);

  const autoContinue = useAutoContinue(currentProject?.id, activeChapterId ?? undefined);

  const handleInsertContinuation = (text: string) => {
    if (editor) {
      editor.chain().focus().insertContent(text).run();
    }
    autoContinue.clearSuggestion();
  };

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
          <button
            onClick={() => setShowMemory(!showMemory)}
            className={`rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors ${showMemory ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]" : ""}`}
            title="AI 记忆库"
            aria-label="AI 记忆库"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 4h12v8H2z" />
              <path d="M5 4V2h6v2" />
              <circle cx="8" cy="8" r="2" />
              <path d="M8 10v2" />
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

      {/* Memory panel (collapsible) */}
      {showMemory && currentProject && (
        <div className="border-b border-[var(--color-border)] max-h-80 overflow-y-auto">
          <MemoryPanel projectId={currentProject.id} />
        </div>
      )}

      {/* Character dialogue picker (only for character-dialogue skill) */}
      {activeSkillId === "character-dialogue" && <CharacterDialoguePicker />}
      {activeSkillId === "character-dialogue" && <DialogueSimulator />}

      {/* Chat area */}
      <AiChatList />

      {/* Input */}
      <AiChatInput />

      {/* Auto-continue suggestion */}
      <AutoContinueSuggestion autoContinue={autoContinue} onInsert={handleInsertContinuation} />
    </div>
  );
}
