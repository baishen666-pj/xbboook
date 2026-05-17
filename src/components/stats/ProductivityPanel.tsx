// @ts-nocheck
import { useState } from 'react';
import {
  productivityAnalyzerService,
  type ProductivityAnalysisData,
} from '@/services/productivityAnalyzerService';

interface Props {
  projectId: string;
}

const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const PERIOD_LABELS = ['凌晨', '上午', '午间', '下午', '傍晚', '夜间'];
const PERIOD_RANGES = ['0-4h', '4-8h', '8-12h', '12-16h', '16-20h', '20-24h'];

const LEVEL_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: '#dcfce7', text: '#166534', label: '高效' },
  medium: { bg: '#fef9c3', text: '#854d0e', label: '中等' },
  low: { bg: '#fef2f2', text: '#991b1b', label: '待提升' },
};

const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#6b7280',
};

const CATEGORY_ICONS: Record<string, string> = {
  habits: '🔄',
  technique: '✍️',
  tools: '🛠️',
  mindset: '🧠',
};

function getHeatmapColor(score: number): string {
  if (score < 20) return '#f3f4f6';
  if (score < 40) return '#bfdbfe';
  if (score < 60) return '#60a5fa';
  if (score < 80) return '#2563eb';
  return '#1d4ed8';
}

