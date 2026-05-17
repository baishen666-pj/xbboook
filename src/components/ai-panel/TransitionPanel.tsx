// @ts-nocheck
import { useState, useEffect } from 'react';
import { chapterService } from '@/services/chapterService';
import { chapterTransitionService } from '@/services/chapterTransitionService';
import type { ChapterTransitionResult, TransitionOption } from '@/services/chapterTransitionService';
import type { Chapter } from '@/types/project';

interface Props {
  projectId: string;
}

const TRANSITION_TYPES = [
  { id: 'time_skip', name: '时间跳跃', desc: '跨越时间段' },
  { id: 'scene_shift', name: '场景转换', desc: '切换场景地点' },
  { id: 'perspective_switch', name: '视角切换', desc: '转换叙事视角' },
  { id: 'emotion_turn', name: '情绪转折', desc: '情感氛围变化' },
  { id: 'suspense_bridge', name: '悬念衔接', desc: '连接悬念线索' },
  { id: 'auto', name: '自动判断', desc: 'AI自动选择' },
] as const;

const LENGTH_OPTIONS = [
  { id: 'brief', name: '简短', desc: '100-200字' },
  { id: 'moderate', name: '适中', desc: '200-400字' },
  { id: 'extended', name: '详细', desc: '400-600字' },
] as const;

const TYPE_COLORS: Record<string, string> = {
  '时间跳跃': '#6366f1',
  '场景转换': '#22c55e',
  '视角切换': '#f59e0b',
  '情绪转折': '#ef4444',
  '悬念衔接': '#8b5cf6',
  '自动判断': '#06b6d4',
};

