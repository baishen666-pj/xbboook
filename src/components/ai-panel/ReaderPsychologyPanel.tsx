// @ts-nocheck
import { useState } from 'react';
import {
  readerPsychologyService,
  type AnalyzeResult,
  type PsychologicalProfile,
  type ReaderJourneyMap,
  type PsychologicalTrigger,
} from '@/services/readerPsychologyService';

interface Props {
  projectId: string;
}

type FocusMode = 'attention' | 'emotion' | 'immersion' | 'addiction' | 'all';

const FOCUS_OPTIONS: { id: FocusMode; name: string; icon: string }[] = [
  { id: 'all', name: '全部维度', icon: '🧠' },
  { id: 'attention', name: '注意力', icon: '🎯' },
  { id: 'emotion', name: '情绪', icon: '💓' },
  { id: 'immersion', name: '沉浸感', icon: '🌀' },
  { id: 'addiction', name: '成瘾', icon: '🔥' },
];

function ScoreCard({ title, score, icon, items, improvements }: {
  title: string;
  score: number;
  icon: string;
  items: string[];
  improvements: string[];
}) {
  const scoreColor = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626';
  const scoreBg = score >= 80 ? '#f0fdf4' : score >= 60 ? '#fffbeb' : '#fef2f2';
  return (
    <div style={{ padding: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
        </div>
        <span style={{ padding: '4px 12px', borderRadius: 12, background: scoreBg, color: scoreColor, fontWeight: 700, fontSize: 16 }}>
          {score}
        </span>
      </div>
      {items.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>分析发现：</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {items.map((item, i) => (
              <span key={i} style={{ padding: '2px 8px', borderRadius: 10, background: '#f0f4ff', fontSize: 11, color: '#4338ca' }}>{item}</span>
            ))}
          </div>
        </div>
      )}
      {improvements.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>优化建议：</div>
          <ul style={{ margin: 0, paddingLeft: 14, fontSize: 12, color: '#555' }}>
            {improvements.map((imp, i) => <li key={i} style={{ marginBottom: 2 }}>{imp}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function CognitiveLoadChart({ data }: { data: ReaderJourneyMap['cognitive_load'] }) {
  if (!data || data.length === 0) return null;
  const maxLoad = Math.max(...data.map(d => d.load), 10);
  const w = 640;
  const h = 180;
  const padL = 40;
  const padR = 20;
  const padT = 20;
  const padB = 32;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const points = data.map((d, i) => ({
    x: padL + (i / Math.max(data.length - 1, 1)) * chartW,
    y: padT + chartH - (d.load / maxLoad) * chartH,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${padT + chartH} L${points[0].x},${padT + chartH} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: w }}>
      <defs>
        <linearGradient id="cogGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.05} />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const y = padT + chartH * (1 - pct);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#e5e7eb" strokeDasharray="3,3" />
            <text x={padL - 6} y={y + 4} textAnchor="end" fill="#999" fontSize={10}>{Math.round(maxLoad * pct)}</text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#cogGrad)" opacity={0.25} />
      <path d={linePath} fill="none" stroke="#8b5cf6" strokeWidth={2.5} strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3.5} fill="#8b5cf6" stroke="#fff" strokeWidth={2} />
          {data.length <= 20 && (
            <text x={p.x} y={padT + chartH + 14} textAnchor="middle" fill="#666" fontSize={9}>Ch{p.chapter}</text>
          )}
        </g>
      ))}
      <rect x={w - padR - 90} y={4} width={8} height={8} fill="#8b5cf6" rx={1} />
      <text x={w - padR - 78} y={12} fill="#666" fontSize={9}>认知负荷</text>
    </svg>
  );
}

function EngagementRow({ engagement, index }: { engagement: ReaderJourneyMap['engagement_prediction'][0]; index: number }) {
  const pct = engagement.predicted_engagement;
  const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: index === 0 ? 'none' : '1px solid #f3f4f6' }}>
      <span style={{ minWidth: 36, fontSize: 11, color: '#666', fontWeight: 500 }}>Ch{engagement.chapter}</span>
      <div style={{ flex: 1, height: 10, background: '#f3f4f6', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 5, transition: 'width 0.3s' }} />
      </div>
      <span style={{ minWidth: 28, textAlign: 'right', fontSize: 12, fontWeight: 600, color }}>{pct}%</span>
      <span style={{ fontSize: 10, color: '#888', minWidth: 50, textAlign: 'right' }}>{engagement.primary_driver}</span>
    </div>
  );
}

