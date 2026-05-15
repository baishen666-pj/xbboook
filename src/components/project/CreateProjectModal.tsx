import { useState, type FormEvent } from "react";
import type { WritingMode } from "@/types/project";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    genre: string;
    description: string;
    writingMode: WritingMode;
  }) => Promise<void>;
}

const WRITING_MODES: Array<{ value: WritingMode; label: string }> = [
  { value: "webnovel", label: "网文" },
  { value: "literary", label: "文学" },
  { value: "script", label: "剧本" },
];

const GENRE_SUGGESTIONS = ["玄幻", "仙侠", "都市", "言情", "科幻", "历史", "游戏", "悬疑"];

export function CreateProjectModal({
  isOpen,
  onClose,
  onSubmit,
}: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [writingMode, setWritingMode] = useState<WritingMode>("webnovel");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("请输入作品名称");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        name: name.trim(),
        genre: genre.trim(),
        description: description.trim(),
        writingMode,
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    setName("");
    setGenre("");
    setDescription("");
    setWritingMode("webnovel");
    setError(null);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="新建作品">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="作品名称 *"
          placeholder="输入你的书名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error && !name.trim() ? error : undefined}
          autoFocus
        />

        <div className="flex flex-col gap-1">
          <label className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            题材类型
          </label>
          <input
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            placeholder="玄幻、言情、科幻..."
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5 mt-1">
            {GENRE_SUGGESTIONS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGenre(g)}
                className="rounded-full border border-[var(--color-border-subtle)] px-2 py-0.5 text-[var(--text-xs)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)] transition-colors"
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            简介
          </label>
          <textarea
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            rows={3}
            placeholder="简要描述你的故事..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            写作模式
          </label>
          <div className="flex gap-2">
            {WRITING_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => setWritingMode(mode.value)}
                className={[
                  "flex-1 rounded-[var(--radius-md)] border px-3 py-2 text-[var(--text-sm)] transition-colors",
                  writingMode === mode.value
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                    : "border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:border-[var(--color-border)]",
                ].join(" ")}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-[var(--text-xs)] text-[var(--color-error)]">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={handleClose} type="button">
            取消
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "创建中..." : "创建作品"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
