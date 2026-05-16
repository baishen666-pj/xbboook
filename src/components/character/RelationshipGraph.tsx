import { useEffect, useRef, useCallback } from "react";
import { Network } from "vis-network";
import type { Data, Options } from "vis-network";
import type { Character, CharacterRelation } from "@/types/project";
import { ROLE_LABELS } from "@/lib/role-types";

const ROLE_NODE_COLORS: Record<string, { background: string; border: string; highlight: { background: string; border: string } }> = {
  protagonist: { background: "#f59e0b", border: "#d97706", highlight: { background: "#fbbf24", border: "#f59e0b" } },
  antagonist: { background: "#ef4444", border: "#dc2626", highlight: { background: "#f87171", border: "#ef4444" } },
  supporting: { background: "#3b82f6", border: "#2563eb", highlight: { background: "#60a5fa", border: "#3b82f6" } },
  minor: { background: "#6b7280", border: "#4b5563", highlight: { background: "#9ca3af", border: "#6b7280" } },
};

const DEFAULT_NODE_COLOR = ROLE_NODE_COLORS.minor;

interface Props {
  characters: Character[];
  relations: CharacterRelation[];
  onNodeClick?: (characterId: string) => void;
  onEdgeClick?: (relation: CharacterRelation) => void;
  filterRole?: string;
}

export function RelationshipGraph({ characters, relations, onNodeClick, onEdgeClick, filterRole }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);

  const getCharacterById = useCallback(
    (id: string) => characters.find((c) => c.id === id),
    [characters],
  );

  useEffect(() => {
    if (!containerRef.current) return;

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

    const nodes: Data["nodes"] = characters
      .filter((c) => visibleIds.has(c.id))
      .map((c) => {
        const colors = ROLE_NODE_COLORS[c.roleType] ?? DEFAULT_NODE_COLOR;
        return {
          id: c.id,
          label: c.nickname ? `${c.name}\n「${c.nickname}」` : c.name,
          title: `${c.name}${c.nickname ? ` (${c.nickname})` : ""}\n${ROLE_LABELS[c.roleType] ?? c.roleType}`,
          color: colors,
          font: { color: "#e5e7eb", size: 13, face: "system-ui, sans-serif" },
          shape: "dot",
          size: c.roleType === "protagonist" ? 28 : c.roleType === "antagonist" ? 24 : c.roleType === "supporting" ? 20 : 14,
          borderWidth: 2,
        };
      });

    const edges: Data["edges"] = filteredRelations.map((r) => ({
      id: r.id,
      from: r.characterAId,
      to: r.characterBId,
      label: r.relationType,
      title: r.description ? `${r.relationType}: ${r.description}` : r.relationType,
      font: { color: "#9ca3af", size: 11, face: "system-ui, sans-serif", strokeWidth: 3, strokeColor: "#1f2937" },
      color: { color: "#4b5563", highlight: "#60a5fa", hover: "#6b7280" },
      arrows: "to",
      smooth: { enabled: true, type: "curvedCW", roundness: 0.2 },
      width: 1.5,
    }));

    const options: Options = {
      physics: {
        enabled: true,
        solver: "forceAtlas2Based",
        forceAtlas2Based: {
          gravitationalConstant: -80,
          centralGravity: 0.01,
          springLength: 150,
          springConstant: 0.08,
        },
        stabilization: { iterations: 150 },
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        dragNodes: true,
        dragView: true,
        zoomView: true,
        navigationButtons: false,
      },
      nodes: {
        shadow: { enabled: true, color: "rgba(0,0,0,0.3)", size: 8 },
      },
      edges: {
        shadow: { enabled: false },
      },
    };

    const network = new Network(containerRef.current, { nodes, edges } as Data, options);
    networkRef.current = network;

    network.on("click", (params) => {
      if (params.nodes && params.nodes.length > 0) {
        const nodeId = params.nodes[0] as string;
        onNodeClick?.(nodeId);
      } else if (params.edges && params.edges.length > 0) {
        const edgeId = params.edges[0] as string;
        const relation = relations.find((r) => r.id === edgeId);
        if (relation) onEdgeClick?.(relation);
      }
    });

    network.once("stabilizationIterationsDone", () => {
      network.fit({ animation: { duration: 300, easingFunction: "easeOutQuad" } });
    });

    return () => {
      network.destroy();
      networkRef.current = null;
    };
  }, [characters, relations, filterRole, onNodeClick, onEdgeClick, getCharacterById]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)]"
      style={{ minHeight: 300 }}
    />
  );
}
