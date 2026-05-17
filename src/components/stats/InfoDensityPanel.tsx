// @ts-nocheck
import { useState } from 'react';
import { infoDensityService } from '@/services/infoDensityService';

interface Props {
  projectId: string;
}

const DIMENSIONS = [
  { id: 'worldbuilding', name: '世界观', color: '#6366f1' },
  { id: 'plotAdvancement', name: '剧情推进', color: '#3b82f6' },
  { id: 'characterDevelopment', name: '角色发展', color: '#10b981' },
  { id: 'newConcepts', name: '新概念', color: '#f59e0b' },
  { id: 'emotionalPayload', name: '情感负载', color: '#ec4899' },
];

const CLASSIFICATION_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  balanced: { label: '均衡', color: '#16a34a', bg: '#dcfce7' },
  overload: { label: '过载', color: '#dc2626', bg: '#fef2f2' },
  sparse: { label: '稀疏', color: '#d97706', bg: '#fef9c3' },
  action: { label: '动作密集', color: '#2563eb', bg: '#dbeafe' },
  dialogue_heavy: { label: '对话密集', color: '#7c3aed', bg: '#ede9fe' },
};

function getDensityColor(value: number): string {
  if (value < 20) return '#f3f4f6';
  if (value < 40) return '#bfdbfe';
  if (value < 60) return '#60a5fa';
  if (value < 80) return '#3b82f6';
  return '#1d4ed8';
}

