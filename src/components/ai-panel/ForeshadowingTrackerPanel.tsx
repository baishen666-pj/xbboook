// @ts-nocheck
import { useState } from 'react';
import {
  foreshadowingTrackerService,
  type DetectResult,
  type HealthResult,
  type SuggestResult,
} from '@/services/foreshadowingTrackerService';

interface Props {
  projectId: string;
}

type TabMode = 'detect' | 'health' | 'suggest';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  planted: { label: '已种植', color: '#6366f1', bg: '#eef2ff' },
  resolved: { label: '已回收', color: '#16a34a', bg: '#f0fdf4' },
  partially_resolved: { label: '部分回收', color: '#d97706', bg: '#fffbeb' },
  abandoned: { label: '已放弃', color: '#dc2626', bg: '#fef2f2' },
};

const IMPORTANCE_MAP: Record<string, { label: string; color: string; bg: string }> = {
  major: { label: '重要', color: '#dc2626', bg: '#fef2f2' },
  minor: { label: '次要', color: '#6366f1', bg: '#eef2ff' },
  background: { label: '背景', color: '#888', bg: '#f5f5f5' },
};

const SEVERITY_MAP: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: '严重', color: '#dc2626', bg: '#fef2f2' },
  medium: { label: '中等', color: '#d97706', bg: '#fffbeb' },
  low: { label: '轻微', color: '#16a34a', bg: '#f0fdf4' },
};

