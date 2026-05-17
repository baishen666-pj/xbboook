import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  searchAll,
  getSuggestions,
  getCategoryLabel,
  getCategoryIcon,
  getRecentSearches,
  addRecentSearch,
  clearRecentSearches,
  type SearchResult,
  type SearchSuggestion,
} from "@/services/searchService";
import { useProjectStore } from "@/stores/projectStore";
import { useChapterContent } from "@/hooks/useChapterContent";

const CATEGORY_ORDER: SearchResult["category"][] = [
  "chapters",
  "characters",
  "worldviews",
  "outlines",
  "foreshadowing",
];

const CATEGORY_FILTERS: { value: SearchResult["category"]; label: string }[] = [
  { value: "chapters", label: "章节" },
  { value: "characters", label: "角色" },
  { value: "worldviews", label: "世界观" },
  { value: "outlines", label: "大纲" },
  { value: "foreshadowing", label: "伏笔" },
];

function HighlightSnippet({
  snippet,
  highlights,
}: {
  snippet: string;
  highlights: string[];
}) {
  if (!highlights.length || !snippet) return <>{snippet}</>;

  const regex = new RegExp(
    `(${highlights.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );
  const parts = snippet.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        highlights.some(
          (h) => h.toLowerCase() === part.toLowerCase(),
        ) ? (
          <mark
            key={i}
            className="bg-amber-400/25 text-amber-300 rounded px-0.5"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function SearchPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategories, setActiveCategories] = useState<
    SearchResult["category"][]
  >([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState(getRecentSearches);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [resultCount, setResultCount] = useState(0);

  const currentProject = useProjectStore((s) => s.currentProject);
  const { loadChapter } = useChapterContent();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(
    (value: string, categories?: string[]) => {
      if (!value || value.length < 2 || !currentProject) {
        setResults([]);
        setResultCount(0);
        return;
      }
      setLoading(true);
      searchAll(currentProject.id, value, {
        categories: categories?.length ? categories : undefined,
      })
        .then((res) => {
          setResults(res);
          setResultCount(res.length);
        })
        .catch(() => {
          setResults([]);
          setResultCount(0);
        })
        .finally(() => setLoading(false));
    },
    [currentProject],
  );

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      setSelectedIndex(-1);
      setShowSuggestions(false);

      if (timerRef.current) clearTimeout(timerRef.current);
      if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);

      if (!value || value.length < 2) {
        setResults([]);
        setResultCount(0);
        setSuggestions([]);
        if (value.length === 0) {
          setRecentSearches(getRecentSearches());
          setShowSuggestions(false);
        }
        return;
      }

      suggestTimerRef.current = setTimeout(async () => {
        if (!currentProject) return;
        try {
          const s = await getSuggestions(currentProject.id, value);
          setSuggestions(s);
          setShowSuggestions(s.length > 0);
        } catch {
          setSuggestions([]);
        }
      }, 150);

      timerRef.current = setTimeout(() => {
        setShowSuggestions(false);
        doSearch(value, activeCategories.length ? activeCategories : undefined);
      }, 300);
    },
    [currentProject, activeCategories, doSearch],
  );

  const toggleCategory = useCallback(
    (cat: SearchResult["category"]) => {
      setActiveCategories((prev) => {
        const next = prev.includes(cat)
          ? prev.filter((c) => c !== cat)
          : [...prev, cat];
        if (query.length >= 2) {
          doSearch(
            query,
            next.length ? next : undefined,
          );
        }
        return next;
      });
    },
    [query, doSearch],
  );

  const handleSelectResult = useCallback(
    (r: SearchResult) => {
      if (r.category === "chapters") {
        loadChapter(r.chapterId);
      }
      addRecentSearch(query);
      onClose();
    },
    [loadChapter, query, onClose],
  );

  const handleSuggestionClick = useCallback(
    (s: SearchSuggestion) => {
      setQuery(s.text);
      setShowSuggestions(false);
      doSearch(s.text, activeCategories.length ? activeCategories : undefined);
    },
    [activeCategories, doSearch],
  );

  const handleRecentClick = useCallback(
    (q: string) => {
      setQuery(q);
      setRecentSearches([]);
      doSearch(q, activeCategories.length ? activeCategories : undefined);
    },
    [activeCategories, doSearch],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const totalItems = showSuggestions
        ? suggestions.length
        : results.length;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, totalItems - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, -1));
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        if (showSuggestions && suggestions[selectedIndex]) {
          handleSuggestionClick(suggestions[selectedIndex]);
        } else if (results[selectedIndex]) {
          handleSelectResult(results[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        if (showSuggestions) {
          setShowSuggestions(false);
        } else {
          onClose();
        }
      }
    },
    [
      showSuggestions,
      suggestions,
      results,
      selectedIndex,
      handleSuggestionClick,
      handleSelectResult,
      onClose,
    ],
  );

  useEffect(() => {
    if (selectedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-search-item]");
    items[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const grouped = useMemo(() => {
    const map = new Map<SearchResult["category"], SearchResult[]>();
    for (const r of results) {
      const list = map.get(r.category) ?? [];
      list.push(r);
      map.set(r.category, list);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      items: map.get(c)!,
    }));
  }, [results]);

  return (
    <div className="flex flex-col h-full" onKeyDown={handleKeyDown}>
      {/* Search input */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-white/30 shrink-0"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => {
            if (query.length === 0 && recentSearches.length > 0) {
              setRecentSearches(getRecentSearches());
            }
          }}
          placeholder="搜索章节、角色、世界观..."
          className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/20"
        />
        {loading && (
          <span className="text-xs text-white/30 animate-pulse">搜索中</span>
        )}
        {resultCount > 0 && !loading && (
          <span className="text-[10px] text-white/25">{resultCount} 条结果</span>
        )}
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/60 text-xs"
        >
          Esc
        </button>
      </div>

      {/* Category filters */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/5 overflow-x-auto">
        {CATEGORY_FILTERS.map((f) => {
          const active = activeCategories.includes(f.value);
          return (
            <button
              key={f.value}
              onClick={() => toggleCategory(f.value)}
              className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors ${
                active
                  ? "bg-indigo-500/30 text-indigo-300 border border-indigo-500/40"
                  : "bg-white/5 text-white/30 border border-transparent hover:bg-white/10 hover:text-white/50"
              }`}
            >
              {f.label}
            </button>
          );
        })}
        {activeCategories.length > 0 && (
          <button
            onClick={() => {
              setActiveCategories([]);
              if (query.length >= 2) doSearch(query);
            }}
            className="px-1.5 py-0.5 rounded text-[10px] text-white/20 hover:text-white/40 hover:bg-white/5"
          >
            清除
          </button>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto" ref={listRef}>
        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="border-b border-white/5">
            {suggestions.map((s, i) => (
              <button
                key={`sug-${s.category}-${s.id}`}
                data-search-item
                onClick={() => handleSuggestionClick(s)}
                className={`w-full text-left px-3 py-2 hover:bg-white/5 border-b border-white/3 transition-colors flex items-center gap-2 ${
                  selectedIndex === i ? "bg-white/5" : ""
                }`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-white/20 shrink-0"
                >
                  <path d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-xs text-white/50">{s.text}</span>
                <span className="text-[10px] text-white/20 ml-auto">
                  {s.category === "chapter"
                    ? "章节"
                    : s.category === "character"
                      ? "角色"
                      : s.category === "worldview"
                        ? "世界观"
                        : s.category === "outline"
                          ? "大纲"
                          : "伏笔"}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Recent searches */}
        {query.length === 0 &&
          !showSuggestions &&
          recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-3 py-1.5 border-t border-white/5">
                <span className="text-[10px] text-white/20">最近搜索</span>
                <button
                  onClick={() => {
                    clearRecentSearches();
                    setRecentSearches([]);
                  }}
                  className="text-[10px] text-white/15 hover:text-white/30"
                >
                  清除
                </button>
              </div>
              {recentSearches.map((q) => (
                <button
                  key={q}
                  onClick={() => handleRecentClick(q)}
                  className="w-full text-left px-3 py-1.5 hover:bg-white/5 border-b border-white/3 transition-colors"
                >
                  <span className="text-xs text-white/40">{q}</span>
                </button>
              ))}
            </div>
          )}

        {/* No results */}
        {query.length >= 2 &&
          results.length === 0 &&
          !loading &&
          !showSuggestions && (
            <div className="px-3 py-8 text-center text-xs text-white/25">
              未找到匹配内容
            </div>
          )}

        {/* Placeholder */}
        {query.length < 2 && recentSearches.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-white/25">
            输入关键词搜索章节、角色、世界观等
          </div>
        )}

        {/* Grouped results */}
        {grouped.map((group) => (
          <div key={group.category}>
            <div className="px-3 py-1.5 text-[10px] font-medium text-white/25 uppercase tracking-wider border-t border-white/5 flex items-center gap-1.5">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-white/15"
              >
                <path d={getCategoryIcon(group.category)} />
              </svg>
              {getCategoryLabel(group.category)}
              <span className="text-white/15 ml-1">
                ({group.items.length})
              </span>
            </div>
            {group.items.map((r, i) => {
              const flatIndex = results.indexOf(r);
              return (
                <button
                  key={`${r.category}-${"id" in r ? r.id : "chapterId" in r ? r.chapterId : ""}-${i}`}
                  data-search-item
                  onClick={() => handleSelectResult(r)}
                  className={`w-full text-left px-3 py-2 hover:bg-white/5 border-b border-white/3 transition-colors ${
                    selectedIndex === flatIndex ? "bg-white/5" : ""
                  }`}
                >
                  <div className="text-xs font-medium text-white/70 truncate flex items-center gap-1.5">
                    {"chapterTitle" in r ? r.chapterTitle : r.title}
                    {r.category === "chapters" && "volumeId" in r && r.volumeId && (
                      <span className="text-[10px] text-white/20 font-normal" />
                    )}
                  </div>
                  {r.snippet && (
                    <div className="mt-0.5 text-[11px] text-white/35 line-clamp-2">
                      <HighlightSnippet
                        snippet={r.snippet}
                        highlights={r.highlights}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
