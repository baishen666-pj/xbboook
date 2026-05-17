import { useState, useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { characterDialogueService } from '@/services/characterDialogueService';
import type { DialogueResult } from '@/services/characterDialogueService';

interface CharacterBrief {
  id: string;
  name: string;
  nickname?: string;
  roleType: string;
}

interface CharacterDialoguePanelProps {
  projectId: string;
  characters: CharacterBrief[];
}

export function CharacterDialoguePanel({ projectId, characters }: CharacterDialoguePanelProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scene, setScene] = useState('');
  const [mood, setMood] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DialogueResult | null>(null);

  const toggleCharacter = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : prev.length < 6 ? [...prev, id] : prev
    );
  };

  const handleSimulate = async () => {
    if (selectedIds.length < 2 || !scene.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await characterDialogueService.simulate(projectId, {
        characterIds: selectedIds,
        scene: scene.trim(),
        mood: mood.trim() || undefined,
      });
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error || '模拟失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const speakerColors: Record<string, string> = {};
  const colorPalette = ['text-blue-400', 'text-green-400', 'text-purple-400', 'text-orange-400', 'text-pink-400', 'text-cyan-400'];
  let colorIdx = 0;
  for (const id of selectedIds) {
    const ch = characters.find((c) => c.id === id);
    if (ch) {
      speakerColors[ch.name] = colorPalette[colorIdx % colorPalette.length];
      colorIdx++;
    }
  }

  return (
    <div className="space-y-3">
      {/* Character Selection */}
      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-1">选择角色（2-6人）</div>
        <div className="flex flex-wrap gap-1.5">
          {characters.map((ch) => (
            <button
              key={ch.id}
              onClick={() => toggleCharacter(ch.id)}
              className={`rounded px-2 py-1 text-xs transition-colors ${
                selectedIds.includes(ch.id)
                  ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                  : 'border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/30'
              }`}
            >
              {ch.name}{ch.nickname ? `（${ch.nickname}）` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Scene Input */}
      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-1">场景描述</div>
        <textarea
          value={scene}
          onChange={(e) => setScene(e.target.value)}
          placeholder="描述对话发生的场景，如：月下古亭，两人对饮..."
          rows={3}
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none focus:border-[var(--color-primary)]/50"
        />
      </div>

      {/* Mood */}
      <div>
        <div className="text-[10px] text-[var(--color-text-muted)] mb-1">氛围（可选）</div>
        <input
          type="text"
          value={mood}
          onChange={(e) => setMood(e.target.value)}
          placeholder="如：紧张、温馨、搞笑"
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
        />
      </div>

      {error && (
        <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">{error}</div>
      )}

      <button
        onClick={handleSimulate}
        disabled={loading || selectedIds.length < 2 || !scene.trim()}
        className="w-full rounded bg-[var(--color-primary)] py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-40"
      >
        {loading ? '模拟中...' : '开始对话模拟'}
      </button>

      {/* Result */}
      {result && (
        <div className="space-y-2">
          {result.scene_description && (
            <div className="rounded bg-[var(--color-surface-1)] p-2 text-[10px] text-[var(--color-text-muted)] italic">
              {result.scene_description}
            </div>
          )}
          <div className="space-y-1.5">
            {result.dialogue.map((line, i) => (
              <div key={i} className="rounded border border-[var(--color-border)] p-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium ${speakerColors[line.speaker] || 'text-[var(--color-text-primary)]'}`}>
                    {line.speaker}
                  </span>
                </div>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  "{line.line}"
                </div>
                {line.action && (
                  <div className="text-[10px] text-[var(--color-text-muted)] mt-1 italic">
                    {line.action}
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
