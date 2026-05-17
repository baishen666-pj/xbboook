import { useState } from 'react';
import { voiceStyleService } from '@/services/voiceStyleService';

interface VoiceStylePanelProps {
  projectId: string;
  characters: Array<{ id: string; name: string }>;
  selectedText: string;
  onApply: (text: string) => void;
}

export function VoiceStylePanel({ projectId, characters, selectedText, onApply }: VoiceStylePanelProps) {
  const [characterId, setCharacterId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRewrite = async () => {
    if (!characterId || !selectedText) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await voiceStyleService.rewrite(projectId, characterId, selectedText);
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error || '风格化失败');
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
        <div className="text-[10px] text-[var(--color-text-muted)] mb-1">选择角色</div>
        <select value={characterId} onChange={(e) => setCharacterId(e.target.value)}
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-xs text-[var(--color-text-primary)]">
          <option value="">选择角色</option>
          {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-1">选中文本</div>
        <div className="rounded bg-[var(--color-surface-1)] p-2 text-[10px] text-[var(--color-text-secondary)] max-h-16 overflow-y-auto">
          {selectedText.slice(0, 300)}{selectedText.length > 300 ? '...' : ''}
        </div>
      </div>

      {error && <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">{error}</div>}

      <button onClick={handleRewrite} disabled={loading || !characterId || !selectedText}
        className="w-full rounded bg-[var(--color-primary)] py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-40">
        {loading ? '风格化中...' : '角色语音风格化'}
      </button>

      {result && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--color-text-muted)]">{result.characterName} 的语言风格</span>
            <span className="text-[10px] text-[var(--color-primary)]">匹配度 {result.match_score}%</span>
          </div>
          <div className="rounded border border-[var(--color-border)] p-2 text-xs text-[var(--color-text-primary)] max-h-40 overflow-y-auto whitespace-pre-wrap">
            {result.rewritten}
          </div>
          {result.voice_traits?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {result.voice_traits.map((t: string, i: number) => (
                <span key={i} className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[9px] text-purple-400">{t}</span>
              ))}
            </div>
          )}
          <button onClick={() => onApply(result.rewritten)}
            className="w-full rounded bg-green-500/20 border border-green-500/30 py-1.5 text-xs text-green-400 hover:bg-green-500/30">
            应用风格化结果
          </button>
        </div>
      )}
    </div>
  );
}
