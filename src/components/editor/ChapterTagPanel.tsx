import { useState, useEffect } from 'react';
import { chapterTagService, type TagInfo } from '@/services/chapterTagService';

interface ChapterTagPanelProps {
  projectId: string;
  currentTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export function ChapterTagPanel({ projectId, currentTags, onTagsChange }: ChapterTagPanelProps) {
  const [allTags, setAllTags] = useState<TagInfo[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    chapterTagService.listTags(projectId).then((res) => {
      if (res.success && res.data) setAllTags(res.data);
    }).catch(() => {});
  }, [projectId]);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !currentTags.includes(trimmed)) {
      onTagsChange([...currentTags, trimmed]);
    }
    setInput('');
  };

  const removeTag = (tag: string) => {
    onTagsChange(currentTags.filter((t) => t !== tag));
  };

  const suggestedTags = allTags
    .filter((t) => !currentTags.includes(t.name))
    .slice(0, 10);

  return (
    <div className="space-y-2">
      {/* Current tags */}
      <div className="flex flex-wrap gap-1">
        {currentTags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-[10px] text-[var(--color-primary)]">
            {tag}
            <button onClick={() => removeTag(tag)} className="hover:text-red-400">×</button>
          </span>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-1">
        <input
          type="text" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTag(input)}
          placeholder="添加标签..."
          className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1 text-[10px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
        />
        <button onClick={() => addTag(input)} disabled={!input.trim()}
          className="rounded bg-[var(--color-primary)] px-2 py-1 text-[10px] text-white disabled:opacity-40">添加</button>
      </div>

      {/* Suggested tags */}
      {suggestedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-[9px] text-[var(--color-text-muted)]">推荐:</span>
          {suggestedTags.map((t) => (
            <button key={t.name} onClick={() => addTag(t.name)}
              className="rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[9px] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/30 hover:text-[var(--color-primary)]">
              {t.name} ({t.count})
            </button>
          ))}
        </div>
      )}

      {/* All tags overview */}
      {allTags.length > 0 && (
        <div className="pt-1 border-t border-[var(--color-border)]">
          <div className="text-[9px] text-[var(--color-text-muted)] mb-1">项目标签 ({allTags.length})</div>
          <div className="flex flex-wrap gap-1">
            {allTags.map((t) => (
              <span key={t.name} className={`rounded px-1.5 py-0.5 text-[9px] ${
                currentTags.includes(t.name)
                  ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  : 'text-[var(--color-text-muted)]'
              }`}>
                {t.name} ({t.count})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