function DropoffRiskItem({ risk }: { risk: ReaderJourneyMap['dropoff_risks'][0] }) {
  const color = risk.risk >= 60 ? '#dc2626' : risk.risk >= 40 ? '#d97706' : '#16a34a';
  const bg = risk.risk >= 60 ? '#fef2f2' : risk.risk >= 40 ? '#fffbeb' : '#f0fdf4';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: bg, borderRadius: 6, fontSize: 12 }}>
      <span style={{ padding: '2px 8px', borderRadius: 8, background: '#e5e7eb', color: '#444', fontSize: 10, fontWeight: 600 }}>Ch{risk.chapter}</span>
      <span style={{ flex: 1, color: '#555' }}>{risk.psychological_reason}</span>
      <span style={{ padding: '2px 8px', borderRadius: 8, background: '#fff', border: `1px solid ${color}`, color, fontSize: 10, fontWeight: 600 }}>
        {risk.risk}% 流失风险
      </span>
    </div>
  );
}

function TriggerCard({ trigger }: { trigger: PsychologicalTrigger }) {
  const usageColor = trigger.current_usage >= 80 ? '#16a34a' : trigger.current_usage >= 50 ? '#d97706' : '#dc2626';
  return (
    <div style={{ padding: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#1e1b4b' }}>{trigger.trigger}</span>
        <span style={{ padding: '2px 8px', borderRadius: 8, background: '#f0f4ff', color: usageColor, fontSize: 11, fontWeight: 600 }}>
          使用率 {trigger.current_usage}%
        </span>
      </div>
      <div style={{ color: '#666', marginBottom: 6, lineHeight: 1.5 }}>{trigger.description}</div>
      <div style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: '#888' }}>建议用法：</span>
        <span style={{ color: '#4338ca' }}>{trigger.optimal_usage}</span>
      </div>
      {trigger.sample_implementation && (
        <div style={{ padding: 8, background: '#f8fafc', borderRadius: 6, fontSize: 11, lineHeight: 1.6, color: '#555', whiteSpace: 'pre-wrap', borderLeft: '3px solid #8b5cf6' }}>
          {trigger.sample_implementation}
        </div>
      )}
    </div>
  );
}

