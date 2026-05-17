import { useState, useRef, useEffect } from "react";

const TAG_COLORS = [
  "bg-blue-500/20 text-blue-400",
  "bg-green-500/20 text-green-400",
  "bg-purple-500/20 text-purple-400",
  "bg-orange-500/20 text-orange-400",
  "bg-pink-500/20 text-pink-400",
  "bg-cyan-500/20 text-cyan-400",
  "bg-yellow-500/20 text-yellow-400",
  "bg-red-500/20 text-red-400",
];

function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]!;
}

interface ChapterTagsProps {
  tags: string[];
  allTags: string[];
  onChange: (tags: string[]) => void;
  compact?: boolean;
}

export function ChapterTags({ tags, allTags, onChange, compact }: ChapterTagsProps) {
  const [input, setInput] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDropdown) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDropdown]);

  const suggestions = allTags.filter(
    (t) => !tags.includes(t) && t.toLowerCase().includes(input.toLowerCase())
  );

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
    setShowDropdown(false);
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      addTag(input);
    }
  }

  if (compact) {
    const visible = tags.slice(0, 2);
    const extra = tags.length - 2;
    return (
      <div className="flex items-center gap-1 mt-0.5">
        {visible.map((t) => (
          <span
            key={t}
            className={`inline-block rounded-full px-1.5 py-0 text-[9px] leading-4 ${tagColor(t)}`}
          >
            {t}
          </span>
        ))}
        {extra > 0 && (
          <span className="text-[9px] text-white/20">+{extra}</span>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap items-center gap-1">
        {tags.map((t) => (
          <span
            key={t}
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[10px] leading-4 ${tagColor(t)}`}
          >
            {t}
            <button
              type="button"
              onClick={() => removeTag(t)}
              className="ml-0.5 opacity-50 hover:opacity-100"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? "添加标签" : ""}
          className="w-16 bg-transparent text-[10px] text-white/50 outline-none placeholder:text-white/20"
        />
      </div>
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-20 w-36 rounded border border-white/10 bg-[var(--color-surface-1)] py-1 shadow-lg">
          {suggestions.slice(0, 8).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => addTag(t)}
              className="block w-full text-left px-2 py-1 text-[10px] text-white/60 hover:bg-white/5"
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