function ScoreBar({ value, max = 100, color = '#6366f1', label }: { value: number; max?: number; color?: string; label?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      {label && <span style={{ minWidth: 50, color: '#666' }}>{label}</span>}
      <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <span style={{ minWidth: 28, textAlign: 'right', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function TimelineChart({ timeline }: { timeline: HealthResult['timeline'] }) {
  if (!timeline || timeline.length === 0) return null;
  const maxOpen = Math.max(...timeline.map(t => t.open_count), 1);
  const w = 600;
  const h = 160;
  const padL = 40;
  const padR = 20;
  const padT = 20;
  const padB = 30;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const barW = Math.min(20, chartW / timeline.length - 4);

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: w }}>
      {/* Y axis labels */}
      {[0, maxOpen / 2, maxOpen].map((v, i) => {
        const y = padT + chartH - (v / maxOpen) * chartH;
        return (
          <g key={i}>
            <text x={padL - 6} y={y + 4} textAnchor="end" fill="#999" fontSize={10}>{Math.round(v)}</text>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#e5e7eb" strokeDasharray="3,3" />
          </g>
        );
      })}
      {/* Bars for planted and resolved */}
      {timeline.map((t, i) => {
        const x = padL + (i / timeline.length) * chartW + (chartW / timeline.length) / 2;
        const plantedH = (t.planted / maxOpen) * chartH;
        const resolvedH = (t.resolved / maxOpen) * chartH;
        const openH = (t.open_count / maxOpen) * chartH;
        const baseY = padT + chartH;
        return (
          <g key={i}>
            {/* Open count bar */}
            <rect x={x - barW / 2} y={baseY - openH} width={barW} height={openH} fill="#e0e7ff" rx={2} />
            {/* Planted marker */}
            <rect x={x - barW / 2 - 2} y={baseY - plantedH} width={3} height={plantedH} fill="#6366f1" rx={1} />
            {/* Resolved marker */}
            <rect x={x + barW / 2 - 1} y={baseY - resolvedH} width={3} height={resolvedH} fill="#16a34a" rx={1} />
            {/* Chapter label */}
            <text x={x} y={baseY + 14} textAnchor="middle" fill="#666" fontSize={9}>Ch{t.chapter}</text>
          </g>
        );
      })}
      {/* Legend */}
      <rect x={w - padR - 140} y={4} width={8} height={8} fill="#6366f1" rx={1} />
      <text x={w - padR - 128} y={12} fill="#666" fontSize={9}>种植</text>
      <rect x={w - padR - 90} y={4} width={8} height={8} fill="#16a34a" rx={1} />
      <text x={w - padR - 78} y={12} fill="#666" fontSize={9}>回收</text>
      <rect x={w - padR - 40} y={4} width={8} height={8} fill="#e0e7ff" rx={1} />
      <text x={w - padR - 28} y={12} fill="#666" fontSize={9}>未结</text>
    </svg>
  );
}

export function ForeshadowingTrackerPanel({ projectId }: Props) {
  const [tab, setTab] = useState<TabMode>('detect');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectResult, setDetectResult] = useState<DetectResult | null>(null);
  const [healthResult, setHealthResult] = useState<HealthResult | null>(null);
  const [suggestResult, setSuggestResult] = useState<SuggestResult | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleTrack = async () => {
    setLoading(true);
    setError(null);
    const res = await foreshadowingTrackerService.track(projectId, { mode: tab });
    if (res.success && res.data) {
      if (tab === 'detect') setDetectResult(res.data as DetectResult);
      else if (tab === 'health') setHealthResult(res.data as HealthResult);
      else setSuggestResult(res.data as SuggestResult);
    } else {
      setError(res.error || '分析失败');
    }
    setLoading(false);
  };

  const currentResult = tab === 'detect' ? detectResult : tab === 'health' ? healthResult : suggestResult;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>🧵 伏笔追踪</h3>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {[
          { id: 'detect' as TabMode, name: '检测', icon: '🔍' },
          { id: 'health' as TabMode, name: '健康度', icon: '💊' },
          { id: 'suggest' as TabMode, name: '回收建议', icon: '💡' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setError(null); }}
            style={{
              flex: 1, padding: '8px 4px', border: tab === t.id ? '2px solid #6366f1' : '1px solid #ddd',
              borderRadius: 8, background: tab === t.id ? '#eef2ff' : '#fff', cursor: 'pointer', textAlign: 'center', fontSize: 12,
            }}
          >
            <div style={{ fontSize: 18 }}>{t.icon}</div>
            <div style={{ fontWeight: 500 }}>{t.name}</div>
          </button>
        ))}
      </div>

      <button
        onClick={handleTrack}
        disabled={loading}
        style={{
          padding: '10px 20px', borderRadius: 8, border: 'none', background: loading ? '#ccc' : '#6366f1',
          color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '分析中...' : '开始分析'}
      </button>

      {error && <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{error}</div>}

      {/* Detect mode */}
      {tab === 'detect' && detectResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Statistics summary */}
          <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>统计数据</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              <div style={{ padding: '6px 8px', background: '#fff', borderRadius: 4, textAlign: 'center', fontSize: 12 }}>
                <div style={{ color: '#888' }}>总计</div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{detectResult.statistics.total}</div>
              </div>
              <div style={{ padding: '6px 8px', background: '#f0fdf4', borderRadius: 4, textAlign: 'center', fontSize: 12 }}>
                <div style={{ color: '#16a34a' }}>已回收</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: '#16a34a' }}>{detectResult.statistics.resolved}</div>
              </div>
              <div style={{ padding: '6px 8px', background: '#eef2ff', borderRadius: 4, textAlign: 'center', fontSize: 12 }}>
                <div style={{ color: '#6366f1' }}>待回收</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: '#6366f1' }}>{detectResult.statistics.planted}</div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <ScoreBar label="回收率" value={detectResult.statistics.resolution_rate} color="#16a34a" />
              <div style={{ marginTop: 4 }}>
                <ScoreBar label="满意度" value={detectResult.statistics.avg_satisfaction} color="#6366f1" />
              </div>
            </div>
          </div>

          {/* Foreshadowing list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {detectResult.foreshadowings.map((f) => {
              const statusInfo = STATUS_MAP[f.status] || STATUS_MAP.planted;
              const impInfo = IMPORTANCE_MAP[f.importance] || IMPORTANCE_MAP.background;
              const isExpanded = expandedId === f.id;
              return (
                <div key={f.id} style={{ padding: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer' }}
                  onClick={() => setExpandedId(isExpanded ? null : f.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{f.title}</span>
                      <span style={{ padding: '2px 6px', borderRadius: 10, fontSize: 10, color: statusInfo.color, background: statusInfo.bg }}>{statusInfo.label}</span>
                      <span style={{ padding: '2px 6px', borderRadius: 10, fontSize: 10, color: impInfo.color, background: impInfo.bg }}>{impInfo.label}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#888' }}>第{f.plant_chapter}章种植</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>{f.description}</div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                    <ScoreBar label="巧妙度" value={f.subtlety} color="#6366f1" />
                    <ScoreBar label="满意度" value={f.satisfaction} color="#16a34a" />
                  </div>
                  {isExpanded && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb', fontSize: 12, color: '#555', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div><strong>种植细节：</strong>{f.plant_detail}</div>
                      <div><strong>伏笔技巧：</strong>{f.technique_name} ({f.technique})</div>
                      {f.resolve_detail && <div><strong>回收方式：</strong>{f.resolve_detail}</div>}
                      {f.resolve_chapter && <div><strong>回收章节：</strong>第{f.resolve_chapter}章</div>}
                      {f.related_plot_thread && <div><strong>关联剧情：</strong>{f.related_plot_thread}</div>}
                      {f.tags && f.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {f.tags.map((tag, i) => (
                            <span key={i} style={{ padding: '1px 6px', borderRadius: 8, background: '#f3f4f6', fontSize: 11 }}>{tag}</span>
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

      {/* Health mode */}
      {tab === 'health' && healthResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Health score */}
          <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 40, fontWeight: 700, color: healthResult.health_score >= 80 ? '#16a34a' : healthResult.health_score >= 60 ? '#d97706' : '#dc2626' }}>
              {healthResult.health_score}
            </div>
            <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
              {healthResult.status === 'good' ? '状态良好' : healthResult.status === 'warning' ? '需要关注' : '存在风险'}
            </div>
          </div>

          {/* Timeline chart */}
          {healthResult.timeline && healthResult.timeline.length > 0 && (
            <div style={{ padding: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>伏笔时间线</h4>
              <TimelineChart timeline={healthResult.timeline} />
            </div>
          )}

          {/* Issues */}
          {healthResult.issues && healthResult.issues.length > 0 && (
            <div style={{ padding: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>问题列表</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {healthResult.issues.map((issue, i) => {
                  const sevInfo = SEVERITY_MAP[issue.severity] || SEVERITY_MAP.medium;
                  return (
                    <div key={i} style={{ padding: 8, background: sevInfo.bg, borderRadius: 6, fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ padding: '1px 6px', borderRadius: 8, background: sevInfo.color, color: '#fff', fontSize: 10, fontWeight: 500 }}>{sevInfo.label}</span>
                        <span style={{ fontWeight: 500 }}>{issue.type}</span>
                      </div>
                      <div style={{ color: '#555' }}>{issue.description}</div>
                      <div style={{ color: '#16a34a', marginTop: 2 }}>{issue.suggestion}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Balance analysis */}
          {healthResult.balance_analysis && (
            <div style={{ padding: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>平衡分析</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
                <div style={{ padding: 6, background: '#f8fafc', borderRadius: 4 }}>
                  <span style={{ color: '#888' }}>种植节奏：</span>{healthResult.balance_analysis.planting_rhythm}
                </div>
                <div style={{ padding: 6, background: '#f8fafc', borderRadius: 4 }}>
                  <span style={{ color: '#888' }}>回收节奏：</span>{healthResult.balance_analysis.resolution_rhythm}
                </div>
                <div style={{ padding: 6, background: '#f8fafc', borderRadius: 4, gridColumn: '1 / -1' }}>
                  <span style={{ color: '#888' }}>张力曲线：</span>{healthResult.balance_analysis.tension_curve}
                </div>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {healthResult.recommendations && healthResult.recommendations.length > 0 && (
            <div style={{ padding: 12, background: '#fffbeb', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>改进建议</h4>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                {healthResult.recommendations.map((r, i) => (
                  <li key={i} style={{ marginBottom: 2 }}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Suggest mode */}
      {tab === 'suggest' && suggestResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Unresolved foreshadowings with suggestions */}
          {suggestResult.unresolved && suggestResult.unresolved.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>未回收伏笔回收建议</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {suggestResult.unresolved.map((uf) => (
                  <div key={uf.id} style={{ padding: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{uf.title}</span>
                      <span style={{ fontSize: 11, color: '#888' }}>第{uf.plant_chapter}章种植</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {uf.suggestions.map((s, si) => (
                        <div key={si} style={{ padding: 8, background: '#f8fafc', borderRadius: 6, fontSize: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontWeight: 500 }}>{s.method}</span>
                            <span style={{ padding: '1px 6px', borderRadius: 8, fontSize: 10, color: s.difficulty === 'easy' ? '#16a34a' : s.difficulty === 'medium' ? '#d97706' : '#dc2626', background: s.difficulty === 'easy' ? '#f0fdf4' : s.difficulty === 'medium' ? '#fffbeb' : '#fef2f2' }}>
                              {s.difficulty === 'easy' ? '简单' : s.difficulty === 'medium' ? '中等' : '困难'}
                            </span>
                          </div>
                          <div style={{ color: '#666', marginBottom: 2 }}><strong>时机：</strong>{s.timing}</div>
                          <div style={{ color: '#666', marginBottom: 2 }}><strong>影响：</strong>{s.impact}</div>
                          {s.sample_text && (
                            <div style={{ marginTop: 4, padding: 6, background: '#eef2ff', borderRadius: 4, fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: '#444' }}>{s.sample_text}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New opportunities */}
          {suggestResult.new_opportunities && suggestResult.new_opportunities.length > 0 && (
            <div style={{ padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>新伏笔种植机会</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {suggestResult.new_opportunities.map((op, i) => (
                  <div key={i} style={{ padding: 8, background: '#fff', borderRadius: 6, fontSize: 12 }}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>{op.description}</div>
                    <div style={{ color: '#666', fontSize: 11 }}>建议章节：第{op.suggested_chapter}章 | 目的：{op.purpose}</div>
                    {op.sample_text && (
                      <div style={{ marginTop: 4, padding: 6, background: '#eef2ff', borderRadius: 4, fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: '#444' }}>{op.sample_text}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weaving tips */}
          {suggestResult.weaving_tips && suggestResult.weaving_tips.length > 0 && (
            <div style={{ padding: 12, background: '#fffbeb', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>伏笔编织技巧</h4>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                {suggestResult.weaving_tips.map((tip, i) => (
                  <li key={i} style={{ marginBottom: 2 }}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
