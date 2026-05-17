import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/services/apiClient";

interface GoalProgress {
  goal: {
    id: string;
    type: "daily" | "weekly" | "monthly" | "total";
    targetWords: number;
    isActive: number;
  };
  currentWords: number;
  percentage: number;
}

interface Props {
  projectId: string;
}

const TYPE_LABELS: Record<string, string> = {
  daily: "每日",
  weekly: "每周",
  monthly: "每月",
  total: "总字数",
};

function ProgressCard({ item, onDelete }: { item: GoalProgress; onDelete: (id: string) => void }) {
  const pct = Math.min(item.percentage, 100);
  const isComplete = pct >= 100;

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-[oklch(0.65_0.18_250)_/20] px-1.5 py-0.5 text-[10px] text-[oklch(0.8_0.18_250)]">
            {TYPE_LABELS[item.goal.type] ?? item.goal.type}
          </span>
          <span className="text-xs font-semibold text-white/80">
            {item.currentWords.toLocaleString()} / {item.goal.targetWords.toLocaleString()}
          </span>
        </div>
        <button
          onClick={() => onDelete(item.goal.id)}
          className="text-white/20 hover:text-red-400 transition-colors text-sm leading-none"
          title="删除目标"
        >
          x
        </button>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isComplete
              ? "bg-[oklch(0.65_0.18_140)]"
              : "bg-[oklch(0.65_0.18_250)]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[10px] text-white/30">
        {isComplete ? "已完成" : `${pct}%`}
      </div>
    </div>
  );
}

export function GoalTracker({ projectId }: Props) {
  const [goals, setGoals] = useState<GoalProgress[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<"daily" | "weekly" | "monthly" | "total">("daily");
  const [formTarget, setFormTarget] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    const res = await apiClient.get<GoalProgress[]>(
      `/projects/${projectId}/goals`
    );
    if (res.success && res.data) {
      setGoals(res.data);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  async function handleCreate() {
    const target = parseInt(formTarget, 10);
    if (!target || target < 1) return;

    await apiClient.post(`/projects/${projectId}/goals`, {
      type: formType,
      target_words: target,
    });
    setShowForm(false);
    setFormTarget("");
    setFormType("daily");
    await fetchGoals();
  }

  async function handleDelete(id: string) {
    await apiClient.delete(`/projects/${projectId}/goals/${id}`);
    await fetchGoals();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-white/50">写作目标</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-white/40 hover:text-white/60 transition-colors"
        >
          {showForm ? "取消" : "+ 新目标"}
        </button>
      </div>

      {showForm && (
        <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-2">
          <select
            value={formType}
            onChange={(e) => setFormType(e.target.value as typeof formType)}
            className="rounded border border-white/10 bg-transparent px-2 py-1 text-xs text-white/70 outline-none"
          >
            <option value="daily">每日</option>
            <option value="weekly">每周</option>
            <option value="monthly">每月</option>
            <option value="total">总字数</option>
          </select>
          <input
            type="number"
            value={formTarget}
            onChange={(e) => setFormTarget(e.target.value)}
            placeholder="目标字数"
            min={1}
            className="w-24 rounded border border-white/10 bg-transparent px-2 py-1 text-xs text-white/70 outline-none placeholder:text-white/20"
          />
          <button
            onClick={handleCreate}
            disabled={!formTarget || parseInt(formTarget, 10) < 1}
            className="rounded bg-[oklch(0.65_0.18_250)] px-3 py-1 text-[10px] text-white disabled:opacity-30"
          >
            添加
          </button>
        </div>
      )}

      {loading && (
        <div className="py-4 text-center text-xs text-white/20">加载中...</div>
      )}

      {!loading && goals.length === 0 && (
        <div className="py-4 text-center text-xs text-white/20">
          暂无目标，点击上方按钮添加
        </div>
      )}

      <div className="space-y-2">
        {goals.map((g) => (
          <ProgressCard key={g.goal.id} item={g} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
}
