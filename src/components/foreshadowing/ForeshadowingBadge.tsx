import type { ForeshadowingStatus, ForeshadowingImportance } from "@/types/project";
import { StatusBadge } from '@/components/ui/StatusBadge';

const STATUS_LABELS: Record<ForeshadowingStatus, string> = {
  planted: "已埋",
  harvested: "已收",
  forgotten: "遗忘",
};

const STATUS_COLORS: Record<ForeshadowingStatus, "green" | "blue" | "orange"> = {
  planted: "green",
  harvested: "blue",
  forgotten: "orange",
};

export function ForeshadowingBadge({ status }: { status: ForeshadowingStatus }) {
  return <StatusBadge label={STATUS_LABELS[status]} color={STATUS_COLORS[status]} size="xs" />;
}

const IMPORTANCE_LABELS: Record<ForeshadowingImportance, string> = {
  critical: "关键",
  important: "重要",
  normal: "普通",
  minor: "次要",
};

const IMPORTANCE_COLORS: Record<ForeshadowingImportance, "red" | "orange" | "gray"> = {
  critical: "red",
  important: "orange",
  normal: "gray",
  minor: "gray",
};

export function ForeshadowingImportanceBadge({ importance }: { importance: ForeshadowingImportance }) {
  return <StatusBadge label={IMPORTANCE_LABELS[importance]} color={IMPORTANCE_COLORS[importance]} size="xs" />;
}
