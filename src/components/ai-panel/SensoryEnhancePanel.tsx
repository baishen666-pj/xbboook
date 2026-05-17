// @ts-nocheck
import { useState } from 'react';
import { sensoryEnhanceService } from '@/services/sensoryEnhanceService';

interface Props {
  projectId: string;
}

const SKILLS = [
  { id: 'sensory-expand', name: '感官描写增强', icon: '🎨', desc: '五感描写增强' },
  { id: 'fight-choreograph', name: '战斗编排', icon: '⚔️', desc: '动作场景编排' },
  { id: 'environment-builder', name: '环境氛围', icon: '🏔️', desc: '环境氛围构建' },
] as const;

const FOCUS_OPTIONS = [
  { id: 'all', name: '全部感官' },
  { id: 'visual', name: '视觉' },
  { id: 'auditory', name: '听觉' },
  { id: 'olfactory', name: '嗅觉' },
  { id: 'tactile', name: '触觉' },
  { id: 'gustatory', name: '味觉' },
];

const INTENSITY_OPTIONS = [
  { id: 'subtle', name: '细腻含蓄' },
  { id: 'moderate', name: '适度展开' },
  { id: 'intense', name: '浓墨重彩' },
];

export function SensoryEnhancePanel({ projectId }: Props) {
  const [skill, setSkill] = useState<string>('sensory-expand');
  const [focus, setFocus] = useState<string>('all');
  const [intensity, setIntensity] = useState<string>('moderate');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEnhanced, setShowEnhanced] = useState(false);

  const handleEnhance = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    const res = await sensoryEnhanceService.enhance(projectId, {
      skillId: skill as any,
      content: content || undefined,
      focus,
      intensity,
    });

    if (res.success && res.data) {
      setResult(res.data);
    } else {
      setError(res.error || '增强失败');
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>🎭 感官描写增强</h3>

      {/* Skill selector */}
      <div style={{ display: 'flex', gap: 8 }}>
        {SKILLS.map(s => (
          <button
            key={s.id}
            onClick={() => { setSkill(s.id); setResult(null); }}
            style={{
              flex: 1, padding: '8px 4px', border: skill === s.id ? '2px solid #6366f1' : '1px solid #ddd',
              borderRadius: 8, background: skill === s.id ? '#eef2ff' : '#fff', cursor: 'pointer', textAlign: 'center', fontSize: 12,
            }}
          >
            <div style={{ fontSize: 20 }}>{s.icon}</div>
            <div style={{ fontWeight: 500 }}>{s.name}</div>
            <div style={{ color: '#888', fontSize: 11 }}>{s.desc}</div>
          </button>
        ))}
      </div>

      {/* Focus & Intensity */}
      {skill === 'sensory-expand' && (
        <>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>感官焦点</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {FOCUS_OPTIONS.map(f => (
                <button key={f.id} onClick={() => setFocus(f.id)} style={{
                  padding: '4px 10px', borderRadius: 12, border: focus === f.id ? '1px solid #6366f1' : '1px solid #ddd',
                  background: focus === f.id ? '#eef2ff' : '#f9f9f9', fontSize: 12, cursor: 'pointer',
                }}>{f.name}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>描写强度</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {INTENSITY_OPTIONS.map(i => (
                <button key={i.id} onClick={() => setIntensity(i.id)} style={{
                  padding: '4px 10px', borderRadius: 12, border: intensity === i.id ? '1px solid #6366f1' : '1px solid #ddd',
                  background: intensity === i.id ? '#eef2ff' : '#f9f9f9', fontSize: 12, cursor: 'pointer',
                }}>{i.name}</button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Input */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>待增强文本（可选，留空分析全书）</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="粘贴或输入需要增强的文本..."
          style={{ width: '100%', height: 100, padding: 8, borderRadius: 8, border: '1px solid #ddd', fontSize: 13, resize: 'vertical' }}
        />
      </div>

      <button
        onClick={handleEnhance}
        disabled={loading}
        style={{
          padding: '10px 20px', borderRadius: 8, border: 'none', background: loading ? '#ccc' : '#6366f1',
          color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '✨ 增强中...' : '🚀 开始增强'}
      </button>

      {error && <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{error}</div>}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Sensory scores radar for sensory-expand */}
          {result.sensory_breakdown && (
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>📊 感官分析</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {Object.entries(result.sensory_breakdown).map(([key, val]: [string, any]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 8px', background: '#fff', borderRadius: 4 }}>
                    <span>{{ visual: '👁️ 视觉', auditory: '👂 听觉', olfactory: '👃 嗅觉', tactile: '✋ 触觉', gustatory: '👅 味觉' }[key] || key}</span>
                    <span style={{ fontWeight: 600, color: val.score > 70 ? '#16a34a' : val.score > 40 ? '#d97706' : '#dc2626' }}>{val.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fight choreography */}
          {result.choreography && (
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>⚔️ 战斗编排</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(result.choreography.phases || []).map((p: any, i: number) => (
                  <div key={i} style={{ padding: '6px 8px', background: '#fff', borderRadius: 4, fontSize: 12 }}>
                    <div style={{ fontWeight: 500 }}>{p.name} <span style={{ color: '#888' }}>张力: {p.tension}%</span></div>
                    <div style={{ color: '#666' }}>{p.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Atmosphere */}
          {result.atmosphere && (
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>🏔️ 氛围分析</h4>
              <div style={{ fontSize: 13, marginBottom: 4 }}><strong>整体氛围：</strong>{result.atmosphere.mood}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {(result.atmosphere.elements || []).map((el: any, i: number) => (
                  <div key={i} style={{ padding: '4px 8px', background: '#fff', borderRadius: 4, fontSize: 12 }}>
                    <span style={{ fontWeight: 500 }}>{el.type}</span> — {el.description}
                    {el.emotion && <span style={{ color: '#888' }}> → {el.emotion}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Enhanced text toggle */}
          {result.enhanced_text && (
            <div>
              <button onClick={() => setShowEnhanced(!showEnhanced)} style={{
                padding: '6px 12px', borderRadius: 6, border: '1px solid #6366f1', background: '#eef2ff',
                fontSize: 12, cursor: 'pointer', fontWeight: 500,
              }}>
                {showEnhanced ? '收起增强文本' : '展开增强文本'}
              </button>
              {showEnhanced && (
                <div style={{ marginTop: 8, padding: 12, background: '#f0fdf4', borderRadius: 8, fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {result.enhanced_text}
                </div>
              )}
            </div>
          )}

          {/* Tips */}
          {(result.suggestions || result.tips) && (
            <div style={{ padding: 12, background: '#fffbeb', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>💡 建议</h4>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                {(result.suggestions || result.tips || []).map((t: string, i: number) => (
                  <li key={i} style={{ marginBottom: 2 }}>{t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
