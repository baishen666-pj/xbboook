// @ts-nocheck
import { useState, useEffect } from 'react';
import { styleTransferService } from '@/services/styleTransferService';

interface Props {
  projectId: string;
}

const TABS = [
  { id: 'transfer', name: '风格迁移', icon: '🎭' },
  { id: 'imitate', name: '名家模仿', icon: '✒️' },
] as const;

export function StyleTransferPanel({ projectId }: Props) {
  const [tab, setTab] = useState<string>('transfer');
  const [styles, setStyles] = useState<any[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<string>('xianxia');
  const [selectedAuthor, setSelectedAuthor] = useState<string>('');
  const [intensity, setIntensity] = useState<string>('moderate');
  const [content, setContent] = useState('');
  const [scene, setScene] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    styleTransferService.listStyles().then(res => {
      if (res?.success && res.data) setStyles(res.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const style = styles.find(s => s.id === selectedStyle);
    if (style) setSelectedAuthor(style.authors[0]);
  }, [selectedStyle, styles]);

  const handleTransfer = async () => {
    setLoading(true); setError(null); setResult(null);
    const res = await styleTransferService.transfer(projectId, {
      content: content || undefined, styleId: selectedStyle, authorName: selectedAuthor, intensity,
    });
    if (res?.success) setResult(res.data); else setError(res?.error || '迁移失败');
    setLoading(false);
  };

  const handleImitate = async () => {
    setLoading(true); setError(null); setResult(null);
    const res = await styleTransferService.imitate(projectId, {
      authorName: selectedAuthor, content: content || undefined, scene: scene || undefined,
    });
    if (res?.success) setResult(res.data); else setError(res?.error || '模仿失败');
    setLoading(false);
  };

  const currentStyle = styles.find(s => s.id === selectedStyle);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>🎭 写作风格迁移</h3>

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

      {/* Style selector */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>目标风格</label>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {styles.map(s => (
            <button key={s.id} onClick={() => setSelectedStyle(s.id)} style={{
              padding: '4px 10px', borderRadius: 12, fontSize: 12, cursor: 'pointer',
              border: selectedStyle === s.id ? '1px solid #6366f1' : '1px solid #ddd',
              background: selectedStyle === s.id ? '#eef2ff' : '#f9f9f9',
            }}>{s.name}</button>
          ))}
        </div>
      </div>

      {/* Author selector */}
      {currentStyle && (
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>目标作家</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {currentStyle.authors.map((a: string) => (
              <button key={a} onClick={() => setSelectedAuthor(a)} style={{
                padding: '4px 10px', borderRadius: 12, fontSize: 12, cursor: 'pointer',
                border: selectedAuthor === a ? '1px solid #6366f1' : '1px solid #ddd',
                background: selectedAuthor === a ? '#eef2ff' : '#f9f9f9',
              }}>{a}</button>
            ))}
          </div>
        </div>
      )}

      {/* Transfer specific */}
      {tab === 'transfer' && (
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>迁移强度</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {[{ id: 'subtle', name: '轻微' }, { id: 'moderate', name: '中等' }, { id: 'strong', name: '深度' }].map(i => (
              <button key={i.id} onClick={() => setIntensity(i.id)} style={{
                padding: '4px 10px', borderRadius: 12, fontSize: 12, cursor: 'pointer',
                border: intensity === i.id ? '1px solid #6366f1' : '1px solid #ddd',
                background: intensity === i.id ? '#eef2ff' : '#f9f9f9',
              }}>{i.name}</button>
            ))}
          </div>
        </div>
      )}

      {/* Content input */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>
          {tab === 'imitate' ? '参考上下文（可选）' : '待迁移文本（可选）'}
        </label>
        <textarea value={content} onChange={e => setContent(e.target.value)}
          placeholder={tab === 'transfer' ? '粘贴待迁移的文本...' : '粘贴参考上下文...'}
          style={{ width: '100%', height: 80, padding: 8, borderRadius: 8, border: '1px solid #ddd', fontSize: 13, resize: 'vertical' }} />
      </div>

      {/* Scene input for imitate */}
      {tab === 'imitate' && (
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>场景描述（可选）</label>
          <input value={scene} onChange={e => setScene(e.target.value)}
            placeholder="如：雨夜中的追逐戏..."
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
        </div>
      )}

      {/* Action button */}
      <button onClick={tab === 'transfer' ? handleTransfer : handleImitate} disabled={loading} style={{
        padding: '10px 20px', borderRadius: 8, border: 'none', background: loading ? '#ccc' : '#6366f1',
        color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
      }}>{loading ? '处理中...' : tab === 'transfer' ? '🎭 开始迁移' : '✒️ 开始模仿'}</button>

      {error && <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{error}</div>}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Style analysis */}
          {result.style_analysis && (
            <div style={{ padding: 12, background: '#eef2ff', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>📊 风格分析</h4>
              <div style={{ fontSize: 12 }}>
                <div style={{ marginBottom: 4 }}><strong>原文特征：</strong>{result.style_analysis.original_traits?.join('、')}</div>
                <div style={{ marginBottom: 4 }}><strong>目标特征：</strong>{result.style_analysis.target_traits?.join('、')}</div>
                <div><strong>主要变化：</strong>{result.style_analysis.key_changes?.join('、')}</div>
              </div>
            </div>
          )}

          {/* Style signature for imitate */}
          {result.style_signature && (
            <div style={{ padding: 12, background: '#eef2ff', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>✒️ 风格签名</h4>
              <div style={{ fontSize: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <div><strong>句式：</strong>{result.style_signature.sentence_patterns?.join('、')}</div>
                <div><strong>用词：</strong>{result.style_signature.vocabulary_style}</div>
                <div><strong>节奏：</strong>{result.style_signature.rhythm}</div>
                <div><strong>修辞：</strong>{result.style_signature.rhetoric}</div>
              </div>
            </div>
          )}

          {/* Similarity radar for imitate */}
          {result.similarity_analysis && (
            <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>🎯 相似度评分</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                {Object.entries(result.similarity_analysis).filter(([k]) => k !== 'overall').map(([key, val]) => (
                  <div key={key} style={{ textAlign: 'center', padding: 4, background: '#fff', borderRadius: 4 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#6366f1' }}>{val}</div>
                    <div style={{ fontSize: 10, color: '#888' }}>{{ vocabulary: '词汇', rhythm: '节奏', tone: '语调', technique: '技法' }[key] || key}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Result text */}
          {(result.transformed_text || result.imitated_text) && (
            <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>
                {tab === 'transfer' ? '🎭 迁移结果' : '✒️ 模仿结果'}
              </h4>
              <div style={{ fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto' }}>
                {result.transformed_text || result.imitated_text}
              </div>
            </div>
          )}

          {/* Tips */}
          {result.tips && (
            <div style={{ padding: 10, background: '#fffbeb', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 13 }}>💡 风格写作技巧</h4>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>{result.tips.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
