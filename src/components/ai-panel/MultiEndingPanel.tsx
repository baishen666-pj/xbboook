// @ts-nocheck
import { useState } from 'react';
import { multiEndingService } from '@/services/multiEndingService';

interface Props {
  projectId: string;
}

const ENDING_TYPES = [
  { id: 'happy', name: '大团圆', icon: '🌈', color: '#10b981' },
  { id: 'tragic', name: '悲剧', icon: '💔', color: '#ef4444' },
  { id: 'open', name: '开放式', icon: '🌀', color: '#6366f1' },
  { id: 'twist', name: '反转', icon: '🔄', color: '#f59e0b' },
  { id: 'bittersweet', name: '苦甜交织', icon: '🍬', color: '#ec4899' },
  { id: 'circular', name: '循环', icon: '♻️', color: '#8b5cf6' },
];

export function MultiEndingPanel({ projectId }: Props) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['happy', 'tragic', 'twist', 'open']);
  const [characterFocus, setCharacterFocus] = useState('');
  const [constraints, setConstraints] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedEnding, setExpandedEnding] = useState<number | null>(null);

  const toggleType = (id: string) => {
    setSelectedTypes(prev => prev.includes(id) ? prev.filter(t => t !== id) : prev.length < 6 ? [...prev, id] : prev);
  };

  const handleGenerate = async () => {
    if (selectedTypes.length === 0) return;
    setLoading(true); setError(null); setData(null);
    const res = await multiEndingService.generate(projectId, {
      endingTypes: selectedTypes, characterFocus: characterFocus || undefined, constraints: constraints || undefined,
    });
    if (res?.success) setData(res.data); else setError(res?.error || '生成失败');
    setLoading(false);
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>🔀 多结局生成器</h3>

      {/* Ending type selector */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>结局类型（选择1-6种）</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {ENDING_TYPES.map(t => (
            <button key={t.id} onClick={() => toggleType(t.id)} style={{
              padding: 8, borderRadius: 8, border: selectedTypes.includes(t.id) ? `2px solid ${t.color}` : '1px solid #ddd',
              background: selectedTypes.includes(t.id) ? `${t.color}18` : '#fff', cursor: 'pointer', textAlign: 'center', fontSize: 12,
            }}>
              <div style={{ fontSize: 20 }}>{t.icon}</div>
              <div style={{ fontWeight: 500 }}>{t.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Optional inputs */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>关注角色（可选）</label>
        <input value={characterFocus} onChange={e => setCharacterFocus(e.target.value)}
          placeholder="如：主角、反派..."
          style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
      </div>
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>约束条件（可选）</label>
        <input value={constraints} onChange={e => setConstraints(e.target.value)}
          placeholder="如：必须回收某个伏笔..."
          style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
      </div>

      <button onClick={handleGenerate} disabled={loading || selectedTypes.length === 0} style={{
        padding: '10px 20px', borderRadius: 8, border: 'none', background: loading ? '#ccc' : '#6366f1',
        color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
      }}>{loading ? '生成中...' : `🔀 生成${selectedTypes.length}种结局`}</button>

      {error && <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{error}</div>}

      {data && (
        <>
          {/* Story summary */}
          {data.story_summary && (
            <div style={{ padding: 10, background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
              <strong>故事概要：</strong>{data.story_summary}
            </div>
          )}

          {/* Endings list */}
          {data.endings?.map((ending: any) => {
            const typeInfo = ENDING_TYPES.find(t => t.id === ending.type);
            const expanded = expandedEnding === ending.id;
            return (
              <div key={ending.id} style={{
                border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden',
                borderLeft: `4px solid ${typeInfo?.color || '#6366f1'}`,
              }}>
                <div onClick={() => setExpandedEnding(expanded ? null : ending.id)} style={{
                  padding: '10px 12px', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 20 }}>{typeInfo?.icon || '📄'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{ending.title}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{ending.type_name} · 满意度 {ending.reader_satisfaction_predicted}%</div>
                  </div>
                  <span style={{ fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
                </div>
                {expanded && (
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.6 }}>{ending.summary}</div>
                    {ending.key_events && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>关键事件</div>
                        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>{ending.key_events.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>
                      </div>
                    )}
                    {ending.character_fates && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>角色命运</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {ending.character_fates.map((cf: any, i: number) => (
                            <div key={i} style={{ fontSize: 12, padding: '4px 8px', background: '#f8fafc', borderRadius: 4 }}>
                              <strong>{cf.name}</strong>：{cf.fate}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {ending.sample_epilogue && (
                      <div style={{ padding: 8, background: '#f0fdf4', borderRadius: 6, fontSize: 12, lineHeight: 1.7, borderLeft: '3px solid #10b981' }}>
                        {ending.sample_epilogue}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Comparison */}
          {data.comparison && (
            <div style={{ padding: 12, background: '#fffbeb', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>🏆 结局对比</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                <div>⭐ <strong>综合最佳：</strong>方案{data.comparison.best_overall}</div>
                {data.comparison.most_surprising && <div>🔄 <strong>最出人意料：</strong>方案{data.comparison.most_surprising.id} — {data.comparison.most_surprising.reason}</div>}
                {data.comparison.most_satisfying && <div>😊 <strong>最令人满足：</strong>方案{data.comparison.most_satisfying.id} — {data.comparison.most_satisfying.reason}</div>}
              </div>
            </div>
          )}

          {data.recommendation && (
            <div style={{ padding: 10, background: '#f0fdf4', borderRadius: 8, fontSize: 13 }}>
              💡 <strong>推荐：</strong>{data.recommendation}
            </div>
          )}
        </>
      )}
    </div>
  );
}
