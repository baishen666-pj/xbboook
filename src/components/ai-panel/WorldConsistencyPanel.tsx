// @ts-nocheck
import { useState } from 'react';
import {
  worldConsistencyService,
  type WorldConsistencyResult,
  type Inconsistency,
  type WorldGap,
} from '@/services/worldConsistencyService';

interface Props {
  projectId: string;
}

const DIMENSIONS = [
  { id: 'geography', name: '地理设定', icon: '🏔️' },
  { id: 'magic', name: '魔法体系', icon: '✨' },
  { id: 'technology', name: '科技水平', icon: '⚙️' },
  { id: 'society', name: '社会制度', icon: '🏛️' },
  { id: 'history', name: '历史时间线', icon: '📜' },
  { id: 'economy', name: '经济系统', icon: '💰' },
  { id: 'races', name: '种族/势力', icon: '🐉' },
];

const SEVERITY_MAP: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: '严重', color: '#dc2626', bg: '#fef2f2' },
  high: { label: '高', color: '#ea580c', bg: '#fff7ed' },
  medium: { label: '中', color: '#d97706', bg: '#fffbeb' },
  low: { label: '低', color: '#16a34a', bg: '#f0fdf4' },
};

const IMPORTANCE_MAP: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: '重要', color: '#dc2626', bg: '#fef2f2' },
  medium: { label: '中等', color: '#d97706', bg: '#fffbeb' },
  low: { label: '次要', color: '#6366f1', bg: '#eef2ff' },
};

function ConfidenceBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      {label && <span style={{ minWidth: 60, color: '#666' }}>{label}</span>}
      <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <span style={{ minWidth: 28, textAlign: 'right', fontWeight: 600, color }}>{value}%</span>
    </div>
  );
}

function OverallScoreRing({ score }: { score: number }) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626';
  const label = score >= 80 ? '优秀' : score >= 60 ? '良好' : '需改进';

  return (
    <div style={{ textAlign: 'center', padding: '12px 0' }}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="60" y="56" textAnchor="middle" fontSize="28" fontWeight="700" fill={color}>{score}</text>
        <text x="60" y="76" textAnchor="middle" fontSize="12" fill="#888">{label}</text>
      </svg>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>整体一致性</div>
    </div>
  );
}

