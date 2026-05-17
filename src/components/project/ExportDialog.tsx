import { useState, useEffect, useRef } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

const FORMATS = [
  { ext: "txt", label: "TXT", desc: "纯文本" },
  { ext: "md", label: "Markdown", desc: "带格式标记" },
  { ext: "epub", label: "EPUB", desc: "电子书" },
  { ext: "docx", label: "DOCX", desc: "Word 文档" },
  { ext: "pdf", label: "PDF", desc: "打印友好" },
] as const;

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportDialog({ isOpen, onClose }: ExportDialogProps) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const chapters = useProjectStore((s) => s.chapters);
  const [format, setFormat] = useState<string>("pdf");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [includeToc, setIncludeToc] = useState(true);
  const [includeCover, setIncludeCover] = useState(true);
  const selectAllRef = useRef(false);

  useEffect(() => {
    if (isOpen && chapters.length > 0) {
      setSelectedIds(new Set(chapters.map((ch) => ch.id)));
      selectAllRef.current = true;
    }
  }, [isOpen, chapters]);

  if (!currentProject) return null;

  const totalWords = chapters
    .filter((ch) => selectedIds.has(ch.id))
    .reduce((sum, ch) => sum + (ch.wordCount ?? 0), 0);

  function toggleAll() {
    if (selectAllRef.current) {
      setSelectedIds(new Set());
      selectAllRef.current = false;
    } else {
      setSelectedIds(new Set(chapters.map((ch) => ch.id)));
      selectAllRef.current = true;
    }
  }

  function toggleChapter(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleExport() {
    const params = new URLSearchParams();
    if (selectedIds.size < chapters.length) {
      params.set("chapters", [...selectedIds].join(","));
    }
    if (!includeToc) params.set("includeToc", "false");
    if (!includeCover) params.set("includeCover", "false");
    const qs = params.toString();
    const url = `/api/projects/${currentProject!.id}/export/${format}${qs ? `?${qs}` : ""}`;
    window.open(url, "_blank");
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="导出作品">
      <div className="flex flex-col gap-4">
        {/* Format selection */}
        <div className="flex flex-col gap-1">
          <label className="text-sm text-[var(--color-text-secondary)]">格式</label>
          <div className="flex gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.ext}
                type="button"
                onClick={() => setFormat(f.ext)}
                className={[
                  "flex-1 rounded-md border px-2 py-1.5 text-center transition-colors",
                  format === f.ext
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                    : "border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:border-[var(--color-border)]",
                ].join(" ")}
              >
                <div className="text-xs font-medium">{f.label}</div>
                <div className="text-[10px] opacity-60">{f.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Chapter selection */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-sm text-[var(--color-text-secondary)]">章节</label>
            <button
              type="button"
              onClick={toggleAll}
              className="text-[10px] text-[var(--color-primary)] hover:underline"
            >
              {selectAllRef.current ? "取消全选" : "全选"}
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1">
            {chapters.map((ch) => (
              <label
                key={ch.id}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[var(--color-surface-3)] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(ch.id)}
                  onChange={() => toggleChapter(ch.id)}
                  className="rounded border-[var(--color-border)]"
                />
                <span className="text-xs text-[var(--color-text-secondary)] flex-1 truncate">
                  {ch.title}
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {ch.wordCount > 0 ? `${ch.wordCount}字` : ""}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Options */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={includeToc}
              onChange={(e) => setIncludeToc(e.target.checked)}
              className="rounded border-[var(--color-border)]"
            />
            包含目录
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={includeCover}
              onChange={(e) => setIncludeCover(e.target.checked)}
              className="rounded border-[var(--color-border)]"
            />
            包含封面页
          </label>
        </div>

        {/* Summary */}
        <div className="text-[10px] text-[var(--color-text-muted)]">
          {selectedIds.size} 章 · {totalWords.toLocaleString()} 字 · {FORMATS.find((f) => f.ext === format)?.label}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} type="button">
            取消
          </Button>
          <Button
            variant="primary"
            onClick={handleExport}
            type="button"
            disabled={selectedIds.size === 0}
          >
            导出
          </Button>
        </div>
      </div>
    </Modal>
  );
}
