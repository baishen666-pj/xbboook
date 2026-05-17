// @ts-nocheck
import { useState, useMemo } from 'react';
import { relationshipEvolutionService } from '@/services/relationshipEvolutionService';
import type { RelationshipEvolutionResult } from '@/services/relationshipEvolutionService';

interface Props {
  projectId: string;
}

const TYPE_COLORS: Record<string, string> = {
  '恋人': '#ec4899',
  '师徒': '#8b5cf6',
  '对手': '#ef4444',
  '盟友': '#22c55e',
  '亲人': '#f97316',
  '朋友': '#06b6d4',
  '仇敌': '#dc2626',
  '竞争': '#eab308',
};

const PAIR_COLORS = [
  '#6366f1', '#ec4899', '#22c55e', '#f97316', '#06b6d4',
  '#8b5cf6', '#ef4444', '#eab308', '#14b8a6', '#f43f5e',
];

function getTypeColor(type: string): string {
  return TYPE_COLORS[type] || '#6366f1';
}

export function RelationshipEvolutionPanel({ projectId }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RelationshipEvolutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [charA, setCharA] = useState('');
  const [charB, setCharB] = useState('');
  const [expandedPair, setExpandedPair] = useState<number | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setExpandedPair(null);

    const params: { characterPair?: string[] } = {};
    if (charA.trim() && charB.trim()) {
      params.characterPair = [charA.trim(), charB.trim()];
    }

    const res = await relationshipEvolutionService.analyze(projectId, params);
    if (res.success && res.data) setResult(res.data);
    else setError(res.error || '分析失败');
    setLoading(false);
  };

  const chartData = useMemo(() => {
    if (!result?.pairs?.length) return null;

    const allEvolution = result.pairs.flatMap(p => p.evolution);
    if (!allEvolution.length) return null;

    const maxChapter = Math.max(...allEvolution.map(e => e.chapter), 1);
    const width = 640;
    const height = 300;
    const padX = 50;
    const padY = 30;
    const plotW = width - padX * 2;
    const plotH = height - padY * 2;

    const toX = (ch: number) => padX + (ch / maxChapter) * plotW;
    const toY = (val: number) => padY + plotH - (val / 100) * plotH;

    const lines = result.pairs.map((pair, idx) => {
      if (!pair.evolution?.length) return null;
      const color = PAIR_COLORS[idx % PAIR_COLORS.length];
      const sorted = [...pair.evolution].sort((a, b) => a.chapter - b.chapter);
      const points = sorted.map(e => ({ x: toX(e.chapter), y: toY(e.intimacy), chapter: e.chapter, intimacy: e.intimacy, state: e.state, event: e.event }));
      const pathD = points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
        .join(' ');
      return { pair, color, points, pathD };
    }).filter(Boolean);

    const yTicks = [0, 25, 50, 75, 100];
    const chapterLabels = Array.from({ length: maxChapter }, (_, i) => i + 1);

    return { width, height, padX, padY, plotW, plotH, lines, yTicks, chapterLabels, maxChapter, toX, toY };
  }, [result]);

  const togglePair = (idx: number) => {
    setExpandedPair(prev => prev === idx ? null : idx);
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>🔄 角色关系演进</h3>

      {/* Character pair filter */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>角色对筛选（可选，留空分析全部）</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={charA}
            onChange={e => setCharA(e.target.value)}
            placeholder="角色A"
            style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, outline: 'none' }}
          />
          <span style={{ color: '#999', fontSize: 13 }}>与</span>
          <input
            value={charB}
            onChange={e => setCharB(e.target.value)}
            placeholder="角色B"
            style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, outline: 'none' }}
          />
        </div>
      </div>

      <button onClick={handleAnalyze} disabled={loading} style={{
        padding: '10px 20px', borderRadius: 8, border: 'none',
        background: loading ? '#ccc' : '#6366f1', color: '#fff', fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer',
      }}>{loading ? '分析中...' : '🔄 分析关系演进'}</button>

      {error && <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{error}</div>}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* SVG Relationship Timeline */}
          {chartData && (
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>关系变化时间线</h4>
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

                {/* Y axis label */}
                <text x={8} y={chartData.padY + chartData.plotH / 2} textAnchor="middle" fill="#94a3b8" fontSize={10}
                  transform={`rotate(-90, 8, ${chartData.padY + chartData.plotH / 2})`}>亲密度</text>

                {/* Chapter labels */}
                {chartData.chapterLabels
                  .filter((_, i) => chartData.maxChapter <= 20 || i % Math.ceil(chartData.maxChapter / 15) === 0)
                  .map(ch => (
                    <text key={ch} x={chartData.toX(ch)} y={chartData.height - 6} textAnchor="middle" fill="#64748b" fontSize={9}>
                      第{ch}章
                    </text>
                  ))}

                {/* Turning point markers */}
                {chartData.lines.map((line, lineIdx) => {
                  if (!line.pair.turningPoints?.length) return null;
                  return line.pair.turningPoints.map((tp, tpIdx) => (
                    <g key={`tp-${lineIdx}-${tpIdx}`}>
                      <line
                        x1={chartData.toX(tp.chapter)} y1={chartData.padY}
                        x2={chartData.toX(tp.chapter)} y2={chartData.padY + chartData.plotH}
                        stroke={line.color} strokeWidth={1} strokeDasharray="4 2" opacity={0.3}
                      />
                      <polygon
                        points={`${chartData.toX(tp.chapter)},${chartData.padY} ${chartData.toX(tp.chapter) - 4},${chartData.padY - 6} ${chartData.toX(tp.chapter) + 4},${chartData.padY - 6}`}
                        fill={line.color} opacity={0.6}
                      />
                    </g>
                  ));
                })}

                {/* Relationship lines */}
                {chartData.lines.map((line, i) => (
                  <g key={i}>
                    <path d={line.pathD} fill="none" stroke={line.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    {line.points.map((p, j) => (
                      <circle key={j} cx={p.x} cy={p.y} r={3.5} fill={line.color} stroke="#fff" strokeWidth={1.5}>
                        <title>{`${line.pair.characters.join(' & ')}\n第${p.chapter}章: ${p.state} (${p.intimacy})\n${p.event}`}</title>
                      </circle>
                    ))}
                  </g>
                ))}

                {/* Legend */}
                {chartData.lines.map((line, i) => (
                  <g key={`legend-${i}`} transform={`translate(${chartData.padX + i * 90}, ${chartData.padY - 16})`}>
                    <rect x={0} y={0} width={10} height={10} rx={2} fill={line.color} />
                    <text x={14} y={9} fill="#475569" fontSize={10}>{line.pair.characters.join('-')}</text>
                  </g>
                ))}
              </svg>
            </div>
          )}

          {/* Relationship Map Overview */}
          {result.relationshipMap && (
            <div style={{ padding: 12, background: '#eef2ff', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>关系地图概览</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ padding: 8, background: '#fff', borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: '#888' }}>关系对总数</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#6366f1' }}>{result.relationshipMap.totalPairs}</div>
                </div>
                <div style={{ padding: 8, background: '#fff', borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: '#888' }}>最有动态</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{result.relationshipMap.mostDynamic}</div>
                </div>
                <div style={{ padding: 8, background: '#fff', borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: '#888' }}>最稳定</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{result.relationshipMap.mostStable}</div>
                </div>
                <div style={{ padding: 8, background: '#fff', borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: '#888' }}>最高张力</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>{result.relationshipMap.tensionHotspot}</div>
                </div>
              </div>
            </div>
          )}

          {/* Pair detail cards */}
          {result.pairs?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>角色对详情</h4>
              {result.pairs.map((pair, idx) => {
                const isExpanded = expandedPair === idx;
                const typeColor = getTypeColor(pair.relationshipType);
                return (
                  <div key={idx} style={{ background: '#f8fafc', borderRadius: 8, overflow: 'hidden', border: `1px solid ${isExpanded ? typeColor : '#e2e8f0'}` }}>
                    {/* Header */}
                    <div
                      onClick={() => togglePair(idx)}
                      style={{
                        padding: '10px 12px', cursor: 'pointer', display: 'flex',
                        justifyContent: 'space-between', alignItems: 'center',
                        background: isExpanded ? `${typeColor}10` : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{pair.characters.join(' & ')}</span>
                        <span style={{
                          padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500,
                          background: `${typeColor}20`, color: typeColor,
                        }}>{pair.relationshipType}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: '#888' }}>动态 {pair.dynamicsScore}/100</span>
                        <span style={{ fontSize: 10, color: '#999', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>&#9660;</span>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {/* Current state & prediction */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div style={{ padding: 8, background: '#fff', borderRadius: 6 }}>
                            <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>当前状态</div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{pair.currentState}</div>
                          </div>
                          <div style={{ padding: 8, background: '#fff', borderRadius: 6 }}>
                            <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>预测方向</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#6366f1' }}>{pair.predictedDirection}</div>
                          </div>
                        </div>

                        {/* Dynamics score bar */}
                        <div style={{ padding: 8, background: '#fff', borderRadius: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: '#888' }}>关系动态指数</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: typeColor }}>{pair.dynamicsScore}/100</span>
                          </div>
                          <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pair.dynamicsScore}%`, background: typeColor, borderRadius: 3 }} />
                          </div>
                        </div>

                        {/* Evolution timeline */}
                        {pair.evolution?.length > 0 && (
                          <div style={{ padding: 8, background: '#fff', borderRadius: 6 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>关系演变轨迹</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {[...pair.evolution].sort((a, b) => a.chapter - b.chapter).map((ev, evIdx) => (
                                <div key={evIdx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                  <span style={{ minWidth: 50, color: '#6366f1', fontWeight: 500 }}>第{ev.chapter}章</span>
                                  <span style={{ padding: '1px 6px', borderRadius: 4, background: `${typeColor}15`, color: typeColor, fontSize: 11 }}>{ev.state}</span>
                                  <span style={{ color: '#888', fontSize: 11 }}>(亲密度 {ev.intimacy})</span>
                                  <span style={{ color: '#666', flex: 1 }}>{ev.event}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Turning points */}
                        {pair.turningPoints?.length > 0 && (
                          <div style={{ padding: 8, background: '#fff', borderRadius: 6 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, color: '#ef4444' }}>关系转折点</div>
                            {pair.turningPoints.map((tp, tpIdx) => (
                              <div key={tpIdx} style={{
                                padding: '6px 10px', background: '#fef2f2', borderRadius: 6,
                                marginBottom: tpIdx < pair.turningPoints.length - 1 ? 4 : 0,
                                fontSize: 12, borderLeft: `3px solid ${typeColor}`,
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                  <span style={{ fontWeight: 600 }}>第{tp.chapter}章</span>
                                  <span style={{ fontSize: 11, color: '#888' }}>{tp.fromState} → {tp.toState}</span>
                                </div>
                                <div style={{ color: '#666' }}>{tp.event}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Suggestions */}
          {result.suggestions?.length > 0 && (
            <div style={{ padding: 12, background: '#fffbeb', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>关系发展建议</h4>
              {result.suggestions.map((s, i) => (
                <div key={i} style={{
                  padding: '8px 10px', background: '#fff', borderRadius: 6,
                  marginBottom: i < result.suggestions.length - 1 ? 6 : 0,
                  fontSize: 12, borderLeft: '3px solid #eab308',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, color: '#6366f1' }}>{s.pair}</span>
                    <span style={{ fontSize: 11, color: '#888' }}>建议时机: {s.timing}</span>
                  </div>
                  <div style={{ color: '#666' }}>{s.suggestion}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
