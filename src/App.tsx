import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { ProjectList } from "@/components/project/ProjectList";
import { AppLayout } from "@/components/layout/AppLayout";
import { TitleBar } from "@/components/layout/TitleBar";
import { StatusBar } from "@/components/layout/StatusBar";
import { EditorArea } from "@/components/editor/EditorArea";
import { EditorContextMenu } from "@/components/editor/EditorContextMenu";
import { AiPanel } from "@/components/ai-panel/AiPanel";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useProjectStore } from "@/stores/projectStore";
import { useUiStore } from "@/stores/uiStore";
import { useAiStore } from "@/stores/aiStore";
import { useCollabStore, getStoredUserId } from "@/stores/collabStore";
import { fetchSkills } from "@/services/aiService";
import { collabService } from "@/services/collabService";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useSessionTracker } from "@/hooks/useSessionTracker";
import { useCollabPresence } from "@/hooks/useCollabPresence";
import { UserPicker } from "@/components/collab/UserPicker";

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
  useSessionTracker();
  useCollabPresence();

  useEffect(() => {
    if (projectId) {
      void loadProjectData(projectId);
    }
  }, [projectId, loadProjectData]);

  useEffect(() => {
    fetchSkills().then(setSkills).catch(() => {});
  }, [setSkills]);

  return (
    <div className="flex h-full flex-col">
      {!isFullscreen && <TitleBar />}

      <AppLayout rightPanel={<ErrorBoundary><AiPanel /></ErrorBoundary>}>
        <ErrorBoundary><EditorArea /></ErrorBoundary>
      </AppLayout>

      {!isFullscreen && <StatusBar />}
      <EditorContextMenu />

      {/* Toggle buttons when panels are closed */}
      {!isLeftPanelOpen && (
        <button
          onClick={toggleLeftPanel}
          className="fixed left-2 top-14 z-20 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] p-1.5 text-[var(--color-text-muted)] shadow-[var(--shadow-sm)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-colors"
          title="打开侧边栏"
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
          title="打开 AI 面板"
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
  const setCurrentUser = useCollabStore((s) => s.setCurrentUser);
  const currentUser = useCollabStore((s) => s.currentUser);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    const stored = getStoredUserId();
    if (stored) {
      collabService.getMe(stored).then((res) => {
        if (res.success && res.data) {
          setCurrentUser(res.data);
        } else {
          localStorage.removeItem("xbboook_user_id");
          setShowPicker(true);
        }
      });
    } else {
      setShowPicker(true);
    }
  }, [setCurrentUser]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProjectList />} />
        <Route path="/project/:projectId" element={<Workspace />} />
      </Routes>
      {showPicker && !currentUser && (
        <UserPicker onComplete={() => setShowPicker(false)} />
      )}
    </BrowserRouter>
  );
}
