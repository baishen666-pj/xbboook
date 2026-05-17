import { useEffect, useRef, useState, useCallback } from "react";
import {
  forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide,
} from "d3-force";
import type { SimulationNodeDatum, SimulationLinkDatum } from "d3-force";
import { drag } from "d3-drag";
import { zoom } from "d3-zoom";
import { select } from "d3-selection";
import { apiClient } from "@/services/apiClient";

interface CharNode extends SimulationNodeDatum {
  id: string;
  name: string;
  role: string;
  personality?: string;
  abilities?: string;
  speechStyle?: string;
  faction?: string;
}

interface RelationLink extends SimulationLinkDatum<CharNode> {
  id: string;
  type: string;
  description?: string;
  confidence?: number;
}

interface ProposedRelation {
  characterA: string;
  characterB: string;
  relationType: string;
  description: string;
  confidence: number;
}

interface SelectedNode {
  id: string;
  name: string;
  role: string;
  personality?: string;
  abilities?: string;
  speechStyle?: string;
}

interface SelectedEdge {
  sourceName: string;
  targetName: string;
  type: string;
  description?: string;
}

interface Props {
  projectId: string;
}

const ROLE_COLORS: Record<string, string> = {
  protagonist: "#4ade80",
  antagonist: "#f87171",
  supporting: "#60a5fa",
  minor: "#a78bfa",
};

const FACTION_COLORS = [
  "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316",
];

const ROLE_RADIUS: Record<string, number> = {
  protagonist: 18,
  antagonist: 16,
  supporting: 13,
  minor: 10,
};

