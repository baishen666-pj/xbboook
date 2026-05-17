import { useState, useCallback, lazy, Suspense } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { characterService } from "@/services/characterService";
import { CharacterCard } from "./CharacterCard";
import { CharacterForm } from "./CharacterForm";
import { RelationshipEditor } from "./RelationshipEditor";
import { RelationshipDetail } from "./RelationshipDetail";
import { ROLE_TYPES } from "@/lib/role-types";
import type { Character, CharacterRelation } from "@/types/project";

const RelationshipGraph = lazy(() => import("./RelationshipGraph").then(m => ({ default: m.RelationshipGraph })));

type ViewMode = "list" | "graph";

export function CharacterList() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const characters = useProjectStore((s) => s.characters);
  const relations = useProjectStore((s) => s.characterRelations);
  const [showForm, setShowForm] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showRelationEditor, setShowRelationEditor] = useState(false);
  const [editingRelation, setEditingRelation] = useState<CharacterRelation | null>(null);
  const [selectedRelation, setSelectedRelation] = useState<CharacterRelation | null>(null);
  const [connectFrom, setConnectFrom] = useState<{ characterAId: string; characterBId: string } | null>(null);

  if (!currentProject) return null;

  const filtered = filterRole === "all"
    ? characters
    : characters.filter((c) => c.roleType === filterRole);

  const handleCreate = async (data: Record<string, string>) => {
    const res = await characterService.create(currentProject.id, {
      name: data.name || "",
      nickname: data.nickname || undefined,
      roleType: data.roleType || undefined,
      gender: data.gender || undefined,
      age: data.age || undefined,
      appearance: data.appearance || undefined,
      personality: data.personality || undefined,
      background: data.background || undefined,
      abilities: data.abilities || undefined,
      notes: data.notes || undefined,
    });
    if (res.success && res.data) {
      useProjectStore.setState((s) => ({
        characters: [...s.characters, res.data!],
      }));
    }
    setShowForm(false);
  };

  const handleUpdate = async (id: string, data: Partial<Character>) => {
    const res = await characterService.update(currentProject.id, id, data);
    if (res.success && res.data) {
      useProjectStore.setState((s) => ({
        characters: s.characters.map((c) => c.id === id ? res.data! : c),
      }));
    }
    setEditingCharacter(null);
  };

  const handleDelete = async (id: string) => {
    const res = await characterService.remove(currentProject.id, id);
    if (res.success) {
      useProjectStore.setState((s) => ({
        characters: s.characters.filter((c) => c.id !== id),
        characterRelations: s.characterRelations.filter(
          (r) => r.characterAId !== id && r.characterBId !== id,
        ),
      }));
    }
  };

  const handleNodeClick = useCallback((characterId: string) => {
    const char = characters.find((c) => c.id === characterId);
    if (char) {
      setEditingCharacter(char);
      setShowForm(true);
    }
  }, [characters]);

  const handleEdgeClick = useCallback((relation: CharacterRelation) => {
    setSelectedRelation(relation);
  }, []);

  const handleDeleteRelation = async (relation: CharacterRelation) => {
    const res = await characterService.deleteRelation(currentProject.id, relation.id);
    if (res.success) {
      useProjectStore.setState((s) => ({
        characterRelations: s.characterRelations.filter((r) => r.id !== relation.id),
      }));
    }
    setSelectedRelation(null);
  };

  const handleCreateRelationFromGraph = useCallback((characterAId: string, characterBId: string) => {
    setConnectFrom({ characterAId, characterBId });
    setEditingRelation(null);
    setShowRelationEditor(true);
  }, []);

  const handleDeleteCharacterFromGraph = useCallback(async (characterId: string) => {
    await handleDelete(characterId);
  }, [handleDelete]);

  const handleEditRelationFromGraph = useCallback((relationId: string) => {
    const rel = relations.find((r) => r.id === relationId);
    if (rel) {
      setEditingRelation(rel);
      setShowRelationEditor(true);
    }
  }, [relations]);

  const handleDeleteRelationFromGraph = useCallback(async (relationId: string) => {
    const res = await characterService.deleteRelation(currentProject.id, relationId);
    if (res.success) {
      useProjectStore.setState((s) => ({
        characterRelations: s.characterRelations.filter((r) => r.id !== relationId),
      }));
    }
  }, [currentProject]);

  return (
    <div className="flex flex-col h-full">
      {/* Header + actions */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-[var(--text-xs)] text-[var(--color-text-secondary)] focus:outline-none"
            aria-label="按角色类型筛选"
          >
            <option value="all">全部角色</option>
            {ROLE_TYPES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {characters.length} 角色 / {relations.length} 关系
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode((m) => m === "list" ? "graph" : "list")}
            className={`rounded px-2 py-1 text-[var(--text-xs)] transition-colors ${
              viewMode === "graph"
                ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-secondary)]"
            }`}
            title={viewMode === "list" ? "切换到图谱视图" : "切换到列表视图"}
            aria-pressed={viewMode === "graph"}
          >
            {viewMode === "list" ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
                <circle cx="4" cy="4" r="2" />
                <circle cx="10" cy="4" r="2" />
                <circle cx="7" cy="10" r="2" />
                <line x1="5.5" y1="5" x2="8.5" y2="5" />
                <line x1="5" y1="5.5" x2="6.5" y2="8.5" />
                <line x1="9" y1="5.5" x2="7.5" y2="8.5" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M2 3h10M2 7h10M2 11h10" />
              </svg>
            )}
          </button>
          <button
            onClick={() => { setEditingCharacter(null); setShowForm(true); }}
            className="rounded bg-[var(--color-primary)] px-2 py-1 text-[var(--text-xs)] text-white hover:opacity-90"
          >
            + 新建
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === "list" ? (
        <>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filtered.length === 0 && (
              <div className="py-8 text-center text-[var(--text-xs)] text-[var(--color-text-muted)]">
                {characters.length === 0 ? "还没有角色，点击新建添加" : "该分类下没有角色"}
              </div>
            )}
            {filtered.map((char) => (
              <CharacterCard
                key={char.id}
                character={char}
                onEdit={() => { setEditingCharacter(char); setShowForm(true); }}
                onDelete={() => handleDelete(char.id)}
              />
            ))}
          </div>

          {/* Relations list at bottom */}
          {relations.length > 0 && (
            <div className="border-t border-[var(--color-border)] max-h-40 overflow-y-auto">
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-[10px] text-[var(--color-text-muted)]">关系列表</span>
                <button
                  onClick={() => { setEditingRelation(null); setShowRelationEditor(true); }}
                  className="text-[10px] text-[var(--color-primary)] hover:underline"
                >
                  + 添加
                </button>
              </div>
              <div className="px-2 pb-2 space-y-0.5">
                {relations.map((r) => {
                  const a = characters.find((c) => c.id === r.characterAId);
                  const b = characters.find((c) => c.id === r.characterBId);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] cursor-pointer"
                      onClick={() => setSelectedRelation(r)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedRelation(r); } }}
                      aria-label={`${a?.name ?? "?"} - ${r.relationType} - ${b?.name ?? "?"}`}
                    >
                      <span className="text-[var(--color-text-secondary)] truncate">{a?.name ?? "?"}</span>
                      <span className="shrink-0 text-[var(--color-primary)]/70">-</span>
                      <span className="text-[var(--color-text-muted)] truncate">{r.relationType}</span>
                      <span className="shrink-0 text-[var(--color-primary)]/70">-</span>
                      <span className="text-[var(--color-text-secondary)] truncate">{b?.name ?? "?"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">

          {/* Graph */}
          <div className="flex-1 min-h-0 p-2">
            {characters.length < 2 ? (
              <div className="flex items-center justify-center h-full text-[var(--text-xs)] text-[var(--color-text-muted)]">
                至少需要2个角色才能显示关系图谱
              </div>
            ) : (
              <Suspense fallback={<div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-[var(--text-sm)]">加载图谱...</div>}>
                <RelationshipGraph
                  characters={characters}
                  relations={relations}
                  onNodeClick={handleNodeClick}
                  onEdgeClick={handleEdgeClick}
                  onCreateRelation={handleCreateRelationFromGraph}
                  onEditCharacter={(id) => { const c = characters.find((ch) => ch.id === id); if (c) { setEditingCharacter(c); setShowForm(true); } }}
                  onDeleteCharacter={handleDeleteCharacterFromGraph}
                  onEditRelation={handleEditRelationFromGraph}
                  onDeleteRelationFromGraph={handleDeleteRelationFromGraph}
                  filterRole={filterRole}
                />
              </Suspense>
            )}
          </div>

        </div>
      )}

      {/* Character form modal */}
      {(showForm || editingCharacter) && (
        <CharacterForm
          character={editingCharacter}
          onSubmit={editingCharacter
            ? (data) => handleUpdate(editingCharacter.id, data as Partial<Character>)
            : handleCreate}
          onCancel={() => { setShowForm(false); setEditingCharacter(null); }}
        />
      )}

      {/* Relationship editor modal */}
      {showRelationEditor && (
        <RelationshipEditor
          editingRelation={editingRelation}
          initialCharacterAId={connectFrom?.characterAId}
          initialCharacterBId={connectFrom?.characterBId}
          onClose={() => { setShowRelationEditor(false); setEditingRelation(null); setConnectFrom(null); }}
        />
      )}

      {/* Relationship detail modal */}
      {selectedRelation && (
        <RelationshipDetail
          relation={selectedRelation}
          characters={characters}
          onEdit={(r) => {
            setSelectedRelation(null);
            setEditingRelation(r);
            setShowRelationEditor(true);
          }}
          onDelete={handleDeleteRelation}
          onClose={() => setSelectedRelation(null)}
        />
      )}

    </div>
  );
}
