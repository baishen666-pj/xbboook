// @ts-nocheck
import { useState } from 'react';
import { readerGroupSimService } from '@/services/readerGroupSimService';

interface Props {
  projectId: string;
}

const READER_GROUPS = [
  { id: 'young_male', name: '年轻男性(18-25)', desc: '偏好热血、爽文、系统流', color: '#3b82f6' },
  { id: 'young_female', name: '年轻女性(18-25)', desc: '偏好甜宠、虐恋、重生', color: '#ec4899' },
  { id: 'mature_male', name: '中年男性(30-45)', desc: '偏好历史、官场、商战', color: '#059669' },
  { id: 'mature_female', name: '中年女性(30-45)', desc: '偏好家庭、职场、情感', color: '#f59e0b' },
  { id: 'hardcore_reader', name: '资深书虫', desc: '看重文笔、逻辑、创新', color: '#8b5cf6' },
  { id: 'casual_reader', name: '休闲读者', desc: '追求轻松、消遣、打发时间', color: '#10b981' },
];

const ASPECTS = [
  { id: 'satisfaction', name: '满意度' },
  { id: 'retention', name: '留存意愿' },
  { id: 'payment', name: '付费意愿' },
  { id: 'sharing', name: '推荐意愿' },
  { id: 'review', name: '评价倾向' },
];

const RISK_COLORS: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
};
const RISK_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
};

