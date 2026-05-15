import { useState } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { characterService } from "@/services/characterService";
import { CharacterCard } from "./CharacterCard";
import { CharacterForm } from "./CharacterForm";
import type { Character } from "@/types/project";

const ROLE_TYPES = [
  { value: "protagonist", label: "主角" },
  { value: "supporting", label: "配角" },
  { value: "antagonist", label: "反派" },
  { value: "minor", label: "路人" },
];

export function CharacterList() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const characters = useProjectStore((s) => s.characters);
  const [showForm, setShowForm] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [filterRole, setFilterRole] = useState<string>("all");

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
      }));
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header + actions */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="rounded border border-white/10 bg-transparent px-2 py-1 text-xs text-white/60 focus:outline-none"
        >
          <option value="all">全部角色</option>
          {ROLE_TYPES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <button
          onClick={() => { setEditingCharacter(null); setShowForm(true); }}
          className="rounded bg-[var(--color-primary)] px-2 py-1 text-xs text-white hover:opacity-90"
        >
          + 新建
        </button>
      </div>

      {/* Character cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filtered.length === 0 && (
          <div className="py-8 text-center text-xs text-white/20">
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

      {/* Form modal */}
      {(showForm || editingCharacter) && (
        <CharacterForm
          character={editingCharacter}
          onSubmit={editingCharacter
            ? (data) => handleUpdate(editingCharacter.id, data as Partial<Character>)
            : handleCreate}
          onCancel={() => { setShowForm(false); setEditingCharacter(null); }}
        />
      )}
    </div>
  );
}
