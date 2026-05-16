import { useEffect, useRef, useCallback } from "react";
import { forceSimulation, forceManyBody, forceCenter, forceLink, type SimulationNodeDatum, type SimulationLinkDatum } from "d3-force";
import { zoom, zoomIdentity } from "d3-zoom";
import { drag } from "d3-drag";
import { select } from "d3-selection";
import type { Character, CharacterRelation } from "@/types/project";

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

const ROLE_COLORS: Record<string, string> = {
  protagonist: "#f59e0b",
  antagonist: "#ef4444",
  supporting: "#3b82f6",
  minor: "#6b7280",
};

const ROLE_SIZES: Record<string, number> = {
  protagonist: 22,
  antagonist: 19,
  supporting: 16,
  minor: 12,
};

const DEFAULT_COLOR = ROLE_COLORS.minor!;
const DEFAULT_SIZE = ROLE_SIZES.minor!;

interface Props {
  characters: Character[];
  relations: CharacterRelation[];
  onNodeClick?: (characterId: string) => void;
  onEdgeClick?: (relation: CharacterRelation) => void;
  filterRole?: string;
}

export function RelationshipGraph({ characters, relations, onNodeClick, onEdgeClick, filterRole }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  const getCharacterById = useCallback(
    (id: string) => characters.find((c) => c.id === id),
    [characters],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const width = svg.clientWidth || 400;
    const height = svg.clientHeight || 300;

    // Filter relations by role
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

    const nodes: SimNode[] = characters
      .filter((c) => visibleIds.has(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        nickname: c.nickname || undefined,
        roleType: c.roleType,
      }));

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const links: SimLink[] = filteredRelations
      .filter((r) => nodeMap.has(r.characterAId) && nodeMap.has(r.characterBId))
      .map((r) => ({
        source: r.characterAId,
        target: r.characterBId,
        id: r.id,
        label: r.relationType,
      }));

    // Clear previous content
    const svgSel = select(svg);
    svgSel.selectAll("*").remove();

    // Root group for zoom/pan
    const g = svgSel.append("g");

    // Setup zoom
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
      });

    svgSel.call(zoomBehavior);

    // Arrow marker definition
    const defs = svgSel.append("defs");
    defs.append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 0 10 7")
      .attr("refX", 10)
      .attr("refY", 3.5)
      .attr("markerWidth", 8)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M 0 0 L 10 3.5 L 0 7 z")
      .attr("fill", "#6b7280");

    // Edge labels background + text
    const linkGroup = g.append("g").attr("class", "links");
    const linkElements = linkGroup.selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#4b5563")
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrowhead)")
      .style("cursor", "pointer")
      .on("click", (_event, d) => {
        const rel = relations.find((r) => r.id === d.id);
        if (rel) onEdgeClick?.(rel);
      });

    const linkLabelGroup = g.append("g").attr("class", "link-labels");
    const linkLabels = linkLabelGroup.selectAll("g")
      .data(links)
      .join("g");

    linkLabels.append("rect")
      .attr("rx", 3)
      .attr("ry", 3)
      .attr("fill", "var(--color-surface-1)")
      .attr("stroke", "var(--color-border)")
      .attr("stroke-width", 0.5)
      .attr("opacity", 0.85);

    const linkTexts = linkLabels.append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", "var(--color-text-muted)")
      .attr("font-size", 10)
      .attr("font-family", "system-ui, sans-serif")
      .text((d) => d.label);

    linkTexts.each(function (_d, i) {
      const bbox = this.getBBox();
      const rect = linkLabels.filter((_, j) => j === i).select("rect");
      rect.attr("x", bbox.x - 3)
        .attr("y", bbox.y - 2)
        .attr("width", bbox.width + 6)
        .attr("height", bbox.height + 4);
    });

    // Node groups
    const nodeGroup = g.append("g").attr("class", "nodes");
    const nodeElements = nodeGroup.selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer");

    nodeElements.append("circle")
      .attr("r", (d) => ROLE_SIZES[d.roleType] ?? DEFAULT_SIZE)
      .attr("fill", (d) => ROLE_COLORS[d.roleType] ?? DEFAULT_COLOR)
      .attr("stroke", "var(--color-surface-1)")
      .attr("stroke-width", 2)
      .on("click", (_event, d) => {
        onNodeClick?.(d.id);
      });

    nodeElements.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => (ROLE_SIZES[d.roleType] ?? DEFAULT_SIZE) + 14)
      .attr("fill", "var(--color-text-secondary)")
      .attr("font-size", 11)
      .attr("font-family", "system-ui, sans-serif")
      .text((d) => d.nickname ? `${d.name}「${d.nickname}」` : d.name);

    // Drag behavior
    const dragBehavior = drag<SVGGElement, SimNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeElements.call(dragBehavior as unknown as (selection: import("d3-selection").Selection<import("d3-selection").BaseType | SVGGElement, SimNode, SVGGElement, unknown>) => void);

    // Force simulation
    const simulation = forceSimulation<SimNode>(nodes)
      .force("charge", forceManyBody().strength(-200))
      .force("center", forceCenter(width / 2, height / 2))
      .force("link", forceLink<SimNode, SimLink>(links)
        .id((d) => d.id)
        .distance(120))
      .on("tick", () => {
        linkElements
          .attr("x1", (d) => (d.source as SimNode).x ?? 0)
          .attr("y1", (d) => (d.source as SimNode).y ?? 0)
          .attr("x2", (d) => (d.target as SimNode).x ?? 0)
          .attr("y2", (d) => (d.target as SimNode).y ?? 0);

        linkLabels
          .attr("transform", (d) => {
            const sx = (d.source as SimNode).x ?? 0;
            const sy = (d.source as SimNode).y ?? 0;
            const tx = (d.target as SimNode).x ?? 0;
            const ty = (d.target as SimNode).y ?? 0;
            return `translate(${(sx + tx) / 2},${(sy + ty) / 2})`;
          });

        nodeElements
          .attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      });

    // Center view after initial layout
    simulation.on("end", () => {
      svgSel.call(
        zoomBehavior.transform,
        zoomIdentity.translate(0, 0).scale(1),
      );
    });

    return () => {
      simulation.stop();
    };
  }, [characters, relations, filterRole, onNodeClick, onEdgeClick, getCharacterById]);

  return (
    <div
      className="w-full h-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)]"
      style={{ minHeight: 300 }}
      role="img"
      aria-label={`角色关系图谱: ${characters.length} 个角色, ${relations.length} 段关系`}
    >
      <svg ref={svgRef} className="w-full h-full" />
      <span className="sr-only">此区域显示角色关系可视化图谱，支持拖拽和缩放交互</span>
    </div>
  );
}
