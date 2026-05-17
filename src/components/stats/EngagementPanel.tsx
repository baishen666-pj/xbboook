// @ts-nocheck
import { useState } from 'react';
import { readerEngagementService } from '@/services/readerEngagementService';

interface Props {
  projectId: string;
}

export function EngagementPanel({ projectId }: Props) {
  const [tab, setTab] = useState<'predict' | 'hook'>('predict');
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState<any>(null);
  const [hookScore, setHookScore] = useState<any>(null);
  const [selectedChapter, setSelectedChapter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handlePredict = async () => {
    setLoading(true);
    setError(null);
    const res = await readerEngagementService.predict(projectId);
    if (res.success && res.data) {
      setPrediction(res.data);
    } else {
      setError(res.error || '预测失败');
    }
    setLoading(false);
  };

  const handleHookScore = async () => {
    if (!selectedChapter) return;
    setLoading(true);
    setError(null);
    const res = await readerEngagementService.hookScore(projectId, selectedChapter);
    if (res.success && res.data) {
      setHookScore(res.data);
    } else {
      setError(res.error || '评分失败');
    }
    setLoading(false);
  };

  const renderEngagementChart = () => {
    if (!prediction?.chapters?.length) return null;
    const width = 600;
    const height = 200;
    const pad = { top: 15, right: 15, bottom: 30, left: 35 };
    const cw = width - pad.left - pad.right;
    const ch = height - pad.top - pad.bottom;
    const chapters = prediction.chapters;

    const getX = (i: number) => pad.left + (i / Math.max(chapters.length - 1, 1)) * cw;
    const getY = (v: number) => pad.top + ch - (v / 100) * ch;

    const engagementPath = chapters.map((c: any, i: number) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(c.engagement_score)}`).join(' ');
    const retentionPath = chapters.map((c: any, i: number) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(c.retention_probability)}`).join(' ');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', background: '#fafafa', borderRadius: 8 }}>
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line x1={pad.left} y1={getY(v)} x2={width - pad.right} y2={getY(v)} stroke="#e5e7eb" />
            <text x={pad.left - 5} y={getY(v) + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{v}%</text>
          </g>
        ))}
        <path d={engagementPath} fill="none" stroke="#6366f1" strokeWidth={2} />
        {chapters.map((c: any, i: number) => (
          <circle key={i} cx={getX(i)} cy={getY(c.engagement_score)} r={3} fill="#6366f1" />
        ))}
        <path d={retentionPath} fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2" />
        {chapters.map((c: any, i: number) => (
          <circle key={`r${i}`} cx={getX(i)} cy={getY(c.retention_probability)} r={3} fill="#f59e0b" />
        ))}
        {chapters.filter((_, i) => i % Math.max(1, Math.floor(chapters.length / 10)) === 0).map((c: any) => (
          <text key={c.chapter} x={getX(chapters.indexOf(c))} y={height - 8} textAnchor="middle" fontSize={9} fill="#9ca3af">Ch{c.chapter}</text>
        ))}
      </svg>
    );
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>读者参与度预测</h3>

      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={() => setTab('predict')} style={{
          flex: 1, padding: 8, borderRadius: 8, border: tab === 'predict' ? '2px solid #6366f1' : '1px solid #ddd',
          background: tab === 'predict' ? '#eef2ff' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500,
        }}>参与度预测</button>
        <button onClick={() => setTab('hook')} style={{
          flex: 1, padding: 8, borderRadius: 8, border: tab === 'hook' ? '2px solid #6366f1' : '1px solid #ddd',
          background: tab === 'hook' ? '#eef2ff' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500,
        }}>钩子评分</button>
      </div>

      {tab === 'predict' && (
        <>
          <button onClick={handlePredict} disabled={loading} style={{
            padding: '10px 20px', borderRadius: 8, border: 'none', background: loading ? '#ccc' : '#6366f1',
            color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
          }}>{loading ? '分析中...' : '预测参与度'}</button>

          {error && <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{error}</div>}

          {prediction && (
            <>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                {renderEngagementChart()}
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', fontSize: 11 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 12, height: 3, background: '#6366f1', borderRadius: 2 }} /> 参与度
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 12, height: 3, background: '#f59e0b', borderRadius: 2, borderStyle: 'dashed' }} /> 留存率
                </span>
              </div>

              {prediction.overall && (
                <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#6366f1' }}>{prediction.overall.average_engagement}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>平均参与度</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>{prediction.overall.predicted_completion_rate}%</div>
                      <div style={{ fontSize: 11, color: '#888' }}>预计完读率</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>
                        {{ rising: '上升', stable: '平稳', declining: '下降' }[prediction.overall.engagement_trend] || '平稳'}
                      </div>
                      <div style={{ fontSize: 11, color: '#888' }}>{prediction.overall.engagement_trend}</div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>章节分析</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflow: 'auto' }}>
                  {prediction.chapters.map((c: any) => (
                    <div key={c.chapter} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: '#fff', borderRadius: 4, fontSize: 12 }}>
                      <span style={{ fontWeight: 500, minWidth: 50 }}>Ch{c.chapter}</span>
                      <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3 }}>
                        <div style={{ height: '100%', width: `${c.engagement_score}%`, background: c.engagement_score > 70 ? '#6366f1' : c.engagement_score > 50 ? '#f59e0b' : '#ef4444', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontWeight: 600, color: c.engagement_score > 70 ? '#6366f1' : '#f59e0b' }}>{c.engagement_score}</span>
                      <span style={{ color: '#888', fontSize: 11 }}>留存{c.retention_probability}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'hook' && (
        <>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>选择章节</label>
            <input
              value={selectedChapter}
              onChange={e => setSelectedChapter(e.target.value)}
              placeholder="输入章节ID..."
              style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}
            />
          </div>
          <button onClick={handleHookScore} disabled={loading || !selectedChapter} style={{
            padding: '10px 20px', borderRadius: 8, border: 'none', background: loading ? '#ccc' : '#6366f1',
            color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
          }}>{loading ? '评分中...' : '钩子评分'}</button>

          {hookScore && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {hookScore.opening && (
                <div style={{ padding: 12, background: '#eef2ff', borderRadius: 8 }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>开头钩子 — {hookScore.opening.score}/100</h4>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>技术：{hookScore.opening.technique}</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                    {(hookScore.opening.technique_tags || []).map((t: string, i: number) => (
                      <span key={i} style={{ padding: '2px 8px', borderRadius: 10, background: '#c7d2fe', fontSize: 11 }}>{t}</span>
                    ))}
                  </div>
                  {hookScore.opening.improved_version && (
                    <div style={{ padding: 8, background: '#fff', borderRadius: 4, fontSize: 12, lineHeight: 1.6, borderLeft: '3px solid #6366f1' }}>
                      {hookScore.opening.improved_version}
                    </div>
                  )}
                </div>
              )}

              {hookScore.ending && (
                <div style={{ padding: 12, background: '#fffbeb', borderRadius: 8 }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>结尾悬念 — {hookScore.ending.score}/100</h4>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>悬念强度：{hookScore.ending.cliffhanger_strength}/100</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                    {(hookScore.ending.technique_tags || []).map((t: string, i: number) => (
                      <span key={i} style={{ padding: '2px 8px', borderRadius: 10, background: '#fde68a', fontSize: 11 }}>{t}</span>
                    ))}
                  </div>
                  {hookScore.ending.improved_version && (
                    <div style={{ padding: 8, background: '#fff', borderRadius: 4, fontSize: 12, lineHeight: 1.6, borderLeft: '3px solid #f59e0b' }}>
                      {hookScore.ending.improved_version}
                    </div>
                  )}
                </div>
              )}

              <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8 }}>
                <div style={{ fontSize: 13 }}>
                  <strong>总体钩子评分：{hookScore.overall_hook_score}/100</strong>
                  <div style={{ marginTop: 4, color: '#666' }}>{hookScore.reader_retention_impact}</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
