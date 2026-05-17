// @ts-nocheck
import { useState, useMemo } from 'react';
import { emotionJourneyService } from '@/services/emotionJourneyService';
import type { EmotionJourneyResult } from '@/services/emotionJourneyService';

interface Props {
  projectId: string;
}

const EMOTION_OPTIONS = [
  { id: 'tension', name: '紧张', color: '#ef4444' },
  { id: 'joy', name: '喜悦', color: '#22c55e' },
  { id: 'sadness', name: '悲伤', color: '#3b82f6' },
  { id: 'anger', name: '愤怒', color: '#f97316' },
  { id: 'fear', name: '恐惧', color: '#a855f7' },
  { id: 'surprise', name: '惊讶', color: '#eab308' },
  { id: 'anticipation', name: '期待', color: '#06b6d4' },
  { id: 'trust', name: '信任', color: '#6b7280' },
] as const;

const RISK_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#eab308',
  high: '#ef4444',
};

export function EmotionJourneyPanel({ projectId }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmotionJourneyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>(['tension', 'joy', 'sadness', 'anticipation']);

  const toggleEmotion = (id: string) => {
    setSelectedEmotions(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : prev.length < 6 ? [...prev, id] : prev
    );
  };

  const handleMap = async () => {
    if (selectedEmotions.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const res = await emotionJourneyService.map(projectId, { emotions: selectedEmotions });
    if (res.success && res.data) setResult(res.data);
    else setError(res.error || '分析失败');
    setLoading(false);
  };

  const chartData = useMemo(() => {
    if (!result?.journeyData?.length) return null;
    const chapters = result.journeyData;
    const width = 600;
    const height = 280;
    const padX = 50;
    const padY = 30;
    const plotW = width - padX * 2;
    const plotH = height - padY * 2;

    const xStep = chapters.length > 1 ? plotW / (chapters.length - 1) : plotW;
    const toX = (i: number) => padX + i * xStep;
    const toY = (v: number) => padY + plotH - (v / 100) * plotH;

    const activeEmotions = EMOTION_OPTIONS.filter(e => selectedEmotions.includes(e.id));

    const lines = activeEmotions.map(em => {
      const points = chapters.map((ch, i) => {
        const val = ch.emotions[em.id] ?? 0;
        return { x: toX(i), y: toY(val) };
      });
      const pathD = points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
        .join(' ');
      return { emotion: em, points, pathD };
    });

    const yTicks = [0, 25, 50, 75, 100];
    return { width, height, padX, padY, plotW, plotH, chapters, lines, toX, toY, yTicks, xStep };
  }, [result, selectedEmotions]);

  const weakSpotChapterSet = useMemo(() => {
    if (!result?.weakSpots) return new Set<number>();
    return new Set(result.weakSpots.map(w => w.chapter));
  }, [result]);

  const powerMomentChapterSet = useMemo(() => {
    if (!result?.powerMoments) return new Set<number>();
    return new Set(result.powerMoments.map(p => p.chapter));
  }, [result]);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>🌈 情感旅程映射</h3>

      {/* Emotion selector */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>情感维度（最多6个）</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {EMOTION_OPTIONS.map(em => {
            const active = selectedEmotions.includes(em.id);
            return (
              <button key={em.id} onClick={() => toggleEmotion(em.id)} style={{
                padding: '4px 10px', borderRadius: 12, fontSize: 12, cursor: 'pointer',
                border: active ? `2px solid ${em.color}` : '1px solid #ddd',
                background: active ? `${em.color}18` : '#f9f9f9',
                color: active ? em.color : '#666',
                fontWeight: active ? 600 : 400,
              }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: em.color, marginRight: 4, verticalAlign: 'middle' }} />
                {em.name}
              </button>
            );
          })}
        </div>
      </div>

      <button onClick={handleMap} disabled={loading || selectedEmotions.length === 0} style={{
        padding: '10px 20px', borderRadius: 8, border: 'none',
        background: loading ? '#ccc' : '#6366f1', color: '#fff', fontWeight: 600,
        cursor: loading || selectedEmotions.length === 0 ? 'not-allowed' : 'pointer',
      }}>{loading ? '分析中...' : '🌈 映射情感旅程'}</button>

      {error && <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{error}</div>}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* SVG Emotion Journey Chart */}
          {chartData && (
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>情感旅程曲线</h4>
              <svg viewBox={`0 0 ${chartData.width} ${chartData.height}`} style={{ width: '100%', height: 'auto' }}>
                {/* Background grid */}
                {chartData.yTicks.map(tick => {
                  const y = chartData.padY + chartData.plotH - (tick / 100) * chartData.plotH;
                  return (
                    <g key={tick}>
                      <line x1={chartData.padX} y1={y} x2={chartData.padX + chartData.plotW} y2={y} stroke="#e2e8f0" strokeWidth={1} />
                      <text x={chartData.padX - 8} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize={10}>{tick}</text>
                    </g>
                  );
                })}

                {/* Chapter labels */}
                {chartData.chapters.map((ch, i) => (
                  <text key={i} x={chartData.toX(i)} y={chartData.height - 6} textAnchor="middle" fill="#64748b" fontSize={9}>
                    {chartData.chapters.length <= 15 ? `第${ch.chapter}章` : (i % Math.ceil(chartData.chapters.length / 15) === 0 ? `第${ch.chapter}章` : '')}
                  </text>
                ))}

                {/* Weak spot and power moment markers */}
                {chartData.chapters.map((ch, i) => {
                  const isWeak = weakSpotChapterSet.has(ch.chapter);
                  const isPower = powerMomentChapterSet.has(ch.chapter);
                  if (!isWeak && !isPower) return null;
                  return (
                    <g key={`marker-${i}`}>
                      <line x1={chartData.toX(i)} y1={chartData.padY} x2={chartData.toX(i)} y2={chartData.padY + chartData.plotH}
                        stroke={isWeak ? '#ef4444' : '#22c55e'} strokeWidth={1} strokeDasharray="4 2" opacity={0.4} />
                    </g>
                  );
                })}

                {/* Emotion lines */}
                {chartData.lines.map(({ emotion, pathD, points }) => (
                  <g key={emotion.id}>
                    <path d={pathD} fill="none" stroke={emotion.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    {points.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={emotion.color} stroke="#fff" strokeWidth={1.5} />
                    ))}
                  </g>
                ))}

                {/* Legend */}
                {chartData.lines.map(({ emotion }, i) => (
                  <g key={`legend-${emotion.id}`} transform={`translate(${chartData.padX + i * 70}, ${chartData.padY - 16})`}>
                    <rect x={0} y={0} width={10} height={10} rx={2} fill={emotion.color} />
                    <text x={14} y={9} fill="#475569" fontSize={10}>{emotion.name}</text>
                  </g>
                ))}
              </svg>
            </div>
          )}

          {/* Emotional Arc Overview */}
          {result.emotionalArc && (
            <div style={{ padding: 12, background: '#eef2ff', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>情感弧线概览</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ padding: 8, background: '#fff', borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: '#888' }}>弧线模式</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{result.emotionalArc.pattern}</div>
                </div>
                <div style={{ padding: 8, background: '#fff', borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: '#888' }}>效果评分</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{result.emotionalArc.effectiveness}/100</div>
                </div>
                <div style={{ padding: 8, background: '#fff', borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: '#888' }}>单调风险</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: RISK_COLORS[result.emotionalArc.monotonyRisk] || '#666' }}>
                    {result.emotionalArc.monotonyRisk === 'low' ? '低' : result.emotionalArc.monotonyRisk === 'medium' ? '中' : '高'}
                  </div>
                </div>
                <div style={{ padding: 8, background: '#fff', borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: '#888' }}>情感范围</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{result.emotionalArc.emotionalRange}</div>
                </div>
              </div>
            </div>
          )}

          {/* Weak Spots */}
          {result.weakSpots?.length > 0 && (
            <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, color: '#dc2626' }}>情感薄弱点</h4>
              {result.weakSpots.map((ws, i) => (
                <div key={i} style={{ padding: '8px 10px', background: '#fff', borderRadius: 6, marginBottom: 6, fontSize: 12, borderLeft: '3px solid #ef4444' }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>第{ws.chapter}章</div>
                  <div style={{ color: '#666', marginBottom: 2 }}>{ws.issue}</div>
                  <div style={{ color: '#16a34a', fontSize: 11 }}>{ws.suggestion}</div>
                </div>
              ))}
            </div>
          )}

          {/* Power Moments */}
          {result.powerMoments?.length > 0 && (
            <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, color: '#16a34a' }}>情感高光时刻</h4>
              {result.powerMoments.map((pm, i) => {
                const emMeta = EMOTION_OPTIONS.find(e => e.id === pm.emotion);
                return (
                  <div key={i} style={{ padding: '8px 10px', background: '#fff', borderRadius: 6, marginBottom: 6, fontSize: 12, borderLeft: `3px solid ${emMeta?.color || '#22c55e'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontWeight: 600 }}>第{pm.chapter}章</span>
                      <span style={{ fontSize: 11, color: '#888' }}>强度 {pm.intensity}/100</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: emMeta?.color || '#22c55e' }} />
                      <span style={{ color: '#666' }}>{emMeta?.name || pm.emotion}</span>
                    </div>
                    <div style={{ color: '#6366f1', fontSize: 11 }}>{pm.technique}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Optimization Suggestions */}
          {result.optimization && (
            <div style={{ padding: 12, background: '#fffbeb', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>优化建议</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div style={{ padding: 8, background: '#fff', borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#888' }}>多样性</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#6366f1' }}>{result.optimization.emotionalDiversityScore}</div>
                </div>
                <div style={{ padding: 8, background: '#fff', borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#888' }}>过渡平滑度</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#6366f1' }}>{result.optimization.transitionSmoothness}</div>
                </div>
                <div style={{ padding: 8, background: '#fff', borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#888' }}>峰谷比</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#6366f1' }}>{result.optimization.peakValleyRatio}</div>
                </div>
              </div>
              {result.optimization.suggestions?.length > 0 && (
                <div>
                  {result.optimization.suggestions.map((s, i) => (
                    <div key={i} style={{ padding: '6px 10px', background: '#fff', borderRadius: 4, marginBottom: 4, fontSize: 12, borderLeft: '3px solid #eab308' }}>
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Journey detail table */}
          {result.journeyData?.length > 0 && (
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>章节情感详情</h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: 6, borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>章节</th>
                      <th style={{ padding: 6, borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>主导情感</th>
                      <th style={{ padding: 6, borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>情感高峰</th>
                      <th style={{ padding: 6, borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>过渡类型</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.journeyData.map((jd, i) => {
                      const domEm = EMOTION_OPTIONS.find(e => e.id === jd.dominantEmotion);
                      const isWeak = weakSpotChapterSet.has(jd.chapter);
                      const isPower = powerMomentChapterSet.has(jd.chapter);
                      return (
                        <tr key={i} style={{ background: isWeak ? '#fef2f2' : isPower ? '#f0fdf4' : 'transparent' }}>
                          <td style={{ padding: 6, borderBottom: '1px solid #f1f5f9', fontWeight: 500 }}>
                            第{jd.chapter}章
                            {isWeak && <span style={{ marginLeft: 4, color: '#ef4444', fontSize: 10 }}>&#9660;</span>}
                            {isPower && <span style={{ marginLeft: 4, color: '#22c55e', fontSize: 10 }}>&#9733;</span>}
                          </td>
                          <td style={{ padding: 6, borderBottom: '1px solid #f1f5f9' }}>
                            {domEm && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: domEm.color }} />
                                {domEm.name}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: 6, borderBottom: '1px solid #f1f5f9', color: '#666' }}>{jd.emotionalPeak}</td>
                          <td style={{ padding: 6, borderBottom: '1px solid #f1f5f9', color: '#888' }}>{jd.transitionType}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
