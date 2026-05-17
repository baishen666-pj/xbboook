export const RELATION_CATEGORIES = [
  { key: "friendly", label: "友好", color: "#22c55e", keywords: ["朋友", "盟友", "搭档", "同门"], dashArray: "none" },
  { key: "romantic", label: "浪漫", color: "#ec4899", keywords: ["恋人", "暗恋"], dashArray: "none" },
  { key: "hostile", label: "敌对", color: "#ef4444", keywords: ["敌人", "仇人", "对手"], dashArray: "6 3" },
  { key: "family", label: "亲情", color: "#a855f7", keywords: ["亲属"], dashArray: "none" },
  { key: "mentor", label: "师承", color: "#f59e0b", keywords: ["师徒"], dashArray: "2 3" },
  { key: "other", label: "其他", color: "#6b7280", keywords: [], dashArray: "none" },
] as const;

export type RelationCategory = typeof RELATION_CATEGORIES[number]["key"];

export const RELATION_PRESETS = [
  "朋友", "敌人", "恋人", "师徒", "亲属", "同门",
  "上下级", "盟友", "对手", "暗恋", "仇人", "搭档",
];

export interface RelationStyle {
  color: string;
  dashArray: string;
  strokeWidth: number;
  category: RelationCategory;
  label: string;
}

export function getRelationStyle(relationType: string): RelationStyle {
  for (const cat of RELATION_CATEGORIES) {
    if (cat.keywords.some((k) => relationType.includes(k))) {
      return {
        color: cat.color,
        dashArray: cat.dashArray,
        strokeWidth: 1.5,
        category: cat.key,
        label: cat.label,
      };
    }
  }
  return {
    color: RELATION_CATEGORIES.find((c) => c.key === "other")!.color,
    dashArray: "none",
    strokeWidth: 1.5,
    category: "other",
    label: RELATION_CATEGORIES.find((c) => c.key === "other")!.label,
  };
}
