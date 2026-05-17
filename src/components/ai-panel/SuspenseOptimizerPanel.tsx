// @ts-nocheck
import { useState } from 'react';
import {
  suspenseOptimizerService,
  type AnalyzeResult,
  type OptimizeResult,
  type TechniquesResult,
} from '@/services/suspenseOptimizerService';

interface Props {
  projectId: string;
}

type TabMode = 'analyze' | 'optimize' | 'techniques';

const DIFFICULTY_MAP: Record<string, { label: string; color: string; bg: string }> = {
  easy: { label: '简单', color: '#16a34a', bg: '#f0fdf4' },
  medium: { label: '中等', color: '#d97706', bg: '#fffbeb' },
  hard: { label: '困难', color: '#dc2626', bg: '#fef2f2' },
};

function TensionChart({ curve }: { curve: AnalyzeResult['suspense_curve'] }) {
  if (!curve || curve.length === 0) return null;
  const maxTension = Math.max(...curve.map(c => c.tension), 10);
  const w = 640;
  const h = 200;
  const padL = 40;
  const padR = 20;
  const padT = 20;
  const padB = 36;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const points = curve.map((c, i) => ({
    x: padL + (i / Math.max(curve.length - 1, 1)) * chartW,
    y: padT + chartH - (c.tension / maxTension) * chartH,
    ...c,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${padT + chartH} L${points[0].x},${padT + chartH} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: w }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const y = padT + chartH * (1 - pct);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#e5e7eb" strokeDasharray="3,3" />
            <text x={padL - 6} y={y + 4} textAnchor="end" fill="#999" fontSize={10}>
              {Math.round(maxTension * pct)}
            </text>
          </g>
        );
      })}

      {/* Area fill */}
      <path d={areaPath} fill="url(#tensionGrad)" opacity={0.3} />
      <defs>
        <linearGradient id="tensionGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
        </linearGradient>
      </defs>

      {/* Line */}
      <path d={linePath} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinejoin="round" />

      {/* Points + labels */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="#6366f1" stroke="#fff" strokeWidth={2} />
          {curve.length <= 25 && (
            <text x={p.x} y={padT + chartH + 14} textAnchor="middle" fill="#666" fontSize={9}>
              Ch{p.chapter}
            </text>
          )}
        </g>
      ))}

      {/* Weak point markers */}
      <rect x={w - padR - 90} y={4} width={8} height={8} fill="#6366f1" rx={1} />
      <text x={w - padR - 78} y={12} fill="#666" fontSize={9}>张力值</text>
    </svg>
  );
}

function CompareBar({ current, optimized, chapter }: { current: number; optimized: number; chapter: number }) {
  const maxVal = Math.max(current, optimized, 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ minWidth: 40, color: '#666' }}>Ch{chapter}</span>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: '#ef4444', minWidth: 32 }}>当前</span>
          <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${(current / maxVal) * 100}%`, height: '100%', background: '#ef4444', borderRadius: 4, opacity: 0.6 }} />
          </div>
          <span style={{ minWidth: 24, textAlign: 'right', fontWeight: 600, fontSize: 11 }}>{current}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: '#16a34a', minWidth: 32 }}>优化</span>
          <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${(optimized / maxVal) * 100}%`, height: '100%', background: '#16a34a', borderRadius: 4 }} />
          </div>
          <span style={{ minWidth: 24, textAlign: 'right', fontWeight: 600, fontSize: 11, color: '#16a34a' }}>{optimized}</span>
        </div>
      </div>
    </div>
  );
}

