import { useState } from 'react';
import { bookAssetsService } from '@/services/bookAssetsService';

interface Props { projectId: string; }

type Tab = 'cover' | 'title' | 'synopsis';

const TABS: { value: Tab; label: string }[] = [
  { value: 'cover', label: '封面提示词' },
  { value: 'title', label: '书名优化' },
  { value: 'synopsis', label: '简介生成' },
];

const COVER_STYLES = [
  { value: 'anime', label: '动漫' },
  { value: 'realistic', label: '写实' },
  { value: 'fantasy', label: '奇幻' },
  { value: 'ink', label: '水墨' },
  { value: 'minimalist', label: '极简' },
  { value: 'dark', label: '暗黑' },
];

const TITLE_STYLES = [
  { value: 'literary', label: '文艺' },
  { value: 'hot-blooded', label: '热血' },
  { value: 'poetic', label: '诗意' },
  { value: 'mysterious', label: '悬疑' },
  { value: 'casual', label: '轻松' },
  { value: 'epic', label: '史诗' },
];

const SYNOPSIS_STYLES = [
  { value: 'suspenseful', label: '悬疑' },
  { value: 'emotional', label: '情感' },
  { value: 'epic', label: '史诗' },
  { value: 'humorous', label: '幽默' },
  { value: 'concise', label: '简洁' },
  { value: 'dramatic', label: '戏剧' },
];

export function BookAssetsPanel({ projectId }: Props) {
  const [tab, setTab] = useState<Tab>('cover');

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded px-1 py-1.5 text-[10px] transition-colors ${
              tab === t.value
                ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                : 'border border-[var(--color-border)] text-[var(--color-text-muted)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'cover' && <CoverTab projectId={projectId} />}
      {tab === 'title' && <TitleTab projectId={projectId} />}
      {tab === 'synopsis' && <SynopsisTab projectId={projectId} />}
    </div>
  );
}

