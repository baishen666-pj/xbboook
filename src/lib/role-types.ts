export const ROLE_TYPES = [
  { value: "protagonist", label: "主角" },
  { value: "antagonist", label: "反派" },
  { value: "supporting", label: "配角" },
  { value: "minor", label: "路人" },
] as const;

export const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLE_TYPES.map((r) => [r.value, r.label]),
);

export const ROLE_COLORS: Record<string, string> = {
  protagonist: "#f59e0b",
  antagonist: "#ef4444",
  supporting: "#3b82f6",
  minor: "#6b7280",
};

export const ROLE_SIZES: Record<string, number> = {
  protagonist: 22,
  antagonist: 19,
  supporting: 16,
  minor: 12,
};
