import type { PublishStatus } from "@/types/project";

const STATUS_CONFIG: Record<
  PublishStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "草稿",
    className: "bg-white/5 text-white/40",
  },
  scheduled: {
    label: "待发",
    className: "bg-amber-500/10 text-amber-400",
  },
  published: {
    label: "已发",
    className: "bg-emerald-500/10 text-emerald-400",
  },
  archived: {
    label: "归档",
    className: "bg-blue-500/10 text-blue-400",
  },
};

interface PublishStatusBadgeProps {
  status: PublishStatus;
}

export function PublishStatusBadge({ status }: PublishStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={[
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none",
        config.className,
      ].join(" ")}
    >
      {config.label}
    </span>
  );
}