function CoverTab({ projectId }: { projectId: string }) {
  const [genre, setGenre] = useState('');
  const [mood, setMood] = useState('');
  const [keyElements, setKeyElements] = useState<string[]>([]);
  const [elementInput, setElementInput] = useState('');
  const [style, setStyle] = useState('anime');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    prompts: { prompt: string; negative_prompt: string; parameters: Record<string, number> }[];
    color_palette: string[];
    composition: string;
  } | null>(null);

  const addElement = () => {
    const trimmed = elementInput.trim();
    if (trimmed && !keyElements.includes(trimmed)) {
      setKeyElements((prev) => [...prev, trimmed]);
    }
    setElementInput('');
  };

  const removeElement = (el: string) => {
    setKeyElements((prev) => prev.filter((e) => e !== el));
  };

  const handleGenerate = async () => {
    if (!genre.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await bookAssetsService.generateCoverPrompt(projectId, {
        genre,
        mood: mood || undefined,
        keyElements: keyElements.length > 0 ? keyElements : undefined,
        style,
      });
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error || '生成失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">类型</div>
        <input
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          placeholder="例如: 玄幻、都市、科幻"
          className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
        />
      </div>

      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">氛围</div>
        <input
          value={mood}
          onChange={(e) => setMood(e.target.value)}
          placeholder="例如: 神秘、温暖、紧张"
          className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
        />
      </div>

      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">核心元素</div>
        <div className="flex gap-1 mb-1 flex-wrap">
          {keyElements.map((el) => (
            <span key={el} className="inline-flex items-center gap-0.5 rounded bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-[10px] text-[var(--color-primary)]">
              {el}
              <button onClick={() => removeElement(el)} className="hover:text-red-400">x</button>
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          <input
            value={elementInput}
            onChange={(e) => setElementInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addElement(); } }}
            placeholder="添加元素后回车"
            className="flex-1 rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
          />
          <button
            onClick={addElement}
            className="rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
          >
            +
          </button>
        </div>
      </div>

      <StyleSelector styles={COVER_STYLES} value={style} onChange={setStyle} />

      {error && <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">{error}</div>}

      <button
        onClick={handleGenerate}
        disabled={loading || !genre.trim()}
        className="w-full rounded bg-[var(--color-primary)] py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-40"
      >
        {loading ? '生成中...' : '生成封面提示词'}
      </button>

      {result && (
        <div className="space-y-2">
          {/* Color palette */}
          {result.color_palette.length > 0 && (
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)] mb-1">推荐色板</div>
              <div className="flex gap-1">
                {result.color_palette.map((color, i) => (
                  <div
                    key={i}
                    className="h-5 w-5 rounded border border-[var(--color-border)]"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Composition */}
          {result.composition && (
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">构图建议</div>
              <div className="text-xs text-[var(--color-text-secondary)] rounded bg-[var(--color-surface-1)] p-1.5">
                {result.composition}
              </div>
            </div>
          )}

          {/* Prompts */}
          <div className="space-y-1.5">
            <div className="text-[10px] text-[var(--color-text-muted)]">生成提示词</div>
            {result.prompts.map((p, i) => (
              <div key={i} className="rounded border border-[var(--color-border)] p-2 space-y-1">
                <div>
                  <div className="text-[9px] text-[var(--color-text-muted)]">正向提示词</div>
                  <div className="text-[10px] text-[var(--color-text-primary)]">{p.prompt}</div>
                </div>
                {p.negative_prompt && (
                  <div>
                    <div className="text-[9px] text-[var(--color-text-muted)]">反向提示词</div>
                    <div className="text-[10px] text-red-400/80">{p.negative_prompt}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TitleTab({ projectId }: { projectId: string }) {
  const [synopsis, setSynopsis] = useState('');
  const [genre, setGenre] = useState('');
  const [style, setStyle] = useState('literary');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    titles: { title: string; subtitle: string; reason: string; score: number }[];
    analysis: string;
  } | null>(null);

  const handleGenerate = async () => {
    if (!synopsis.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await bookAssetsService.optimizeTitle(projectId, {
        synopsis,
        genre: genre || undefined,
        style,
      });
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error || '生成失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 85) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">故事简介</div>
        <textarea
          value={synopsis}
          onChange={(e) => setSynopsis(e.target.value)}
          placeholder="输入故事简介，用于生成书名建议..."
          rows={3}
          className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] resize-none"
        />
      </div>

      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">类型</div>
        <input
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          placeholder="例如: 玄幻、言情、悬疑"
          className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
        />
      </div>

      <StyleSelector styles={TITLE_STYLES} value={style} onChange={setStyle} />

      {error && <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">{error}</div>}

      <button
        onClick={handleGenerate}
        disabled={loading || !synopsis.trim()}
        className="w-full rounded bg-[var(--color-primary)] py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-40"
      >
        {loading ? '生成中...' : '优化书名'}
      </button>

      {result && (
        <div className="space-y-2">
          {result.analysis && (
            <div className="text-[10px] text-[var(--color-text-muted)] rounded bg-[var(--color-surface-1)] p-1.5">
              {result.analysis}
            </div>
          )}

          <div className="space-y-1.5">
            <div className="text-[10px] text-[var(--color-text-muted)]">书名建议</div>
            {result.titles.map((t, i) => (
              <div key={i} className="rounded border border-[var(--color-border)] p-2">
                <div className="flex items-center justify-between mb-0.5">
                  <div className="text-xs font-medium text-[var(--color-text-primary)]">{t.title}</div>
                  <div className={`text-[10px] font-medium ${scoreColor(t.score)}`}>{t.score}分</div>
                </div>
                {t.subtitle && (
                  <div className="text-[10px] text-[var(--color-text-muted)]">副标题: {t.subtitle}</div>
                )}
                {t.reason && (
                  <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{t.reason}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SynopsisTab({ projectId }: { projectId: string }) {
  const [genre, setGenre] = useState('');
  const [chapterCount, setChapterCount] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [style, setStyle] = useState('suspenseful');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    synopsis: string;
    short_pitch: string;
    selling_points: string[];
    tag_suggestions: string[];
  } | null>(null);

  const addKeyword = () => {
    const trimmed = keywordInput.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords((prev) => [...prev, trimmed]);
    }
    setKeywordInput('');
  };

  const removeKeyword = (kw: string) => {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  };

  const handleGenerate = async () => {
    if (!genre.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await bookAssetsService.generateSynopsis(projectId, {
        genre,
        chapterCount: chapterCount ? Number(chapterCount) : undefined,
        keywords: keywords.length > 0 ? keywords : undefined,
        style,
      });
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error || '生成失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">类型</div>
        <input
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          placeholder="例如: 玄幻、都市、言情"
          className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
        />
      </div>

      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">预计章节数</div>
        <input
          value={chapterCount}
          onChange={(e) => setChapterCount(e.target.value)}
          placeholder="例如: 200"
          type="number"
          className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
        />
      </div>

      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">关键词</div>
        <div className="flex gap-1 mb-1 flex-wrap">
          {keywords.map((kw) => (
            <span key={kw} className="inline-flex items-center gap-0.5 rounded bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-[10px] text-[var(--color-primary)]">
              {kw}
              <button onClick={() => removeKeyword(kw)} className="hover:text-red-400">x</button>
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          <input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
            placeholder="添加关键词后回车"
            className="flex-1 rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
          />
          <button
            onClick={addKeyword}
            className="rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
          >
            +
          </button>
        </div>
      </div>

      <StyleSelector styles={SYNOPSIS_STYLES} value={style} onChange={setStyle} />

      {error && <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">{error}</div>}

      <button
        onClick={handleGenerate}
        disabled={loading || !genre.trim()}
        className="w-full rounded bg-[var(--color-primary)] py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-40"
      >
        {loading ? '生成中...' : '生成简介'}
      </button>

      {result && (
        <div className="space-y-2">
          {/* Short pitch */}
          {result.short_pitch && (
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">一句话简介</div>
              <div className="text-xs text-[var(--color-primary)] font-medium rounded bg-[var(--color-primary)]/5 p-1.5">
                {result.short_pitch}
              </div>
            </div>
          )}

          {/* Synopsis */}
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">完整简介</div>
            <div className="rounded border border-[var(--color-border)] p-2 text-xs text-[var(--color-text-secondary)] max-h-40 overflow-y-auto whitespace-pre-wrap">
              {result.synopsis}
            </div>
          </div>

          {/* Selling points */}
          {result.selling_points.length > 0 && (
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">卖点</div>
              <div className="space-y-0.5">
                {result.selling_points.map((sp, i) => (
                  <div key={i} className="text-[10px] text-[var(--color-text-secondary)] pl-2">
                    <span className="text-[var(--color-primary)] mr-1">.</span>{sp}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tag suggestions */}
          {result.tag_suggestions.length > 0 && (
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">推荐标签</div>
              <div className="flex gap-1 flex-wrap">
                {result.tag_suggestions.map((tag, i) => (
                  <span key={i} className="rounded bg-[var(--color-surface-1)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StyleSelector({ styles, value, onChange }: {
  styles: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">风格</div>
      <div className="grid grid-cols-3 gap-1">
        {styles.map((s) => (
          <button
            key={s.value}
            onClick={() => onChange(s.value)}
            className={`rounded px-1 py-1 text-[10px] transition-colors ${
              value === s.value
                ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                : 'border border-[var(--color-border)] text-[var(--color-text-muted)]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