export function InfoDensityPanel({ projectId }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    const params: any = {};
    if (selectedChapters.length > 0) params.chapterIds = selectedChapters;
    const res = await infoDensityService.analyze(projectId, params);
    if (res.success && res.data) {
      setData(res.data);
    } else {
      setError(res.error || '分析失败');
    }
    setLoading(false);
  };

  const renderHeatmap = () => {
    if (!data?.chapterDensity?.length) return null;
    const chapters = data.chapterDensity;
    const cellW = 80;
    const cellH = 32;
    const labelW = 60;
    const headerH = 70;
    const svgW = labelW + chapters.length * cellW + 10;
    const svgH = headerH + DIMENSIONS.length * cellH + 10;

    return (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'auto' }}>
        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ minWidth: svgW, height: 'auto', background: '#fafafa' }}>
          {chapters.map((ch, ci) => (
            <g key={ci}>
              <text x={labelW + ci * cellW + cellW / 2} y={14} textAnchor="middle" fontSize={9} fill="#6b7280" fontWeight={500}>Ch{ch.chapter}</text>
              <text x={labelW + ci * cellW + cellW / 2} y={26} textAnchor="middle" fontSize={7} fill="#9ca3af">{ch.totalDensity}</text>
              {(() => {
                const cl = CLASSIFICATION_LABELS[ch.classification] || CLASSIFICATION_LABELS.balanced;
                return (
                  <g>
                    <rect x={labelW + ci * cellW + 8} y={32} width={cellW - 16} height={14} rx={7} fill={cl.bg} stroke={cl.color} strokeWidth={0.5} />
                    <text x={labelW + ci * cellW + cellW / 2} y={42} textAnchor="middle" fontSize={7} fill={cl.color} fontWeight={500}>{cl.label}</text>
                  </g>
                );
              })()}
            </g>
          ))}
          {DIMENSIONS.map((dim, di) => {
            const yOff = headerH + di * cellH;
            return (
              <g key={dim.id}>
                <text x={labelW - 4} y={yOff + cellH / 2 + 3} textAnchor="end" fontSize={9} fill={dim.color} fontWeight={500}>{dim.name}</text>
                {chapters.map((ch, ci) => {
                  const val = ch.dimensions?.[dim.id] ?? 0;
                  return (
                    <g key={ci}>
                      <rect x={labelW + ci * cellW + 1} y={yOff + 1} width={cellW - 2} height={cellH - 2} rx={4} fill={getDensityColor(val)} title={`${dim.name} Ch${ch.chapter}: ${val}`} />
                      <text x={labelW + ci * cellW + cellW / 2} y={yOff + cellH / 2 + 3} textAnchor="middle" fontSize={9} fill={val > 60 ? '#fff' : '#374151'} fontWeight={600}>{val}</text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const renderBarChart = () => {
    if (!data?.chapterDensity?.length) return null;
    const chapters = data.chapterDensity;
    const svgW = Math.max(500, chapters.length * 50);
    const svgH = 200;
    const pad = { top: 20, right: 20, bottom: 35, left: 40 };
    const chartW = svgW - pad.left - pad.right;
    const chartH = svgH - pad.top - pad.bottom;
    const barW = Math.min(30, (chartW / chapters.length) * 0.7);
    const gap = chartW / chapters.length;

    const getX = (i) => pad.left + gap * i + gap / 2;
    const getY = (v) => pad.top + chartH - (v / 100) * chartH;

    return (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'auto' }}>
        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ minWidth: svgW, height: 'auto', background: '#fafafa' }}>
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={pad.left} y1={getY(v)} x2={svgW - pad.right} y2={getY(v)} stroke="#e5e7eb" strokeWidth={1} />
              <text x={pad.left - 5} y={getY(v) + 3} textAnchor="end" fontSize={9} fill="#9ca3af">{v}</text>
            </g>
          ))}
          {chapters.map((ch, i) => {
            const barH = (ch.totalDensity / 100) * chartH;
            const y = pad.top + chartH - barH;
            const cl = CLASSIFICATION_LABELS[ch.classification] || CLASSIFICATION_LABELS.balanced;
            return (
              <g key={i}>
                <rect x={getX(i) - barW / 2} y={y} width={barW} height={barH} rx={3} fill={cl.color} fillOpacity={0.75} title={`Ch${ch.chapter}: ${ch.totalDensity}`} />
                <text x={getX(i)} y={svgH - pad.bottom + 14} textAnchor="middle" fontSize={8} fill="#6b7280">Ch{ch.chapter}</text>
                <text x={getX(i)} y={y - 4} textAnchor="middle" fontSize={8} fill="#374151" fontWeight={600}>{ch.totalDensity}</text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const renderOverloadWarnings = () => {
    if (!data?.overloadChapters?.length) return null;
    return (
      <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#dc2626' }}>过载章节警告</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.overloadChapters.map((item, i) => (
            <div key={i} style={{ padding: '8px 10px', background: '#fff', borderRadius: 6, borderLeft: '3px solid #dc2626', fontSize: 12 }}>
              <div style={{ fontWeight: 600, color: '#991b1b', marginBottom: 2 }}>第{item.chapter}章</div>
              <div style={{ color: '#7f1d1d', marginBottom: 2 }}>
                {item.elements?.map((el, ei) => (
                  <span key={ei} style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 10, background: '#fee2e2', color: '#991b1b', fontSize: 10, marginRight: 4, marginBottom: 2 }}>{el}</span>
                ))}
              </div>
              <div style={{ color: '#6366f1', fontSize: 11 }}>{item.suggestion}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSparseReminders = () => {
    if (!data?.sparseChapters?.length) return null;
    return (
      <div style={{ padding: 12, background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#d97706' }}>稀疏章节提醒</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.sparseChapters.map((item, i) => (
            <div key={i} style={{ padding: '8px 10px', background: '#fff', borderRadius: 6, borderLeft: '3px solid #f59e0b', fontSize: 12 }}>
              <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 2 }}>第{item.chapter}章</div>
              <div style={{ color: '#78350f', marginBottom: 2 }}>{item.missing}</div>
              <div style={{ color: '#6366f1', fontSize: 11 }}>{item.suggestion}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderReorganizationPlan = () => {
    if (!data?.reorganizationPlan?.length) return null;
    const actionIcons: Record<string, string> = { move: '->', add: '+', remove: 'x' };
    const actionColors: Record<string, string> = { move: '#3b82f6', add: '#16a34a', remove: '#dc2626' };
    return (
      <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>信息重排方案</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.reorganizationPlan.map((plan, i) => {
            const color = actionColors[plan.action] || '#6b7280';
            return (
              <div key={i} style={{ padding: '8px 10px', background: '#fff', borderRadius: 6, fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 10, background: `${color}18`, color, fontSize: 10, fontWeight: 600 }}>{plan.action.toUpperCase()}</span>
                  <span style={{ color: '#374151' }}>
                    第{plan.fromChapter}章 {actionIcons[plan.action] || '->'} {plan.toChapter ? `第${plan.toChapter}章` : ''}
                  </span>
                </div>
                <div style={{ color: '#6b7280', marginBottom: 2 }}>{plan.element}</div>
                <div style={{ color: '#6366f1', fontSize: 11 }}>{plan.reason}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDistributionAssessment = () => {
    if (!data?.distributionAssessment) return null;
    const { distributionAssessment: da } = data;
    return (
      <div style={{ padding: 12, background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>分布评估</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div style={{ padding: '6px 8px', background: '#fff', borderRadius: 6, fontSize: 12 }}>
            <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>整体平衡度</div>
            <div style={{ fontWeight: 700, color: da.overallBalance >= 70 ? '#16a34a' : da.overallBalance >= 40 ? '#d97706' : '#dc2626', fontSize: 18 }}>{da.overallBalance}/100</div>
            <div style={{ marginTop: 4, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${da.overallBalance}%`, background: da.overallBalance >= 70 ? '#22c55e' : da.overallBalance >= 40 ? '#f59e0b' : '#ef4444', borderRadius: 3 }} />
            </div>
          </div>
          <div style={{ padding: '6px 8px', background: '#fff', borderRadius: 6, fontSize: 12 }}>
            <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>节奏影响</div>
            <div style={{ color: '#374151', lineHeight: 1.5 }}>{da.pacingImpact}</div>
          </div>
        </div>
        <div style={{ padding: '6px 8px', background: '#fff', borderRadius: 6, fontSize: 12 }}>
          <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>理想分布</div>
          <div style={{ color: '#374151', lineHeight: 1.5 }}>{da.idealDistribution}</div>
        </div>
      </div>
    );
  };

  const renderTips = () => {
    if (!data?.tips?.length) return null;
    return (
      <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>优化技巧</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {data.tips.map((tip, i) => (
            <div key={i} style={{ padding: '6px 8px', background: '#fff', borderRadius: 4, fontSize: 12, color: '#374151', display: 'flex', gap: 8 }}>
              <span style={{ color: '#6366f1', fontWeight: 600, minWidth: 20 }}>{i + 1}.</span>
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>信息密度分析</h3>

      <button onClick={handleAnalyze} disabled={loading} style={{
        padding: '10px 20px', borderRadius: 8, border: 'none', background: loading ? '#ccc' : '#6366f1',
        color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', alignSelf: 'flex-start',
      }}>
        {loading ? '分析中...' : '开始分析'}
      </button>

      {error && <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{error}</div>}

      {data && (
        <>
          {renderHeatmap()}
          {renderBarChart()}
          {renderDistributionAssessment()}
          {renderOverloadWarnings()}
          {renderSparseReminders()}
          {renderReorganizationPlan()}
          {renderTips()}
        </>
      )}
    </div>
  );
}
