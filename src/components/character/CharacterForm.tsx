import { useState } from "react";
import type { Character } from "@/types/project";
import { ROLE_TYPES } from "@/lib/role-types";

interface Props {
  character?: Character | null;
  onSubmit: (data: Record<string, string>) => Promise<void> | void;
  onCancel: () => void;
}

const FIELDS: Array<{ key: string; label: string; multiline?: boolean; placeholder?: string }> = [
  { key: "name", label: "姓名", placeholder: "角色姓名" },
  { key: "nickname", label: "别名/绰号", placeholder: "可选" },
  { key: "roleType", label: "角色类型" },
  { key: "gender", label: "性别", placeholder: "可选" },
  { key: "age", label: "年龄", placeholder: "可选" },
  { key: "appearance", label: "外貌描写", multiline: true, placeholder: "描述角色的外貌特征" },
  { key: "personality", label: "性格特点", multiline: true, placeholder: "描述角色的性格" },
  { key: "background", label: "背景故事", multiline: true, placeholder: "角色的身世背景" },
  { key: "abilities", label: "能力", multiline: true, placeholder: "特殊能力或技能" },
  { key: "notes", label: "备注", multiline: true, placeholder: "其他补充信息" },
];

export function CharacterForm({ character, onSubmit, onCancel }: Props) {
  const initialState: Record<string, string> = {};
  for (const f of FIELDS) {
    if (f.key === "roleType") {
      initialState[f.key] = character?.roleType ?? "supporting";
    } else {
      const val = character?.[f.key as keyof Character];
      initialState[f.key] = (val as string) ?? "";
    }
  }

  const [form, setForm] = useState(initialState);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) return;
    onSubmit(form);
  };

  const update = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border border-white/10 bg-[oklch(0.16_0_0)] p-4 shadow-2xl">
        <h3 className="mb-3 text-sm font-medium text-white/80">
          {character ? "编辑角色" : "新建角色"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-xs text-white/40 mb-1">{f.label}</label>
              {f.key === "roleType" ? (
                <select
                  value={form[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  className="w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white/80 focus:outline-none focus:border-[var(--color-primary)]/50"
                >
                  {ROLE_TYPES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              ) : f.multiline ? (
                <textarea
                  value={form[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  rows={3}
                  className="w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[var(--color-primary)]/50 resize-none"
                />
              ) : (
                <input
                  type="text"
                  value={form[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[var(--color-primary)]/50"
                />
              )}
            </div>
          ))}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded px-3 py-1.5 text-sm text-white/40 hover:bg-white/5"
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-sm text-white hover:opacity-90"
            >
              {character ? "保存" : "创建"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
