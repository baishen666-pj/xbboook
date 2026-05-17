// @ts-nocheck
import { useState } from 'react';
import { themeAnalysisService } from '@/services/themeAnalysisService';
import type { ThemeAnalysisResult } from '@/services/themeAnalysisService';

interface Props {
  projectId: string;
}

const DEPTH_OPTIONS = [
  { id: 'surface', name: '表层', desc: '快速识别主要主题', color: '#22c55e' },
  { id: 'deep', name: '深层', desc: '主题+母题+象征', color: '#6366f1' },
  { id: 'comprehensive', name: '全面', desc: '含文化语境和文学传统', color: '#a855f7' },
] as const;

const MOTIF_TYPE_LABELS: Record<string, string> = {
  image: '意象',
  symbol: '象征',
  action: '行为',
  setting: '场景',
  character: '角色',
};

function ProminenceBar({ value }: { value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: value >= 80 ? '#6366f1' : value >= 60 ? '#8b5cf6' : '#a78bfa', borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 11, color: '#64748b', minWidth: 28, textAlign: 'right' }}>{value}%</span>
    </div>
  );
}

function DepthScore({ value, label }: { value: number; label: string }) {
  const getColor = (v: number) => v >= 80 ? '#22c55e' : v >= 60 ? '#eab308' : '#ef4444';
  return (
    <div style={{ padding: 10, background: '#fff', borderRadius: 8, textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: getColor(value) }}>{value}</div>
    </div>
  );
}