export function CharacterGraph({ projectId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation<CharNode>> | null>(null);
  const [nodes, setNodes] = useState<CharNode[]>([]);
  const [links, setLinks] = useState<RelationLink[]>([]);
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<SelectedEdge | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [proposals, setProposals] = useState<ProposedRelation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const factionsRef = useRef<Map<string, string>>(new Map());

  const clearSelection = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  // Load graph data
  useEffect(() => {
    void loadGraph();
    return () => {
      simulationRef.current?.stop();
    };
  }, [projectId]);

  async function loadGraph() {
    const res = await apiClient.get<{
      characters: Array<Record<string, unknown>>;
      relations: Array<{ id: string; character_a_id: string; character_b_id: string; relation_type: string; description?: string }>;
    }>(`/projects/${projectId}/characters`);

    if (!res.success || !res.data) return;

    const { characters, relations } = res.data;

    const charNodes: CharNode[] = characters.map((c) => ({
      id: c.id as string,
      name: c.name as string,
      role: (c.role_type as string) || "minor",
      personality: c.personality as string | undefined,
      abilities: c.abilities as string | undefined,
      speechStyle: c.speech_style as string | undefined,
      x: 300 + (Math.random() - 0.5) * 200,
      y: 200 + (Math.random() - 0.5) * 150,
      fx: undefined,
      fy: undefined,
    }));

    const charLinks: RelationLink[] = relations.map((r) => ({
      id: r.id,
      source: r.character_a_id,
      target: r.character_b_id,
      type: r.relation_type || "关系",
      description: r.description || undefined,
    }));

    simulationRef.current?.stop();

    const sim = forceSimulation<CharNode>(charNodes)
      .force("link", forceLink<CharNode, RelationLink>(charLinks).id((d) => d.id).distance(100))
      .force("charge", forceManyBody().strength(-250))
      .force("center", forceCenter(300, 200))
      .force("collide", forceCollide<CharNode>().radius((d) => (ROLE_RADIUS[d.role] || 12) + 10));

    sim.tick(150);
    sim.stop();

    setNodes([...charNodes]);
    setLinks([...charLinks]);
  }

  // Setup d3 drag + zoom after SVG renders
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || nodes.length === 0) return;

    const gEl = svgEl.querySelector("g.graph-group") as SVGGElement;
    if (!gEl) return;
    gRef.current = gEl;

    const svgSelection = select(svgEl);
    const gSelection = select(gEl);

    // Zoom
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        gSelection.attr("transform", event.transform.toString());
      });

    svgSelection.call(zoomBehavior);

    // Drag on nodes
    const nodeSelection = gSelection.selectAll<SVGGElement, CharNode>(".node-group");

    const dragBehavior = drag<SVGGElement, CharNode>()
      .on("start", (event, d) => {
        if (!event.active) simulationRef.current?.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
        d.x = event.x;
        d.y = event.y;
        setNodes((prev) => [...prev]);
      })
      .on("end", (event, d) => {
        if (!event.active) simulationRef.current?.alphaTarget(0);
        d.fx = undefined;
        d.fy = undefined;
      });

    nodeSelection.call(dragBehavior);

    return () => {
      svgSelection.on(".zoom", null);
    };
  }, [nodes.length]);

  // AI extraction
  async function handleExtract() {
    setExtracting(true);
    setError(null);
    setProposals([]);
    clearSelection();

    try {
      const res = await apiClient.post<{
        relations: ProposedRelation[];
        factions: Array<{ name: string; members: string[] }>;
      }>(`/projects/${projectId}/characters/extract-relations`, {});

      if (res.success && res.data) {
        // Apply faction colors
        const factionMap = new Map<string, string>();
        (res.data.factions || []).forEach((f, i) => {
          const color = FACTION_COLORS[i % FACTION_COLORS.length] ?? '#888';
          f.members.forEach((m: string | undefined) => { if (m) factionMap.set(String(m), color); });
        });
        factionsRef.current = factionMap;

        if (factionMap.size > 0) {
          setNodes((prev) =>
            prev.map((n) => ({ ...n, faction: factionMap.get(n.name) }))
          );
        }

        setProposals(res.data.relations || []);
      } else {
        setError("提取失败");
      }
    } catch {
      setError("提取关系时出错，请确认AI已配置");
    }
    setExtracting(false);
  }

  async function acceptProposal(p: ProposedRelation) {
    const chars = nodes;
    const charA = chars.find((c) => c.name === p.characterA);
    const charB = chars.find((c) => c.name === p.characterB);
    if (!charA || !charB) return;

    await apiClient.post(`/projects/${projectId}/characters/relations`, {
      characterAId: charA.id,
      characterBId: charB.id,
      relationType: p.relationType,
      description: p.description,
    });

    setProposals((prev) => prev.filter(
      (r) => !(r.characterA === p.characterA && r.characterB === p.characterB && r.relationType === p.relationType),
    ));

    await loadGraph();
  }

  function rejectProposal(p: ProposedRelation) {
    setProposals((prev) => prev.filter(
      (r) => !(r.characterA === p.characterA && r.characterB === p.characterB && r.relationType === p.relationType),
    ));
  }

  function getNodeColor(node: CharNode): string {
    if (node.faction) return node.faction;
    return ROLE_COLORS[node.role] || "#94a3b8";
  }

  function getNodeRadius(node: CharNode): number {
    return ROLE_RADIUS[node.role] || 12;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-[var(--color-text-muted)]">
          角色关系图谱 · {nodes.length} 个角色 · {links.length} 条关系
        </div>
        <button
          onClick={handleExtract}
          disabled={extracting}
          className="rounded bg-[var(--color-primary)] px-2 py-0.5 text-[10px] text-white hover:opacity-90 disabled:opacity-40"
        >
          {extracting ? "提取中..." : "AI提取关系"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="text-[10px] text-red-400">{error}</div>
      )}

      {/* Proposals */}
      {proposals.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto rounded bg-white/5 p-2">
          <div className="text-[10px] text-[var(--color-text-muted)]">提议关系（点击接受或拒绝）</div>
          {proposals.map((p, i) => (
            <div key={i} className="flex items-center gap-1 text-[10px]">
              <span className="text-[var(--color-text-primary)]">
                {p.characterA} — {p.characterB}：{p.relationType}
              </span>
              <span className="text-[var(--color-text-muted)]">({(p.confidence * 100).toFixed(0)}%)</span>
              <button
                onClick={() => acceptProposal(p)}
                className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] text-white hover:opacity-80"
              >
                接受
              </button>
              <button
                onClick={() => rejectProposal(p)}
                className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-white/60 hover:opacity-80"
              >
                拒绝
              </button>
            </div>
          ))}
        </div>
      )}

      {/* SVG Graph */}
      <div className="relative">
        <svg
          ref={svgRef}
          width="100%"
          height="400"
          viewBox="0 0 600 400"
          className="rounded bg-[var(--color-surface-hover)] cursor-grab active:cursor-grabbing"
          onClick={(e) => {
            if (e.target === svgRef.current || (e.target as Element).tagName === "svg") {
              clearSelection();
            }
          }}
        >
          <g className="graph-group">
            {/* Links */}
            {links.map((link) => {
              const src = link.source as unknown as CharNode;
              const tgt = link.target as unknown as CharNode;
              if (typeof src === "string" || typeof tgt === "string") return null;
              const thickness = link.confidence ? 1 + link.confidence * 3 : 1.5;
              return (
                <g
                  key={link.id}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEdge({
                      sourceName: src.name,
                      targetName: tgt.name,
                      type: link.type,
                      description: link.description,
                    });
                    setSelectedNode(null);
                  }}
                >
                  <line
                    x1={src.x ?? 0} y1={src.y ?? 0} x2={tgt.x ?? 0} y2={tgt.y ?? 0}
                    stroke="rgba(255,255,255,0.15)" strokeWidth={thickness}
                  />
                  <text
                    x={((src.x ?? 0) + (tgt.x ?? 0)) / 2} y={((src.y ?? 0) + (tgt.y ?? 0)) / 2}
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
                className="node-group cursor-pointer"
                transform={`translate(${node.x},${node.y})`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNode({
                    id: node.id,
                    name: node.name,
                    role: node.role,
                    personality: node.personality,
                    abilities: node.abilities,
                    speechStyle: node.speechStyle,
                  });
                  setSelectedEdge(null);
                }}
              >
                <circle
                  r={getNodeRadius(node)}
                  fill={getNodeColor(node)}
                  opacity={0.85}
                  className="transition-all duration-150"
                />
                <circle
                  r={getNodeRadius(node) + 4}
                  fill="none"
                  stroke={getNodeColor(node)}
                  strokeWidth={1.5}
                  opacity={selectedNode?.id === node.id ? 0.6 : 0}
                  className="transition-opacity duration-150"
                />
                <text
                  textAnchor="middle"
                  dy={getNodeRadius(node) + 14}
                  fill="rgba(255,255,255,0.7)"
                  fontSize={9}
                  className="pointer-events-none select-none"
                >
                  {node.name}
                </text>
              </g>
            ))}
          </g>
        </svg>

        {/* Node detail overlay */}
        {selectedNode && (
          <div
            className="absolute top-2 right-2 w-48 rounded-lg bg-[#1a1a2e] border border-white/10 p-3 text-xs shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-[var(--color-text-primary)]">{selectedNode.name}</span>
              <button onClick={clearSelection} className="text-white/40 hover:text-white/60">x</button>
            </div>
            <div className="space-y-1 text-[var(--color-text-muted)]">
              <div>角色：{selectedNode.role === "protagonist" ? "主角" : selectedNode.role === "antagonist" ? "反派" : selectedNode.role === "supporting" ? "配角" : "路人"}</div>
              {selectedNode.personality && <div>性格：{selectedNode.personality}</div>}
              {selectedNode.abilities && <div>能力：{selectedNode.abilities}</div>}
              {selectedNode.speechStyle && <div>语风：{selectedNode.speechStyle}</div>}
            </div>
          </div>
        )}

        {/* Edge detail overlay */}
        {selectedEdge && (
          <div
            className="absolute top-2 right-2 w-48 rounded-lg bg-[#1a1a2e] border border-white/10 p-3 text-xs shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-[var(--color-text-primary)]">关系详情</span>
              <button onClick={clearSelection} className="text-white/40 hover:text-white/60">x</button>
            </div>
            <div className="space-y-1 text-[var(--color-text-muted)]">
              <div className="text-[var(--color-text-primary)]">{selectedEdge.sourceName} ↔ {selectedEdge.targetName}</div>
              <div>类型：{selectedEdge.type}</div>
              {selectedEdge.description && <div>{selectedEdge.description}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-[10px]">
        {Object.entries(ROLE_COLORS).map(([role, color]) => (
          <span key={role} className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[var(--color-text-muted)]">
              {role === "protagonist" ? "主角" : role === "antagonist" ? "反派" : role === "supporting" ? "配角" : "路人"}
            </span>
          </span>
        ))}
        {factionsRef.current.size > 0 && (
          <span className="text-[var(--color-text-muted)] ml-2">（颜色按阵营分组）</span>
        )}
      </div>
    </div>
  );
}
