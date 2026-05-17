// @ts-nocheck
import { useState } from 'react';
import { creativeBreakthroughService } from '@/services/creativeBreakthroughService';

interface Props {
  projectId: string;
}

const TABS = [
  { id: 'what-if', name: '如果设想', icon: '🔮' },
  { id: 'constraint', name: '限制写作', icon: '🎯' },
  { id: 'blend', name: '类型融合', icon: '🧬' },
] as const;

const ASPECTS = [
  { id: 'plot', name: '剧情' }, { id: 'character', name: '角色' }, { id: 'setting', name: '场景' },
  { id: 'conflict', name: '冲突' }, { id: 'ending', name: '结局' }, { id: 'random', name: '随机' },
];

const CONSTRAINTS = [
  { id: 'no_dialogue', name: '无对话' }, { id: 'no_adjectives', name: '无形容词' },
  { id: 'single_sentence', name: '单句段落' }, { id: 'reverse_pov', name: '反转视角' },
  { id: 'stream_consciousness', name: '意识流' }, { id: 'letter_format', name: '书信体' },
  { id: 'no_protagonist', name: '无主角' }, { id: 'time_limit', name: '限时紧迫' },
];

const GENRES = [
  '奇幻', '科幻', '悬疑', '言情', '武侠', '仙侠', '恐怖', '历史', '都市', '军事', '末日', '赛博朋克',
];