export function SuspenseOptimizerPanel({ projectId }: Props) {
  const [tab, setTab] = useState<TabMode>('analyze');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(null);
  const [techniquesResult, setTechniquesResult] = useState<TechniquesResult | null>(null);
  const [expandedChapter, setExpandedChapter] = useState<number | null>(null);

  const handleOptimize = async () => {
    setLoading(true);
    setError(null);
    const res = await suspenseOptimizerService.optimize(projectId, { mode: tab });
    if (res.success && res.data) {
      if (tab === 'analyze') setAnalyzeResult(res.data as AnalyzeResult);
      else if (tab === 'optimize') setOptimizeResult(res.data as OptimizeResult);
      else setTechniquesResult(res.data as TechniquesResult);
    } else {
      setError(res.error || '分析失败');
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>悬念节奏优化</h3>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {[
          { id: 'analyze' as TabMode, name: '悬念分析', icon: '📈' },
          { id: 'optimize' as TabMode, name: '优化方案', icon: '⚡' },
          { id: 'techniques' as TabMode, name: '悬念技巧库', icon: '📚' },
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
        onClick={handleOptimize}
        disabled={loading}
        style={{
          padding: '10px 20px', borderRadius: 8, border: 'none', background: loading ? '#ccc' : '#6366f1',
          color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '分析中...' : '开始分析'}
      </button>

      {error && <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{error}</div>}

      {/* Analyze mode */}
      {tab === 'analyze' && analyzeResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Overall assessment */}
          <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>整体评估</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              <div style={{ padding: '8px 10px', background: '#eef2ff', borderRadius: 6, textAlign: 'center' }}>
                <div style={{ color: '#6366f1', fontSize: 11 }}>悬念评分</div>
                <div style={{ fontWeight: 700, fontSize: 22, color: '#6366f1' }}>{analyzeResult.overall_assessment.suspense_score}</div>
              </div>
              <div style={{ padding: '8px 10px', background: '#f0fdf4', borderRadius: 6, textAlign: 'center' }}>
                <div style={{ color: '#16a34a', fontSize: 11 }}>持续吸引力</div>
                <div style={{ fontWeight: 700, fontSize: 22, color: '#16a34a' }}>{analyzeResult.overall_assessment.sustained_interest}</div>
              </div>
              <div style={{ padding: '8px 10px', background: '#fffbeb', borderRadius: 6, textAlign: 'center' }}>
                <div style={{ color: '#d97706', fontSize: 11 }}>高潮效果</div>
                <div style={{ fontWeight: 700, fontSize: 22, color: '#d97706' }}>{analyzeResult.overall_assessment.climax_effectiveness}</div>
              </div>
              <div style={{ padding: '8px 10px', background: '#fff', borderRadius: 6, textAlign: 'center', border: '1px solid #e5e7eb' }}>
                <div style={{ color: '#666', fontSize: 11 }}>张弛节奏</div>
                <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4, lineHeight: 1.3 }}>{analyzeResult.overall_assessment.tension_rhythm}</div>
              </div>
            </div>
          </div>

          {/* Tension curve chart */}
          {analyzeResult.suspense_curve.length > 0 && (
            <div style={{ padding: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>张力曲线</h4>
              <TensionChart curve={analyzeResult.suspense_curve} />
            </div>
          )}

          {/* Techniques used */}
          {analyzeResult.techniques_used.length > 0 && (
            <div style={{ padding: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>已使用悬念技巧</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {analyzeResult.techniques_used.map((t, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#f8fafc', borderRadius: 6, fontSize: 12 }}>
                    <div>
                      <span style={{ fontWeight: 500 }}>{t.name}</span>
                      <span style={{ color: '#888', marginLeft: 8 }}>第{t.chapters.join(', ')}章</span>
                    </div>
                    <span style={{ padding: '2px 8px', borderRadius: 10, background: t.effectiveness >= 80 ? '#f0fdf4' : t.effectiveness >= 60 ? '#fffbeb' : '#fef2f2', color: t.effectiveness >= 80 ? '#16a34a' : t.effectiveness >= 60 ? '#d97706' : '#dc2626', fontSize: 11, fontWeight: 600 }}>
                      {t.effectiveness}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weak points */}
          {analyzeResult.weak_points.length > 0 && (
            <div style={{ padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>薄弱环节</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {analyzeResult.weak_points.map((wp, i) => (
                  <div key={i} style={{ padding: 8, background: '#fff', borderRadius: 6, fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ padding: '2px 6px', borderRadius: 8, background: '#fef2f2', color: '#dc2626', fontSize: 10, fontWeight: 500 }}>第{wp.chapter}章</span>
                      <span style={{ fontWeight: 500 }}>{wp.issue}</span>
                    </div>
                    <div style={{ color: '#16a34a' }}>{wp.suggestion}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Peak moments */}
          {analyzeResult.peak_moments.length > 0 && (
            <div style={{ padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>高潮时刻</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {analyzeResult.peak_moments.map((pm, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: '#fff', borderRadius: 6, fontSize: 12 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 8, background: '#6366f1', color: '#fff', fontSize: 10, fontWeight: 600 }}>第{pm.chapter}章</span>
                    <span style={{ fontWeight: 500 }}>{pm.type}</span>
                    <span style={{ color: '#888' }}>- {pm.technique}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Optimize mode */}
      {tab === 'optimize' && optimizeResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Chapter optimizations with compare bars */}
          {optimizeResult.optimizations.length > 0 && (
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>逐章优化建议</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {optimizeResult.optimizations.map((opt) => {
                  const isExpanded = expandedChapter === opt.chapter;
                  return (
                    <div key={opt.chapter} style={{ padding: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer' }}
                      onClick={() => setExpandedChapter(isExpanded ? null : opt.chapter)}>
                      <CompareBar current={opt.current_tension} optimized={opt.optimized_tension} chapter={opt.chapter} />
                      {opt.reorder_suggestion && (
                        <div style={{ marginTop: 6, fontSize: 11, color: '#6366f1' }}>{opt.reorder_suggestion}</div>
                      )}
                      {isExpanded && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {/* Additions */}
                          {opt.additions.length > 0 && (
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 12, color: '#16a34a', marginBottom: 4 }}>建议添加：</div>
                              {opt.additions.map((a, ai) => (
                                <div key={ai} style={{ padding: 8, background: '#f0fdf4', borderRadius: 6, fontSize: 12, marginBottom: 4 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                    <span style={{ fontWeight: 500 }}>{a.technique}</span>
                                  </div>
                                  <div style={{ color: '#666' }}>{a.description}</div>
                                  {a.sample_text && (
                                    <div style={{ marginTop: 4, padding: 6, background: '#eef2ff', borderRadius: 4, fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: '#444' }}>{a.sample_text}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Removals */}
                          {opt.removals.length > 0 && (
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 12, color: '#dc2626', marginBottom: 4 }}>建议移除：</div>
                              {opt.removals.map((r, ri) => (
                                <div key={ri} style={{ padding: '4px 8px', background: '#fef2f2', borderRadius: 4, fontSize: 11, color: '#dc2626', marginBottom: 2 }}>{r}</div>
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

          {/* New hooks */}
          {optimizeResult.new_hooks.length > 0 && (
            <div style={{ padding: 12, background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>建议新增钩子</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {optimizeResult.new_hooks.map((hook, i) => (
                  <div key={i} style={{ padding: 8, background: '#fff', borderRadius: 6, fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ padding: '2px 6px', borderRadius: 8, background: '#6366f1', color: '#fff', fontSize: 10 }}>{hook.type}</span>
                      <span style={{ color: '#888', fontSize: 11 }}>{hook.position}</span>
                    </div>
                    <div style={{ color: '#444' }}>{hook.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline adjustments */}
          {optimizeResult.timeline_adjustments && (
            <div style={{ padding: 12, background: '#fffbeb', borderRadius: 8, fontSize: 13 }}>
              <strong>时间线调整：</strong>{optimizeResult.timeline_adjustments}
            </div>
          )}

          {/* Tips */}
          {optimizeResult.tips.length > 0 && (
            <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>优化技巧</h4>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                {optimizeResult.tips.map((tip, i) => (
                  <li key={i} style={{ marginBottom: 2 }}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Techniques mode */}
      {tab === 'techniques' && techniquesResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Applicable techniques */}
          {techniquesResult.applicable_techniques.length > 0 && (
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>适用悬念技巧</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {techniquesResult.applicable_techniques.map((tech, i) => {
                  const diffInfo = DIFFICULTY_MAP[tech.difficulty] || DIFFICULTY_MAP.medium;
                  return (
                    <div key={i} style={{ padding: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{tech.name}</span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ padding: '2px 6px', borderRadius: 8, background: diffInfo.bg, color: diffInfo.color, fontSize: 10, fontWeight: 500 }}>{diffInfo.label}</span>
                          <span style={{ padding: '2px 6px', borderRadius: 8, background: tech.expected_impact >= 80 ? '#f0fdf4' : '#fffbeb', color: tech.expected_impact >= 80 ? '#16a34a' : '#d97706', fontSize: 10, fontWeight: 600 }}>
                            影响 {tech.expected_impact}%
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{tech.description}</div>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                        适用章节：第{tech.applicable_chapters.join(', ')}章
                      </div>
                      <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>
                        <strong>实施方法：</strong>{tech.implementation}
                      </div>
                      {tech.example && (
                        <div style={{ marginTop: 4, padding: 8, background: '#eef2ff', borderRadius: 6, fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: '#444' }}>{tech.example}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Technique combinations */}
          {techniquesResult.technique_combinations.length > 0 && (
            <div style={{ padding: 12, background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>技巧组合建议</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {techniquesResult.technique_combinations.map((combo, i) => (
                  <div key={i} style={{ padding: 8, background: '#fff', borderRadius: 6, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>{combo.combo}</span>
                      <span style={{ fontSize: 11, color: '#888' }}>第{combo.chapters.join(', ')}章</span>
                    </div>
                    <div style={{ color: '#666' }}>{combo.effect}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Genre-specific tips */}
          {techniquesResult.genre_specific_tips.length > 0 && (
            <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>类型专属技巧</h4>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                {techniquesResult.genre_specific_tips.map((tip, i) => (
                  <li key={i} style={{ marginBottom: 2 }}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Advanced techniques */}
          {techniquesResult.advanced_techniques.length > 0 && (
            <div style={{ padding: 12, background: '#fffbeb', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>高级悬念技巧</h4>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                {techniquesResult.advanced_techniques.map((t, i) => (
                  <li key={i} style={{ marginBottom: 2 }}>{t}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Common mistakes */}
          {techniquesResult.common_mistakes.length > 0 && (
            <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>常见错误</h4>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                {techniquesResult.common_mistakes.map((m, i) => (
                  <li key={i} style={{ marginBottom: 2, color: '#dc2626' }}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
