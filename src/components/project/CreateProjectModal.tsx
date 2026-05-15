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
  { value: "webnovel", label: "Web Novel" },
  { value: "literary", label: "Literary" },
  { value: "script", label: "Script" },
];

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
      setError("Project name is required");
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
      setError(err instanceof Error ? err.message : "Failed to create project");
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Project">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Project Name *"
          placeholder="My Novel"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error && !name.trim() ? error : undefined}
          autoFocus
        />

        <Input
          label="Genre"
          placeholder="Fantasy, Romance, Sci-Fi..."
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
        />

        <div className="flex flex-col gap-1">
          <label className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            Description
          </label>
          <textarea
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            rows={3}
            placeholder="Brief description of your story..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            Writing Mode
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
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Project"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
