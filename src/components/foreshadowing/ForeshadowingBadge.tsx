import type { ForeshadowingStatus, ForeshadowingImportance } from "@/types/project";

interface Props {
  status: ForeshadowingStatus;
}

const STATUS_CONFIG: Record<ForeshadowingStatus, { label: string; className: string }> = {
  planted: { label: "已埋", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  harvested: { label: "已收", className: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  forgotten: { label: "遗忘", className: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
};

export function ForeshadowingBadge({ status }: Props) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

const IMPORTANCE_CONFIG: Record<ForeshadowingImportance, { label: string; className: string }> = {
  critical: { label: "关键", className: "bg-red-500/15 text-red-400" },
  important: { label: "重要", className: "bg-orange-500/15 text-orange-400" },
  normal: { label: "普通", className: "bg-white/5 text-white/30" },
  minor: { label: "次要", className: "bg-white/5 text-white/20" },
};

export function ForeshadowingImportanceBadge({ importance }: { importance: ForeshadowingImportance }) {
  const c = IMPORTANCE_CONFIG[importance] ?? IMPORTANCE_CONFIG.normal;
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] ${c.className}`}>
      {c.label}
    </span>
  );
}