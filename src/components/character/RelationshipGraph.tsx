import { useEffect, useRef, useState, useCallback } from "react";
import {
  forceSimulation, forceManyBody, forceCenter, forceLink, forceRadial, forceX, forceY,
  type Simulation, type SimulationNodeDatum, type SimulationLinkDatum,
} from "d3-force";
import { zoom } from "d3-zoom";
import { drag } from "d3-drag";
import { select } from "d3-selection";
import type { Character, CharacterRelation } from "@/types/project";
import { getRelationStyle, RELATION_CATEGORIES } from "@/lib/relationship-types";
import { ROLE_COLORS, ROLE_SIZES } from "@/lib/role-types";
import { GraphContextMenu, type ContextMenuState } from "./GraphContextMenu";

interface SimNode extends SimulationNodeDatum {
  id: string;
  name: string;
  nickname?: string;
  roleType: string;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  id: string;
  label: string;
}

type LayoutMode = "force" | "radial" | "grid";

const DEFAULT_COLOR = ROLE_COLORS.minor;
const DEFAULT_SIZE = ROLE_SIZES.minor;

const ROLE_RADIAL_RINGS: Record<string, number> = {
  protagonist: 0,
  antagonist: 60,
  supporting: 120,
  minor: 180,
};

interface Props {
  characters: Character[];
  relations: CharacterRelation[];
  onNodeClick?: (characterId: string) => void;
  onEdgeClick?: (relation: CharacterRelation) => void;
  onCreateRelation?: (characterAId: string, characterBId: string) => void;
  onEditCharacter?: (characterId: string) => void;
  onDeleteCharacter?: (characterId: string) => void;
  onEditRelation?: (relationId: string) => void;
  onDeleteRelationFromGraph?: (relationId: string) => void;
  filterRole?: string;
}

