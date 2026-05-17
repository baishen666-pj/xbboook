import { useState, lazy, Suspense } from "react";
import { useUiStore } from "@/stores/uiStore";
import { useProjectStore } from "@/stores/projectStore";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

const VolumeTree = lazy(() => import("./VolumeTree").then(m => ({ default: m.VolumeTree })));
const CharacterList = lazy(() => import("@/components/character/CharacterList").then(m => ({ default: m.CharacterList })));
const WorldviewList = lazy(() => import("@/components/worldview/WorldviewList").then(m => ({ default: m.WorldviewList })));
const OutlinePanel = lazy(() => import("@/components/outline/OutlinePanel").then(m => ({ default: m.OutlinePanel })));
const VersionPanel = lazy(() => import("@/components/version/VersionPanel").then(m => ({ default: m.VersionPanel })));
const SchedulePanel = lazy(() => import("@/components/schedule/SchedulePanel").then(m => ({ default: m.SchedulePanel })));
const ForeshadowingPanel = lazy(() => import("@/components/foreshadowing/ForeshadowingPanel").then(m => ({ default: m.ForeshadowingPanel })));
const SearchPanel = lazy(() => import("@/components/search/SearchPanel").then(m => ({ default: m.SearchPanel })));
const ImportPanel = lazy(() => import("@/components/settings/ImportPanel").then(m => ({ default: m.ImportPanel })));
const WritingGoalPanel = lazy(() => import("@/components/settings/WritingGoalPanel").then(m => ({ default: m.WritingGoalPanel })));
const StoryArcPanel = lazy(() => import("@/components/story-arcs/StoryArcPanel").then(m => ({ default: m.StoryArcPanel })));
const SnippetPanel = lazy(() => import("@/components/snippets/SnippetPanel").then(m => ({ default: m.SnippetPanel })));
const ConsistencyPanel = lazy(() => import("@/components/consistency/ConsistencyPanel").then(m => ({ default: m.ConsistencyPanel })));
const TimelinePanel = lazy(() => import("@/components/timeline/TimelinePanel").then(m => ({ default: m.TimelinePanel })));
const OutlineBoard = lazy(() => import("@/components/outline/OutlineBoard").then(m => ({ default: m.OutlineBoard })));

type Tab = "chapters" | "characters" | "worldview" | "outline" | "versions" | "schedule" | "foreshadowing" | "snippets" | "arcs" | "consistency" | "timeline" | "board";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "chapters", label: "章节" },
  { key: "characters", label: "角色" },
  { key: "worldview", label: "世界观" },
  { key: "outline", label: "大纲" },
  { key: "board", label: "看板" },
  { key: "foreshadowing", label: "伏笔" },
  { key: "arcs", label: "弧线" },
  { key: "timeline", label: "时间线" },
  { key: "snippets", label: "片段" },
  { key: "consistency", label: "一致性" },
  { key: "versions", label: "历史" },
  { key: "schedule", label: "排期" },
];