export function ReaderGroupSimPanel({ projectId }: Props) {
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedAspects, setSelectedAspects] = useState<string[]>(['satisfaction', 'retention', 'payment']);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleGroup = (id: string) => {
    setSelectedGroups(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  const toggleAspect = (id: string) => {
    setSelectedAspects(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const handleSimulate = async () => {
    if (selectedAspects.length === 0) return;
    setLoading(true);
    setError(null);
    const params: any = { aspects: selectedAspects };
    if (selectedGroups.length > 0) params.groups = selectedGroups;
    const res = await readerGroupSimService.simulate(projectId, params);
    if (res.success && res.data) {
      setData(res.data);
    } else {
      setError(res.error || '模拟失败');
    }
    setLoading(false);
  };

  const renderBarChart = () => {
    if (!data?.groupReactions?.length) return null;
    const reactions = data.groupReactions;
    const barHeight = 28;
    const gap = 8;
    const labelWidth = 120;
    const chartWidth = 360;
    const height = reactions.length * (barHeight + gap) + 40;

    return (
      <svg viewBox={`0 0 ${labelWidth + chartWidth + 20} ${height}`} style={{ width: '100%', background: '#fafafa', borderRadius: 8 }}>
        {[0, 25, 50, 75, 100].map(v => {
          const x = labelWidth + (v / 100) * chartWidth;
          return (
            <g key={v}>
              <line x1={x} y1={0} x2={x} y2={height - 20} stroke="#e5e7eb" />
              <text x={x} y={height - 6} textAnchor="middle" fontSize={9} fill="#9ca3af">{v}</text>
            </g>
          );
        })}
        {reactions.map((r: any, i: number) => {
          const y = i * (barHeight + gap) + 4;
          const groupDef = READER_GROUPS.find(g => g.id === r.groupId);
          const color = groupDef?.color || '#6366f1';
          const w = (r.overallScore / 100) * chartWidth;
          return (
            <g key={r.groupId}>
              <text x={labelWidth - 8} y={y + barHeight / 2 + 4} textAnchor="end" fontSize={11} fill="#333" fontWeight={500}>
                {r.groupName}
              </text>
              <rect x={labelWidth} y={y} width={w} height={barHeight} fill={color} fillOpacity={0.8} rx={4} />
              <text x={labelWidth + w + 6} y={y + barHeight / 2 + 4} fontSize={12} fill="#333" fontWeight={600}>
                {r.overallScore}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>读者群模拟</h3>

      {/* Group selector */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>目标读者群体（不选则分析全部）</label>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {READER_GROUPS.map(g => (
            <button key={g.id} onClick={() => toggleGroup(g.id)} style={{
              padding: '4px 10px', borderRadius: 12, fontSize: 12, cursor: 'pointer',
              border: selectedGroups.includes(g.id) ? `1px solid ${g.color}` : '1px solid #ddd',
              background: selectedGroups.includes(g.id) ? `${g.color}18` : '#f9f9f9',
              color: selectedGroups.includes(g.id) ? g.color : '#666',
            }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: g.color, marginRight: 4 }} />
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {/* Aspect selector */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>分析维度</label>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {ASPECTS.map(a => (
            <button key={a.id} onClick={() => toggleAspect(a.id)} style={{
              padding: '4px 10px', borderRadius: 12, fontSize: 12, cursor: 'pointer',
              border: selectedAspects.includes(a.id) ? '1px solid #6366f1' : '1px solid #ddd',
              background: selectedAspects.includes(a.id) ? '#eef2ff' : '#f9f9f9',
              color: selectedAspects.includes(a.id) ? '#6366f1' : '#666',
            }}>
              {a.name}
            </button>
          ))}
        </div>
      </div>

      <button onClick={handleSimulate} disabled={loading || selectedAspects.length === 0} style={{
        padding: '10px 20px', borderRadius: 8, border: 'none', background: loading ? '#ccc' : '#6366f1',
        color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
      }}>
        {loading ? '模拟分析中...' : '开始模拟'}
      </button>

      {error && <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{error}</div>}

      {data && (
        <>
          {/* Work positioning */}
          {data.workPositioning && (
            <div style={{ padding: 12, background: '#eef2ff', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>作品定位</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
                <div><strong>类型：</strong>{data.workPositioning.genre}</div>
                <div><strong>目标读者：</strong>{data.workPositioning.targetAudience}</div>
                <div><strong>市场定位：</strong>{data.workPositioning.marketPosition}</div>
              </div>
            </div>
          )}

          {/* Bar chart */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            {renderBarChart()}
          </div>

          {/* Group reaction cards */}
          {data.groupReactions?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>群体详细反馈</h4>
              {data.groupReactions.map((r: any) => {
                const groupDef = READER_GROUPS.find(g => g.id === r.groupId);
                const color = groupDef?.color || '#6366f1';
                return (
                  <div key={r.groupId} style={{ padding: 12, background: '#fff', borderRadius: 8, border: `1px solid #e5e7eb`, borderLeft: `4px solid ${color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{r.groupName}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: RISK_COLORS[r.dropoffRisk] || '#888', color: '#fff' }}>
                        弃读风险: {RISK_LABELS[r.dropoffRisk] || r.dropoffRisk}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 8 }}>
                      {[
                        { label: '满意度', value: r.satisfaction },
                        { label: '留存', value: r.retention },
                        { label: '付费', value: r.paymentWillingness },
                        { label: '推荐', value: r.sharingLikelihood },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: s.value >= 70 ? color : s.value >= 50 ? '#f59e0b' : '#ef4444' }}>{s.value}</div>
                          <div style={{ fontSize: 10, color: '#888' }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {r.favoriteAspects?.length > 0 && (
                      <div style={{ marginBottom: 4, fontSize: 12 }}>
                        <span style={{ color: '#10b981', fontWeight: 500 }}>喜欢：</span>
                        {r.favoriteAspects.join('、')}
                      </div>
                    )}
                    {r.painPoints?.length > 0 && (
                      <div style={{ marginBottom: 4, fontSize: 12 }}>
                        <span style={{ color: '#ef4444', fontWeight: 500 }}>痛点：</span>
                        {r.painPoints.join('、')}
                      </div>
                    )}
                    {r.typicalComment && (
                      <div style={{ padding: '6px 8px', background: '#f8fafc', borderRadius: 4, fontSize: 12, fontStyle: 'italic', color: '#555', marginBottom: 4, borderLeft: '2px solid #ddd' }}>
                        "{r.typicalComment}"
                      </div>
                    )}
                    {r.readingBehavior && (
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>阅读行为：{r.readingBehavior}</div>
                    )}
                    {r.improvementWishes?.length > 0 && (
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: '#6366f1', fontWeight: 500 }}>期望改进：</span>
                        {r.improvementWishes.join('、')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Market analysis */}
          {data.marketAnalysis && (
            <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>市场分析</h4>
              <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div><strong>潜在读者规模：</strong>{data.marketAnalysis.totalAddressableAudience}</div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div><strong>最佳群体：</strong>{data.marketAnalysis.primarySegment?.group}（契合度 {data.marketAnalysis.primarySegment?.affinity}%）</div>
                </div>
                {data.marketAnalysis.secondarySegments?.length > 0 && (
                  <div>
                    <strong>次要群体：</strong>
                    {data.marketAnalysis.secondarySegments.map((s: any, i: number) => `${s.group}(${s.affinity}%)`).join('、')}
                  </div>
                )}
                <div><strong>竞争优势：</strong>{data.marketAnalysis.competitiveAdvantage}</div>
                {data.marketAnalysis.marketRisks?.length > 0 && (
                  <div><strong style={{ color: '#ef4444' }}>市场风险：</strong>{data.marketAnalysis.marketRisks.join('、')}</div>
                )}
                {data.marketAnalysis.monetizationTips?.length > 0 && (
                  <div><strong style={{ color: '#f59e0b' }}>变现建议：</strong>{data.marketAnalysis.monetizationTips.join('、')}</div>
                )}
              </div>
            </div>
          )}

          {/* Cross-group insights */}
          {data.crossGroupInsights?.length > 0 && (
            <div style={{ padding: 12, background: '#fffbeb', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>跨群体共同反馈</h4>
              {data.crossGroupInsights.map((insight: string, i: number) => (
                <div key={i} style={{ fontSize: 12, padding: '3px 0', color: '#555' }}>{i + 1}. {insight}</div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {data.recommendations?.length > 0 && (
            <div style={{ padding: 12, background: '#eef2ff', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>综合建议</h4>
              {data.recommendations.map((rec: string, i: number) => (
                <div key={i} style={{ fontSize: 12, padding: '3px 0', color: '#555' }}>{i + 1}. {rec}</div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
