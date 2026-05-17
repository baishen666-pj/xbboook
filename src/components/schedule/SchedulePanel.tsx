import { useEffect, useMemo, useState, useCallback } from "react";
import { useScheduleStore } from "@/stores/scheduleStore";
import { useProjectStore } from "@/stores/projectStore";
import { chapterService } from "@/services/chapterService";
import { toast } from "@/stores/toastStore";
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
  selected,
  onToggleSelect,
}: {
  item: ScheduleItem;
  onStatusChange: (id: string, status: PublishStatus) => void;
  onScheduleChange: (id: string, date: string) => void;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(
    item.scheduledAt ? item.scheduledAt.slice(0, 16) : ""
  );

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 border-b border-[var(--color-border)] last:border-0 transition-colors ${selected ? "bg-indigo-500/5" : ""}`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        className="h-3 w-3 rounded border-[var(--color-border)] accent-indigo-500 shrink-0"
      />
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

function BatchScheduleDialog({
  chapterIds,
  onClose,
  onConfirm,
}: {
  chapterIds: string[];
  onClose: () => void;
  onConfirm: (startDate: string, intervalHours: number) => void;
}) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const [startDate, setStartDate] = useState(tomorrow.toISOString().slice(0, 16));
  const [interval, setInterval] = useState(24);
  const [loading, setLoading] = useState(false);

  const preview = useMemo(() => {
    if (!startDate) return [];
    const start = new Date(startDate);
    return chapterIds.slice(0, 10).map((_, i) => {
      const date = new Date(start.getTime() + i * interval * 3600_000);
      return date.toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        weekday: "short",
      });
    });
  }, [startDate, interval, chapterIds]);

  const handleSubmit = async () => {
    setLoading(true);
    await onConfirm(new Date(startDate).toISOString(), interval);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--color-surface-1)] rounded-lg shadow-xl w-96 max-h-[80vh] overflow-hidden border border-[var(--color-border)]">
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
            批量排期 ({chapterIds.length} 章)
          </h3>
        </div>

        <div className="px-4 py-3 space-y-3">
          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">开始时间</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-0)] px-2 py-1.5 text-xs text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)]/30"
            />
          </div>

          <div>
            <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">发布间隔</label>
            <div className="flex gap-2">
              {[
                { hours: 24, label: "每天" },
                { hours: 12, label: "每12h" },
                { hours: 48, label: "隔天" },
                { hours: 168, label: "每周" },
              ].map((opt) => (
                <button
                  key={opt.hours}
                  onClick={() => setInterval(opt.hours)}
                  className={`px-2 py-1 rounded text-[10px] transition-colors ${
                    interval === opt.hours
                      ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)]"
                      : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {preview.length > 0 && (
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">预览</label>
              <div className="bg-[var(--color-surface-0)] rounded border border-[var(--color-border)] p-2 max-h-32 overflow-y-auto">
                {preview.map((date, i) => (
                  <div key={i} className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1.5 py-0.5">
                    <span className="text-[var(--color-text-secondary)] font-medium w-6">{i + 1}.</span>
                    {date}
                  </div>
                ))}
                {chapterIds.length > 10 && (
                  <div className="text-[10px] text-[var(--color-text-muted)] pt-1 opacity-50">
                    ...共 {chapterIds.length} 章
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="flex-1 rounded border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !startDate}
            className="flex-1 rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs text-white hover:opacity-90 transition-colors disabled:opacity-50"
          >
            {loading ? "排期中..." : "确认排期"}
          </button>
        </div>
      </div>
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

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatch, setShowBatch] = useState(false);
  const [publishing, setPublishing] = useState(false);

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
    const scheduledCount = grouped.scheduled.length;
    const nextScheduled = grouped.scheduled[0]?.scheduledAt ?? null;
    return { chapters: draftItems.length, words: totalWords, scheduledCount, nextScheduled };
  }, [grouped]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllDraft = useCallback(() => {
    setSelectedIds(new Set(grouped.draft.map((i) => i.id)));
  }, [grouped.draft]);

  const selectAllScheduled = useCallback(() => {
    setSelectedIds(new Set(grouped.scheduled.map((i) => i.id)));
  }, [grouped.scheduled]);

  function handleStatusChange(id: string, status: PublishStatus) {
    void updatePublishStatus(id, status);
  }

  function handleScheduleChange(id: string, date: string) {
    void updatePublishStatus(id, "scheduled", date);
  }

  const handleBatchSchedule = async (startDate: string, intervalHours: number) => {
    if (!currentProject) return;
    const res = await chapterService.batchSchedule(currentProject.id, {
      chapterIds: [...selectedIds],
      startDate,
      intervalHours,
    });
    if (res.success && res.data) {
      toast("success", `已排期 ${res.data.scheduled.length} 章`);
      setSelectedIds(new Set());
      setShowBatch(false);
      void fetchSchedule(currentProject.id);
    } else {
      toast("error", "批量排期失败");
    }
  };

  const handlePublishDue = async () => {
    if (!currentProject) return;
    setPublishing(true);
    const res = await chapterService.publishDue(currentProject.id);
    if (res.success && res.data) {
      toast("success", `已发布 ${res.data.count} 章到期章节`);
      void fetchSchedule(currentProject.id);
    } else {
      toast("error", "发布失败");
    }
    setPublishing(false);
  };

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
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-3 py-2 flex-wrap">
        <span className="text-[10px] text-[var(--color-text-muted)]">
          存稿: {stats.chapters}章 / {stats.words.toLocaleString()}字
        </span>
        {stats.scheduledCount > 0 && (
          <span className="text-[10px] text-amber-500">
            待发: {stats.scheduledCount}章
          </span>
        )}
        {stats.nextScheduled && (
          <span className="text-[10px] text-[var(--color-text-muted)]">
            最近: {formatDateTime(stats.nextScheduled)}
          </span>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-1 border-b border-[var(--color-border)] px-3 py-1.5">
        {selectedIds.size > 0 ? (
          <>
            <span className="text-[10px] text-[var(--color-text-muted)] mr-1">
              {selectedIds.size} 章
            </span>
            <button
              onClick={() => setShowBatch(true)}
              className="rounded bg-[var(--color-primary)]/10 px-2 py-0.5 text-[10px] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors"
            >
              批量排期
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="rounded px-2 py-0.5 text-[10px] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] transition-colors"
            >
              取消选择
            </button>
          </>
        ) : (
          <>
            <button
              onClick={selectAllDraft}
              className="rounded px-2 py-0.5 text-[10px] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              全选草稿
            </button>
            <button
              onClick={selectAllScheduled}
              className="rounded px-2 py-0.5 text-[10px] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              全选待发
            </button>
          </>
        )}
        <div className="flex-1" />
        {grouped.scheduled.length > 0 && (
          <button
            onClick={handlePublishDue}
            disabled={publishing}
            className="rounded bg-green-500/10 px-2 py-0.5 text-[10px] text-green-500 hover:bg-green-500/20 transition-colors disabled:opacity-50"
          >
            {publishing ? "发布中..." : "发布到期"}
          </button>
        )}
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
                  selected={selectedIds.has(item.id)}
                  onToggleSelect={() => toggleSelect(item.id)}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Batch schedule dialog */}
      {showBatch && (
        <BatchScheduleDialog
          chapterIds={[...selectedIds]}
          onClose={() => setShowBatch(false)}
          onConfirm={handleBatchSchedule}
        />
      )}
    </div>
  );
}
