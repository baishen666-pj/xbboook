import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useProjectStore } from "@/stores/projectStore";
import { chapterService } from "@/services/chapterService";
import { outlineService } from "@/services/outlineService";
import { streamAi } from "@/services/aiService";
import type { Chapter } from "@/types/project";

type BoardColumn = "draft" | "writing" | "revised" | "done";

const COLUMNS: Array<{ id: BoardColumn; label: string; color: string }> = [
  { id: "draft", label: "待写", color: "bg-zinc-500" },
  { id: "writing", label: "写作中", color: "bg-blue-500" },
  { id: "revised", label: "待修改", color: "bg-amber-500" },
  { id: "done", label: "已完成", color: "bg-green-500" },
];

interface BoardCard {
  id: string;
  title: string;
  wordCount: number;
  status: string;
  volumeId: string | null;
  sortIndex: number;
  outlineSummary: string;
}

function SortableCard({
  card,
  onGenerate,
  generating,
}: {
  card: BoardCard;
  onGenerate: (card: BoardCard) => void;
  generating: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-0)] p-2.5 cursor-grab active:cursor-grabbing hover:border-[var(--color-primary)]/30 transition-colors"
    >
      <div className="flex items-start gap-1.5">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-[var(--color-text-primary)] truncate">
            {card.title}
          </div>
          {card.outlineSummary && (
            <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 line-clamp-2">
              {card.outlineSummary}
            </div>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onGenerate(card);
          }}
          disabled={generating}
          className="shrink-0 rounded p-1 text-[10px] text-[var(--color-text-muted)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40"
          title={generating ? "生成中..." : "AI 生成节拍"}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
        </button>
      </div>
      {card.wordCount > 0 && (
        <div className="mt-1.5 text-[10px] text-[var(--color-text-muted)]">
          {card.wordCount.toLocaleString()} 字
        </div>
      )}
    </div>
  );
}

function Column({
  column,
  cards,
  onGenerate,
  generatingId,
}: {
  column: (typeof COLUMNS)[number];
  cards: BoardCard[];
  onGenerate: (card: BoardCard) => void;
  generatingId: string | null;
}) {
  return (
    <div className="flex flex-col min-w-[200px] w-[220px] shrink-0">
      <div className="flex items-center gap-2 px-1 pb-2">
        <div className={`w-2 h-2 rounded-full ${column.color}`} />
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
          {column.label}
        </span>
        <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">
          {cards.length}
        </span>
      </div>
      <SortableContext
        items={cards.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 space-y-2 min-h-[60px] rounded-lg bg-[var(--color-surface-1)]/50 p-1.5">
          {cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              onGenerate={onGenerate}
              generating={generatingId === card.id}
            />
          ))}
          {cards.length === 0 && (
            <div className="py-4 text-center text-[10px] text-[var(--color-text-muted)] opacity-50">
              拖拽章节到这里
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function OutlineBoard() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const chapters = useProjectStore((s) => s.chapters);
  const [cards, setCards] = useState<BoardCard[]>([]);
  const [outlines, setOutlines] = useState<Map<string, string>>(new Map());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatingStatus, setGeneratingStatus] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    if (!currentProject) return;
    outlineService.list(currentProject.id).then((res) => {
      if (res.success && res.data) {
        const map = new Map<string, string>();
        for (const o of res.data) {
          if (o.targetRefId && o.content) {
            map.set(o.targetRefId, o.content);
          }
        }
        setOutlines(map);
      }
    });
  }, [currentProject]);

  useEffect(() => {
    const boardCards: BoardCard[] = chapters.map((ch: Chapter, i: number) => ({
      id: ch.id,
      title: ch.title,
      wordCount: ch.wordCount,
      status: ch.status,
      volumeId: ch.volumeId,
      sortIndex: i,
      outlineSummary: outlines.get(ch.id) ?? "",
    }));
    setCards(boardCards);
  }, [chapters, outlines]);

  const columnCards = useMemo(() => {
    const map: Record<BoardColumn, BoardCard[]> = {
      draft: [],
      writing: [],
      revised: [],
      done: [],
    };
    for (const card of cards) {
      const col = (card.status as BoardColumn) || "draft";
      if (col in map) map[col].push(card);
      else map.draft.push(card);
    }
    return map;
  }, [cards]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeCard = cards.find((c) => c.id === active.id);
      if (!activeCard) return;

      const targetColumn = over.data.current?.columnId as BoardColumn | undefined;
      if (targetColumn && targetColumn !== activeCard.status) {
        const validStatus = targetColumn as string;
        setCards((prev) =>
          prev.map((c) =>
            c.id === activeCard.id ? { ...c, status: validStatus } : c
          )
        );
      }
    },
    [cards]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null);
      const { active } = event;
      const card = cards.find((c) => c.id === active.id);
      if (!card || !currentProject) return;

      const original = chapters.find((c: Chapter) => c.id === card.id);
      if (original && original.status !== card.status) {
        await chapterService.update(currentProject.id, card.id, {
          status: card.status as Chapter["status"],
        });
      }
    },
    [cards, chapters, currentProject]
  );

  const handleGenerateBeats = useCallback(
    async (card: BoardCard) => {
      if (!currentProject || generatingId) return;

      setGeneratingId(card.id);
      setGeneratingStatus("正在生成节拍...");

      let content = "";
      try {
        for await (const event of streamAi({
          projectId: currentProject.id,
          skillId: "plot-planning",
          customInstruction: `为章节"${card.title}"生成详细的写作节拍。包括：场景、冲突、角色动作、情感弧线。${card.outlineSummary ? `\n大纲描述: ${card.outlineSummary}` : ""}`,
        })) {
          if (event.type === "chunk") {
            content += event.content;
            setGeneratingStatus(`生成中... ${content.length} 字`);
          }
        }

        if (content) {
          await outlineService.create(currentProject.id, {
            title: `${card.title} - 节拍`,
            level: 1,
            targetRefId: card.id,
            content,
          });
          setOutlines((prev) => {
            const next = new Map(prev);
            next.set(card.id, content);
            return next;
          });
          setGeneratingStatus("节拍已保存");
        }
      } catch {
        setGeneratingStatus("生成失败");
      } finally {
        setTimeout(() => {
          setGeneratingId(null);
          setGeneratingStatus("");
        }, 2000);
      }
    },
    [currentProject, generatingId]
  );

  if (!currentProject) return null;

  const activeCard = activeId ? cards.find((c) => c.id === activeId) : null;

  return (
    <div className="flex flex-col h-full">
      {generatingStatus && (
        <div className="flex items-center gap-2 border-b border-[var(--color-primary)]/10 bg-[var(--color-primary)]/5 px-3 py-1.5 text-[11px] text-[var(--color-primary)]">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-primary)] animate-[pulse-subtle_1.5s_ease-in-out_infinite]" />
          {generatingStatus}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 p-3 h-full items-start">
            {COLUMNS.map((col) => (
              <Column
                key={col.id}
                column={col}
                cards={columnCards[col.id]}
                onGenerate={handleGenerateBeats}
                generatingId={generatingId}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeCard && (
            <div className="rounded-lg border border-[var(--color-primary)] bg-[var(--color-surface-0)] p-2.5 shadow-lg max-w-[200px]">
              <div className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                {activeCard.title}
              </div>
              {activeCard.wordCount > 0 && (
                <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {activeCard.wordCount.toLocaleString()} 字
                </div>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