export function ProductivityPanel({ projectId }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProductivityAnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'all'>('month');

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    const res = await productivityAnalyzerService.analyze(projectId, { period });
    if (res.success && res.data) {
      setData(res.data);
    } else {
      setError(res.error || '分析失败');
    }
    setLoading(false);
  };

  const renderOverviewCards = () => {
    if (!data?.overview) return null;
    const { overview } = data;
    const levelInfo = LEVEL_COLORS[overview.productivityLevel] || LEVEL_COLORS.medium;

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>总字数</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{overview.totalWords.toLocaleString()}</div>
        </div>
        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>总章节</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{overview.totalChapters}</div>
        </div>
        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>效率等级</div>
          <div style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, background: levelInfo.bg, color: levelInfo.text, fontSize: 13, fontWeight: 600 }}>
            {levelInfo.label}
          </div>
        </div>
        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>完成率</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#6366f1' }}>{overview.completionRate}%</div>
        </div>
      </div>
    );
  };

  const renderHeatmap = () => {
    if (!data?.heatmapData?.length) return null;

    const cellSize = 32;
    const labelWidth = 36;
    const headerHeight = 20;
    const width = labelWidth + 6 * cellSize + 10;
    const height = headerHeight + 7 * cellSize + 10;

    return (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', background: '#fafafa' }}>
          {PERIOD_RANGES.map((label, i) => (
            <text key={i} x={labelWidth + i * cellSize + cellSize / 2} y={12} textAnchor="middle" fontSize={8} fill="#9ca3af">{label}</text>
          ))}
          {DAY_LABELS.map((label, d) => {
            const yOff = headerHeight + d * cellSize;
            return (
              <g key={d}>
                <text x={labelWidth - 4} y={yOff + cellSize / 2 + 3} textAnchor="end" fontSize={9} fill="#6b7280">{label}</text>
                {Array.from({ length: 6 }, (_, h) => {
                  const cell = data.heatmapData.find(c => c.day === d && c.period === h);
                  const score = cell?.score ?? 0;
                  return (
                    <rect key={h} x={labelWidth + h * cellSize + 1} y={yOff + 1} width={cellSize - 2} height={cellSize - 2} rx={4} fill={getHeatmapColor(score)} title={`${DAY_LABELS[d]} ${PERIOD_LABELS[h]}: 活跃度 ${score}%`} />
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const renderWeeklyTrend = () => {
    if (!data?.weeklyTrend?.length) return null;

    const svgWidth = 500;
    const svgHeight = 160;
    const pad = { top: 15, right: 15, bottom: 25, left: 40 };
    const chartW = svgWidth - pad.left - pad.right;
    const chartH = svgHeight - pad.top - pad.bottom;
    const points = data.weeklyTrend;
    const maxWords = Math.max(...points.map(p => p.words), 1);

    const getX = (i) => pad.left + (i / Math.max(points.length - 1, 1)) * chartW;
    const getY = (v) => pad.top + chartH - (v / maxWords) * chartH;

    const linePath = points.map((p, i) => {
      const cmd = i === 0 ? 'M' : 'L';
      return cmd + ' ' + getX(i) + ' ' + getY(p.words);
    }).join(' ');

    const fillPath = linePath + ' L ' + getX(points.length - 1) + ' ' + getY(0) + ' L ' + getX(0) + ' ' + getY(0) + ' Z';

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
      const yVal = Math.round(maxWords * (1 - ratio));
      const yPos = getY(yVal);
      const lbl = yVal >= 1000 ? (yVal / 1000).toFixed(1) + 'k' : String(yVal);
      return { yPos, lbl, key: i };
    });

    return (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <svg viewBox={'0 0 ' + svgWidth + ' ' + svgHeight} style={{ width: '100%', height: 'auto', background: '#fafafa' }}>
          {gridLines.map(g => (
            <g key={g.key}>
              <line x1={pad.left} y1={g.yPos} x2={svgWidth - pad.right} y2={g.yPos} stroke="#e5e7eb" strokeWidth={1} />
              <text x={pad.left - 4} y={g.yPos + 3} textAnchor="end" fontSize={8} fill="#9ca3af">{g.lbl}</text>
            </g>
          ))}
          <path d={fillPath} fill="#6366f1" fillOpacity={0.1} />
          <path d={linePath} fill="none" stroke="#6366f1" strokeWidth={2} strokeLinejoin="round" />
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={getX(i)} cy={getY(p.words)} r={3} fill="#6366f1" />
              <text x={getX(i)} y={svgHeight - 6} textAnchor="middle" fontSize={8} fill="#9ca3af">{'W' + p.week}</text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  const renderPatterns = () => {
    if (!data?.patterns) return null;
    const { patterns } = data;

    const topPeak = patterns.peakHours?.reduce((best, h) => (!best || h.productivity > best.productivity) ? h : best, null);

    return (
      <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600 }}>创作模式分析</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {topPeak && (
            <div style={{ padding: '6px 8px', background: '#fff', borderRadius: 6, fontSize: 12 }}>
              <span style={{ color: '#94a3b8' }}>高峰时段</span>
              <div style={{ fontWeight: 600, color: '#1e293b', marginTop: 2 }}>{topPeak.hour}:00 ({topPeak.productivity}%)</div>
            </div>
          )}
          <div style={{ padding: '6px 8px', background: '#fff', borderRadius: 6, fontSize: 12 }}>
            <span style={{ color: '#94a3b8' }}>最佳日期</span>
            <div style={{ fontWeight: 600, color: '#1e293b', marginTop: 2 }}>{patterns.bestDay}</div>
          </div>
          <div style={{ padding: '6px 8px', background: '#fff', borderRadius: 6, fontSize: 12 }}>
            <span style={{ color: '#94a3b8' }}>平均写作时长</span>
            <div style={{ fontWeight: 600, color: '#1e293b', marginTop: 2 }}>{patterns.avgSessionLength}</div>
          </div>
          <div style={{ padding: '6px 8px', background: '#fff', borderRadius: 6, fontSize: 12 }}>
            <span style={{ color: '#94a3b8' }}>每次字数</span>
            <div style={{ fontWeight: 600, color: '#1e293b', marginTop: 2 }}>{patterns.wordsPerSession.toLocaleString()} 字</div>
          </div>
        </div>
        <div style={{ marginTop: 8, padding: '6px 8px', background: '#fff', borderRadius: 6, fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8' }}>一致性评分</span>
            <span style={{ fontWeight: 700, color: patterns.consistencyScore >= 70 ? '#16a34a' : patterns.consistencyScore >= 40 ? '#d97706' : '#dc2626' }}>
              {patterns.consistencyScore}/100
            </span>
          </div>
          <div style={{ marginTop: 4, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${patterns.consistencyScore}%`, background: patterns.consistencyScore >= 70 ? '#22c55e' : patterns.consistencyScore >= 40 ? '#f59e0b' : '#ef4444', borderRadius: 3 }} />
          </div>
        </div>
      </div>
    );
  };

  const renderBottlenecks = () => {
    if (!data?.bottlenecks?.length) return null;

    const typeLabels: Record<string, string> = {
      starting_block: '起步困难',
      middle_slump: '中段低谷',
      revision_loop: '反复修改',
      perfectionism: '完美主义',
    };

    return (
      <div style={{ padding: 12, background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>瓶颈诊断</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.bottlenecks.map((b, i) => (
            <div key={i} style={{ padding: '8px 10px', background: '#fff', borderRadius: 6, fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ padding: '1px 8px', borderRadius: 10, background: '#fef3c7', color: '#92400e', fontSize: 10, fontWeight: 500 }}>
                  {typeLabels[b.type] || b.type}
                </span>
                <span style={{ fontWeight: 500, color: '#1e293b' }}>{b.description}</span>
              </div>
              {b.evidence && <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 2 }}>证据: {b.evidence}</div>}
              {b.solution && <div style={{ color: '#6366f1', fontSize: 11 }}>建议: {b.solution}</div>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderRecommendations = () => {
    if (!data?.recommendations?.length) return null;

    return (
      <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>AI 建议</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.recommendations.map((r, i) => (
            <div key={i} style={{ padding: '8px 10px', background: '#fff', borderRadius: 6, fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>{CATEGORY_ICONS[r.category] || '💡'}</span>
                <span style={{ fontWeight: 600, color: '#1e293b', flex: 1 }}>{r.title}</span>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: PRIORITY_COLORS[r.priority] || '#6b7280' }} title={r.priority} />
              </div>
              <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 2 }}>{r.description}</div>
              <div style={{ color: '#16a34a', fontSize: 11, fontWeight: 500 }}>行动: {r.action}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderGoals = () => {
    if (!data?.goals) return null;
    const { goals } = data;

    return (
      <div style={{ padding: 12, background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>目标设置</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ padding: '6px 8px', background: '#fff', borderRadius: 6, fontSize: 12 }}>
            <span style={{ color: '#94a3b8' }}>每日目标</span>
            <div style={{ fontWeight: 600, color: '#1e293b', marginTop: 2 }}>{goals.dailyTarget.toLocaleString()} 字</div>
          </div>
          <div style={{ padding: '6px 8px', background: '#fff', borderRadius: 6, fontSize: 12 }}>
            <span style={{ color: '#94a3b8' }}>每周目标</span>
            <div style={{ fontWeight: 600, color: '#1e293b', marginTop: 2 }}>{goals.weeklyTarget.toLocaleString()} 字</div>
          </div>
        </div>
        <div style={{ marginTop: 6, padding: '6px 8px', background: '#fff', borderRadius: 6, fontSize: 12 }}>
          <span style={{ color: '#94a3b8' }}>下一个里程碑</span>
          <div style={{ fontWeight: 600, color: '#1e293b', marginTop: 2 }}>{goals.milestone}</div>
          <div style={{ color: '#6366f1', fontSize: 11 }}>{goals.eta}</div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>AI 写作效率分析</h3>

      {/* Period selector */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>分析周期</label>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['week', 'month', 'quarter', 'all'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '4px 12px', borderRadius: 12, fontSize: 12, cursor: 'pointer',
              border: period === p ? '1px solid #6366f1' : '1px solid #ddd',
              background: period === p ? '#eef2ff' : '#f9f9f9',
              color: period === p ? '#6366f1' : '#666',
              fontWeight: period === p ? 600 : 400,
            }}>
              {{ week: '近一周', month: '近一月', quarter: '近三月', all: '全部' }[p]}
            </button>
          ))}
        </div>
      </div>

      <button onClick={handleAnalyze} disabled={loading} style={{
        padding: '10px 20px', borderRadius: 8, border: 'none', background: loading ? '#ccc' : '#6366f1',
        color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
      }}>
        {loading ? '分析中...' : '开始分析'}
      </button>

      {error && <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{error}</div>}

      {data && (
        <>
          {renderOverviewCards()}
          {renderHeatmap()}
          {renderWeeklyTrend()}
          {renderPatterns()}
          {renderBottlenecks()}
          {renderRecommendations()}
          {renderGoals()}
        </>
      )}
    </div>
  );
}