export function ReaderPsychologyPanel({ projectId }: Props) {
  const [focus, setFocus] = useState<FocusMode>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    const res = await readerPsychologyService.analyze(projectId, { focus });
    if (res.success && res.data) {
      setResult(res.data);
    } else {
      setError(res.error || '分析失败');
    }
    setLoading(false);
  };

  const profile = result?.psychological_profile;
  const journey = result?.reader_journey_map;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>读者心理操控</h3>

      {/* Focus selector */}
      <div style={{ display: 'flex', gap: 4 }}>
        {FOCUS_OPTIONS.map(opt => (
          <button
            key={opt.id}
            onClick={() => setFocus(opt.id)}
            style={{
              flex: 1, padding: '6px 4px', border: focus === opt.id ? '2px solid #8b5cf6' : '1px solid #ddd',
              borderRadius: 8, background: focus === opt.id ? '#f5f3ff' : '#fff', cursor: 'pointer', textAlign: 'center', fontSize: 11,
            }}
          >
            <div style={{ fontSize: 16 }}>{opt.icon}</div>
            <div style={{ fontWeight: 500 }}>{opt.name}</div>
          </button>
        ))}
      </div>

      <button
        onClick={handleAnalyze}
        disabled={loading}
        style={{
          padding: '10px 20px', borderRadius: 8, border: 'none', background: loading ? '#ccc' : '#8b5cf6',
          color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14,
        }}
      >
        {loading ? '心理分析中...' : '开始心理分析'}
      </button>

      {error && <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{error}</div>}

      {profile && (
        <>
          {/* Four-dimension score cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            <ScoreCard
              title="注意力管理"
              icon="🎯"
              score={profile.attention_management.score}
              items={profile.attention_management.hooks_used}
              improvements={profile.attention_management.improvements}
            />
            <ScoreCard
              title="情绪引导"
              icon="💓"
              score={profile.emotional_engineering.score}
              items={profile.emotional_engineering.techniques}
              improvements={profile.emotional_engineering.improvements}
            />
            <ScoreCard
              title="沉浸感"
              icon="🌀"
              score={profile.immersion_factors.score}
              items={profile.immersion_factors.enhancing_factors}
              improvements={profile.immersion_factors.improvements}
            />
            <ScoreCard
              title="成瘾机制"
              icon="🔥"
              score={profile.addiction_mechanisms.score}
              items={profile.addiction_mechanisms.progress_loops}
              improvements={profile.addiction_mechanisms.improvements}
            />
          </div>

          {/* Weak moments / emotional gaps details */}
          {profile.attention_management.weak_moments.length > 0 && (
            <div style={{ padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 13 }}>注意力低谷</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {profile.attention_management.weak_moments.map((wm, i) => (
                  <div key={i} style={{ padding: '4px 8px', background: '#fff', borderRadius: 4, fontSize: 12 }}>
                    <span style={{ color: '#8b5cf6', fontWeight: 600 }}>第{wm.chapter}章</span>
                    <span style={{ color: '#666', marginLeft: 8 }}>{wm.issue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {profile.emotional_engineering.emotional_peaks.length > 0 && (
            <div style={{ padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 13 }}>情感高峰</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {profile.emotional_engineering.emotional_peaks.map((ep, i) => (
                  <div key={i} style={{ padding: '4px 8px', background: '#fff', borderRadius: 4, fontSize: 12 }}>
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>第{ep.chapter}章</span>
                    <span style={{ color: '#666', marginLeft: 8 }}>{ep.technique}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {profile.emotional_engineering.emotional_gaps.length > 0 && (
            <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 13 }}>情感空白</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {profile.emotional_engineering.emotional_gaps.map((eg, i) => (
                  <div key={i} style={{ padding: '4px 8px', background: '#fff', borderRadius: 4, fontSize: 12 }}>
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>第{eg.chapter}章</span>
                    <span style={{ color: '#666', marginLeft: 8 }}>{eg.issue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Addiction mechanisms details */}
          {profile.addiction_mechanisms.cliffhangers.length > 0 && (
            <div style={{ padding: 12, background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 13 }}>悬念设置</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {profile.addiction_mechanisms.cliffhangers.map((cf, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: '#fff', borderRadius: 4, fontSize: 12 }}>
                    <span style={{ padding: '2px 6px', borderRadius: 8, background: '#8b5cf6', color: '#fff', fontSize: 10, fontWeight: 600 }}>第{cf.chapter}章</span>
                    <span style={{ flex: 1, color: '#555' }}>{cf.type}</span>
                    <span style={{ padding: '2px 6px', borderRadius: 8, background: cf.strength >= 80 ? '#f0fdf4' : '#fffbeb', color: cf.strength >= 80 ? '#16a34a' : '#d97706', fontSize: 10, fontWeight: 600 }}>
                      强度 {cf.strength}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {profile.immersion_factors.breaking_factors.length > 0 && (
            <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 13 }}>沉浸感破坏因素</h4>
              <ul style={{ margin: 0, paddingLeft: 14, fontSize: 12, color: '#dc2626' }}>
                {profile.immersion_factors.breaking_factors.map((bf, i) => <li key={i} style={{ marginBottom: 2 }}>{bf}</li>)}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Reader journey map */}
      {journey && (
        <>
          {/* Cognitive load chart */}
          {journey.cognitive_load.length > 0 && (
            <div style={{ padding: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>认知负荷曲线</h4>
              <CognitiveLoadChart data={journey.cognitive_load} />
            </div>
          )}

          {/* Engagement prediction */}
          {journey.engagement_prediction.length > 0 && (
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>参与度预测</h4>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {journey.engagement_prediction.map((ep, i) => (
                  <EngagementRow key={i} engagement={ep} index={i} />
                ))}
              </div>
            </div>
          )}

          {/* Dropoff risks */}
          {journey.dropoff_risks.length > 0 && (
            <div style={{ padding: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>流失风险</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {journey.dropoff_risks.map((dr, i) => (
                  <DropoffRiskItem key={i} risk={dr} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Psychological triggers */}
      {result?.psychological_triggers && result.psychological_triggers.length > 0 && (
        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>心理学效应触发器</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {result.psychological_triggers.map((trigger, i) => (
              <TriggerCard key={i} trigger={trigger} />
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {result?.recommendations && result.recommendations.length > 0 && (
        <div style={{ padding: 12, background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 8 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>综合建议</h4>
          <ul style={{ margin: 0, paddingLeft: 14, fontSize: 12, color: '#4338ca' }}>
            {result.recommendations.map((rec, i) => <li key={i} style={{ marginBottom: 4, lineHeight: 1.6 }}>{rec}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
