import { useState, useCallback } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { characterService } from "@/services/characterService";
import { ROLE_LABELS } from "@/lib/role-types";
import { RELATION_PRESETS } from "@/lib/relationship-types";
import type { CharacterRelation } from "@/types/project";

interface Props {
  onClose: () => void;
  editingRelation?: CharacterRelation | null;
  initialCharacterAId?: string;
  initialCharacterBId?: string;
}

export function RelationshipEditor({ onClose, editingRelation, initialCharacterAId, initialCharacterBId }: Props) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const characters = useProjectStore((s) => s.characters);
  const relations = useProjectStore((s) => s.characterRelations);

  const [characterAId, setCharacterAId] = useState(editingRelation?.characterAId ?? initialCharacterAId ?? "");
  const [characterBId, setCharacterBId] = useState(editingRelation?.characterBId ?? initialCharacterBId ?? "");
  const [relationType, setRelationType] = useState(editingRelation?.relationType ?? "");
  const [description, setDescription] = useState(editingRelation?.description ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCharacterName = useCallback(
    (id: string) => {
      const c = characters.find((ch) => ch.id === id);
      return c ? `${c.name}${c.nickname ? ` (${c.nickname})` : ""}` : "未知角色";
    },
    [characters],
  );

  const isDuplicate = characterAId && characterBId && characterAId === characterBId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject || !characterAId || !characterBId || !relationType.trim() || isDuplicate) return;

    setIsSubmitting(true);
    setError(null);

    try {
      if (editingRelation) {
        const res = await characterService.updateRelation(currentProject.id, editingRelation.id, {
          relationType: relationType.trim(),
          description: description.trim() || undefined,
        });
        if (res.success && res.data) {
          useProjectStore.setState((s) => ({
            characterRelations: s.characterRelations.map((r) =>
              r.id === editingRelation.id ? res.data! : r,
            ),
          }));
          onClose();
        } else {
          setError(res.error ?? "更新关系失败");
        }
      } else {
        const res = await characterService.createRelation(currentProject.id, {
          characterAId,
          characterBId,
          relationType: relationType.trim(),
          description: description.trim() || undefined,
        });
        if (res.success && res.data) {
          useProjectStore.setState((s) => ({
            characterRelations: [...s.characterRelations, res.data!],
          }));
          onClose();
        } else {
          setError(res.error ?? "创建关系失败");
        }
      }
    } catch {
      setError("操作失败，请重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!currentProject || !editingRelation) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await characterService.deleteRelation(currentProject.id, editingRelation.id);
      if (res.success) {
        useProjectStore.setState((s) => ({
          characterRelations: s.characterRelations.filter((r) => r.id !== editingRelation.id),
        }));
        onClose();
      } else {
        setError(res.error ?? "删除关系失败");
      }
    } catch {
      setError("删除失败，请重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  const existingRelation = !editingRelation && characterAId && characterBId && !isDuplicate
    ? relations.find(
        (r) =>
          (r.characterAId === characterAId && r.characterBId === characterBId) ||
          (r.characterAId === characterBId && r.characterBId === characterAId),
      )
    : null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 shadow-2xl">
        <h3 className="mb-3 text-[var(--text-sm)] font-medium text-[var(--color-text-primary)]">
          {editingRelation ? "编辑关系" : "添加关系"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-3">
          {!editingRelation && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[var(--text-xs)] text-[var(--color-text-muted)] mb-1">角色 A</label>
                <select
                  value={characterAId}
                  onChange={(e) => setCharacterAId(e.target.value)}
                  className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-[var(--text-sm)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]/50"
                >
                  <option value="">选择角色</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({ROLE_LABELS[c.roleType] ?? c.roleType})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[var(--text-xs)] text-[var(--color-text-muted)] mb-1">角色 B</label>
                <select
                  value={characterBId}
                  onChange={(e) => setCharacterBId(e.target.value)}
                  className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-[var(--text-sm)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]/50"
                >
                  <option value="">选择角色</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({ROLE_LABELS[c.roleType] ?? c.roleType})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {editingRelation && (
            <div className="flex items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-[var(--text-xs)] text-[var(--color-text-muted)]">
              <span className="text-[var(--color-text-secondary)]">{getCharacterName(editingRelation.characterAId)}</span>
              <span className="text-[var(--color-primary)]">&lt;-&gt;</span>
              <span className="text-[var(--color-text-secondary)]">{getCharacterName(editingRelation.characterBId)}</span>
            </div>
          )}

          {isDuplicate && (
            <p className="text-[var(--text-xs)] text-red-400">不能选择相同的角色</p>
          )}

          {existingRelation && (
            <p className="text-[var(--text-xs)] text-amber-400">
              这两个角色已有关系: {existingRelation.relationType}
            </p>
          )}

          <div>
            <label className="block text-[var(--text-xs)] text-[var(--color-text-muted)] mb-1">关系类型</label>
            <input
              type="text"
              value={relationType}
              onChange={(e) => setRelationType(e.target.value)}
              placeholder="如: 朋友、师徒、恋人..."
              list="relation-presets"
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-[var(--text-sm)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]/50"
            />
            <datalist id="relation-presets">
              {RELATION_PRESETS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-[var(--text-xs)] text-[var(--color-text-muted)] mb-1">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述这段关系的细节..."
              rows={2}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-[var(--text-sm)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]/50 resize-none"
            />
          </div>

          {error && (
            <p className="text-[var(--text-xs)] text-red-400">{error}</p>
          )}

          <div className="flex justify-between gap-2 pt-1">
            {editingRelation && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="rounded px-3 py-1.5 text-[var(--text-sm)] text-red-400 hover:bg-red-500/10 disabled:opacity-50"
              >
                删除
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-1.5 text-[var(--text-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !relationType.trim() || isDuplicate || (!editingRelation && (!characterAId || !characterBId))}
              className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-[var(--text-sm)] text-white hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "..." : editingRelation ? "保存" : "创建"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
