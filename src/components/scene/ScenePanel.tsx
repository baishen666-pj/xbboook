import { useState, useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useSceneStore } from '@/stores/sceneStore';
import { SceneCard } from './SceneCard';
import { SceneForm } from './SceneForm';
import { SceneStatsBar } from './SceneStatsBar';
import type { SceneWithPov, SceneStatus } from '@/types/project';

const STATUS_TABS: Array<{ key: SceneStatus | 'all'; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'draft', label: '草稿' },
  { key: 'writing', label: '写作中' },
  { key: 'revising', label: '修改中' },
  { key: 'done', label: '完成' },
];

export function ScenePanel() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const scenes = useSceneStore((s) => s.scenes);
  const stats = useSceneStore((s) => s.stats);
  const isLoading = useSceneStore((s) => s.isLoading);
  const loadScenes = useSceneStore((s) => s.loadScenes);
  const loadStats = useSceneStore((s) => s.loadStats);
  const deleteScene = useSceneStore((s) => s.deleteScene);
  const updateScene = useSceneStore((s) => s.updateScene);

  const [activeTab, setActiveTab] = useState<SceneStatus | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingScene, setEditingScene] = useState<SceneWithPov | null>(null);
  const [groupByChapter, setGroupByChapter] = useState(true);

  useEffect(() => {
    if (currentProject) {
      loadScenes(currentProject.id);
      loadStats(currentProject.id);
    }
  }, [currentProject, loadScenes, loadStats]);

  if (!currentProject) return null;

  const filtered = activeTab === 'all'
    ? scenes
    : scenes.filter((s) => s.status === activeTab);

  const handleEdit = (scene: SceneWithPov) => {
    setEditingScene(scene);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await deleteScene(currentProject.id, id);
    loadStats(currentProject.id);
  };

  const handleStatusChange = async (id: string, status: SceneStatus) => {
    await updateScene(currentProject.id, id, { status } as Record<string, unknown>);
    loadStats(currentProject.id);
  };

  const groupedByChapter = groupByChapter
    ? Object.entries(
        filtered.reduce<Record<string, SceneWithPov[]>>((acc, scene) => {
          const key = scene.chapterId;
          if (!acc[key]) acc[key] = [];
          acc[key].push(scene);
          return acc;
        }, {})
      )
    : null;

  const chapters = useProjectStore.getState().chapters;

  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      {stats && <SceneStatsBar stats={stats} />}

      {/* Status tabs + controls */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--color-border)] px-2 py-1.5 scrollbar-none">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 rounded px-2 py-1 text-xs transition-colors ${
              activeTab === tab.key
                ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]'
            }`}
          >
            {tab.label}
            {tab.key !== 'all' && stats?.byStatus[tab.key] && (
              <span className="ml-1 text-[10px] text-[var(--color-text-muted)]">
                {stats.byStatus[tab.key]}
              </span>
            )}
          </button>
        ))}
        <div className="flex-1" />

        {/* Group toggle */}
        <button
          onClick={() => setGroupByChapter(!groupByChapter)}
          className={`shrink-0 rounded px-2 py-1 text-xs transition-colors ${
            groupByChapter
              ? 'text-[var(--color-primary)]'
              : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]'
          }`}
          title={groupByChapter ? '按章节分组' : '平铺显示'}
        >
          {groupByChapter ? '分组' : '平铺'}
        </button>

        <button
          onClick={() => { setEditingScene(null); setShowForm(true); }}
          className="shrink-0 rounded bg-[var(--color-primary)] px-2 py-1 text-xs text-white hover:opacity-90"
        >
          + 新建场景
        </button>
      </div>

      {/* Scene list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {isLoading && scenes.length === 0 && (
          <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">加载中...</div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">
            {scenes.length === 0 ? '还没有场景，点击新建添加' : '该状态下没有场景'}
          </div>
        )}

        {groupedByChapter ? (
          groupedByChapter.map(([chapterId, chapterScenes]) => {
            const chapter = chapters.find((c) => c.id === chapterId);
            return (
              <div key={chapterId} className="space-y-1">
                <div className="flex items-center gap-2 px-1 pt-2 pb-1">
                  <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                    {chapter?.title ?? '未分配章节'}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    ({chapterScenes.length} 场景)
                  </span>
                </div>
                {chapterScenes.map((scene) => (
                  <SceneCard
                    key={scene.id}
                    scene={scene}
                    chapterTitle={chapter?.title ?? null}
                    onEdit={() => handleEdit(scene)}
                    onDelete={() => handleDelete(scene.id)}
                    onStatusChange={(status) => handleStatusChange(scene.id, status)}
                  />
                ))}
              </div>
            );
          })
        ) : (
          filtered.map((scene) => {
            const chapter = chapters.find((c) => c.id === scene.chapterId);
            return (
              <SceneCard
                key={scene.id}
                scene={scene}
                chapterTitle={chapter?.title ?? null}
                onEdit={() => handleEdit(scene)}
                onDelete={() => handleDelete(scene.id)}
                onStatusChange={(status) => handleStatusChange(scene.id, status)}
              />
            );
          })
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <SceneForm
          scene={editingScene}
          projectId={currentProject.id}
          onSubmit={editingScene
            ? async (data) => {
                await updateScene(currentProject.id, editingScene.id, data);
                setShowForm(false);
                setEditingScene(null);
                loadStats(currentProject.id);
              }
            : async (data) => {
                const { createScene } = useSceneStore.getState();
                await createScene(currentProject.id, data as { chapterId: string; title: string } & Record<string, unknown>);
                setShowForm(false);
                loadStats(currentProject.id);
              }}
          onCancel={() => { setShowForm(false); setEditingScene(null); }}
        />
      )}
    </div>
  );
}
