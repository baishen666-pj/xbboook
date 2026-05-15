import { useUiStore } from "@/stores/uiStore";
import { useProjectStore } from "@/stores/projectStore";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { VolumeTree } from "./VolumeTree";
import { CharacterList } from "@/components/character/CharacterList";
import { WorldviewList } from "@/components/worldview/WorldviewList";
import { OutlinePanel } from "@/components/outline/OutlinePanel";

type Tab = "chapters" | "characters" | "worldview" | "outline";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "chapters", label: "Chapters" },
  { key: "characters", label: "Characters" },
  { key: "worldview", label: "World" },
  { key: "outline", label: "Outline" },
];

export function ChapterSidebar() {
  const activeLeftTab = useUiStore((s) => s.activeLeftTab);
  const setActiveLeftTab = useUiStore((s) => s.setActiveLeftTab);
  const toggleLeftPanel = useUiStore((s) => s.toggleLeftPanel);
  const currentProject = useProjectStore((s) => s.currentProject);

  return (
    <div className="flex h-full flex-col border-r border-[var(--color-border)] bg-[var(--color-surface-1)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
        <span className="truncate text-[var(--text-sm)] font-medium text-[var(--color-text-primary)]">
          {currentProject?.name ?? "No Project"}
        </span>
        <button
          onClick={toggleLeftPanel}
          className="rounded-[var(--radius-sm)] p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-colors"
          title="Close panel"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 2L4 7l5 5" />
          </svg>
        </button>
      </div>

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
      <ScrollArea className="flex-1">
        {activeLeftTab === "chapters" && <VolumeTree />}
        {activeLeftTab === "characters" && <CharacterList />}
        {activeLeftTab === "worldview" && <WorldviewList />}
        {activeLeftTab === "outline" && <OutlinePanel />}
      </ScrollArea>
    </div>
  );
}
