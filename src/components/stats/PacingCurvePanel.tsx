// @ts-nocheck
import { useState } from 'react';
import { pacingCurveService } from '@/services/pacingCurveService';

interface Props {
  projectId: string;
}

const DIMENSIONS = [
  { id: 'tension', name: '张力', color: '#ef4444' },
  { id: 'pace', name: '节奏', color: '#3b82f6' },
  { id: 'emotion', name: '情感', color: '#f59e0b' },
  { id: 'info_density', name: '信息密度', color: '#10b981' },
  { id: 'character_activity', name: '角色活跃', color: '#8b5cf6' },
  { id: 'conflict', name: '冲突', color: '#ec4899' },
];

export function PacingCurvePanel({ projectId }: Props) {
  const [selectedDims, setSelectedDims] = useState<string[]>(['tension', 'pace', 'emotion']);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleDim = (id: string) => {
    setSelectedDims(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  const handleGenerate = async () => {
    if (selectedDims.length === 0) return;
    setLoading(true);
    setError(null);
    const res = await pacingCurveService.generate(projectId, { dimensions: selectedDims });
    if (res.success && res.data) {
      setData(res.data);
    } else {
      setError(res.error || '生成失败');
    }
    setLoading(false);
  };

  const renderSVG = () => {
    if (!data?.curve_data?.length) return null;
    const width = 600;
    const height = 300;
    const padding = { top: 20, right: 20, bottom: 40, left: 40 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const points = data.curve_data;
    const maxVal = 100;

    const getX = (i: number) => padding.left + (i / Math.max(points.length - 1, 1)) * chartW;
    const getY = (v: number) => padding.top + chartH - (v / maxVal) * chartH;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', background: '#fafafa', borderRadius: 8 }}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line x1={padding.left} y1={getY(v)} x2={width - padding.right} y2={getY(v)} stroke="#e5e7eb" strokeWidth={1} />
            <text x={padding.left - 5} y={getY(v) + 4} textAnchor="end" fontSize={10} fill="#9ca3af">{v}</text>
          </g>
        ))}

        {/* X axis labels */}
        {points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 10)) === 0).map((p, i, arr) => (
          <text key={i} x={getX(points.indexOf(p))} y={height - 10} textAnchor="middle" fontSize={9} fill="#9ca3af">Ch{p.chapter}</text>
        ))}

        {/* Curves */}
        {selectedDims.map(dim => {
          const dimConfig = DIMENSIONS.find(d => d.id === dim);
          if (!dimConfig) return null;
          const pathData = points.map((p, i) => {
            const val = p[dim] ?? 0;
            return `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(val)}`;
          }).join(' ');

          const areaData = `${pathData} L ${getX(points.length - 1)} ${getY(0)} L ${getX(0)} ${getY(0)} Z`;

          return (
            <g key={dim}>
              <path d={areaData} fill={dimConfig.color} fillOpacity={0.08} />
              <path d={pathData} fill="none" stroke={dimConfig.color} strokeWidth={2} strokeLinejoin="round" />
              {points.map((p, i) => (
                <circle key={i} cx={getX(i)} cy={getY(p[dim] ?? 0)} r={3} fill={dimConfig.color} />
              ))}
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>📈 节奏曲线分析</h3>

      {/* Dimension selector */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>分析维度</label>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {DIMENSIONS.map(d => (
            <button key={d.id} onClick={() => toggleDim(d.id)} style={{
              padding: '4px 10px', borderRadius: 12, fontSize: 12, cursor: 'pointer',
              border: selectedDims.includes(d.id) ? `1px solid ${d.color}` : '1px solid #ddd',
              background: selectedDims.includes(d.id) ? `${d.color}18` : '#f9f9f9',
              color: selectedDims.includes(d.id) ? d.color : '#666',
            }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: d.color, marginRight: 4 }} />
              {d.name}
            </button>
          ))}
        </div>
      </div>

      <button onClick={handleGenerate} disabled={loading || selectedDims.length === 0} style={{
        padding: '10px 20px', borderRadius: 8, border: 'none', background: loading ? '#ccc' : '#6366f1',
        color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
      }}>
        {loading ? '📊 分析中...' : '🚀 生成节奏曲线'}
      </button>

      {error && <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{error}</div>}

      {data && (
        <>
          {/* SVG Chart */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            {renderSVG()}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            {selectedDims.map(dim => {
              const dc = DIMENSIONS.find(d => d.id === dim);
              return dc ? (
                <span key={dim} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 12, height: 3, borderRadius: 2, background: dc.color }} /> {dc.name}
                </span>
              ) : null;
            })}
          </div>

          {/* Segments */}
          {data.segments && (
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>📋 节奏段落</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.segments.map((seg: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 8px', background: '#fff', borderRadius: 4, fontSize: 12 }}>
                    <span style={{ fontWeight: 500, minWidth: 80 }}>{seg.name}</span>
                    <span style={{ color: '#888' }}>Ch{seg.chapters?.[0]}-{seg.chapters?.[1]}</span>
                    <span style={{ color: '#6366f1', fontWeight: 500 }}>张力: {seg.avg_tension}</span>
                    <span style={{ color: '#666', flex: 1 }}>{seg.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Problem areas */}
          {data.problem_areas?.length > 0 && (
            <div style={{ padding: 12, background: '#fffbeb', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>⚠️ 节奏问题</h4>
              {data.problem_areas.map((p: any, i: number) => (
                <div key={i} style={{ padding: '4px 0', fontSize: 12 }}>
                  <strong>第{p.chapter}章</strong>：{p.issue}
                  {p.suggestion && <span style={{ color: '#6366f1' }}> → {p.suggestion}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Overall assessment */}
          {data.overall_assessment && (
            <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>✅ 总体评估</h4>
              <div style={{ fontSize: 13 }}>
                <div><strong>节奏评分：</strong>{data.overall_assessment.pacing_score}/100</div>
                <div><strong>平衡性：</strong>{data.overall_assessment.balance}</div>
                <div><strong>优点：</strong>{data.overall_assessment.strength}</div>
                <div><strong>不足：</strong>{data.overall_assessment.weakness}</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
