import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { useEffect } from "react";
import { ProjectList } from "@/components/project/ProjectList";
import { AppLayout } from "@/components/layout/AppLayout";
import { TitleBar } from "@/components/layout/TitleBar";
import { StatusBar } from "@/components/layout/StatusBar";
import { EditorArea } from "@/components/editor/EditorArea";
import { EditorContextMenu } from "@/components/editor/EditorContextMenu";
import { AiPanel } from "@/components/ai-panel/AiPanel";
import { useProjectStore } from "@/stores/projectStore";
import { useUiStore } from "@/stores/uiStore";
import { useAiStore } from "@/stores/aiStore";
import { fetchSkills } from "@/services/aiService";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

function Workspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const loadProjectData = useProjectStore((s) => s.loadProjectData);
  const toggleLeftPanel = useUiStore((s) => s.toggleLeftPanel);
  const toggleRightPanel = useUiStore((s) => s.toggleRightPanel);
  const isLeftPanelOpen = useUiStore((s) => s.isLeftPanelOpen);
  const isRightPanelOpen = useUiStore((s) => s.isRightPanelOpen);
  const isFullscreen = useUiStore((s) => s.isFullscreen);
  const setSkills = useAiStore((s) => s.setSkills);

  useKeyboardShortcuts();

  useEffect(() => {
    if (projectId) {
      void loadProjectData(projectId);
    }
  }, [projectId, loadProjectData]);

  useEffect(() => {
    fetchSkills().then(setSkills);
  }, [setSkills]);

  return (
    <div className="flex h-full flex-col">
      {!isFullscreen && <TitleBar />}

      <AppLayout rightPanel={<AiPanel />}>
        <EditorArea />
      </AppLayout>

      {!isFullscreen && <StatusBar />}
      <EditorContextMenu />

      {/* Toggle buttons when panels are closed */}
      {!isLeftPanelOpen && (
        <button
          onClick={toggleLeftPanel}
          className="fixed left-2 top-14 z-20 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] p-1.5 text-[var(--color-text-muted)] shadow-[var(--shadow-sm)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-colors"
          title="Open sidebar"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M5 2l5 5-5 5" />
          </svg>
        </button>
      )}
      {!isRightPanelOpen && (
        <button
          onClick={toggleRightPanel}
          className="fixed right-2 top-14 z-20 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] p-1.5 text-[var(--color-text-muted)] shadow-[var(--shadow-sm)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-colors"
          title="Open AI panel"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 2L4 7l5 5" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProjectList />} />
        <Route path="/project/:projectId" element={<Workspace />} />
      </Routes>
    </BrowserRouter>
  );
}
