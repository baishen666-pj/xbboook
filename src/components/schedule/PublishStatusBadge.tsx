import type { PublishStatus } from "@/types/project";
import { StatusBadge } from '@/components/ui/StatusBadge';

const STATUS_LABELS: Record<PublishStatus, string> = {
  draft: "草稿",
  scheduled: "待发",
  published: "已发",
  archived: "归档",
};

const STATUS_COLORS: Record<PublishStatus, "gray" | "orange" | "green" | "blue"> = {
  draft: "gray",
  scheduled: "orange",
  published: "green",
  archived: "blue",
};

export function PublishStatusBadge({ status }: { status: PublishStatus }) {
  return <StatusBadge label={STATUS_LABELS[status]} color={STATUS_COLORS[status]} size="xs" />;
}