export function RelationshipGraph({
  characters, relations, onNodeClick, onEdgeClick,
  onCreateRelation, onEditCharacter, onDeleteCharacter,
  onEditRelation, onDeleteRelationFromGraph, filterRole,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const prevNodeIdsRef = useRef<Set<string>>(new Set());
  const zoomBehaviorRef = useRef<ReturnType<typeof zoom<SVGSVGElement, unknown>> | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("force");
  const [searchText, setSearchText] = useState("");
  const [connectMode, setConnectMode] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const connectDragRef = useRef<{ sourceId: string; line: SVGGElement | null } | null>(null);

  const getCharacterById = useCallback(
    (id: string) => characters.find((c) => c.id === id),
    [characters],
  );

  // Build filtered nodes/links from props
  const buildGraphData = useCallback(() => {
    const filteredRelations = filterRole && filterRole !== "all"
      ? relations.filter((r) => {
          const a = getCharacterById(r.characterAId);
          const b = getCharacterById(r.characterBId);
          return (a?.roleType === filterRole || b?.roleType === filterRole);
        })
      : relations;

    const visibleIds = new Set<string>();
    filteredRelations.forEach((r) => {
      visibleIds.add(r.characterAId);
      visibleIds.add(r.characterBId);
    });

    if (filterRole && filterRole !== "all") {
      characters.forEach((c) => {
        if (c.roleType === filterRole) visibleIds.add(c.id);
      });
    } else {
      characters.forEach((c) => visibleIds.add(c.id));
    }

    // Preserve existing node positions
    const posMap = new Map<string, { x: number; y: number; fx: number | null; fy: number | null }>();
    nodesRef.current.forEach((n) => {
      posMap.set(n.id, { x: n.x ?? 0, y: n.y ?? 0, fx: n.fx ?? null, fy: n.fy ?? null });
    });

    const newNodes: SimNode[] = characters
      .filter((c) => visibleIds.has(c.id))
      .map((c) => {
        const existing = posMap.get(c.id);
        return {
          id: c.id,
          name: c.name,
          nickname: c.nickname || undefined,
          roleType: c.roleType,
          x: existing?.x,
          y: existing?.y,
          fx: existing?.fx ?? undefined,
          fy: existing?.fy ?? undefined,
        };
      });

    const nodeMap = new Map(newNodes.map((n) => [n.id, n]));

    const newLinks: SimLink[] = filteredRelations
      .filter((r) => nodeMap.has(r.characterAId) && nodeMap.has(r.characterBId))
      .map((r) => ({
        source: r.characterAId,
        target: r.characterBId,
        id: r.id,
        label: r.relationType,
      }));

    return { nodes: newNodes, links: newLinks };
  }, [characters, relations, filterRole, getCharacterById]);

  // Apply layout forces
  const applyLayout = useCallback((sim: Simulation<SimNode, SimLink>, mode: LayoutMode, nodes: SimNode[], width: number, height: number) => {
    sim.force("charge", forceManyBody().strength(-200))
      .force("center", forceCenter(width / 2, height / 2))
      .force("link", forceLink<SimNode, SimLink>(nodes.length > 0 ? [] : []).id((d) => d.id).distance(120));

    if (mode === "radial") {
      sim.force("radial", forceRadial<SimNode>((d) => ROLE_RADIAL_RINGS[d.roleType] ?? 120, width / 2, height / 2).strength(0.8));
    } else {
      sim.force("radial", null);
    }

    if (mode === "grid") {
      const roleGroups = new Map<string, SimNode[]>();
      nodes.forEach((n) => {
        const group = roleGroups.get(n.roleType) ?? [];
        group.push(n);
        roleGroups.set(n.roleType, group);
      });
      const roles = Array.from(roleGroups.keys());
      const cols = Math.ceil(Math.sqrt(nodes.length));
      const spacing = 100;

      sim.force("gridX", forceX<SimNode>((d) => {
        const roleIdx = roles.indexOf(d.roleType);
        const inGroup = roleGroups.get(d.roleType) ?? [];
        const idx = inGroup.indexOf(d);
        return (roleIdx % 2) * cols * spacing + (idx % cols) * spacing + 100;
      }).strength(0.5));
      sim.force("gridY", forceY<SimNode>((d) => {
        const roleIdx = roles.indexOf(d.roleType);
        const inGroup = roleGroups.get(d.roleType) ?? [];
        const idx = inGroup.indexOf(d);
        return Math.floor(roleIdx / 2) * cols * spacing + Math.floor(idx / cols) * spacing + 100;
      }).strength(0.5));
    } else {
      sim.force("gridX", null);
      sim.force("gridY", null);
    }
  }, []);

  // Main render effect — incremental D3 updates
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const width = svg.clientWidth || 400;
    const height = svg.clientHeight || 300;
    const svgSel = select(svg);

    const { nodes: newNodes, links: newLinks } = buildGraphData();
    nodesRef.current = newNodes;
    linksRef.current = newLinks;

    // Check if we need full init (first render or container changed)
    const isFirstRender = !simulationRef.current;
    prevNodeIdsRef.current = new Set(newNodes.map((n) => n.id));

    if (isFirstRender) {
      // Full SVG initialization
      svgSel.selectAll("*").remove();

      const defs = svgSel.append("defs");
      // Arrow markers for each category color
      for (const cat of RELATION_CATEGORIES) {
        defs.append("marker")
          .attr("id", `arrowhead-${cat.key}`)
          .attr("viewBox", "0 0 10 7")
          .attr("refX", 10)
          .attr("refY", 3.5)
          .attr("markerWidth", 8)
          .attr("markerHeight", 6)
          .attr("orient", "auto")
          .append("path")
          .attr("d", "M 0 0 L 10 3.5 L 0 7 z")
          .attr("fill", cat.color);
      }

      // Glow filter for search highlight
      const filter = defs.append("filter").attr("id", "glow");
      filter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "coloredBlur");
      const feMerge = filter.append("feMerge");
      feMerge.append("feMergeNode").attr("in", "coloredBlur");
      feMerge.append("feMergeNode").attr("in", "SourceGraphic");

      svgSel.append("g").attr("class", "links");
      svgSel.append("g").attr("class", "link-labels");
      svgSel.append("g").attr("class", "nodes");
      svgSel.append("g").attr("class", "connect-line");

      // Zoom
      const zb = zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 5])
        .on("zoom", (event) => {
          svgSel.select("g:first-child").attr("transform", event.transform.toString());
          // The root 'g' is the first child after defs
        });
      svgSel.call(zb);
      zoomBehaviorRef.current = zb;

      // Wrap existing groups in a root group for zoom
      const rootG = svgSel.insert("g", ".links");
      svgSel.select(".links").remove();
      svgSel.select(".link-labels").remove();
      svgSel.select(".nodes").remove();
      svgSel.select(".connect-line").remove();
      rootG.append("g").attr("class", "links");
      rootG.append("g").attr("class", "link-labels");
      rootG.append("g").attr("class", "nodes");
      rootG.append("g").attr("class", "connect-line");

      // Update zoom to target rootG
      const zb2 = zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 5])
        .on("zoom", (event) => {
          rootG.attr("transform", event.transform.toString());
        });
      svgSel.call(zb2);
      zoomBehaviorRef.current = zb2;
    }

    // Update simulation data
    let sim = simulationRef.current;
    if (!sim) {
      sim = forceSimulation<SimNode>(newNodes).alphaDecay(0.02);
      simulationRef.current = sim;
    } else {
      sim.nodes(newNodes);
    }

    const linkForce = sim.force("link") as ReturnType<typeof forceLink<SimNode, SimLink>> | null;
    if (linkForce) {
      linkForce.links(newLinks).id((d: SimNode) => d.id);
    }

    applyLayout(sim, layoutMode, newNodes, width, height);
    sim.alpha(0.3).restart();

    const rootG = svgSel.select("g:first-child");
    if (rootG.empty()) return;

    // --- Update links ---
    const linksSel = rootG.select<SVGGElement>(".links")
      .selectAll<SVGLineElement, SimLink>("line")
      .data(newLinks, (d) => d.id);

    linksSel.exit().remove();

    const linksEnter = linksSel.enter().append("line")
      .style("cursor", "pointer");

    linksSel.merge(linksEnter)
      .attr("stroke", (d) => getRelationStyle(d.label).color)
      .attr("stroke-width", (d) => getRelationStyle(d.label).strokeWidth)
      .attr("stroke-dasharray", (d) => getRelationStyle(d.label).dashArray)
      .attr("marker-end", (d) => `url(#arrowhead-${getRelationStyle(d.label).category})`)
      .on("click", (_event, d) => {
        const rel = relations.find((r) => r.id === d.id);
        if (rel) onEdgeClick?.(rel);
      })
      .on("contextmenu", (_event, d) => {
        _event.preventDefault();
        setContextMenu({ x: _event.clientX, y: _event.clientY, type: "edge", id: d.id });
      });

    // --- Update link labels ---
    const linkLabelsSel = rootG.select<SVGGElement>(".link-labels")
      .selectAll<SVGGElement, SimLink>("g")
      .data(newLinks, (d) => d.id);

    linkLabelsSel.exit().remove();

    const linkLabelsEnter = linkLabelsSel.enter().append("g");

    linkLabelsEnter.append("rect")
      .attr("rx", 3).attr("ry", 3)
      .attr("fill", "var(--color-surface-1)")
      .attr("stroke", "var(--color-border)")
      .attr("stroke-width", 0.5)
      .attr("opacity", 0.85);

    linkLabelsEnter.append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", "var(--color-text-muted)")
      .attr("font-size", 10)
      .attr("font-family", "system-ui, sans-serif");

    const mergedLabels = linkLabelsSel.merge(linkLabelsEnter);
    mergedLabels.select("text").text((d) => d.label);

    // Measure text after DOM update
    requestAnimationFrame(() => {
      mergedLabels.each(function () {
        const textEl = select(this).select("text").node() as SVGTextElement | null;
        if (!textEl) return;
        const bbox = textEl.getBBox();
        select(this).select("rect")
          .attr("x", bbox.x - 3)
          .attr("y", bbox.y - 2)
          .attr("width", bbox.width + 6)
          .attr("height", bbox.height + 4);
      });
    });

    // --- Update nodes ---
    const searchLower = searchText.toLowerCase();
    const isSearching = searchText.length > 0;
    const matchedIds = isSearching
      ? new Set(newNodes.filter((n) => n.name.toLowerCase().includes(searchLower) || (n.nickname && n.nickname.toLowerCase().includes(searchLower))).map((n) => n.id))
      : null;

    const nodesSel = rootG.select<SVGGElement>(".nodes")
      .selectAll<SVGGElement, SimNode>("g")
      .data(newNodes, (d) => d.id);

    nodesSel.exit().remove();

    const nodesEnter = nodesSel.enter().append("g")
      .style("cursor", "pointer");

    nodesEnter.append("circle")
      .attr("stroke", "var(--color-surface-1)")
      .attr("stroke-width", 2);

    nodesEnter.append("text")
      .attr("text-anchor", "middle")
      .attr("fill", "var(--color-text-secondary)")
      .attr("font-size", 11)
      .attr("font-family", "system-ui, sans-serif");

    const mergedNodes = nodesSel.merge(nodesEnter);

    const getNodeSize = (roleType: string): number => {
      return ROLE_SIZES[roleType] as number ?? DEFAULT_SIZE;
    };
    const getNodeColor = (roleType: string): string => {
      return ROLE_COLORS[roleType] as string ?? DEFAULT_COLOR;
    };

    mergedNodes.select("circle")
      .attr("r", (d) => {
        const base = getNodeSize(d.roleType);
        return matchedIds?.has(d.id) ? base + 4 : base;
      })
      .attr("fill", (d) => getNodeColor(d.roleType))
      .attr("filter", (d) => matchedIds?.has(d.id) ? "url(#glow)" : "none");

    mergedNodes.attr("opacity", (d) => {
      if (!isSearching) return 1;
      return matchedIds?.has(d.id) ? 1 : 0.15;
    });

    mergedNodes.select("text")
      .attr("dy", (d) => getNodeSize(d.roleType) + 14)
      .text((d) => d.nickname ? `${d.name}「${d.nickname}」` : d.name);

    mergedNodes
      .on("click", (_event, d) => {
        if (connectMode) return;
        onNodeClick?.(d.id);
      })
      .on("contextmenu", (_event, d) => {
        _event.preventDefault();
        setContextMenu({ x: _event.clientX, y: _event.clientY, type: "node", id: d.id });
      });

    // Drag behavior
    const dragBehavior = drag<SVGGElement, SimNode>()
      .on("start", (event, d) => {
        if (connectMode) {
          connectDragRef.current = { sourceId: d.id, line: null };
          return;
        }
        if (!event.active) sim!.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        if (connectMode && connectDragRef.current) {
          const connectG = rootG.select<SVGGElement>(".connect-line");
          connectG.selectAll("*").remove();
          connectG.append("line")
            .attr("x1", d.x ?? 0).attr("y1", d.y ?? 0)
            .attr("x2", event.x).attr("y2", event.y)
            .attr("stroke", "var(--color-primary)")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "4 4")
            .attr("pointer-events", "none");
        } else {
          d.fx = event.x;
          d.fy = event.y;
        }
      })
      .on("end", (event, d) => {
        if (connectMode && connectDragRef.current) {
          rootG.select(".connect-line").selectAll("*").remove();
          // Find closest node to drop position
          const threshold = 40;
          let closestNode: SimNode | null = null;
          let closestDist = Infinity;
          for (const n of newNodes) {
            if (n.id === connectDragRef.current.sourceId) continue;
            const dist = Math.sqrt(((n.x ?? 0) - event.x) ** 2 + ((n.y ?? 0) - event.y) ** 2);
            if (dist < threshold && dist < closestDist) {
              closestDist = dist;
              closestNode = n;
            }
          }
          if (closestNode) {
            onCreateRelation?.(connectDragRef.current.sourceId, closestNode.id);
          }
          connectDragRef.current = null;
          return;
        }
        if (!event.active) sim!.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mergedNodes.call(dragBehavior as any);

    // Tick handler
    sim.on("tick", () => {
      rootG.select<SVGGElement>(".links")
        .selectAll<SVGLineElement, SimLink>("line")
        .attr("x1", (d) => (d.source as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as SimNode).y ?? 0);

      rootG.select<SVGGElement>(".link-labels")
        .selectAll<SVGGElement, SimLink>("g")
        .attr("transform", (d) => {
          const sx = (d.source as SimNode).x ?? 0;
          const sy = (d.source as SimNode).y ?? 0;
          const tx = (d.target as SimNode).x ?? 0;
          const ty = (d.target as SimNode).y ?? 0;
          return `translate(${(sx + tx) / 2},${(sy + ty) / 2})`;
        });

      mergedNodes.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      sim.on("tick", null);
    };
  }, [characters, relations, filterRole, layoutMode, searchText, connectMode, onNodeClick, onEdgeClick, onCreateRelation, onEditCharacter, onDeleteCharacter, onEditRelation, onDeleteRelationFromGraph, getCharacterById, buildGraphData, applyLayout]);

  // Cleanup simulation on unmount
  useEffect(() => {
    return () => {
      simulationRef.current?.stop();
      simulationRef.current = null;
      prevNodeIdsRef.current = new Set();
    };
  }, []);

  // Export SVG
  const handleExportSvg = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relationship-graph.svg";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div
      className="w-full h-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] flex flex-col"
      style={{ minHeight: 300 }}
      role="img"
      aria-label={`角色关系图谱: ${characters.length} 个角色, ${relations.length} 段关系`}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[var(--color-border)] flex-shrink-0">
        {/* Search */}
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="搜索角色..."
          className="w-28 rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-0.5 text-[var(--text-xs)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]/50"
          aria-label="搜索角色"
        />

        <div className="flex-1" />

        {/* Layout buttons */}
        <div className="flex rounded border border-[var(--color-border)] overflow-hidden">
          {[
            { mode: "force" as LayoutMode, label: "力导向", icon: "⁘" },
            { mode: "radial" as LayoutMode, label: "环形", icon: "◎" },
            { mode: "grid" as LayoutMode, label: "网格", icon: "▦" },
          ].map((item) => (
            <button
              key={item.mode}
              onClick={() => setLayoutMode(item.mode)}
              className={`px-1.5 py-0.5 text-[var(--text-xs)] transition-colors ${
                layoutMode === item.mode
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
              }`}
              title={item.label}
              aria-label={`布局: ${item.label}`}
              aria-pressed={layoutMode === item.mode}
            >
              {item.icon}
            </button>
          ))}
        </div>

        {/* Connect mode */}
        <button
          onClick={() => setConnectMode((m) => !m)}
          className={`rounded px-2 py-0.5 text-[var(--text-xs)] transition-colors border ${
            connectMode
              ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
              : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
          }`}
          title="连线模式: 拖拽节点到另一个节点创建关系"
          aria-pressed={connectMode}
        >
          {connectMode ? "连线中" : "连线"}
        </button>

        {/* Export */}
        <button
          onClick={handleExportSvg}
          className="rounded px-2 py-0.5 text-[var(--text-xs)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] transition-colors"
          title="导出为 SVG"
          aria-label="导出图谱为 SVG"
        >
          导出
        </button>
      </div>

      {/* SVG canvas */}
      <svg ref={svgRef} className="w-full flex-1" style={{ cursor: connectMode ? "crosshair" : "default" }} />
      <span className="sr-only">此区域显示角色关系可视化图谱，支持拖拽和缩放交互</span>

      {/* Legend */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-t border-[var(--color-border)] flex-shrink-0 flex-wrap">
        <span className="text-[10px] text-[var(--color-text-muted)]">角色:</span>
        {[
          { label: "主角", color: "#f59e0b" },
          { label: "反派", color: "#ef4444" },
          { label: "配角", color: "#3b82f6" },
          { label: "路人", color: "#6b7280" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-[10px] text-[var(--color-text-muted)]">{item.label}</span>
          </div>
        ))}
        <span className="text-[10px] text-[var(--color-text-muted)] ml-2">关系:</span>
        {RELATION_CATEGORIES.map((cat) => (
          <div key={cat.key} className="flex items-center gap-1">
            <span
              className="inline-block w-4 h-0.5"
              style={{
                backgroundColor: cat.color,
                borderStyle: cat.dashArray === "none" ? "solid" : "dashed",
                borderTop: `1.5px ${cat.dashArray === "none" ? "solid" : "dashed"} ${cat.color}`,
              }}
            />
            <span className="text-[10px] text-[var(--color-text-muted)]">{cat.label}</span>
          </div>
        ))}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <GraphContextMenu
          {...contextMenu}
          actions={contextMenu.type === "node"
            ? {
                type: "node" as const,
                onEdit: (id) => { onEditCharacter?.(id); setContextMenu(null); },
                onAddRelation: (id) => { onCreateRelation?.(id, ""); setContextMenu(null); },
                onDelete: (id) => { onDeleteCharacter?.(id); setContextMenu(null); },
              }
            : {
                type: "edge" as const,
                onEdit: (id) => { onEditRelation?.(id); setContextMenu(null); },
                onDelete: (id) => { onDeleteRelationFromGraph?.(id); setContextMenu(null); },
              }
          }
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
