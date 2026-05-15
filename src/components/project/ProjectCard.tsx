import type { Project } from "@/types/project";

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / 3_600_000);

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

const MODE_LABELS: Record<string, string> = {
  webnovel: "Web Novel",
  literary: "Literary",
  script: "Script",
};

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-5 text-left transition-all duration-[var(--duration-normal)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-2)] hover:shadow-[var(--shadow-md)]"
    >
      <div className="flex items-start justify-between">
        <h3 className="text-base font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
          {project.name}
        </h3>
        <span className="rounded-[var(--radius-sm)] bg-[var(--color-primary-subtle)] px-2 py-0.5 text-[var(--text-xs)] text-[var(--color-primary)]">
          {MODE_LABELS[project.writingMode] ?? project.writingMode}
        </span>
      </div>

      {project.genre && (
        <span className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
          {project.genre}
        </span>
      )}

      {project.description && (
        <p className="line-clamp-2 text-[var(--text-sm)] text-[var(--color-text-muted)]">
          {project.description}
        </p>
      )}

      <div className="mt-auto flex items-center gap-4 pt-2 text-[var(--text-xs)] text-[var(--color-text-muted)]">
        <span>{project.wordCount.toLocaleString()} words</span>
        <span>{project.chapterCount} chapters</span>
        <span className="ml-auto">{formatDate(project.updatedAt)}</span>
      </div>
    </button>
  );
}
