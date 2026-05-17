import { useEffect, useRef, useState } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from "d3-force";
import type { SimulationNodeDatum, SimulationLinkDatum } from "d3-force";
import { apiClient } from "@/services/apiClient";

interface CharNode extends SimulationNodeDatum {
  id: string;
  name: string;
  role: string;
  x: number;
  y: number;
}

interface RelationLink extends SimulationLinkDatum<CharNode> {
  type: string;
}

interface Props {
  projectId: string;
}

export function CharacterGraph({ projectId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<CharNode[]>([]);
  const [links, setLinks] = useState<RelationLink[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    void loadGraph();
  }, [projectId]);

  async function loadGraph() {
    const charsRes = await apiClient.get<Array<{ id: string; name: string; role: string }>>(`/projects/${projectId}/characters`);
    if (!charsRes.success || !charsRes.data) return;

    const chars = charsRes.data;
    const charNodes: CharNode[] = chars.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role || "未分类",
      x: 200 + Math.random() * 200,
      y: 150 + Math.random() * 100,
    }));

    // Generate links from character relationships
    const charLinks: RelationLink[] = [];
    for (const char of chars) {
      const detailRes = await apiClient.get<{ relationships?: string }>(`/projects/${projectId}/characters/${char.id}`);
      if (detailRes.success && detailRes.data?.relationships) {
        try {
          const rels = JSON.parse(detailRes.data.relationships) as Array<{ targetId?: string; type?: string }>;
          for (const rel of rels) {
            if (rel.targetId && chars.some((c) => c.id === rel.targetId)) {
              charLinks.push({ source: char.id, target: rel.targetId, type: rel.type || "关系" });
            }
          }
        } catch { /* skip */ }
      }
    }

    // If no explicit relationships, create proximity links
    if (charLinks.length === 0 && charNodes.length > 1) {
      for (let i = 0; i < charNodes.length - 1; i++) {
        charLinks.push({ source: charNodes[i]!.id, target: charNodes[i + 1]!.id, type: "同作品" });
      }
    }

    const simulation = forceSimulation<CharNode>(charNodes)
      .force("link", forceLink<CharNode, RelationLink>(charLinks).id((d) => d.id).distance(80))
      .force("charge", forceManyBody().strength(-200))
      .force("center", forceCenter(300, 200))
      .force("collide", forceCollide<CharNode>().radius(30));

    simulation.on("tick", () => {
      setNodes([...charNodes]);
      setLinks([...charLinks]);
    });

    simulation.tick(120);
    simulation.stop();

    setNodes([...charNodes]);
    setLinks([...charLinks]);
  }

  const roleColors: Record<string, string> = {
    protagonist: "#4ade80",
    antagonist: "#f87171",
    supporting: "#60a5fa",
    minor: "#a78bfa",
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-[var(--color-text-muted)]">
        角色关系图谱 · {nodes.length} 个角色 · {links.length} 条关系
      </div>
      <svg ref={svgRef} width="100%" height="350" viewBox="0 0 600 400" className="rounded bg-[var(--color-surface-hover)]">
        {/* Links */}
        {links.map((link, i) => {
          const src = link.source as unknown as CharNode;
          const tgt = link.target as unknown as CharNode;
          if (typeof src === "string" || typeof tgt === "string") return null;
          return (
            <g key={i}>
              <line
                x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                stroke="rgba(255,255,255,0.15)" strokeWidth={1}
              />
              <text
                x={(src.x + tgt.x) / 2} y={(src.y + tgt.y) / 2}
                textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={8}
              >
                {link.type}
              </text>
            </g>
          );
        })}
        {/* Nodes */}
        {nodes.map((node) => (
          <g
            key={node.id}
            transform={`translate(${node.x},${node.y})`}
            onMouseEnter={() => setHovered(node.id)}
            onMouseLeave={() => setHovered(null)}
            className="cursor-pointer"
          >
            <circle
              r={hovered === node.id ? 16 : 12}
              fill={roleColors[node.role] || "#94a3b8"}
              opacity={0.8}
              className="transition-all"
            />
            <text
              textAnchor="middle" dy={24} fill="rgba(255,255,255,0.7)" fontSize={9}
            >
              {node.name}
            </text>
            {hovered === node.id && (
              <text textAnchor="middle" dy={-18} fill="white" fontSize={8} fontWeight="bold">
                {node.role}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-2 text-[10px]">
        {Object.entries(roleColors).map(([role, color]) => (
          <span key={role} className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[var(--color-text-muted)]">{role === "protagonist" ? "主角" : role === "antagonist" ? "反派" : role === "supporting" ? "配角" : "路人"}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
