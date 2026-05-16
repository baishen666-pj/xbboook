import { useState } from "react";
import { useUiStore } from "@/stores/uiStore";
import { useProjectStore } from "@/stores/projectStore";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { VolumeTree } from "./VolumeTree";
import { CharacterList } from "@/components/character/CharacterList";
import { WorldviewList } from "@/components/worldview/WorldviewList";
import { OutlinePanel } from "@/components/outline/OutlinePanel";
import { VersionPanel } from "@/components/version/VersionPanel";
import { SearchPanel } from "@/components/search/SearchPanel";
import { ImportPanel } from "@/components/settings/ImportPanel";
import { WritingGoalPanel } from "@/components/settings/WritingGoalPanel";

type Tab = "chapters" | "characters" | "worldview" | "outline" | "versions";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "chapters", label: "章节" },
  { key: "characters", label: "角色" },
  { key: "worldview", label: "世界观" },
  { key: "outline", label: "大纲" },
  { key: "versions", label: "历史" },
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
            className={`rounded-[var(--radius-sm)] p-1 transition-colors ${
              isSearchOpen
                ? "text-[var(--color-primary)] bg-[var(--color-primary-subtle)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]"
            }`}
            title="搜索 (Ctrl+Shift+F)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <button
            onClick={() => setShowImport(!showImport)}
            className={`rounded-[var(--radius-sm)] p-1 transition-colors ${
              showImport
                ? "text-[var(--color-primary)] bg-[var(--color-primary-subtle)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]"
            }`}
            title="导入文件"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
          </button>
          <button
            onClick={() => setShowGoal(!showGoal)}
            className={`rounded-[var(--radius-sm)] p-1 transition-colors ${
              showGoal
                ? "text-[var(--color-primary)] bg-[var(--color-primary-subtle)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]"
            }`}
            title="写作目标"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </button>
          <button
            onClick={toggleLeftPanel}
            className="rounded-[var(--radius-sm)] p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-colors"
            title="关闭面板"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 2L4 7l5 5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search overlay */}
      {isSearchOpen && (
        <div className="border-b border-[var(--color-border)]" style={{ height: "40vh", minHeight: 160 }}>
          <SearchPanel onClose={closeSearch} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveLeftTab(tab.key)}
            className={[
              "flex-1 px-1 py-2 text-[var(--text-xs)] transition-colors",
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
      {showImport ? (
        <ImportPanel onClose={() => setShowImport(false)} />
      ) : showGoal ? (
        <WritingGoalPanel />
      ) : activeLeftTab === "versions" ? (
        <VersionPanel />
      ) : (
        <ScrollArea className="flex-1">
          {activeLeftTab === "chapters" && <VolumeTree />}
          {activeLeftTab === "characters" && <CharacterList />}
          {activeLeftTab === "worldview" && <WorldviewList />}
          {activeLeftTab === "outline" && <OutlinePanel />}
        </ScrollArea>
      )}
    </div>
  );
}