export function ChapterSidebar() {
  const activeLeftTab = useUiStore((s) => s.activeLeftTab);
  const setActiveLeftTab = useUiStore((s) => s.setActiveLeftTab);
  const toggleLeftPanel = useUiStore((s) => s.toggleLeftPanel);
  const isSearchOpen = useUiStore((s) => s.isSearchOpen);
  const toggleSearch = useUiStore((s) => s.toggleSearch);
  const closeSearch = useUiStore((s) => s.closeSearch);
  const currentProject = useProjectStore((s) => s.currentProject);
  const [showImport, setShowImport] = useState(false);
  const [showGoal, setShowGoal] = useState(false);

  return (
    <div className="flex h-full flex-col border-r border-[var(--color-border)] bg-[var(--color-surface-1)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
        <span className="truncate text-[var(--text-sm)] font-medium text-[var(--color-text-primary)]">
          {currentProject?.name ?? "未选择作品"}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleSearch}
            className={`touch-target rounded-[var(--radius-sm)] p-1 transition-colors ${
              isSearchOpen
                ? "text-[var(--color-primary)] bg-[var(--color-primary-subtle)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]"
            }`}
            title="搜索 (Ctrl+Shift+F)"
            aria-label="搜索"
            aria-expanded={isSearchOpen}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <button
            onClick={() => setShowImport(!showImport)}
            className={`touch-target rounded-[var(--radius-sm)] p-1 transition-colors ${
              showImport
                ? "text-[var(--color-primary)] bg-[var(--color-primary-subtle)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]"
            }`}
            title="导入文件"
            aria-label="导入文件"
            aria-expanded={showImport}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
          </button>
          <button
            onClick={() => setShowGoal(!showGoal)}
            className={`touch-target rounded-[var(--radius-sm)] p-1 transition-colors ${
              showGoal
                ? "text-[var(--color-primary)] bg-[var(--color-primary-subtle)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]"
            }`}
            title="写作目标"
            aria-label="写作目标"
            aria-expanded={showGoal}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </button>
          <button
            onClick={toggleLeftPanel}
            className="touch-target rounded-[var(--radius-sm)] p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-colors"
            title="关闭面板"
            aria-label="关闭侧边栏"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M9 2L4 7l5 5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search overlay */}
      {isSearchOpen && (
        <div className="border-b border-[var(--color-border)] tab-content-enter" style={{ height: "40vh", minHeight: 160 }}>
          <ErrorBoundary>
            <Suspense fallback={<div className="p-4 text-[var(--color-text-muted)] text-[var(--text-sm)]">加载中...</div>}>
              <SearchPanel onClose={closeSearch} />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)] overflow-x-auto scrollbar-none" role="tablist" aria-label="侧边栏标签页">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveLeftTab(tab.key)}
            role="tab"
            aria-selected={activeLeftTab === tab.key}
            aria-controls={`tabpanel-${tab.key}`}
            className={[
              "flex-1 px-1 py-2 text-[var(--text-xs)] transition-colors min-h-[44px]",
              activeLeftTab === tab.key
                ? "border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {showImport ? (
          <div className="tab-content-enter h-full" role="tabpanel">
            <ErrorBoundary>
              <Suspense fallback={<div className="p-4 text-[var(--color-text-muted)] text-[var(--text-sm)]">加载中...</div>}>
                <ImportPanel onClose={() => setShowImport(false)} />
              </Suspense>
            </ErrorBoundary>
          </div>
        ) : showGoal ? (
          <div className="tab-content-enter h-full" role="tabpanel">
            <ErrorBoundary>
              <Suspense fallback={<div className="p-4 text-[var(--color-text-muted)] text-[var(--text-sm)]">加载中...</div>}>
                <WritingGoalPanel />
              </Suspense>
            </ErrorBoundary>
          </div>
        ) : activeLeftTab === "versions" ? (
          <div id="tabpanel-versions" className="tab-content-enter h-full" role="tabpanel" aria-label="历史版本">
            <ErrorBoundary>
              <Suspense fallback={<div className="p-4 text-[var(--color-text-muted)] text-[var(--text-sm)]">加载中...</div>}>
                <VersionPanel />
              </Suspense>
            </ErrorBoundary>
          </div>
        ) : activeLeftTab === "schedule" ? (
          <div id="tabpanel-schedule" className="tab-content-enter h-full" role="tabpanel" aria-label="排期">
            <ErrorBoundary>
              <Suspense fallback={<div className="p-4 text-[var(--color-text-muted)] text-[var(--text-sm)]">加载中...</div>}>
                <SchedulePanel />
              </Suspense>
            </ErrorBoundary>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="tab-content-enter">
              <ErrorBoundary>
                <Suspense fallback={<div className="p-4 text-[var(--color-text-muted)] text-[var(--text-sm)]">加载中...</div>}>
                  {activeLeftTab === "chapters" && <div id="tabpanel-chapters" role="tabpanel" aria-label="章节列表"><VolumeTree /></div>}
                  {activeLeftTab === "characters" && <div id="tabpanel-characters" role="tabpanel" aria-label="角色列表"><CharacterList /></div>}
                  {activeLeftTab === "worldview" && <div id="tabpanel-worldview" role="tabpanel" aria-label="世界观"><WorldviewList /></div>}
                  {activeLeftTab === "outline" && <div id="tabpanel-outline" role="tabpanel" aria-label="大纲"><OutlinePanel /></div>}
                  {activeLeftTab === "board" && <div id="tabpanel-board" role="tabpanel" aria-label="看板"><OutlineBoard /></div>}
                  {activeLeftTab === "foreshadowing" && <div id="tabpanel-foreshadowing" role="tabpanel" aria-label="伏笔"><ForeshadowingPanel /></div>}
                  {activeLeftTab === "arcs" && <div id="tabpanel-arcs" role="tabpanel" aria-label="故事弧线"><StoryArcPanel /></div>}
                  {activeLeftTab === "snippets" && <div id="tabpanel-snippets" role="tabpanel" aria-label="片段"><SnippetPanel /></div>}
                  {activeLeftTab === "consistency" && <div id="tabpanel-consistency" role="tabpanel" aria-label="一致性检查"><ConsistencyPanel /></div>}
                  {activeLeftTab === "timeline" && <div id="tabpanel-timeline" role="tabpanel" aria-label="时间线"><TimelinePanel /></div>}
                </Suspense>
              </ErrorBoundary>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
