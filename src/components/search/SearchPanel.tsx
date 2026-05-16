import { useState, useRef, useCallback } from "react";
import { searchChapters, type SearchResult } from "@/services/searchService";
import { useProjectStore } from "@/stores/projectStore";
import { useChapterContent } from "@/hooks/useChapterContent";

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
          const res = await searchChapters(currentProject.id, value);
          setResults(res);
        } catch {
          setResults([]);
        }
        setLoading(false);
      }, 300);
    },
    [currentProject, loadChapter]
  );

  const handleClick = (r: SearchResult) => {
    loadChapter(r.chapterId);
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
          placeholder="搜索所有章节..."
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
            输入关键词搜索所有章节
          </div>
        )}
        {results.map((r, i) => (
          <button
            key={`${r.chapterId}-${i}`}
            onClick={() => handleClick(r)}
            className="w-full text-left px-3 py-2 hover:bg-white/5 border-b border-white/3 transition-colors"
          >
            <div className="text-xs font-medium text-white/70 truncate">{r.chapterTitle}</div>
            <div className="mt-0.5 text-[11px] text-white/35 line-clamp-2">
              {r.snippet}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