export function TransitionPanel({ projectId }: Props) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [fromChapterId, setFromChapterId] = useState<string>('');
  const [toChapterId, setToChapterId] = useState<string>('');
  const [transitionType, setTransitionType] = useState<string>('auto');
  const [length, setLength] = useState<string>('moderate');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ChapterTransitionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTransition, setSelectedTransition] = useState<number | null>(null);

  useEffect(() => {
    chapterService.list(projectId).then(res => {
      if (res.success && res.data) {
        const list = res.data;
        setChapters(list);
        if (list.length >= 2) {
          setFromChapterId(list[0].id);
          setToChapterId(list[1].id);
        }
      }
    });
  }, [projectId]);

  const handleGenerate = async () => {
    if (!fromChapterId || !toChapterId) return;
    if (fromChapterId === toChapterId) {
      setError('请选择不同的章节');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedTransition(null);
    const res = await chapterTransitionService.generate(projectId, {
      fromChapterId,
      toChapterId,
      transitionType: transitionType as typeof TRANSITION_TYPES[number]['id'],
      length: length as typeof LENGTH_OPTIONS[number]['id'],
    });
    if (res.success && res.data) setResult(res.data);
    else setError(res.error || '生成失败');
    setLoading(false);
  };

  const fromChapter = chapters.find(c => c.id === fromChapterId);
  const toChapter = chapters.find(c => c.id === toChapterId);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>章节过渡生成</h3>

      {/* Chapter selectors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4, color: '#475569' }}>前章（来源）</label>
          <select
            value={fromChapterId}
            onChange={e => setFromChapterId(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff' }}
          >
            <option value="">选择章节</option>
            {chapters.map(ch => (
              <option key={ch.id} value={ch.id}>{ch.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4, color: '#475569' }}>后章（目标）</label>
          <select
            value={toChapterId}
            onChange={e => setToChapterId(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff' }}
          >
            <option value="">选择章节</option>
            {chapters.map(ch => (
              <option key={ch.id} value={ch.id}>{ch.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Chapter info preview */}
      {fromChapter && toChapter && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
          <div style={{ padding: 10, background: '#eef2ff', borderRadius: 8, borderLeft: '3px solid #6366f1' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>前章</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{fromChapter.title}</div>
          </div>
          <div style={{ fontSize: 18, color: '#94a3b8' }}>&rarr;</div>
          <div style={{ padding: 10, background: '#f0fdf4', borderRadius: 8, borderLeft: '3px solid #22c55e' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>后章</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{toChapter.title}</div>
          </div>
        </div>
      )}

      {/* Transition type selector */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4, color: '#475569' }}>过渡类型</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TRANSITION_TYPES.map(tt => (
            <button
              key={tt.id}
              onClick={() => setTransitionType(tt.id)}
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                border: transitionType === tt.id ? `2px solid ${TYPE_COLORS[tt.name] || '#6366f1'}` : '1px solid #e2e8f0',
                background: transitionType === tt.id ? `${TYPE_COLORS[tt.name] || '#6366f1'}18` : '#f9f9f9',
                color: transitionType === tt.id ? (TYPE_COLORS[tt.name] || '#6366f1') : '#666',
                fontWeight: transitionType === tt.id ? 600 : 400,
              }}
              title={tt.desc}
            >
              {tt.name}
            </button>
          ))}
        </div>
      </div>

      {/* Length selector */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4, color: '#475569' }}>段落长度</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {LENGTH_OPTIONS.map(lo => (
            <button
              key={lo.id}
              onClick={() => setLength(lo.id)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                border: length === lo.id ? '2px solid #6366f1' : '1px solid #e2e8f0',
                background: length === lo.id ? '#eef2ff' : '#f9f9f9',
                color: length === lo.id ? '#6366f1' : '#666',
                fontWeight: length === lo.id ? 600 : 400,
                textAlign: 'center',
              }}
            >
              <div>{lo.name}</div>
              <div style={{ fontSize: 10, color: '#999' }}>{lo.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={loading || !fromChapterId || !toChapterId}
        style={{
          padding: '10px 20px', borderRadius: 8, border: 'none',
          background: loading || !fromChapterId || !toChapterId ? '#ccc' : '#6366f1',
          color: '#fff', fontWeight: 600, fontSize: 14,
          cursor: loading || !fromChapterId || !toChapterId ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '生成中...' : '生成过渡段落'}
      </button>

      {error && (
        <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{error}</div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Transition analysis */}
          {result.transitionAnalysis && (
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>过渡分析</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ padding: 8, background: '#eef2ff', borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: '#888' }}>前章结尾氛围</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{result.transitionAnalysis.fromMood}</div>
                </div>
                <div style={{ padding: 8, background: '#f0fdf4', borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: '#888' }}>后章开头氛围</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{result.transitionAnalysis.toMood}</div>
                </div>
                <div style={{ padding: 8, background: '#fff', borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: '#888' }}>差距类型</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{result.transitionAnalysis.gapType}</div>
                </div>
                <div style={{ padding: 8, background: '#fff', borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: '#888' }}>推荐过渡类型</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#6366f1' }}>{result.transitionAnalysis.recommendedType}</div>
                </div>
              </div>
              {result.transitionAnalysis.gapDescription && (
                <div style={{ marginTop: 8, padding: 8, background: '#fffbeb', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
                  {result.transitionAnalysis.gapDescription}
                </div>
              )}
            </div>
          )}

          {/* Transition options */}
          {result.transitions?.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>过渡方案</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.transitions.map((t: TransitionOption, i: number) => {
                  const isExpanded = selectedTransition === i;
                  const typeColor = TYPE_COLORS[t.type] || '#6366f1';
                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedTransition(isExpanded ? null : i)}
                      style={{
                        padding: 12, background: '#fff', borderRadius: 8,
                        border: `1px solid ${isExpanded ? typeColor : '#e2e8f0'}`,
                        cursor: 'pointer',
                        boxShadow: isExpanded ? `0 2px 8px ${typeColor}20` : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isExpanded ? 8 : 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                            background: `${typeColor}18`, color: typeColor,
                          }}>{t.type}</span>
                          <span style={{ fontSize: 11, color: '#888' }}>{t.tone}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: '#888' }}>{t.wordCount}字</span>
                          <span style={{ fontSize: 10, color: '#bbb' }}>{isExpanded ? '收起' : '展开'}</span>
                        </div>
                      </div>
                      {isExpanded && (
                        <div>
                          <div style={{
                            padding: 12, background: '#f8fafc', borderRadius: 6,
                            fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap',
                            borderLeft: `3px solid ${typeColor}`,
                          }}>
                            {t.text}
                          </div>
                          {t.techniquesUsed?.length > 0 && (
                            <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {t.techniquesUsed.map((tech, j) => (
                                <span key={j} style={{
                                  padding: '2px 8px', borderRadius: 4, fontSize: 11,
                                  background: '#f1f5f9', color: '#64748b',
                                }}>{tech}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tips */}
          {result.tips?.length > 0 && (
            <div style={{ padding: 12, background: '#fffbeb', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>过渡写作技巧</h4>
              {result.tips.map((tip, i) => (
                <div key={i} style={{
                  padding: '6px 10px', background: '#fff', borderRadius: 4,
                  marginBottom: 4, fontSize: 12, borderLeft: '3px solid #eab308',
                }}>
                  {tip}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
