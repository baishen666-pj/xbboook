interface StatusBadgeProps {
  label: string;
  color: "blue" | "green" | "gray" | "red" | "amber" | "purple" | "orange" | "emerald";
  size?: "xs" | "sm";
}

const COLOR_MAP: Record<StatusBadgeProps["color"], string> = {
  blue: "bg-blue-500/15 text-blue-400",
  green: "bg-green-500/15 text-green-400",
  gray: "bg-gray-500/15 text-gray-400",
  red: "bg-red-500/15 text-red-400",
  amber: "bg-amber-500/15 text-amber-400",
  purple: "bg-purple-500/15 text-purple-400",
  orange: "bg-orange-500/15 text-orange-400",
  emerald: "bg-emerald-500/15 text-emerald-400",
};

const SIZE_MAP = {
  xs: "text-[10px] px-1.5 py-0.5",
  sm: "text-[var(--text-xs)] px-2 py-0.5",
};

export function StatusBadge({ label, color, size = "xs" }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${COLOR_MAP[color]} ${SIZE_MAP[size]}`}>
      {label}
    </span>
  );
}
