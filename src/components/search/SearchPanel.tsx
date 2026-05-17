import { useState, useRef, useCallback, useMemo } from "react";
import { searchAll, getCategoryLabel, type SearchResult } from "@/services/searchService";
import { useProjectStore } from "@/stores/projectStore";
import { useChapterContent } from "@/hooks/useChapterContent";

const CATEGORY_ORDER: SearchResult["category"][] = [
  "chapters", "characters", "worldviews", "outlines", "foreshadowing",
];

export function SearchPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const currentProject = useProjectStore((s) => s.currentProject);
  const { loadChapter } = useChapterContent();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (!value || value.length < 2 || !currentProject) {
        setResults([]);
        return;
      }
      timerRef.current = setTimeout(async () => {
        setLoading(true);
        try {
          const res = await searchAll(currentProject.id, value);
          setResults(res);
        } catch {
          setResults([]);
        }
        setLoading(false);
      }, 300);
    },
    [currentProject]
  );

  const grouped = useMemo(() => {
    const map = new Map<SearchResult["category"], SearchResult[]>();
    for (const r of results) {
      const list = map.get(r.category) ?? [];
      list.push(r);
      map.set(r.category, list);
    }
    return CATEGORY_ORDER
      .filter((c) => map.has(c))
      .map((c) => ({ category: c, items: map.get(c)! }));
  }, [results]);

  const handleClick = (r: SearchResult) => {
    if (r.category === "chapters") {
      loadChapter(r.chapterId);
    }
    onClose();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30 shrink-0">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="搜索章节、角色、世界观..."
          className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/20"
        />
        {loading && (
          <span className="text-xs text-white/30 animate-pulse">搜索中</span>
        )}
        <button onClick={onClose} className="text-white/30 hover:text-white/60 text-xs">
          Esc
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {query.length >= 2 && results.length === 0 && !loading && (
          <div className="px-3 py-6 text-center text-xs text-white/25">
            未找到匹配内容
          </div>
        )}
        {query.length < 2 && (
          <div className="px-3 py-6 text-center text-xs text-white/25">
            输入关键词搜索章节、角色、世界观等
          </div>
        )}
        {grouped.map((group) => (
          <div key={group.category}>
            <div className="px-3 py-1.5 text-[10px] font-medium text-white/25 uppercase tracking-wider border-t border-white/5">
              {getCategoryLabel(group.category)}
            </div>
            {group.items.map((r, i) => (
              <button
                key={`${r.category}-${"id" in r ? r.id : "chapterId" in r ? r.chapterId : ""}-${i}`}
                onClick={() => handleClick(r)}
                className="w-full text-left px-3 py-2 hover:bg-white/5 border-b border-white/3 transition-colors"
              >
                <div className="text-xs font-medium text-white/70 truncate">
                  {"chapterTitle" in r ? r.chapterTitle : r.title}
                </div>
                <div className="mt-0.5 text-[11px] text-white/35 line-clamp-2">
                  {r.snippet}
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
