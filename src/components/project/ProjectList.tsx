import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjectStore } from "@/stores/projectStore";
import { ProjectCard } from "./ProjectCard";
import { CreateProjectModal } from "./CreateProjectModal";
import { Button } from "@/components/ui/Button";
import type { WritingMode } from "@/types/project";

export function ProjectList() {
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const createProject = useProjectStore((s) => s.createProject);
  const isLoading = useProjectStore((s) => s.isLoading);

  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  async function handleCreate(data: {
    name: string;
    genre: string;
    description: string;
    writingMode: WritingMode;
  }) {
    const project = await createProject(data);
    if (project) {
      navigate(`/project/${project.id}`);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-[var(--color-surface-0)] px-6 py-12">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              网文笔阁
            </h1>
            <p className="mt-1 text-[var(--text-sm)] text-[var(--color-text-muted)]">
              你的写作工作台
            </p>
          </div>
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v10M3 8h10" />
            </svg>
            新建作品
          </Button>
        </div>

        {/* Loading */}
        {isLoading && projects.length === 0 && (
          <div className="py-20 text-center text-[var(--color-text-muted)]">
            加载中...
          </div>
        )}

        {/* Empty state */}
        {!isLoading && projects.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-20">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-primary-subtle)]">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              开始你的第一部作品
            </h2>
            <p className="max-w-sm text-center text-[var(--text-sm)] text-[var(--color-text-muted)]">
              创建一个新项目开始写作。管理章节、构建角色、设定世界观，让 AI 辅助你的创作之旅。
            </p>
            <Button variant="primary" onClick={() => setIsModalOpen(true)}>
              创建作品
            </Button>
          </div>
        )}

        {/* Grid */}
        {projects.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => navigate(`/project/${project.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
