// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { writingCoachService } from '@/services/writingCoachService';
import { chapterService } from '@/services/chapterService';

interface Props {
  projectId: string;
}

const TABS = [
  { id: 'coach', name: '写作教练', icon: '🎓' },
  { id: 'weakness', name: '弱点检测', icon: '🔍' },
] as const;

const FOCUS_OPTIONS = [
  { id: 'all', name: '全部维度' },
  { id: 'narrative', name: '叙事技巧' },
  { id: 'character', name: '角色塑造' },
  { id: 'pacing', name: '节奏把控' },
  { id: 'prose', name: '文笔功底' },
  { id: 'emotion', name: '情感表达' },
  { id: 'structure', name: '结构设计' },
  { id: 'dialogue', name: '对话写作' },
];

const DIMENSION_LABELS: Record<string, string> = {
  narrative: '叙事技巧',
  character: '角色塑造',
  pacing: '节奏把控',
  prose: '文笔功底',
  emotion: '情感表达',
  structure: '结构设计',
  dialogue: '对话写作',
};

const DIMENSION_KEYS = ['narrative', 'character', 'pacing', 'prose', 'emotion', 'structure', 'dialogue'];

const SEVERITY_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  critical: { bg: '#fef2f2', border: '#dc2626', text: '#991b1b', label: '严重' },
  high: { bg: '#fff7ed', border: '#ea580c', text: '#9a3412', label: '高' },
  medium: { bg: '#fefce8', border: '#ca8a04', text: '#854d0e', label: '中' },
  low: { bg: '#f8fafc', border: '#94a3b8', text: '#475569', label: '低' },
};

function RadarChart({ dimensions, size = 200 }: { dimensions: Record<string, { score: number }>; size?: number }) {
  const center = size / 2;
  const radius = size / 2 - 30;
  const count = DIMENSION_KEYS.length;
  const angleStep = (2 * Math.PI) / count;

  function getPoint(index: number, value: number): [number, number] {
    const angle = angleStep * index - Math.PI / 2;
    const r = (value / 100) * radius;
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
  }

  const rings = [20, 40, 60, 80, 100];
  const dataPoints = DIMENSION_KEYS.map((key, i) => {
    const val = dimensions[key]?.score ?? 50;
    return getPoint(i, val);
  });
  const dataPath = dataPoints.map(p => `${p[0]},${p[1]}`).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings.map(ring => {
        const points = DIMENSION_KEYS.map((_, i) => {
          const p = getPoint(i, ring);
          return `${p[0]},${p[1]}`;
        }).join(' ');
        return <polygon key={ring} points={points} fill="none" stroke="#ddd" strokeWidth="0.5" opacity="0.4" />;
      })}
      {DIMENSION_KEYS.map((_, i) => {
        const outer = getPoint(i, 100);
        return <line key={i} x1={center} y1={center} x2={outer[0]} y2={outer[1]} stroke="#ddd" strokeWidth="0.5" opacity="0.4" />;
      })}
      <polygon points={dataPath} fill="#6366f1" fillOpacity="0.15" stroke="#6366f1" strokeWidth="1.5" />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#6366f1" />
      ))}
      {DIMENSION_KEYS.map((key, i) => {
        const labelPos = getPoint(i, 120);
        const val = dimensions[key]?.score ?? 50;
        return (
          <text key={key} x={labelPos[0]} y={labelPos[1]} textAnchor="middle" dominantBaseline="middle" fill="#666" fontSize="10">
            {DIMENSION_LABELS[key]} {val}
          </text>
        );
      })}
    </svg>
  );
}

const LEVEL_COLORS: Record<string, string> = {
  beginner: '#dc2626',
  intermediate: '#d97706',
  advanced: '#16a34a',
  master: '#6366f1',
};

const LEVEL_LABELS: Record<string, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高级',
  master: '大师',
};