export function CreativeBreakthroughPanel({ projectId }: Props) {
  const [tab, setTab] = useState<string>('what-if');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState('');

  // What-If state
  const [aspect, setAspect] = useState('random');
  const [count, setCount] = useState(5);

  // Constraint state
  const [selectedConstraints, setSelectedConstraints] = useState<string[]>(['no_dialogue']);

  // Blend state
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  const handleWhatIf = async () => {
    setLoading(true); setError(null); setResult(null);
    const res = await creativeBreakthroughService.whatIf(projectId, { content: content || undefined, aspect, count });
    if (res.success && res.data) setResult(res.data); else setError(res.error || '失败');
    setLoading(false);
  };

  const handleConstraint = async () => {
    if (selectedConstraints.length === 0) return;
    setLoading(true); setError(null); setResult(null);
    const res = await creativeBreakthroughService.constraintWrite(projectId, {
      content: content || undefined,
      constraints: selectedConstraints.map(c => ({ type: c })),
    });
    if (res.success && res.data) setResult(res.data); else setError(res.error || '失败');
    setLoading(false);
  };

  const handleBlend = async () => {
    if (selectedGenres.length < 2) return;
    setLoading(true); setError(null); setResult(null);
    const res = await creativeBreakthroughService.genreBlend(projectId, {
      content: content || undefined,
      genres: selectedGenres,
    });
    if (res.success && res.data) setResult(res.data); else setError(res.error || '失败');
    setLoading(false);
  };

  const toggleConstraint = (id: string) => {
    setSelectedConstraints(prev => prev.includes(id) ? prev.filter(c => c !== id) : prev.length < 3 ? [...prev, id] : prev);
  };

  const toggleGenre = (g: string) => {
    setSelectedGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : prev.length < 4 ? [...prev, g] : prev);
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>🧠 创意突破工具</h3>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setResult(null); }} style={{
            flex: 1, padding: 8, borderRadius: 8, border: tab === t.id ? '2px solid #6366f1' : '1px solid #ddd',
            background: tab === t.id ? '#eef2ff' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500, textAlign: 'center',
          }}>
            <div style={{ fontSize: 18 }}>{t.icon}</div>
            <div>{t.name}</div>
          </button>
        ))}
      </div>

      {/* Content input */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>参考文本（可选）</label>
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="粘贴参考文本..."
          style={{ width: '100%', height: 80, padding: 8, borderRadius: 8, border: '1px solid #ddd', fontSize: 13, resize: 'vertical' }} />
      </div>

      {/* What-If options */}
      {tab === 'what-if' && (
        <>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>设想方向</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {ASPECTS.map(a => (
                <button key={a.id} onClick={() => setAspect(a.id)} style={{
                  padding: '4px 10px', borderRadius: 12, fontSize: 12, cursor: 'pointer',
                  border: aspect === a.id ? '1px solid #6366f1' : '1px solid #ddd',
                  background: aspect === a.id ? '#eef2ff' : '#f9f9f9',
                }}>{a.name}</button>
              ))}
            </div>
          </div>
          <button onClick={handleWhatIf} disabled={loading} style={{
            padding: '10px 20px', borderRadius: 8, border: 'none', background: loading ? '#ccc' : '#6366f1',
            color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
          }}>{loading ? '生成中...' : '🔮 生成设想'}</button>
        </>
      )}

      {/* Constraint options */}
      {tab === 'constraint' && (
        <>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>选择限制（最多3个）</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {CONSTRAINTS.map(c => (
                <button key={c.id} onClick={() => toggleConstraint(c.id)} style={{
                  padding: '4px 10px', borderRadius: 12, fontSize: 12, cursor: 'pointer',
                  border: selectedConstraints.includes(c.id) ? '1px solid #6366f1' : '1px solid #ddd',
                  background: selectedConstraints.includes(c.id) ? '#eef2ff' : '#f9f9f9',
                }}>{c.name}</button>
              ))}
            </div>
          </div>
          <button onClick={handleConstraint} disabled={loading || selectedConstraints.length === 0} style={{
            padding: '10px 20px', borderRadius: 8, border: 'none', background: loading ? '#ccc' : '#6366f1',
            color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
          }}>{loading ? '创作中...' : '🎯 限制创作'}</button>
        </>
      )}

      {/* Genre blend options */}
      {tab === 'blend' && (
        <>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>选择类型（2-4个）</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {GENRES.map(g => (
                <button key={g} onClick={() => toggleGenre(g)} style={{
                  padding: '4px 10px', borderRadius: 12, fontSize: 12, cursor: 'pointer',
                  border: selectedGenres.includes(g) ? '1px solid #6366f1' : '1px solid #ddd',
                  background: selectedGenres.includes(g) ? '#eef2ff' : '#f9f9f9',
                }}>{g}</button>
              ))}
            </div>
          </div>
          <button onClick={handleBlend} disabled={loading || selectedGenres.length < 2} style={{
            padding: '10px 20px', borderRadius: 8, border: 'none', background: loading ? '#ccc' : '#6366f1',
            color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
          }}>{loading ? '融合中...' : '🧬 开始融合'}</button>
        </>
      )}

      {error && <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{error}</div>}

      {/* Results */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* What-If scenarios */}
          {result.scenarios && (
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>🔮 设想方案</h4>
              {result.scenarios.map((s: any) => (
                <div key={s.id} style={{ padding: '8px 10px', background: '#fff', borderRadius: 6, marginBottom: 6, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <strong style={{ color: '#6366f1' }}>{s.what_if}</strong>
                    <span style={{ fontSize: 11, color: '#888' }}>戏剧性:{s.drama_potential} 可行性:{s.feasibility}</span>
                  </div>
                  <div style={{ color: '#666', marginBottom: 4 }}>{s.description}</div>
                  <div style={{ color: '#888', fontSize: 11 }}>影响：{s.impact}</div>
                  {s.sample_paragraph && (
                    <div style={{ marginTop: 6, padding: 6, background: '#f0fdf4', borderRadius: 4, fontSize: 11, lineHeight: 1.6, borderLeft: '3px solid #10b981' }}>
                      {s.sample_paragraph}
                    </div>
                  )}
                </div>
              ))}
              {result.combination_hint && (
                <div style={{ padding: '6px 10px', background: '#fffbeb', borderRadius: 4, fontSize: 12 }}>
                  💡 {result.combination_hint}
                </div>
              )}
            </div>
          )}

          {/* Constraint write result */}
          {result.result_text && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8 }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>🎯 限制创作结果</h4>
                <div style={{ fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{result.result_text}</div>
              </div>
              {result.unusual_elements && (
                <div style={{ padding: 8, background: '#eef2ff', borderRadius: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>✨ 意外元素</div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>{result.unusual_elements.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>
                </div>
              )}
              {result.technique_analysis && (
                <div style={{ padding: 8, background: '#f8fafc', borderRadius: 6, fontSize: 12 }}>
                  📝 {result.technique_analysis}
                </div>
              )}
            </div>
          )}

          {/* Genre blend result */}
          {result.blend_analysis && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ padding: 12, background: '#eef2ff', borderRadius: 8 }}>
                <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>🧬 融合分析</h4>
                {result.blend_analysis.fusion_points && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>融合点：</div>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>{result.blend_analysis.fusion_points.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul>
                  </div>
                )}
                {result.blend_analysis.unique_opportunities && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>独特机会：</div>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>{result.blend_analysis.unique_opportunities.map((o: string, i: number) => <li key={i}>{o}</li>)}</ul>
                  </div>
                )}
              </div>
              {result.sample_scene && (
                <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8 }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>📖 示例场景</h4>
                  <div style={{ fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{result.sample_scene}</div>
                </div>
              )}
              {result.tone_recommendation && (
                <div style={{ padding: 8, background: '#fffbeb', borderRadius: 6, fontSize: 12 }}>
                  🎵 基调建议：{result.tone_recommendation}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
