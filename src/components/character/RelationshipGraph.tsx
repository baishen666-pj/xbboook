import { useState, useEffect, useRef, useCallback } from 'react';
import { relationshipGraphService, type GraphNode, type GraphEdge } from '@/services/relationshipGraphService';

interface RelationshipGraphProps {
  projectId: string;
}

const ROLE_COLORS: Record<string, string> = {
  protagonist: '#f59e0b',
  antagonist: '#ef4444',
  supporting: '#3b82f6',
  minor: '#6b7280',
};

function getNodeColor(roleType: string): string {
  return ROLE_COLORS[roleType] ?? '#6b7280';
}

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function RelationshipGraph({ projectId }: RelationshipGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    relationshipGraphService.getGraph(projectId).then((res) => {
      if (controller.signal.aborted) return;
      if (res.success && res.data) {
        const data = res.data;
        const width = svgRef.current?.clientWidth ?? 400;
        const height = svgRef.current?.clientHeight ?? 300;
        const cx = width / 2;
        const cy = height / 2;
        const simNodes: SimNode[] = data.nodes.map((n, i) => {
          const angle = (2 * Math.PI * i) / data.nodes.length;
          const r = Math.min(width, height) * 0.3;
          return { ...n, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), vx: 0, vy: 0 };
        });
        setNodes(simNodes);
        setEdges(data.edges);
      } else {
        setError(res.error || '加载失败');
      }
    }).catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : '请求失败');
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });

    return () => controller.abort();
  }, [projectId]);

  // Simple force simulation
  const tick = useCallback(() => {
    setNodes((prev) => {
      if (prev.length === 0) return prev;
      const width = svgRef.current?.clientWidth ?? 400;
      const height = svgRef.current?.clientHeight ?? 300;
      const cx = width / 2;
      const cy = height / 2;
      const next = prev.map((n) => ({ ...n, vx: 0, vy: 0 }));

      // Repulsion between all nodes
      for (let i = 0; i < next.length; i++) {
        for (let j = i + 1; j < next.length; j++) {
          const ni = next[i]!;
          const nj = next[j]!;
          const dx = ni.x - nj.x;
          const dy = ni.y - nj.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = 3000 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          next[i] = { ...ni, vx: ni.vx + fx, vy: ni.vy + fy };
          next[j] = { ...nj, vx: nj.vx - fx, vy: nj.vy - fy };
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const idxA = next.findIndex((n) => n.id === edge.source);
        const idxB = next.findIndex((n) => n.id === edge.target);
        if (idxA === -1 || idxB === -1) continue;
        const a = next[idxA]!;
        const b = next[idxB]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = (dist - 100) * 0.02;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        next[idxA] = { ...a, vx: a.vx + fx, vy: a.vy + fy };
        next[idxB] = { ...b, vx: b.vx - fx, vy: b.vy - fy };
      }

      // Center gravity
      for (let i = 0; i < next.length; i++) {
        const n = next[i]!;
        const dx = cx - n.x;
        const dy = cy - n.y;
        next[i] = { ...n, vx: n.vx + dx * 0.005, vy: n.vy + dy * 0.005 };
      }

      // Apply velocity with damping
      return next.map((n) => ({
        ...n,
        x: Math.max(30, Math.min(width - 30, n.x + n.vx * 0.6)),
        y: Math.max(30, Math.min(height - 30, n.y + n.vy * 0.6)),
      }));
    });
  }, [edges]);

  // Run simulation
  useEffect(() => {
    let frame = 0;
    const maxFrames = 200;
    const run = () => {
      frame++;
      if (frame < maxFrames) {
        tick();
        animRef.current = requestAnimationFrame(run);
      }
    };
    if (nodes.length > 0) {
      animRef.current = requestAnimationFrame(run);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [nodes.length > 0, tick]);

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const highlightedNodeIds = selectedNodeId
    ? new Set([
        selectedNodeId,
        ...edges
          .filter((e) => e.source === selectedNodeId || e.target === selectedNodeId)
          .flatMap((e) => [e.source, e.target]),
      ])
    : null;

  const highlightedEdgeIndices = selectedNodeId
    ? new Set(
        edges
          .map((e, i) => (e.source === selectedNodeId || e.target === selectedNodeId ? i : -1))
          .filter((i) => i >= 0)
      )
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[10px] text-[var(--color-text-muted)]">
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-[10px] text-red-400">
        {error}
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[10px] text-[var(--color-text-muted)]">
        暂无角色数据
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <svg
        ref={svgRef}
        className="w-full flex-1"
        style={{ minHeight: 300 }}
        onClick={() => setSelectedNodeId(null)}
      >
        {/* Edges */}
        {edges.map((edge, i) => {
          const source = nodeMap.get(edge.source);
          const target = nodeMap.get(edge.target);
          if (!source || !target) return null;
          const isHighlighted = highlightedEdgeIndices?.has(i) ?? false;
          return (
            <line
              key={i}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={isHighlighted ? 'var(--color-primary)' : 'var(--color-border)'}
              strokeWidth={isHighlighted ? 2 : 1}
              opacity={selectedNodeId && !isHighlighted ? 0.2 : 0.6}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const isHighlighted = highlightedNodeIds?.has(node.id) ?? false;
          const isSelected = selectedNodeId === node.id;
          return (
            <g
              key={node.id}
              transform={`translate(${node.x},${node.y})`}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedNodeId(selectedNodeId === node.id ? null : node.id);
              }}
              style={{ cursor: 'pointer' }}
              opacity={selectedNodeId && !isHighlighted ? 0.3 : 1}
            >
              <circle
                r={isSelected ? 16 : 12}
                fill={getNodeColor(node.roleType)}
                stroke={isSelected ? 'var(--color-primary)' : 'var(--color-surface-1)'}
                strokeWidth={isSelected ? 2.5 : 1.5}
              />
              <text
                y={20}
                textAnchor="middle"
                fill="var(--color-text-secondary)"
                fontSize={10}
                fontFamily="system-ui, sans-serif"
              >
                {node.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-t border-[var(--color-border)] flex-shrink-0">
        <span className="text-[10px] text-[var(--color-text-muted)]">角色:</span>
        {[
          { label: '主角', color: '#f59e0b' },
          { label: '反派', color: '#ef4444' },
          { label: '配角', color: '#3b82f6' },
          { label: '路人', color: '#6b7280' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[10px] text-[var(--color-text-muted)]">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