export function ThemeAnalysisPanel({ projectId }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ThemeAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [depth, setDepth] = useState<'surface' | 'deep' | 'comprehensive'>('deep');
  const [expandedSymbol, setExpandedSymbol] = useState<number | null>(null);
  const [expandedTheme, setExpandedTheme] = useState<number | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    const res = await themeAnalysisService.analyze(projectId, { depth });
    if (res.success && res.data) setResult(res.data);
    else setError(res.error || '分析失败');
    setLoading(false);
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>🎭 AI主题深度分析</h3>

      {/* Depth selector */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>分析深度</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {DEPTH_OPTIONS.map(opt => (
            <button key={opt.id} onClick={() => setDepth(opt.id)} style={{
              flex: 1, padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
              border: depth === opt.id ? `2px solid ${opt.color}` : '1px solid #ddd',
              background: depth === opt.id ? `${opt.color}12` : '#f9f9f9',
              color: depth === opt.id ? opt.color : '#666',
              fontWeight: depth === opt.id ? 600 : 400,
              fontSize: 12,
              transition: 'all 0.2s',
            }}>
              <div style={{ fontWeight: 600 }}>{opt.name}</div>
              <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <button onClick={handleAnalyze} disabled={loading} style={{
        padding: '10px 20px', borderRadius: 8, border: 'none',
        background: loading ? '#ccc' : '#6366f1', color: '#fff', fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14,
      }}>{loading ? '分析中...' : '🎭 开始主题分析'}</button>

      {error && <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{error}</div>}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Primary Themes */}
          {result.primaryThemes?.length > 0 && (
            <div style={{ padding: 12, background: '#eef2ff', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 14, color: '#4338ca' }}>主要主题</h4>
              {result.primaryThemes.map((t, i) => (
                <div key={i} style={{
                  padding: 10, background: '#fff', borderRadius: 8, marginBottom: 8,
                  borderLeft: `4px solid ${t.prominence >= 80 ? '#6366f1' : t.prominence >= 60 ? '#8b5cf6' : '#a78bfa'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{t.theme}</span>
                    <span style={{ fontSize: 11, color: '#888' }}>显著度</span>
                  </div>
                  <ProminenceBar value={t.prominence} />
                  <div style={{ fontSize: 12, color: '#555', margin: '6px 0' }}>{t.description}</div>
                  <button onClick={() => setExpandedTheme(expandedTheme === i ? null : i)} style={{
                    background: 'none', border: 'none', color: '#6366f1', fontSize: 11,
                    cursor: 'pointer', padding: '2px 0', textDecoration: 'underline',
                  }}>
                    {expandedTheme === i ? '收起详情' : '展开详情'}
                  </button>
                  {expandedTheme === i && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {t.chaptersPresent?.length > 0 && (
                        <div style={{ fontSize: 11, color: '#666' }}>
                          <span style={{ fontWeight: 600 }}>出现章节：</span>
                          {t.chaptersPresent.map(ch => `第${ch}章`).join('、')}
                        </div>
                      )}
                      {t.keyQuotes?.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 2 }}>关键引用：</div>
                          {t.keyQuotes.map((q, qi) => (
                            <div key={qi} style={{ fontSize: 11, color: '#888', paddingLeft: 8, borderLeft: '2px solid #e2e8f0', marginBottom: 3 }}>
                              "{q}"
                            </div>
                          ))}
                        </div>
                      )}
                      {t.literaryTradition && (
                        <div style={{ fontSize: 11, color: '#666' }}>
                          <span style={{ fontWeight: 600 }}>文学传统：</span>{t.literaryTradition}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Motifs */}
          {result.motifs?.length > 0 && (
            <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 14, color: '#16a34a' }}>母题追踪</h4>
              {result.motifs.map((m, i) => (
                <div key={i} style={{
                  padding: 10, background: '#fff', borderRadius: 8, marginBottom: 8,
                  borderLeft: '4px solid #22c55e',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{m.motif}</span>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 10,
                      background: '#ecfdf5', color: '#16a34a', fontWeight: 500,
                    }}>
                      {MOTIF_TYPE_LABELS[m.type] || m.type}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#555', marginBottom: 6 }}>{m.significance}</div>
                  {m.occurrences?.length > 0 && (
                    <div style={{ marginBottom: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 2 }}>出现记录：</div>
                      {m.occurrences.slice(0, 5).map((o, oi) => (
                        <div key={oi} style={{ fontSize: 11, color: '#888', paddingLeft: 8, marginBottom: 2 }}>
                          第{o.chapter}章: {o.description}
                        </div>
                      ))}
                    </div>
                  )}
                  {m.evolution && (
                    <div style={{ fontSize: 11, color: '#6366f1', fontStyle: 'italic', borderTop: '1px solid #f0fdf4', paddingTop: 4 }}>
                      演变: {m.evolution}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Symbolism */}
          {result.symbolism?.length > 0 && (
            <div style={{ padding: 12, background: '#fefce8', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 14, color: '#a16207' }}>象征体系</h4>
              {result.symbolism.map((s, i) => (
                <div key={i} style={{
                  padding: 10, background: '#fff', borderRadius: 8, marginBottom: 8,
                  borderLeft: '4px solid #eab308',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{s.symbol}</span>
                    <span style={{ fontSize: 11, color: '#888' }}>出现 {s.occurrences} 次</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', fontSize: 12, marginBottom: 4 }}>
                    <div style={{ padding: '4px 8px', background: '#f8fafc', borderRadius: 4, color: '#555' }}>{s.literalMeaning}</div>
                    <span style={{ color: '#a16207', fontWeight: 600 }}>→</span>
                    <div style={{ padding: '4px 8px', background: '#fffbeb', borderRadius: 4, color: '#a16207', fontWeight: 500 }}>{s.metaphoricalMeaning}</div>
                  </div>
                  <button onClick={() => setExpandedSymbol(expandedSymbol === i ? null : i)} style={{
                    background: 'none', border: 'none', color: '#a16207', fontSize: 11,
                    cursor: 'pointer', padding: '2px 0', textDecoration: 'underline',
                  }}>
                    {expandedSymbol === i ? '收起层次' : '展开层次'}
                  </button>
                  {expandedSymbol === i && s.layers?.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {s.layers.map((layer, li) => (
                        <div key={li} style={{
                          fontSize: 11, padding: '4px 8px', background: '#fffbeb',
                          borderRadius: 4, color: '#78350f', borderLeft: `3px solid ${li === 0 ? '#fbbf24' : '#f59e0b'}`,
                        }}>
                          <span style={{ fontWeight: 600 }}>L{li + 1}:</span> {layer}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Thematic Arc */}
          {result.thematicArc && (
            <div style={{ padding: 12, background: '#faf5ff', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 14, color: '#7c3aed' }}>主题弧线</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div style={{ padding: 8, background: '#fff', borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: '#888' }}>发展模式</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{result.thematicArc.pattern}</div>
                </div>
                <div style={{ padding: 8, background: '#fff', borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: '#888' }}>核心冲突</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{result.thematicArc.centralConflict}</div>
                </div>
                <div style={{ padding: 8, background: '#fff', borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: '#888' }}>解决方向</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{result.thematicArc.resolutionDirection}</div>
                </div>
                <div style={{ padding: 8, background: '#fff', borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#888' }}>哲学深度</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#7c3aed' }}>{result.thematicArc.philosophicalDepth}</div>
                </div>
              </div>
            </div>
          )}

          {/* Literary Analysis */}
          {result.literaryAnalysis && (
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>文学分析</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <DepthScore value={result.literaryAnalysis.originality} label="原创性" />
                <DepthScore value={result.thematicArc?.philosophicalDepth || 0} label="哲学深度" />
              </div>
              {result.literaryAnalysis.genreContribution && (
                <div style={{ padding: '8px 10px', background: '#fff', borderRadius: 6, marginBottom: 6, fontSize: 12 }}>
                  <span style={{ fontWeight: 600, color: '#555' }}>类型贡献：</span>
                  <span style={{ color: '#666' }}>{result.literaryAnalysis.genreContribution}</span>
                </div>
              )}
              {result.literaryAnalysis.culturalContext && (
                <div style={{ padding: '8px 10px', background: '#fff', borderRadius: 6, marginBottom: 6, fontSize: 12 }}>
                  <span style={{ fontWeight: 600, color: '#555' }}>文化语境：</span>
                  <span style={{ color: '#666' }}>{result.literaryAnalysis.culturalContext}</span>
                </div>
              )}
              {result.literaryAnalysis.comparativeNotes && (
                <div style={{ padding: '8px 10px', background: '#fff', borderRadius: 6, fontSize: 12 }}>
                  <span style={{ fontWeight: 600, color: '#555' }}>比较分析：</span>
                  <span style={{ color: '#666' }}>{result.literaryAnalysis.comparativeNotes}</span>
                </div>
              )}
            </div>
          )}

          {/* Suggestions */}
          {result.suggestions?.length > 0 && (
            <div style={{ padding: 12, background: '#fffbeb', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>深化建议</h4>
              {result.suggestions.map((s, i) => (
                <div key={i} style={{
                  padding: '6px 10px', background: '#fff', borderRadius: 4, marginBottom: 4,
                  fontSize: 12, borderLeft: '3px solid #eab308',
                }}>
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
