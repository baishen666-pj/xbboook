import { useState } from "react";
import { useProjectStore } from "@/stores/projectStore";
import type { Foreshadowing, ForeshadowingImportance } from "@/types/project";

interface Props {
  item?: Foreshadowing | null;
  onSubmit: (data: {
    title: string;
    description?: string;
    plant_chapter_id?: string;
    expected_harvest_chapter_id?: string;
    importance?: string;
  }) => void;
  onCancel: () => void;
}

const IMPORTANCE_OPTIONS: Array<{ value: ForeshadowingImportance; label: string }> = [
  { value: "critical", label: "关键" },
  { value: "important", label: "重要" },
  { value: "normal", label: "普通" },
  { value: "minor", label: "次要" },
];

export function ForeshadowingForm({ item, onSubmit, onCancel }: Props) {
  const chapters = useProjectStore((s) => s.chapters);
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [plantChapterId, setPlantChapterId] = useState(item?.plantChapterId ?? "");
  const [expectedHarvestChapterId, setExpectedHarvestChapterId] = useState(item?.expectedHarvestChapterId ?? "");
  const [importance, setImportance] = useState(item?.importance ?? "normal");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      plant_chapter_id: plantChapterId || undefined,
      expected_harvest_chapter_id: expectedHarvestChapterId || undefined,
      importance,
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border border-white/10 bg-[oklch(0.16_0_0)] p-4 shadow-2xl">
        <h3 className="mb-3 text-sm font-medium text-white/80">
          {item ? "编辑伏笔" : "新建伏笔"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div>
            <label className="block text-xs text-white/40 mb-1">标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="伏笔标题"
              className="w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[var(--color-primary)]/50"
            />
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="伏笔描述..."
              rows={4}
              className="w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white/80 placeholder:text-white/15 focus:outline-none focus:border-[var(--color-primary)]/50 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1">埋设章节</label>
            <select
              value={plantChapterId}
              onChange={(e) => setPlantChapterId(e.target.value)}
              className="w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white/80 focus:outline-none"
            >
              <option value="">未指定</option>
              {chapters.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1">预期回收章节</label>
            <select
              value={expectedHarvestChapterId}
              onChange={(e) => setExpectedHarvestChapterId(e.target.value)}
              className="w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white/80 focus:outline-none"
            >
              <option value="">未指定</option>
              {chapters.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1">重要程度</label>
            <div className="flex gap-1.5">
              {IMPORTANCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setImportance(opt.value)}
                  className={`rounded px-2 py-1 text-xs transition-colors ${
                    importance === opt.value
                      ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)]"
                      : "text-white/30 hover:bg-white/5"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

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
              {item ? "保存" : "创建"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}