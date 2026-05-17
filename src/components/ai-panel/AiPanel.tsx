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
import { AnalysisPanel } from "./AnalysisPanel";
import { InspirationPanel } from "./InspirationPanel";
import { MaterialPanel } from "./MaterialPanel";
import { ReaderSimulator } from "./ReaderSimulator";
import { OrchestratorPanel } from "./OrchestratorPanel";
import { PluginMarketplace } from "./PluginMarketplace";
import { IntegrationPanel } from "./IntegrationPanel";
import { AgentWritingPanel } from "./AgentWritingPanel";
import { StyleFingerprintPanel } from "./StyleFingerprintPanel";
import { StoryPlannerPanel } from "./StoryPlannerPanel";
import { PromptTemplatePanel } from "./PromptTemplatePanel";
import { ModelComparisonPanel } from "./ModelComparisonPanel";
import { BatchGenerationPanel } from "./BatchGenerationPanel";
import { DialogueConsistencyPanel } from "./DialogueConsistencyPanel";

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
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showInspiration, setShowInspiration] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [showReaderSim, setShowReaderSim] = useState(false);
  const [showOrchestrator, setShowOrchestrator] = useState(false);
  const [showPlugins, setShowPlugins] = useState(false);
  const [showIntegration, setShowIntegration] = useState(false);
  const [showAgent, setShowAgent] = useState(false);
  const [showStyleFP, setShowStyleFP] = useState(false);
  const [showStoryPlanner, setShowStoryPlanner] = useState(false);
  const [showPromptTemplates, setShowPromptTemplates] = useState(false);
  const [showModelComparison, setShowModelComparison] = useState(false);
  const [showBatchGeneration, setShowBatchGeneration] = useState(false);
  const [showDialogueConsistency, setShowDialogueConsistency] = useState(false);

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
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className={`rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors ${showAnalysis ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]" : ""}`}
            title="深度分析"
            aria-label="深度分析"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 14V6l4-4 4 4v8" />
              <path d="M6 14v-4h4v4" />
              <circle cx="8" cy="8" r="1.5" />
            </svg>
          </button>
          <button
            onClick={() => setShowInspiration(!showInspiration)}
            className={`rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors ${showInspiration ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]" : ""}`}
            title="灵感生成器"
            aria-label="灵感生成器"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 1l2 4 4.5.5-3.25 3L12.5 13 8 10.5 3.5 13l1.25-4.5L1.5 5.5 6 5z" />
            </svg>
          </button>
          <button
            onClick={() => setShowMaterials(!showMaterials)}
            className={`rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors ${showMaterials ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]" : ""}`}
            title="素材收集库"
            aria-label="素材收集库"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="12" height="12" rx="2" />
              <path d="M5 2v12M2 7h12" />
            </svg>
          </button>
          <button
            onClick={() => setShowReaderSim(!showReaderSim)}
            className={`rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors ${showReaderSim ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]" : ""}`}
            title="读者模拟"
            aria-label="读者模拟"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="5" r="3" />
              <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
            </svg>
          </button>
          <button
            onClick={() => setShowOrchestrator(!showOrchestrator)}
            className={`rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors ${showOrchestrator ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]" : ""}`}
            title="AI写作编排"
            aria-label="AI写作编排"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
              <circle cx="8" cy="8" r="3" />
            </svg>
          </button>
          <button
            onClick={() => setShowPlugins(!showPlugins)}
            className={`rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors ${showPlugins ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]" : ""}`}
            title="插件市场"
            aria-label="插件市场"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 3h4M6 8h4M6 13h4M3 3h1v1H3zM3 8h1v1H3zM3 13h1v1H3z" />
            </svg>
          </button>
          <button
            onClick={() => setShowIntegration(!showIntegration)}
            className={`rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors ${showIntegration ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]" : ""}`}
            title="第三方集成"
            aria-label="第三方集成"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 2v4l-4 4v4h4l4-4h4V6H10L6 2z" />
              <path d="M1 15l4-4M10 6l4-4" />
            </svg>
          </button>
          <button
            onClick={() => setShowAgent(!showAgent)}
            className={`rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors ${showAgent ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]" : ""}`}
            title="AI代理写作"
            aria-label="AI代理写作"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="12" height="10" rx="2" />
              <circle cx="6" cy="8" r="1.5" />
              <circle cx="10" cy="8" r="1.5" />
              <path d="M5 13v2M11 13v2M3 6h10" />
            </svg>
          </button>
          <button
            onClick={() => setShowStyleFP(!showStyleFP)}
            className={`rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors ${showStyleFP ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]" : ""}`}
            title="风格学习"
            aria-label="风格学习"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 2h12v12H2z" />
              <path d="M5 5h6M5 8h4M5 11h6" />
              <circle cx="12" cy="4" r="2" fill="currentColor" />
            </svg>
          </button>
          <button
            onClick={() => setShowStoryPlanner(!showStoryPlanner)}
            className={`rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors ${showStoryPlanner ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]" : ""}`}
            title="长篇规划"
            aria-label="长篇规划"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1 1h5v5H1zM10 1h5v5h-5zM1 10h5v5H1zM10 10h5v5h-5z" />
              <path d="M6 3.5h4M3.5 6v4M6 12.5h4M12.5 6v4" />
            </svg>
          </button>
          <button
            onClick={() => setShowPromptTemplates(!showPromptTemplates)}
            className={`rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors ${showPromptTemplates ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]" : ""}`}
            title="Prompt模板"
            aria-label="Prompt模板"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="2" width="14" height="12" rx="2" />
              <path d="M4 5h8M4 8h5M4 11h6" />
            </svg>
          </button>
          <button
            onClick={() => setShowModelComparison(!showModelComparison)}
            className={`rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors ${showModelComparison ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]" : ""}`}
            title="多模型对比"
            aria-label="多模型对比"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="1" width="6" height="14" rx="1" />
              <rect x="9" y="1" width="6" height="14" rx="1" />
              <path d="M3 5h2M3 8h2M11 5h2M11 8h2" />
            </svg>
          </button>
          <button
            onClick={() => setShowBatchGeneration(!showBatchGeneration)}
            className={`rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors ${showBatchGeneration ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]" : ""}`}
            title="批量生章"
            aria-label="批量生章"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 2h4v4H2zM10 2h4v4h-4zM2 10h4v4H2zM10 10h4v4h-4z" />
              <path d="M6 4h4M4 6v4M6 12h4M12 6v4" />
            </svg>
          </button>
          <button
            onClick={() => setShowDialogueConsistency(!showDialogueConsistency)}
            className={`rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors ${showDialogueConsistency ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]" : ""}`}
            title="角色语音一致性"
            aria-label="角色语音一致性"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 3h12v2H2zM4 7h8v2H4zM6 11h4v2H6z" />
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

      {/* Analysis panel (collapsible) */}
      {showAnalysis && currentProject && (
        <div className="border-b border-[var(--color-border)] max-h-96 overflow-y-auto">
          <AnalysisPanel projectId={currentProject.id} />
        </div>
      )}

      {/* Inspiration panel (collapsible) */}
      {showInspiration && currentProject && (
        <div className="border-b border-[var(--color-border)] max-h-96 overflow-y-auto">
          <InspirationPanel projectId={currentProject.id} />
        </div>
      )}

      {/* Material panel (collapsible) */}
      {showMaterials && currentProject && (
        <div className="border-b border-[var(--color-border)] max-h-96 overflow-y-auto">
          <MaterialPanel projectId={currentProject.id} />
        </div>
      )}

      {/* Reader simulator (collapsible) */}
      {showReaderSim && currentProject && (
        <div className="border-b border-[var(--color-border)] max-h-96 overflow-y-auto">
          <ReaderSimulator projectId={currentProject.id} />
        </div>
      )}

      {/* Orchestrator (collapsible) */}
      {showOrchestrator && currentProject && (
        <div className="border-b border-[var(--color-border)] max-h-96 overflow-y-auto">
          <OrchestratorPanel projectId={currentProject.id} />
        </div>
      )}

      {/* Plugin marketplace (collapsible) */}
      {showPlugins && (
        <div className="border-b border-[var(--color-border)] max-h-96 overflow-y-auto">
          <PluginMarketplace />
        </div>
      )}

      {/* Integration panel (collapsible) */}
      {showIntegration && currentProject && (
        <div className="border-b border-[var(--color-border)] max-h-96 overflow-y-auto">
          <IntegrationPanel projectId={currentProject.id} />
        </div>
      )}

      {/* Agent writing (collapsible) */}
      {showAgent && currentProject && (
        <div className="border-b border-[var(--color-border)] max-h-96 overflow-y-auto">
          <AgentWritingPanel projectId={currentProject.id} />
        </div>
      )}

      {/* Style fingerprint (collapsible) */}
      {showStyleFP && currentProject && (
        <div className="border-b border-[var(--color-border)] max-h-96 overflow-y-auto">
          <StyleFingerprintPanel projectId={currentProject.id} />
        </div>
      )}

      {/* Story planner (collapsible) */}
      {showStoryPlanner && currentProject && (
        <div className="border-b border-[var(--color-border)] max-h-96 overflow-y-auto">
          <StoryPlannerPanel projectId={currentProject.id} />
        </div>
      )}

      {/* Prompt templates (collapsible) */}
      {showPromptTemplates && (
        <div className="border-b border-[var(--color-border)] max-h-96 overflow-y-auto">
          <PromptTemplatePanel onSelectTemplate={() => {}} />
        </div>
      )}

      {/* Model comparison (collapsible) */}
      {showModelComparison && (
        <div className="border-b border-[var(--color-border)] max-h-96 overflow-y-auto">
          <ModelComparisonPanel />
        </div>
      )}

      {/* Batch generation (collapsible) */}
      {showBatchGeneration && currentProject && (
        <div className="border-b border-[var(--color-border)] max-h-96 overflow-y-auto">
          <BatchGenerationPanel projectId={currentProject.id} />
        </div>
      )}

      {/* Dialogue consistency (collapsible) */}
      {showDialogueConsistency && currentProject && (
        <div className="border-b border-[var(--color-border)] max-h-96 overflow-y-auto">
          <DialogueConsistencyPanel projectId={currentProject.id} />
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
