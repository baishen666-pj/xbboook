import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjectStore } from "@/stores/projectStore";
import { ProjectCard } from "./ProjectCard";
import { CreateProjectModal } from "./CreateProjectModal";
import { TemplateProjectCreator } from "./TemplateProjectCreator";
import { OnboardingWizard } from "./OnboardingWizard";
import { Button } from "@/components/ui/Button";
import type { WritingMode } from "@/types/project";
import type { Project } from "@/types/project";

const FEATURES = [
  { icon: "edit", title: "富文本编辑器", desc: "Markdown 快捷输入、分屏对照" },
  { icon: "ai", title: "AI 写作助手", desc: "24 种技能，续写、润色、角色对话" },
  { icon: "users", title: "角色 & 世界观", desc: "角色设定、关系图谱、世界设定" },
  { icon: "plot", title: "伏笔追踪", desc: "埋设和回收伏笔，保持连贯" },
  { icon: "version", title: "版本管理", desc: "自动快照，随时回滚" },
] as const;

function FeatureIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "edit":
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>;
    case "ai":
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" /><path d="M16 14H8a6 6 0 0 0-6 6v1h20v-1a6 6 0 0 0-6-6z" /></svg>;
    case "users":
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case "plot":
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
    case "version":
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>;
    default:
      return null;
  }
}

export function ProjectList() {
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const createProject = useProjectStore((s) => s.createProject);
  const isLoading = useProjectStore((s) => s.isLoading);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showTemplateCreator, setShowTemplateCreator] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [newProject, setNewProject] = useState<Project | null>(null);

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
      setNewProject(project);
      setShowOnboarding(true);
    }
  }

  function handleTemplateCreated(projectId: string) {
    navigate(`/project/${projectId}`);
  }

  function handleOnboardingComplete() {
    setShowOnboarding(false);
    if (newProject) {
      navigate(`/project/${newProject.id}`);
      setNewProject(null);
    }
  }

  function handleOnboardingClose() {
    setShowOnboarding(false);
    if (newProject) {
      navigate(`/project/${newProject.id}`);
      setNewProject(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-[var(--color-surface-0)] px-6 py-12">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
              网文笔阁
            </h1>
            <p className="mt-1.5 text-[var(--text-sm)] text-[var(--color-text-muted)]">
              你的 AI 网文写作工作台
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowTemplateCreator(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
              从模板创建
            </Button>
            <Button variant="primary" onClick={() => setIsModalOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v10M3 8h10" />
              </svg>
              新建作品
            </Button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && projects.length === 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-44 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] animate-[pulse-subtle_2s_ease-in-out_infinite]" />
            ))}
          </div>
        )}

        {/* Empty state with feature highlights */}
        {!isLoading && projects.length === 0 && (
          <div className="flex flex-col items-center gap-8 py-16">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--color-primary-subtle)]">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
              <div className="text-center">
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                  开始你的第一部作品
                </h2>
                <p className="mt-2 max-w-md text-[var(--text-sm)] text-[var(--color-text-muted)] leading-relaxed">
                  Xbboook 帮你从构思到成稿，AI 全程辅助创作。
                </p>
              </div>
              <Button variant="primary" size="lg" onClick={() => setIsModalOpen(true)}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 4v10M4 9h10" />
                </svg>
                创建作品
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-3xl mt-4">
              {FEATURES.map((f) => (
                <div
                  key={f.icon}
                  className="flex items-start gap-3 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-3"
                >
                  <div className="shrink-0 text-[var(--color-primary)] mt-0.5">
                    <FeatureIcon icon={f.icon} />
                  </div>
                  <div>
                    <div className="text-[var(--text-sm)] font-medium text-[var(--color-text-primary)]">
                      {f.title}
                    </div>
                    <div className="text-[var(--text-xs)] text-[var(--color-text-muted)] mt-0.5">
                      {f.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
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

      <TemplateProjectCreator
        isOpen={showTemplateCreator}
        onClose={() => setShowTemplateCreator(false)}
        onProjectCreated={handleTemplateCreated}
      />

      {newProject && (
        <OnboardingWizard
          isOpen={showOnboarding}
          onClose={handleOnboardingClose}
          onComplete={handleOnboardingComplete}
        />
      )}
    </div>
  );
}
