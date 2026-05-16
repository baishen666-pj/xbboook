import { useEffect, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { fetchContextSummary, type ContextSummary } from '@/services/aiService';

interface Hint {
  type: 'info' | 'warning';
  text: string;
}

export function ContextHints() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const [hints, setHints] = useState<Hint[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!currentProject) {
      setHints([]);
      return;
    }

    let cancelled = false;
    fetchContextSummary(currentProject.id)
      .then((data: ContextSummary) => {
        if (cancelled) return;
        const items: Hint[] = [];
        if (data.plantedForeshadowingCount > 0) {
          items.push({
            type: 'info',
            text: `${data.plantedForeshadowingCount} 个已埋伏笔待回收`,
          });
        }
        if (data.charactersWithoutVoice > 0) {
          items.push({
            type: 'warning',
            text: `${data.charactersWithoutVoice} 个角色缺少语音设定`,
          });
        }
        if (!data.hasWorldview) {
          items.push({ type: 'info', text: '尚未设定世界观' });
        }
        if (data.outlineNodeCount === 0) {
          items.push({ type: 'info', text: '尚未创建大纲' });
        }
        setHints(items);
      })
      .catch(() => {
        // silently ignore
      });

    return () => {
      cancelled = true;
    };
  }, [currentProject]);

  if (hints.length === 0) return null;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex items-center gap-1 px-3 py-1 text-xs text-white/40 hover:text-white/60 border-b border-white/5"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {hints.length} 条提示
      </button>
    );
  }

  return (
    <div className="border-b border-white/5 px-3 py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/30">
          上下文提示
        </span>
        <button
          onClick={() => setCollapsed(true)}
          className="text-white/30 hover:text-white/50"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {hints.map((hint, i) => (
          <span
            key={i}
            className={`text-xs ${
              hint.type === 'warning'
                ? 'text-amber-400/70'
                : 'text-white/40'
            }`}
          >
            {hint.type === 'warning' ? '!' : '•'} {hint.text}
          </span>
        ))}
      </div>
    </div>
  );
}
