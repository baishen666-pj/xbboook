import { useState, useEffect } from 'react';
import { characterProfileService } from '@/services/characterProfileService';
import { characterService } from '@/services/characterService';
import type { Character } from '@/types/project';

interface CharacterProfilePanelProps {
  projectId: string;
  characterId?: string;
}

const DEPTH_OPTIONS = [
  { value: 'basic', label: '基础' },
  { value: 'detailed', label: '详细' },
  { value: 'deep', label: '深度' },
];

const ARC_TYPE_OPTIONS = [
  { value: 'growth', label: '成长' },
  { value: 'fall', label: '堕落' },
  { value: 'flat', label: '平直' },
  { value: 'transformation', label: '蜕变' },
  { value: 'corruption', label: '腐化' },
];

const BIG_FIVE_LABELS: Record<string, string> = {
  openness: '开放性',
  conscientiousness: '尽责性',
  extraversion: '外向性',
  agreeableness: '宜人性',
  neuroticism: '神经质',
};

export function CharacterProfilePanel({ projectId, characterId: initialCharacterId }: CharacterProfilePanelProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharId, setSelectedCharId] = useState(initialCharacterId ?? '');
  const [depth, setDepth] = useState('basic');
  const [activeTab, setActiveTab] = useState<'analysis' | 'arc'>('analysis');

  const [profile, setProfile] = useState<{
    mbti: { type: string; confidence: number; dimensions: Record<string, number>; explanation: string };
    enneagram: { type: string; wing: string; explanation: string };
    big_five: Record<string, number>;
    motivations: string[]; fears: string[]; values: string[];
    communication_style: string; conflict_style: string;
    growth_potential: number; story_role: string;
  } | null>(null);
  const [arcResult, setArcResult] = useState<{
    arc_type: string;
    start_state: { belief: string; want: string; need: string; flaw: string };
    end_state: { belief: string; resolution: string };
    milestones: { phase: string; chapters: number[]; event: string; internal_change: string; external_change: string }[];
    key_scenes: string[]; pitfalls: string[];
  } | null>(null);

  const [arcType, setArcType] = useState('growth');
  const [targetChapters, setTargetChapters] = useState(30);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    characterService.list(projectId).then((res) => {
      if (res.success && res.data) {
        setCharacters(res.data.characters);
        if (!initialCharacterId && res.data.characters.length > 0) {
          setSelectedCharId(res.data.characters[0]?.id ?? '');
        }
      }
    });
  }, [projectId, initialCharacterId]);

  const handleAnalyze = async () => {
    if (!selectedCharId) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await characterProfileService.analyze(projectId, {
        characterId: selectedCharId,
        depth,
      });
      if (res.success && res.data) {
        setProfile(res.data);
      } else {
        setError(res.error ?? '分析失败');
      }
    } catch {
      setError('请求失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlanArc = async () => {
    if (!selectedCharId) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await characterProfileService.planArc(projectId, {
        characterId: selectedCharId,
        arcType,
        targetChapters,
      });
      if (res.success && res.data) {
        setArcResult(res.data);
      } else {
        setError(res.error ?? '规划失败');
      }
    } catch {
      setError('请求失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="border-b border-[var(--color-border)] p-2 space-y-2">
        <div className="text-sm font-medium text-[var(--color-text-primary)]">角色深度分析</div>
        <div className="flex items-center gap-2">
          <select
            value={selectedCharId}
            onChange={(e) => setSelectedCharId(e.target.value)}
            className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-0)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]/50"
          >
            <option value="">选择角色</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={depth}
            onChange={(e) => setDepth(e.target.value)}
            className="rounded border border-[var(--color-border)] bg-[var(--color-surface-0)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]/50"
          >
            {DEPTH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        {/* Tabs */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('analysis')}
            className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
              activeTab === 'analysis' ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'
            }`}
          >
            心理分析
          </button>
          <button
            onClick={() => setActiveTab('arc')}
            className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
              activeTab === 'arc' ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'
            }`}
          >
            弧光规划
          </button>
          <div className="flex-1" />
          <button
            onClick={activeTab === 'analysis' ? handleAnalyze : handlePlanArc}
            disabled={isLoading || !selectedCharId}
            className="rounded bg-[var(--color-primary)] px-3 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isLoading ? '处理中...' : activeTab === 'analysis' ? '分析' : '生成'}
          </button>
        </div>
        {error && <div className="text-[10px] text-red-400">{error}</div>}
      </div>

      {isLoading && (
        <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">处理中...</div>
      )}

      {!isLoading && activeTab === 'analysis' && profile && (
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {/* MBTI + Growth */}
          <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-text-primary)]">
                {profile.mbti.type}
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)]">
                置信度 {profile.mbti.confidence}%
              </span>
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)]">{profile.mbti.explanation}</div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-[var(--color-text-muted)]">成长潜力</span>
              <span className={`text-xs font-bold ${profile.growth_potential >= 70 ? 'text-emerald-400' : profile.growth_potential >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                {profile.growth_potential}
              </span>
            </div>
          </div>

          {/* Enneagram */}
          <div className="rounded border border-[var(--color-border)] p-2 space-y-0.5">
            <span className="text-[10px] text-[var(--color-text-muted)]">九型人格</span>
            <div className="text-xs text-[var(--color-text-primary)]">
              {profile.enneagram.type}{profile.enneagram.wing && `w${profile.enneagram.wing}`}
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)]">{profile.enneagram.explanation}</div>
          </div>

          {/* Big Five */}
          <div className="rounded border border-[var(--color-border)] p-2 space-y-1.5">
            <span className="text-[10px] text-[var(--color-text-muted)]">大五人格</span>
            {Object.entries(profile.big_five).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--color-text-muted)] w-12 shrink-0">
                  {BIG_FIVE_LABELS[key] ?? key}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--color-surface-1)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-primary)]/70"
                    style={{ width: `${value}%` }}
                  />
                </div>
                <span className="text-[10px] text-[var(--color-text-muted)] w-6 text-right">{value}</span>
              </div>
            ))}
          </div>

          {/* Motivations / Fears / Values */}
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: '动机', items: profile.motivations },
              { label: '恐惧', items: profile.fears },
              { label: '价值观', items: profile.values },
            ].map(({ label, items }) => (
              <div key={label} className="rounded border border-[var(--color-border)] p-1.5 space-y-0.5">
                <div className="text-[10px] text-[var(--color-text-muted)]">{label}</div>
                {items.map((item, i) => (
                  <div key={i} className="text-[10px] text-[var(--color-text-primary)]">{item}</div>
                ))}
              </div>
            ))}
          </div>

          {/* Styles */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded border border-[var(--color-border)] p-1.5">
              <div className="text-[10px] text-[var(--color-text-muted)]">沟通风格</div>
              <div className="text-[10px] text-[var(--color-text-primary)]">{profile.communication_style}</div>
            </div>
            <div className="rounded border border-[var(--color-border)] p-1.5">
              <div className="text-[10px] text-[var(--color-text-muted)]">冲突风格</div>
              <div className="text-[10px] text-[var(--color-text-primary)]">{profile.conflict_style}</div>
            </div>
          </div>
        </div>
      )}

      {!isLoading && activeTab === 'arc' && (
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {/* Arc controls */}
          <div className="flex items-center gap-2">
            <select
              value={arcType}
              onChange={(e) => setArcType(e.target.value)}
              className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-0)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]/50"
            >
              {ARC_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[var(--color-text-muted)]">目标章节</span>
              <input
                type="number"
                value={targetChapters}
                onChange={(e) => setTargetChapters(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                className="w-14 rounded border border-[var(--color-border)] bg-[var(--color-surface-0)] px-1.5 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]/50"
              />
            </div>
          </div>

          {arcResult && (
            <>
              {/* Start/End state */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2 space-y-1">
                  <div className="text-[10px] text-[var(--color-text-muted)]">起始状态</div>
                  <div className="text-[10px] text-[var(--color-text-primary)]">信念: {arcResult.start_state.belief}</div>
                  <div className="text-[10px] text-[var(--color-text-primary)]">渴望: {arcResult.start_state.want}</div>
                  <div className="text-[10px] text-[var(--color-text-primary)]">需求: {arcResult.start_state.need}</div>
                  <div className="text-[10px] text-[var(--color-text-primary)]">缺陷: {arcResult.start_state.flaw}</div>
                </div>
                <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2 space-y-1">
                  <div className="text-[10px] text-[var(--color-text-muted)]">终局状态</div>
                  <div className="text-[10px] text-[var(--color-text-primary)]">信念: {arcResult.end_state.belief}</div>
                  <div className="text-[10px] text-[var(--color-text-primary)]">结局: {arcResult.end_state.resolution}</div>
                </div>
              </div>

              {/* Milestones timeline */}
              <div className="space-y-1">
                <div className="text-[10px] text-[var(--color-text-muted)]">里程碑</div>
                {arcResult.milestones.map((ms, i) => (
                  <div key={i} className="flex gap-2 rounded border border-[var(--color-border)] p-1.5">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                      {i < arcResult.milestones.length - 1 && (
                        <div className="w-px flex-1 bg-[var(--color-border)]" />
                      )}
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-[var(--color-text-primary)]">{ms.phase}</span>
                        <span className="text-[10px] text-[var(--color-text-muted)]">
                          {ms.chapters.length > 0 ? `第${ms.chapters[0]}-${ms.chapters[ms.chapters.length - 1]}章` : ''}
                        </span>
                      </div>
                      <div className="text-[10px] text-[var(--color-text-primary)]">{ms.event}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">内在: {ms.internal_change}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">外在: {ms.external_change}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pitfalls */}
              {arcResult.pitfalls.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] text-[var(--color-text-muted)]">注意事项</div>
                  {arcResult.pitfalls.map((p, i) => (
                    <div key={i} className="rounded bg-amber-500/10 p-1.5 text-[10px] text-amber-400">{p}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