export function WritingCoachPanel({ projectId }: Props) {
  const [tab, setTab] = useState<string>('coach');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Coach state
  const [coachResult, setCoachResult] = useState<any>(null);
  const [focusAreas, setFocusAreas] = useState<string[]>(['all']);

  // Weakness state
  const [weaknessResult, setWeaknessResult] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [severity, setSeverity] = useState<string>('all');
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (tab === 'weakness') {
      chapterService.getByProject(projectId).then(res => {
        if (res.success && res.data) {
          setChapters(res.data);
          if (res.data.length > 0 && !selectedChapterId) {
            setSelectedChapterId(res.data[0].id);
          }
        }
      });
    }
  }, [tab, projectId]);

  const toggleFocus = (id: string) => {
    if (id === 'all') {
      setFocusAreas(['all']);
      return;
    }
    setFocusAreas(prev => {
      const next = prev.filter(f => f !== 'all');
      if (next.includes(id)) {
        const filtered = next.filter(f => f !== id);
        return filtered.length === 0 ? ['all'] : filtered;
      }
      return [...next, id];
    });
  };

  const handleCoach = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCoachResult(null);
    const res = await writingCoachService.coach(projectId, { focusAreas });
    if (res.success && res.data) {
      setCoachResult(res.data);
    } else {
      setError(res.error || '评估失败');
    }
    setLoading(false);
  }, [projectId, focusAreas]);

  const handleWeakness = useCallback(async () => {
    if (!selectedChapterId) return;
    setLoading(true);
    setError(null);
    setWeaknessResult(null);
    setExpandedIssues(new Set());
    const res = await writingCoachService.weakness(projectId, { chapterId: selectedChapterId, severity });
    if (res.success && res.data) {
      setWeaknessResult(res.data);
    } else {
      setError(res.error || '检测失败');
    }
    setLoading(false);
  }, [projectId, selectedChapterId, severity]);

  const toggleIssue = (id: number) => {
    setExpandedIssues(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>🎓 AI写作教练</h3>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setError(null); }} style={{
            flex: 1, padding: 8, borderRadius: 8, border: tab === t.id ? '2px solid #6366f1' : '1px solid #ddd',
            background: tab === t.id ? '#eef2ff' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500, textAlign: 'center',
          }}>
            <div style={{ fontSize: 18 }}>{t.icon}</div>
            <div>{t.name}</div>
          </button>
        ))}
      </div>

      {/* Coach Tab */}
      {tab === 'coach' && (
        <>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>评估维度</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {FOCUS_OPTIONS.map(f => (
                <button key={f.id} onClick={() => toggleFocus(f.id)} style={{
                  padding: '4px 10px', borderRadius: 12, fontSize: 12, cursor: 'pointer',
                  border: focusAreas.includes(f.id) ? '1px solid #6366f1' : '1px solid #ddd',
                  background: focusAreas.includes(f.id) ? '#eef2ff' : '#f9f9f9',
                }}>{f.name}</button>
              ))}
            </div>
          </div>
          <button onClick={handleCoach} disabled={loading} style={{
            padding: '10px 20px', borderRadius: 8, border: 'none', background: loading ? '#ccc' : '#6366f1',
            color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
          }}>{loading ? '评估中...' : '🎓 开始评估'}</button>
        </>
      )}

      {/* Weakness Tab */}
      {tab === 'weakness' && (
        <>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>选择章节</label>
            <select value={selectedChapterId} onChange={e => setSelectedChapterId(e.target.value)} style={{
              width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, background: '#fff',
            }}>
              <option value="">请选择章节</option>
              {chapters.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>严重程度过滤</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {['all', 'critical', 'high', 'medium', 'low'].map(s => (
                <button key={s} onClick={() => setSeverity(s)} style={{
                  padding: '4px 10px', borderRadius: 12, fontSize: 12, cursor: 'pointer',
                  border: severity === s ? '1px solid #6366f1' : '1px solid #ddd',
                  background: severity === s ? '#eef2ff' : '#f9f9f9',
                }}>{s === 'all' ? '全部' : SEVERITY_COLORS[s]?.label || s}</button>
              ))}
            </div>
          </div>
          <button onClick={handleWeakness} disabled={loading || !selectedChapterId} style={{
            padding: '10px 20px', borderRadius: 8, border: 'none', background: loading || !selectedChapterId ? '#ccc' : '#6366f1',
            color: '#fff', fontWeight: 600, cursor: loading || !selectedChapterId ? 'not-allowed' : 'pointer',
          }}>{loading ? '检测中...' : '🔍 开始检测'}</button>
        </>
      )}

      {error && <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{error}</div>}

      {/* Coach Results */}
      {tab === 'coach' && coachResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Overall */}
          <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#888' }}>综合评分</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: '#6366f1' }}>{coachResult.overall_score}</div>
            <div style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 500, color: '#fff', background: LEVEL_COLORS[coachResult.overall_level] || '#888' }}>
              {LEVEL_LABELS[coachResult.overall_level] || coachResult.overall_level}
            </div>
          </div>

          {/* Radar chart */}
          {coachResult.dimensions && (
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, display: 'flex', justifyContent: 'center' }}>
              <RadarChart dimensions={coachResult.dimensions} size={280} />
            </div>
          )}

          {/* Dimension cards */}
          {coachResult.dimensions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>维度详情</h4>
              {DIMENSION_KEYS.map(key => {
                const dim = coachResult.dimensions[key];
                if (!dim) return null;
                return (
                  <div key={key} style={{ padding: 10, background: '#f8fafc', borderRadius: 8, borderLeft: `3px solid ${LEVEL_COLORS[dim.level] || '#888'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{DIMENSION_LABELS[key]}</span>
                      <span style={{ fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: LEVEL_COLORS[dim.level] || '#888' }}>{dim.score}</span>
                        <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 8, fontSize: 11, color: '#fff', background: LEVEL_COLORS[dim.level] || '#888' }}>
                          {LEVEL_LABELS[dim.level] || dim.level}
                        </span>
                      </span>
                    </div>
                    {dim.strength && <div style={{ fontSize: 12, color: '#16a34a', marginBottom: 2 }}>+ {dim.strength}</div>}
                    {dim.weakness && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 2 }}>- {dim.weakness}</div>}
                    {dim.improvement && <div style={{ fontSize: 12, color: '#6366f1' }}>&rarr; {dim.improvement}</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Exercises */}
          {coachResult.exercises?.length > 0 && (
            <div style={{ padding: 12, background: '#eef2ff', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>🎯 练习建议</h4>
              {coachResult.exercises.map((ex: any, i: number) => (
                <div key={i} style={{ padding: 8, background: '#fff', borderRadius: 6, marginBottom: 6, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <strong style={{ color: '#6366f1' }}>{ex.title}</strong>
                    <span style={{ fontSize: 11, color: '#888' }}>{ex.estimated_time}</span>
                  </div>
                  <div style={{ color: '#666', marginBottom: 4 }}>{ex.description}</div>
                  {ex.prompt && (
                    <div style={{ padding: 6, background: '#f0fdf4', borderRadius: 4, fontSize: 11, lineHeight: 1.6, borderLeft: '3px solid #10b981' }}>
                      {ex.prompt}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <span style={{ padding: '1px 8px', borderRadius: 8, fontSize: 11, background: ex.difficulty === 'easy' ? '#dcfce7' : ex.difficulty === 'hard' ? '#fef2f2' : '#fefce8', color: ex.difficulty === 'easy' ? '#16a34a' : ex.difficulty === 'hard' ? '#dc2626' : '#d97706' }}>
                      {ex.difficulty === 'easy' ? '简单' : ex.difficulty === 'hard' ? '困难' : '中等'}
                    </span>
                    <span style={{ fontSize: 11, color: '#888' }}>{ex.area}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reading recommendations */}
          {coachResult.reading_recommendations?.length > 0 && (
            <div style={{ padding: 12, background: '#fffbeb', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>📚 推荐阅读</h4>
              {coachResult.reading_recommendations.map((r: any, i: number) => (
                <div key={i} style={{ padding: 8, background: '#fff', borderRadius: 6, marginBottom: 6, fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>{r.title} <span style={{ color: '#888', fontWeight: 400 }}>by {r.author}</span></div>
                  <div style={{ color: '#666', marginTop: 2 }}>{r.reason}</div>
                  {r.focus && <div style={{ color: '#6366f1', marginTop: 2, fontSize: 11 }}>学习重点: {r.focus}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Milestone goals */}
          {coachResult.milestone_goals?.length > 0 && (
            <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>🏁 里程碑目标</h4>
              {coachResult.milestone_goals.map((g: any, i: number) => (
                <div key={i} style={{ padding: 8, background: '#fff', borderRadius: 6, marginBottom: 6, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{g.goal}</strong>
                    <span style={{ padding: '1px 8px', borderRadius: 8, fontSize: 11, background: '#eef2ff', color: '#6366f1' }}>{g.timeline}</span>
                  </div>
                  {g.success_criteria && <div style={{ color: '#666', marginTop: 2, fontSize: 11 }}>达成标准: {g.success_criteria}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Encouragement */}
          {coachResult.encouragement && (
            <div style={{ padding: 12, background: 'linear-gradient(135deg, #eef2ff, #f0fdf4)', borderRadius: 8, fontSize: 13, fontStyle: 'italic', textAlign: 'center', color: '#6366f1' }}>
              {coachResult.encouragement}
            </div>
          )}
        </div>
      )}

      {/* Weakness Results */}
      {tab === 'weakness' && weaknessResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Summary */}
          <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>问题总览</h4>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{weaknessResult.total_issues} 个问题</span>
            </div>
            {weaknessResult.severity_breakdown && (
              <div style={{ display: 'flex', gap: 6 }}>
                {Object.entries(weaknessResult.severity_breakdown).map(([key, count]: [string, any]) => {
                  const sev = SEVERITY_COLORS[key];
                  if (!sev || count === 0) return null;
                  return (
                    <div key={key} style={{ padding: '4px 10px', borderRadius: 8, background: sev.bg, border: `1px solid ${sev.border}`, fontSize: 12 }}>
                      <span style={{ color: sev.text }}>{sev.label}: {count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Overall assessment */}
          {weaknessResult.overall_assessment && (
            <div style={{ padding: 12, background: '#eef2ff', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <h4 style={{ margin: 0, fontSize: 14 }}>整体评估</h4>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#6366f1' }}>{weaknessResult.overall_assessment.quality_score}/100</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
                <div style={{ padding: 6, background: '#f0fdf4', borderRadius: 4 }}><strong style={{ color: '#16a34a' }}>最大优点</strong><br />{weaknessResult.overall_assessment.biggest_strength}</div>
                <div style={{ padding: 6, background: '#fef2f2', borderRadius: 4 }}><strong style={{ color: '#dc2626' }}>最大弱点</strong><br />{weaknessResult.overall_assessment.biggest_weakness}</div>
              </div>
              {weaknessResult.overall_assessment.priority_fix && (
                <div style={{ marginTop: 6, padding: 6, background: '#fff', borderRadius: 4, fontSize: 12 }}>
                  <strong style={{ color: '#ea580c' }}>优先修复:</strong> {weaknessResult.overall_assessment.priority_fix}
                </div>
              )}
            </div>
          )}

          {/* Issue list */}
          {weaknessResult.issues?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>问题列表</h4>
              {weaknessResult.issues.map((issue: any) => {
                const sev = SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.low;
                const expanded = expandedIssues.has(issue.id);
                return (
                  <div key={issue.id} style={{ background: sev.bg, borderRadius: 8, border: `1px solid ${sev.border}`, overflow: 'hidden' }}>
                    <button onClick={() => toggleIssue(issue.id)} style={{
                      width: '100%', padding: '8px 10px', border: 'none', background: 'transparent',
                      cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div>
                        <span style={{ padding: '1px 8px', borderRadius: 8, fontSize: 11, color: '#fff', background: sev.border, marginRight: 6 }}>
                          {sev.label}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: sev.text }}>{issue.type_name}</span>
                      </div>
                      <span style={{ fontSize: 11, color: '#888' }}>{expanded ? '▲' : '▼'}</span>
                    </button>
                    {expanded && (
                      <div style={{ padding: '0 10px 10px', fontSize: 12 }}>
                        {issue.location && <div style={{ color: '#888', marginBottom: 4 }}>位置: {issue.location}</div>}
                        {issue.problem && <div style={{ marginBottom: 6 }}>{issue.problem}</div>}
                        {issue.original_text && (
                          <div style={{ padding: 8, background: '#fff', borderRadius: 4, borderLeft: '3px solid #dc2626', marginBottom: 6 }}>
                            <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>原文:</div>
                            <div style={{ lineHeight: 1.6 }}>{issue.original_text}</div>
                          </div>
                        )}
                        {issue.fixed_text && (
                          <div style={{ padding: 8, background: '#f0fdf4', borderRadius: 4, borderLeft: '3px solid #10b981', marginBottom: 6 }}>
                            <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>修改示范:</div>
                            <div style={{ lineHeight: 1.6 }}>{issue.fixed_text}</div>
                          </div>
                        )}
                        {issue.explanation && (
                          <div style={{ color: '#6366f1', fontSize: 11 }}>{issue.explanation}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Patterns */}
          {weaknessResult.patterns?.length > 0 && (
            <div style={{ padding: 12, background: '#fffbeb', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>反复出现的模式</h4>
              {weaknessResult.patterns.map((p: any, i: number) => (
                <div key={i} style={{ padding: 8, background: '#fff', borderRadius: 6, marginBottom: 6, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <strong>{p.name}</strong>
                    <span style={{ color: '#888' }}>出现 {p.frequency} 次</span>
                  </div>
                  <div style={{ color: '#666', marginBottom: 2 }}>影响: {p.impact}</div>
                  <div style={{ color: '#6366f1' }}>解决: {p.fix}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
