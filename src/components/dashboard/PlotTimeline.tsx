import { useEffect, useState } from "react";
import { apiClient } from "@/services/apiClient";

interface TimelineChapter {
  id: string;
  title: string;
  wordCount: number;
  volumeId: string | null;
}

interface TimelineVolume {
  id: string;
  name: string;
  sortOrder: number;
}

export function PlotTimeline({ projectId }: { projectId: string }) {
  const [chapters, setChapters] = useState<TimelineChapter[]>([]);
  const [volumes, setVolumes] = useState<TimelineVolume[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [projectId]);

  async function load() {
    const chRes = await apiClient.get<TimelineChapter[]>(`/projects/${projectId}/chapters`);
    const volRes = await apiClient.get<TimelineVolume[]>(`/projects/${projectId}/volumes`);

    if (chRes.success && chRes.data) setChapters(chRes.data);
    if (volRes.success && volRes.data) setVolumes(volRes.data.sort((a, b) => a.sortOrder - b.sortOrder));
  }

  const chaptersByVolume = (volumeId: string | null) =>
    chapters.filter((c) => c.volumeId === volumeId);

  const maxWords = Math.max(...chapters.map((c) => c.wordCount), 1);

  return (
    <div className="space-y-2">
      <div className="text-xs text-[var(--color-text-muted)]">
        情节时间线 · {chapters.length} 章 · {volumes.length} 卷
      </div>

      <div className="relative overflow-x-auto">
        {/* Volume sections */}
        <div className="flex items-stretch gap-0 min-w-max">
          {/* No-volume chapters */}
          {chaptersByVolume(null).length > 0 && (
            <VolumeSection
              name="未分卷"
              chapters={chaptersByVolume(null)}
              maxWords={maxWords}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
          {volumes.map((vol) => (
            <VolumeSection
              key={vol.id}
              name={vol.name}
              chapters={chaptersByVolume(vol.id)}
              maxWords={maxWords}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ))}
        </div>
      </div>

      {/* Selected chapter detail */}
      {selectedId && (() => {
        const ch = chapters.find((c) => c.id === selectedId);
        if (!ch) return null;
        return (
          <div className="rounded bg-[var(--color-surface-hover)] p-2 text-[10px]">
            <div className="font-medium text-[var(--color-text-primary)]">{ch.title}</div>
            <div className="text-[var(--color-text-muted)]">{ch.wordCount} 字</div>
          </div>
        );
      })()}
    </div>
  );
}

function VolumeSection({ name, chapters, maxWords, selectedId, onSelect }: {
  name: string;
  chapters: TimelineChapter[];
  maxWords: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="border-r border-[var(--color-border)] last:border-r-0">
      <div className="text-[9px] text-[var(--color-primary)] font-medium px-2 py-1 bg-[var(--color-primary-subtle)] whitespace-nowrap">
        {name} ({chapters.length}章)
      </div>
      <div className="flex items-end gap-px p-1">
        {chapters.map((ch) => {
          const heightPct = maxWords > 0 ? (ch.wordCount / maxWords) * 100 : 0;
          const isSelected = selectedId === ch.id;
          return (
            <div
              key={ch.id}
              onClick={() => onSelect(ch.id)}
              className={`w-3 rounded-t-sm cursor-pointer transition-all hover:opacity-80 ${isSelected ? "ring-1 ring-[var(--color-primary)]" : ""}`}
              style={{
                height: `${Math.max(heightPct, 5)}px`,
                backgroundColor: isSelected ? "var(--color-primary)" : "rgba(255,255,255,0.2)",
                minHeight: "4px",
              }}
              title={`${ch.title}: ${ch.wordCount}字`}
            />
          );
        })}
      </div>
    </div>
  );
}
