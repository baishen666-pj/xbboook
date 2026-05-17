import { useState, useEffect, useRef, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { chapterDependencyService } from '@/services/chapterDependencyService';
import type { DependencyEdge } from '@/services/chapterDependencyService';
import type { Chapter } from '@/types/project';

const TYPE_COLORS: Record<string, string> = {
  plot: '#6366f1',
  character: '#f43f5e',
  foreshadowing: '#f59e0b',
  timeline: '#10b981',
  worldview: '#8b5cf6',
};

const TYPE_LABELS: Record<string, string> = {
  plot: '情节',
  character: '角色',
  foreshadowing: '伏笔',
  timeline: '时间线',
  worldview: '世界观',
};

const STROKE_WIDTH: Record<string, number> = {
  weak: 1.5,
  normal: 2.5,
  strong: 4,
};

interface GraphNode {
  id: string;
  title: string;
  sortOrder: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number;
}

interface Props {
  projectId: string;
  onChapterClick?: (chapterId: string) => void;
}

export function ChapterDependencyGraph({ projectId, onChapterClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [edges, setEdges] = useState<DependencyEdge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const chapters = useProjectStore((s) => s.chapters);
  const nodesRef = useRef<GraphNode[]>([]);
  const animRef = useRef<number>(0);
  const draggingRef = useRef<string | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });

  const loadDeps = useCallback(async () => {
    setIsLoading(true);
    const res = await chapterDependencyService.list(projectId);
    if (res.success && res.data) setEdges(res.data);
    setIsLoading(false);
  }, [projectId]);

  useEffect(() => { loadDeps(); }, [loadDeps]);

  // Build nodes from chapters
  const buildNodes = useCallback((): GraphNode[] => {
    const canvas = canvasRef.current;
    if (!canvas) return [];
    const w = canvas.width;
    const h = canvas.height;

    return chapters.map((ch: Chapter, i: number) => {
      const existing = nodesRef.current.find((n) => n.id === ch.id);
      if (existing) return existing;
      const cols = Math.ceil(Math.sqrt(chapters.length));
      const row = Math.floor(i / cols);
      const col = i % cols;
      return {
        id: ch.id,
        title: ch.title,
        sortOrder: ch.sortOrder,
        x: 80 + col * (w - 160) / Math.max(cols - 1, 1),
        y: 60 + row * 80,
        vx: 0,
        vy: 0,
      };
    });
  }, [chapters]);

  // Simple force simulation
  const simulate = useCallback(() => {
    const nodes = nodesRef.current;
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    const w = canvas.width;
    const h = canvas.height;

    for (const node of nodes) {
      if (node.id === draggingRef.current) continue;

      let fx = 0, fy = 0;

      // Repulsion between nodes
      for (const other of nodes) {
        if (other.id === node.id) continue;
        const dx = node.x - other.x;
        const dy = node.y - other.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = 3000 / (dist * dist);
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      }

      // Attraction along edges
      for (const edge of edges) {
        let other: GraphNode | undefined;
        if (edge.sourceChapterId === node.id) {
          other = nodes.find((n) => n.id === edge.targetChapterId);
        } else if (edge.targetChapterId === node.id) {
          other = nodes.find((n) => n.id === edge.sourceChapterId);
        }
        if (!other) continue;

        const dx = other.x - node.x;
        const dy = other.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ideal = 150;
        const force = (dist - ideal) * 0.01;
        fx += (dx / Math.max(dist, 1)) * force;
        fy += (dy / Math.max(dist, 1)) * force;
      }

      // Center gravity
      fx += (w / 2 - node.x) * 0.001;
      fy += (h / 2 - node.y) * 0.001;

      node.vx = (node.vx + fx) * 0.6;
      node.vy = (node.vy + fy) * 0.6;
      node.x = Math.max(60, Math.min(w - 60, node.x + node.vx));
      node.y = Math.max(40, Math.min(h - 40, node.y + node.vy));
    }
  }, [edges]);

  // Draw
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const nodes = nodesRef.current;

    // Draw edges
    for (const edge of edges) {
      const source = nodes.find((n) => n.id === edge.sourceChapterId);
      const target = nodes.find((n) => n.id === edge.targetChapterId);
      if (!source || !target) continue;

      const color = TYPE_COLORS[edge.dependencyType] ?? '#666';
      const width = STROKE_WIDTH[edge.strength] ?? 2.5;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = color + '88';
      ctx.lineWidth = width;
      ctx.stroke();

      // Arrow
      const angle = Math.atan2(target.y - source.y, target.x - source.x);
      const arrowLen = 10;
      const arrowX = target.x - Math.cos(angle) * 30;
      const arrowY = target.y - Math.sin(angle) * 30;
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(arrowX - arrowLen * Math.cos(angle - 0.4), arrowY - arrowLen * Math.sin(angle - 0.4));
      ctx.lineTo(arrowX - arrowLen * Math.cos(angle + 0.4), arrowY - arrowLen * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fillStyle = color + 'aa';
      ctx.fill();
    }

    // Draw nodes
    for (const node of nodes) {
      const isSelected = node.id === selectedNode;
      const isHovered = node.id === hoveredNode;
      const radius = isSelected ? 22 : isHovered ? 20 : 16;

      // Glow for selected
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#6366f1' : isHovered ? '#4f46e5' : '#3b3f5c';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#818cf8' : '#4b5080';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Label
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      const label = node.title.length > 8 ? node.title.slice(0, 8) + '…' : node.title;
      ctx.fillText(label, node.x, node.y + radius + 14);
    }
  }, [edges, selectedNode, hoveredNode]);

  // Animation loop
  useEffect(() => {
    nodesRef.current = buildNodes();
    let frame = 0;
    const maxFrames = 200;

    const loop = () => {
      if (frame < maxFrames) {
        simulate();
        frame++;
      }
      draw();
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [buildNodes, simulate, draw]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const node = nodesRef.current.find((n) => {
      const dx = n.x - x;
      const dy = n.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 20;
    });

    if (node) {
      draggingRef.current = node.id;
      offsetRef.current = { x: x - node.x, y: y - node.y };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (draggingRef.current) {
      const node = nodesRef.current.find((n) => n.id === draggingRef.current);
      if (node) {
        node.x = x - offsetRef.current.x;
        node.y = y - offsetRef.current.y;
        node.vx = 0;
        node.vy = 0;
      }
    } else {
      const node = nodesRef.current.find((n) => {
        const dx = n.x - x;
        const dy = n.y - y;
        return Math.sqrt(dx * dx + dy * dy) < 20;
      });
      setHoveredNode(node?.id ?? null);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    draggingRef.current = null;
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const node = nodesRef.current.find((n) => {
      const dx = n.x - x;
      const dy = n.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 20;
    });

    setSelectedNode(node?.id ?? null);
    if (node) onChapterClick?.(node.id);
  }, [onChapterClick]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
        <span className="text-xs font-medium text-[var(--color-text-primary)]">章节依赖图谱</span>
        <div className="flex-1" />
        {/* Legend */}
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[key] }} />
            {label}
          </span>
        ))}
        <button
          onClick={() => setShowForm(true)}
          className="rounded bg-[var(--color-primary)] px-2 py-1 text-[10px] text-white hover:opacity-90"
        >
          + 添加依赖
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-surface-0)]/50 z-10">
            <span className="text-xs text-[var(--color-text-muted)]">加载中...</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleClick}
        />
      </div>

      {/* Selected node info */}
      {selectedNode && (
        <div className="border-t border-[var(--color-border)] px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-primary)]">
              {chapters.find((c: Chapter) => c.id === selectedNode)?.title ?? '未知'}
            </span>
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {edges.filter((e) => e.sourceChapterId === selectedNode || e.targetChapterId === selectedNode).length} 个依赖
            </span>
            <div className="flex-1" />
            <button
              onClick={() => setSelectedNode(null)}
              className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            >
              取消选择
            </button>
          </div>
        </div>
      )}

      {/* Add dependency form */}
      {showForm && (
        <DependencyForm
          chapters={chapters}
          projectId={projectId}
          onSubmit={async (data) => {
            await chapterDependencyService.create(projectId, data);
            setShowForm(false);
            loadDeps();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function DependencyForm({
  chapters,
  projectId,
  onSubmit,
  onCancel,
}: {
  chapters: Chapter[];
  projectId: string;
  onSubmit: (data: { sourceChapterId: string; targetChapterId: string; dependencyType: string; description: string; strength: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [sourceId, setSourceId] = useState(chapters[0]?.id ?? '');
  const [targetId, setTargetId] = useState(chapters[1]?.id ?? '');
  const [depType, setDepType] = useState('plot');
  const [strength, setStrength] = useState('normal');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceId || !targetId || sourceId === targetId) return;
    setSubmitting(true);
    try {
      await onSubmit({ sourceChapterId: sourceId, targetChapterId: targetId, dependencyType: depType, description, strength });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 shadow-2xl"
      >
        <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">添加章节依赖</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">源章节（依赖方）</label>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
              >
                {chapters.map((ch) => <option key={ch.id} value={ch.id}>{ch.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">目标章节（被依赖）</label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
              >
                {chapters.map((ch) => <option key={ch.id} value={ch.id}>{ch.title}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">类型</label>
              <select
                value={depType}
                onChange={(e) => setDepType(e.target.value)}
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">强度</label>
              <select
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
              >
                <option value="weak">弱</option>
                <option value="normal">中</option>
                <option value="strong">强</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">说明</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
              placeholder="为什么有这个依赖？"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onCancel} className="rounded px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)]">取消</button>
          <button type="submit" disabled={submitting || !sourceId || !targetId || sourceId === targetId} className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-50">
            {submitting ? '创建中...' : '创建'}
          </button>
        </div>
      </form>
    </div>
  );
}
