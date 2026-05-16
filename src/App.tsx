import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useUiStore } from "@/stores/uiStore";
import { useAiStore } from "@/stores/aiStore";
import { useCollabStore, getStoredUserId } from "@/stores/collabStore";
import { fetchSkills } from "@/services/aiService";
import { collabService } from "@/services/collabService";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useSessionTracker } from "@/hooks/useSessionTracker";
import { useCollabPresence } from "@/hooks/useCollabPresence";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ToastContainer } from "@/components/ui/ToastContainer";

const ProjectList = lazy(() =>
  import("@/components/project/ProjectList").then((m) => ({ default: m.ProjectList })),
);
const AppLayout = lazy(() =>
  import("@/components/layout/AppLayout").then((m) => ({ default: m.AppLayout })),
);
const TitleBar = lazy(() =>
  import("@/components/layout/TitleBar").then((m) => ({ default: m.TitleBar })),
);
const StatusBar = lazy(() =>
  import("@/components/layout/StatusBar").then((m) => ({ default: m.StatusBar })),
);
const EditorArea = lazy(() =>
  import("@/components/editor/EditorArea").then((m) => ({ default: m.EditorArea })),
);
const EditorContextMenu = lazy(() =>
  import("@/components/editor/EditorContextMenu").then((m) => ({ default: m.EditorContextMenu })),
);
const AiPanel = lazy(() =>
  import("@/components/ai-panel/AiPanel").then((m) => ({ default: m.AiPanel })),
);
const UserPicker = lazy(() =>
  import("@/components/collab/UserPicker").then((m) => ({ default: m.UserPicker })),
);

function LoadingFallback() {
  return (
    <div className="flex h-full items-center justify-center bg-[var(--color-surface-0)]">
      <div className="h-5 w-5 animate-[spin-slow_1s_linear_infinite] rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
    </div>
  );
}

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
      <a href="#main-content" className="skip-to-content">跳到主要内容</a>
      {!isFullscreen && (
        <Suspense fallback={null}>
          <TitleBar />
        </Suspense>
      )}

      <Suspense fallback={<LoadingFallback />}>
        <AppLayout rightPanel={<ErrorBoundary><AiPanel /></ErrorBoundary>}>
          <ErrorBoundary><EditorArea /></ErrorBoundary>
        </AppLayout>
      </Suspense>

      {!isFullscreen && (
        <Suspense fallback={null}>
          <StatusBar />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <EditorContextMenu />
      </Suspense>

      {/* Toggle buttons when panels are closed */}
      {!isLeftPanelOpen && (
        <button
          onClick={toggleLeftPanel}
          className="fixed left-2 top-14 z-20 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] p-1.5 text-[var(--color-text-muted)] shadow-[var(--shadow-sm)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-colors btn-hover-scale touch-target"
          title="打开侧边栏"
          aria-label="打开侧边栏"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M5 2l5 5-5 5" />
          </svg>
        </button>
      )}
      {!isRightPanelOpen && (
        <button
          onClick={toggleRightPanel}
          className="fixed right-2 top-14 z-20 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] p-1.5 text-[var(--color-text-muted)] shadow-[var(--shadow-sm)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-colors btn-hover-scale touch-target"
          title="打开 AI 面板"
          aria-label="打开 AI 面板"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
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
      <ToastContainer />
      <Routes>
        <Route
          path="/"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <ProjectList />
            </Suspense>
          }
        />
        <Route path="/project/:projectId" element={<Workspace />} />
      </Routes>
      {showPicker && !currentUser && (
        <Suspense fallback={null}>
          <UserPicker onComplete={() => setShowPicker(false)} />
        </Suspense>
      )}
    </BrowserRouter>
  );
}
