export const ROLE_TYPES = [
  { value: "protagonist", label: "主角" },
  { value: "antagonist", label: "反派" },
  { value: "supporting", label: "配角" },
  { value: "minor", label: "路人" },
] as const;

export const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLE_TYPES.map((r) => [r.value, r.label]),
);
