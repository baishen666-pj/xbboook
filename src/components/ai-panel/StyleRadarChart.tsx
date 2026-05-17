import type { StyleDimensions } from "@/services/styleProfileService";

const DIMENSION_LABELS: Record<keyof StyleDimensions, string> = {
  language: "语言",
  narrative: "节奏",
  emotional: "情感",
  dialogue: "对话",
  description: "描写",
  webNovel: "网文",
};

const DIMENSIONS: (keyof StyleDimensions)[] = [
  "language", "narrative", "emotional", "dialogue", "description", "webNovel",
];

interface Props {
  dimensions: StyleDimensions;
  size?: number;
}

export function StyleRadarChart({ dimensions, size = 200 }: Props) {
  const center = size / 2;
  const radius = size / 2 - 30;
  const angleStep = (2 * Math.PI) / 6;

  function getPoint(index: number, value: number): [number, number] {
    const angle = angleStep * index - Math.PI / 2;
    const r = (value / 10) * radius;
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
  }

  // Grid rings (2, 4, 6, 8, 10)
  const rings = [2, 4, 6, 8, 10];

  // Data polygon points
  const dataPoints = DIMENSIONS.map((dim, i) => {
    const val = dimensions[dim] ?? 5;
    return getPoint(i, val);
  });
  const dataPath = dataPoints.map((p) => `${p[0]},${p[1]}`).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid */}
      {rings.map((ring) => {
        const points = DIMENSIONS.map((_, i) => {
          const p = getPoint(i, ring);
          return `${p[0]},${p[1]}`;
        }).join(" ");
        return (
          <polygon
            key={ring}
            points={points}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="0.5"
            opacity="0.3"
          />
        );
      })}

      {/* Axis lines */}
      {DIMENSIONS.map((_, i) => {
        const outer = getPoint(i, 10);
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={outer[0]}
            y2={outer[1]}
            stroke="var(--color-border)"
            strokeWidth="0.5"
            opacity="0.3"
          />
        );
      })}

      {/* Data polygon */}
      <polygon
        points={dataPath}
        fill="var(--color-primary)"
        fillOpacity="0.15"
        stroke="var(--color-primary)"
        strokeWidth="1.5"
      />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle
          key={i}
          cx={p[0]}
          cy={p[1]}
          r="2.5"
          fill="var(--color-primary)"
        />
      ))}

      {/* Labels */}
      {DIMENSIONS.map((dim, i) => {
        const labelPos = getPoint(i, 12);
        return (
          <text
            key={dim}
            x={labelPos[0]}
            y={labelPos[1]}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--color-text-secondary)"
            fontSize="10"
          >
            {DIMENSION_LABELS[dim]} {dimensions[dim] ?? 5}
          </text>
        );
      })}
    </svg>
  );
}