function InconsistencyCard({ item, expanded, onToggle }: { item: Inconsistency; expanded: boolean; onToggle: () => void }) {
  const sevInfo = SEVERITY_MAP[item.severity] || SEVERITY_MAP.medium;
  return (
    <div
      style={{ padding: 10, background: sevInfo.bg, border: `1px solid ${sevInfo.color}33`, borderRadius: 8, cursor: 'pointer' }}
      onClick={onToggle}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, background: sevInfo.color, color: '#fff', fontWeight: 500 }}>
            {sevInfo.label}
          </span>
          <span style={{ fontSize: 11, color: '#888' }}>{item.dimension}</span>
        </div>
        <span style={{ fontSize: 11, color: '#888' }}>
          第{item.location1?.chapter}章 vs 第{item.location2?.chapter}章
        </span>
      </div>
      <div style={{ fontSize: 13, color: '#333', fontWeight: 500 }}>{item.description}</div>
      {expanded && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${sevInfo.color}22`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12 }}>
            <strong style={{ color: '#555' }}>设定A（第{item.location1?.chapter}章）：</strong>
            <span style={{ color: '#666' }}>{item.location1?.text}</span>
          </div>
          <div style={{ fontSize: 12 }}>
            <strong style={{ color: '#555' }}>矛盾B（第{item.location2?.chapter}章）：</strong>
            <span style={{ color: '#666' }}>{item.location2?.text}</span>
          </div>
          {item.fixOptions && item.fixOptions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>修正方案：</div>
              {item.fixOptions.map((fix, fi) => (
                <div key={fi} style={{ padding: 6, background: '#fff', borderRadius: 6, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontWeight: 500 }}>{fix.approach}</span>
                    <span style={{
                      padding: '1px 6px', borderRadius: 8, fontSize: 10,
                      color: fix.difficulty === 'easy' ? '#16a34a' : '#dc2626',
                      background: fix.difficulty === 'easy' ? '#f0fdf4' : '#fef2f2',
                    }}>
                      {fix.difficulty === 'easy' ? '简单' : '困难'}
                    </span>
                  </div>
                  <div style={{ color: '#666' }}>影响：{fix.impact}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WorldConsistencyPanel({ projectId }: Props) {
  const [selectedDims, setSelectedDims] = useState<string[]>(['all']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WorldConsistencyResult | null>(null);
  const [expandedInconsistency, setExpandedInconsistency] = useState<number | null>(null);
  const [showGaps, setShowGaps] = useState(true);

  const toggleDimension = (dimId: string) => {
    if (dimId === 'all') {
      setSelectedDims(['all']);
      return;
    }
    setSelectedDims(prev => {
      const next = prev.filter(d => d !== 'all');
      if (next.includes(dimId)) {
        const filtered = next.filter(d => d !== dimId);
        return filtered.length === 0 ? ['all'] : filtered;
      }
      return [...next, dimId];
    });
  };

  const handleCheck = async () => {
    setLoading(true);
    setError(null);
    const res = await worldConsistencyService.check(projectId, { dimensions: selectedDims });
    if (res.success && res.data) {
      setResult(res.data);
    } else {
      setError(res.error || '分析失败');
    }
    setLoading(false);
  };

  const sortedInconsistencies = result?.inconsistencies
    ? [...result.inconsistencies].sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
      })
    : [];

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>🌍 世界观一致性检查</h3>

      {/* Dimension selector */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        <button
          onClick={() => toggleDimension('all')}
          style={{
            padding: '4px 10px', borderRadius: 16, fontSize: 12, border: selectedDims.includes('all') ? '2px solid #6366f1' : '1px solid #ddd',
            background: selectedDims.includes('all') ? '#eef2ff' : '#fff', cursor: 'pointer', fontWeight: 500,
          }}
        >
          全部
        </button>
        {DIMENSIONS.map(d => (
          <button
            key={d.id}
            onClick={() => toggleDimension(d.id)}
            style={{
              padding: '4px 10px', borderRadius: 16, fontSize: 12, border: selectedDims.includes(d.id) ? '2px solid #6366f1' : '1px solid #ddd',
              background: selectedDims.includes(d.id) ? '#eef2ff' : '#fff', cursor: 'pointer',
            }}
          >
            {d.icon} {d.name}
          </button>
        ))}
      </div>

      <button
        onClick={handleCheck}
        disabled={loading}
        style={{
          padding: '10px 20px', borderRadius: 8, border: 'none', background: loading ? '#ccc' : '#6366f1',
          color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '分析中...' : '开始检查'}
      </button>

      {error && <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{error}</div>}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Overall score */}
          <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
            <OverallScoreRing score={result.overallConsistency} />
          </div>

          {/* World elements overview */}
          <div style={{ padding: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>世界观元素概览</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.worldElements && Object.entries(result.worldElements).map(([key, dim]) => (
                <div key={key} style={{ padding: 8, background: '#f8fafc', borderRadius: 6 }}>
                  <ConfidenceBar value={dim.confidence || 0} label={key === 'geography' ? '地理' : key === 'magicOrPower' ? '魔法/力量' : key === 'technology' ? '科技' : key === 'society' ? '社会' : key === 'history' ? '历史' : key === 'economy' ? '经济' : '种族/势力'} />
                  {dim.established && dim.established.length > 0 && (
                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {dim.established.slice(0, 3).map((e: string, i: number) => (
                        <span key={i} style={{ padding: '1px 6px', borderRadius: 8, background: '#eef2ff', fontSize: 11, color: '#444' }}>
                          {e.length > 20 ? e.slice(0, 20) + '...' : e}
                        </span>
                      ))}
                      {dim.established.length > 3 && (
                        <span style={{ fontSize: 11, color: '#888' }}>+{dim.established.length - 3}项</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Inconsistencies */}
          {sortedInconsistencies.length > 0 && (
            <div style={{ padding: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>
                冲突列表 ({sortedInconsistencies.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sortedInconsistencies.map(item => (
                  <InconsistencyCard
                    key={item.id}
                    item={item}
                    expanded={expandedInconsistency === item.id}
                    onToggle={() => setExpandedInconsistency(expandedInconsistency === item.id ? null : item.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Gaps */}
          {result.gaps && result.gaps.length > 0 && (
            <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <div
                style={{ padding: '10px 12px', background: '#f8fafc', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => setShowGaps(!showGaps)}
              >
                <h4 style={{ margin: 0, fontSize: 14 }}>设定缺失提醒 ({result.gaps.length})</h4>
                <span style={{ fontSize: 12, color: '#888' }}>{showGaps ? '收起' : '展开'}</span>
              </div>
              {showGaps && (
                <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {result.gaps.map((gap: WorldGap, i: number) => {
                    const impInfo = IMPORTANCE_MAP[gap.importance] || IMPORTANCE_MAP.medium;
                    return (
                      <div key={i} style={{ padding: 8, background: impInfo.bg, borderRadius: 6, fontSize: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ padding: '1px 6px', borderRadius: 8, fontSize: 10, background: impInfo.color, color: '#fff', fontWeight: 500 }}>
                            {impInfo.label}
                          </span>
                          <span style={{ color: '#888' }}>{gap.dimension}</span>
                        </div>
                        <div style={{ fontWeight: 500, marginBottom: 2 }}>{gap.description}</div>
                        <div style={{ color: '#16a34a' }}>建议：{gap.suggestion}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations && result.recommendations.length > 0 && (
            <div style={{ padding: 12, background: '#fffbeb', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>改进建议</h4>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                {result.recommendations.map((r, i) => (
                  <li key={i} style={{ marginBottom: 2 }}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
