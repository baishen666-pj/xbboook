import { useEffect, useMemo, useState } from "react";
import { useScheduleStore } from "@/stores/scheduleStore";
import { useProjectStore } from "@/stores/projectStore";
import { PublishStatusBadge } from "./PublishStatusBadge";
import type { PublishStatus, ScheduleItem } from "@/types/project";

const STATUS_GROUPS: Array<{ key: PublishStatus; label: string }> = [
  { key: "draft", label: "草稿" },
  { key: "scheduled", label: "待发" },
  { key: "published", label: "已发" },
  { key: "archived", label: "归档" },
];

const NEXT_STATUS: Record<PublishStatus, PublishStatus> = {
  draft: "scheduled",
  scheduled: "published",
  published: "archived",
  archived: "draft",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ScheduleItemRow({
  item,
  onStatusChange,
  onScheduleChange,
}: {
  item: ScheduleItem;
  onStatusChange: (id: string, status: PublishStatus) => void;
  onScheduleChange: (id: string, date: string) => void;
}) {
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(
    item.scheduledAt ? item.scheduledAt.slice(0, 16) : ""
  );

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--color-border)] last:border-0">
      <span className="flex-1 truncate text-xs text-[var(--color-text-secondary)]">
        {item.title}
      </span>
      <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
        {item.wordCount > 0 ? `${item.wordCount}字` : ""}
      </span>
      <PublishStatusBadge status={item.publishStatus} />
      <button
        onClick={() => onStatusChange(item.id, NEXT_STATUS[item.publishStatus])}
        className="rounded px-1 py-0.5 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] transition-colors"
        title="切换状态"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
      {item.publishStatus === "scheduled" && (
        <>
          {editingSchedule ? (
            <div className="flex items-center gap-1">
              <input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-28 rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-1 py-0.5 text-[10px] text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]/30"
              />
              <button
                onClick={() => {
                  if (scheduleDate) {
                    onScheduleChange(item.id, new Date(scheduleDate).toISOString());
                  }
                  setEditingSchedule(false);
                }}
                className="rounded bg-[var(--color-primary)]/10 px-1 py-0.5 text-[10px] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors"
              >
                确定
              </button>
              <button
                onClick={() => setEditingSchedule(false)}
                className="rounded px-1 py-0.5 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingSchedule(true)}
              className="rounded px-1 py-0.5 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] transition-colors"
              title="设置定时发布"
            >
              {item.scheduledAt ? formatDateTime(item.scheduledAt) : "设时间"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function SchedulePanel() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const scheduleItems = useScheduleStore((s) => s.scheduleItems);
  const loading = useScheduleStore((s) => s.loading);
  const fetchSchedule = useScheduleStore((s) => s.fetchSchedule);
  const updatePublishStatus = useScheduleStore((s) => s.updatePublishStatus);
  const clear = useScheduleStore((s) => s.clear);

  useEffect(() => {
    if (currentProject) {
      void fetchSchedule(currentProject.id);
    }
    return () => {
      clear();
    };
  }, [currentProject, fetchSchedule, clear]);

  const grouped = useMemo(() => {
    const map: Record<PublishStatus, ScheduleItem[]> = {
      draft: [],
      scheduled: [],
      published: [],
      archived: [],
    };
    for (const item of scheduleItems) {
      map[item.publishStatus].push(item);
    }
    return map;
  }, [scheduleItems]);

  const stats = useMemo(() => {
    const draftItems = grouped.draft;
    const totalWords = draftItems.reduce((sum, i) => sum + i.wordCount, 0);
    return { chapters: draftItems.length, words: totalWords };
  }, [grouped]);

  function handleStatusChange(id: string, status: PublishStatus) {
    void updatePublishStatus(id, status);
  }

  function handleScheduleChange(id: string, date: string) {
    void updatePublishStatus(id, "scheduled", date);
  }

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-muted)]">
        选择作品查看排期
      </div>
    );
  }

  if (loading && scheduleItems.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-muted)]">
        加载中...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Stats bar */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-3 py-2">
        <span className="text-[10px] text-[var(--color-text-muted)]">
          存稿: {stats.chapters}章 / {stats.words}字
        </span>
      </div>

      {/* Groups */}
      <div className="flex-1 overflow-y-auto">
        {STATUS_GROUPS.map((group) => {
          const items = grouped[group.key];
          if (items.length === 0) return null;
          return (
            <div key={group.key}>
              <div className="flex items-center gap-1 px-3 py-1 text-[10px] text-[var(--color-text-muted)]">
                <PublishStatusBadge status={group.key} />
                <span>{items.length}章</span>
              </div>
              {items.map((item) => (
                <ScheduleItemRow
                  key={item.id}
                  item={item}
                  onStatusChange={handleStatusChange}
                  onScheduleChange={handleScheduleChange}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}