// @ts-nocheck
import { useState } from 'react';
import { dialogueConsistencyService } from '@/services/dialogueConsistencyService';

interface Props {
  projectId: string;
}

const TABS = [
  { id: 'check', name: '对话一致性检查', icon: '💬' },
  { id: 'voice', name: '语音档案', icon: '🔍' },
] as const;

const FORMALITY_MAP: Record<string, string> = {
  formal: '正式庄重',
  casual: '随意口语',
  mixed: '混合风格',
};

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600, color }}>{score}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: '#e5e7eb' }}>
        <div style={{ height: '100%', borderRadius: 3, background: color, width: `${score}%`, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

export function DialogueConsistencyPanel({ projectId }: Props) {
  const [tab, setTab] = useState<'check' | 'voice'>('check');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<any>(null);
  const [voiceResult, setVoiceResult] = useState<any>(null);
  const [characterName, setCharacterName] = useState('');
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [expandedChar, setExpandedChar] = useState<number | null>(null);
  const [expandedVoice, setExpandedVoice] = useState<number | null>(null);

  const handleCheck = async () => {
    setLoading(true);
    setError(null);
    setCheckResult(null);
    const res = await dialogueConsistencyService.check(projectId, {
      characterNames: selectedCharacters.length > 0 ? selectedCharacters : undefined,
    });
    if (res?.success && res.data) {
      setCheckResult(res.data);
    } else {
      setError(res?.error || '检查失败');
    }
    setLoading(false);
  };

  const handleVoice = async () => {
    if (!characterName.trim()) return;
    setLoading(true);
    setError(null);
    setVoiceResult(null);
    const res = await dialogueConsistencyService.voiceProfile(projectId, {
      characterName: characterName.trim(),
    });
    if (res?.success && res.data) {
      setVoiceResult(res.data);
    } else {
      setError(res?.error || '生成失败');
    }
    setLoading(false);
  };

  const toggleCharacter = (name: string) => {
    setSelectedCharacters(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>💬 AI角色语音一致性</h3>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 8 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id as any); setError(null); }}
            style={{
              flex: 1, padding: '8px 4px', border: tab === t.id ? '2px solid #6366f1' : '1px solid #ddd',
              borderRadius: 8, background: tab === t.id ? '#eef2ff' : '#fff', cursor: 'pointer', textAlign: 'center', fontSize: 12,
            }}
          >
            <div style={{ fontSize: 20 }}>{t.icon}</div>
            <div style={{ fontWeight: 500 }}>{t.name}</div>
          </button>
        ))}
      </div>

      {/* Tab: Consistency Check */}
      {tab === 'check' && (
        <>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>关注角色（可选，留空分析全部）</label>
            <input
              value={selectedCharacters.join('、')}
              onChange={e => {
                const val = e.target.value.trim();
                setSelectedCharacters(val ? val.split(/[、,，\s]+/).filter(Boolean) : []);
              }}
              placeholder="输入角色名，用顿号分隔"
              style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}
            />
          </div>

          <button
            onClick={handleCheck}
            disabled={loading}
            style={{
              padding: '10px 20px', borderRadius: 8, border: 'none', background: loading ? '#ccc' : '#6366f1',
              color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '分析中...' : '💬 开始一致性检查'}
          </button>

          {error && <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{error}</div>}

          {checkResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Global findings */}
              {checkResult.global_findings && (
                <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>📊 全局评估</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                    <ScoreBar score={checkResult.global_findings.dialogue_quality || 0} label="对话质量" />
                    <ScoreBar score={checkResult.global_findings.character_distinctiveness || 0} label="角色区分度" />
                  </div>
                  {checkResult.global_findings.strengths?.length > 0 && (
                    <div style={{ marginBottom: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#10b981' }}>优点</div>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                        {checkResult.global_findings.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {checkResult.global_findings.issues?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#ef4444' }}>问题</div>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                        {checkResult.global_findings.issues.map((s: string, i: number) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Character cards */}
              {checkResult.characters?.map((char: any, idx: number) => {
                const expanded = expandedChar === idx;
                const scoreColor = char.consistency_score >= 80 ? '#10b981' : char.consistency_score >= 60 ? '#f59e0b' : '#ef4444';
                return (
                  <div key={idx} style={{
                    border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden',
                    borderLeft: `4px solid ${scoreColor}`,
                  }}>
                    <div
                      onClick={() => setExpandedChar(expanded ? null : idx)}
                      style={{ padding: '10px 12px', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{char.name}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>
                          一致性 <span style={{ fontWeight: 600, color: scoreColor }}>{char.consistency_score}%</span>
                          {char.voice_profile?.formality && ` · ${FORMALITY_MAP[char.voice_profile.formality] || char.voice_profile.formality}`}
                        </div>
                      </div>
                      <span style={{ fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
                    </div>
                    {expanded && (
                      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {/* Voice profile */}
                        {char.voice_profile && (
                          <div style={{ padding: 8, background: '#f8fafc', borderRadius: 6 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>语音特征</div>
                            <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {char.voice_profile.vocabulary_style && <div><strong>用词：</strong>{char.voice_profile.vocabulary_style}</div>}
                              {char.voice_profile.sentence_pattern && <div><strong>句式：</strong>{char.voice_profile.sentence_pattern}</div>}
                              {char.voice_profile.tone && <div><strong>语调：</strong>{char.voice_profile.tone}</div>}
                              {char.voice_profile.emotional_range && <div><strong>情感范围：</strong>{char.voice_profile.emotional_range}</div>}
                              {char.voice_profile.catchphrases?.length > 0 && (
                                <div><strong>口头禅：</strong>{char.voice_profile.catchphrases.join('、')}</div>
                              )}
                            </div>
                          </div>
                        )}
                        {/* Inconsistent chapters */}
                        {char.inconsistent_chapters?.length > 0 && (
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#ef4444' }}>不一致章节</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {char.inconsistent_chapters.map((ic: any, i: number) => (
                                <div key={i} style={{ padding: 6, background: '#fef2f2', borderRadius: 4, fontSize: 12 }}>
                                  <div style={{ fontWeight: 500 }}>第{ic.chapter}章: {ic.issue}</div>
                                  {ic.original && <div style={{ color: '#888', marginTop: 2 }}>原文: "{ic.original}"</div>}
                                  {ic.suggestion && <div style={{ color: '#10b981', marginTop: 2 }}>建议: {ic.suggestion}</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {char.overall_assessment && (
                          <div style={{ fontSize: 12, color: '#666', padding: 6, background: '#f8fafc', borderRadius: 4 }}>{char.overall_assessment}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Recommendations */}
              {checkResult.recommendations?.length > 0 && (
                <div style={{ padding: 12, background: '#fffbeb', borderRadius: 8 }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>💡 改进建议</h4>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                    {checkResult.recommendations.map((r: string, i: number) => <li key={i} style={{ marginBottom: 2 }}>{r}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Tab: Voice Profile */}
      {tab === 'voice' && (
        <>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>角色名称</label>
            <input
              value={characterName}
              onChange={e => setCharacterName(e.target.value)}
              placeholder="输入要分析的角色名"
              style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}
            />
          </div>

          <button
            onClick={handleVoice}
            disabled={loading || !characterName.trim()}
            style={{
              padding: '10px 20px', borderRadius: 8, border: 'none', background: loading || !characterName.trim() ? '#ccc' : '#6366f1',
              color: '#fff', fontWeight: 600, cursor: loading || !characterName.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '分析中...' : '🔍 生成语音档案'}
          </button>

          {error && <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{error}</div>}

          {voiceResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Archetype */}
              {voiceResult.voice_archetype && (
                <div style={{ padding: 10, background: '#eef2ff', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#888' }}>语音原型</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#6366f1' }}>{voiceResult.voice_archetype}</div>
                </div>
              )}

              {/* Features */}
              {voiceResult.features && (
                <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>📋 语音特征</h4>

                  {voiceResult.features.vocabulary && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>用词特点</div>
                      <div style={{ fontSize: 12, color: '#666' }}>等级: {voiceResult.features.vocabulary.level}</div>
                      {voiceResult.features.vocabulary.preferred_words?.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                          {voiceResult.features.vocabulary.preferred_words.map((w: string, i: number) => (
                            <span key={i} style={{ padding: '2px 8px', background: '#e0e7ff', borderRadius: 10, fontSize: 11 }}>{w}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {voiceResult.features.syntax && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>句式特征</div>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        平均长度: {voiceResult.features.syntax.avg_sentence_length}字 · {voiceResult.features.syntax.pattern}
                      </div>
                      {voiceResult.features.syntax.special_patterns?.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                          {voiceResult.features.syntax.special_patterns.map((p: string, i: number) => (
                            <span key={i} style={{ padding: '2px 8px', background: '#fef3c7', borderRadius: 10, fontSize: 11 }}>{p}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {voiceResult.features.tone && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>语调</div>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        主要: {voiceResult.features.tone.primary}
                        {voiceResult.features.tone.secondary && ` · 次要: ${voiceResult.features.tone.secondary}`}
                      </div>
                    </div>
                  )}

                  {voiceResult.features.emotional_expression && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>情感表达</div>
                      <div style={{ fontSize: 12, color: '#666' }}>{voiceResult.features.emotional_expression.style}</div>
                      {voiceResult.features.emotional_expression.triggers?.length > 0 && (
                        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>触发: {voiceResult.features.emotional_expression.triggers.join('、')}</div>
                      )}
                    </div>
                  )}

                  {voiceResult.features.speech_habits?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>说话习惯</div>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                        {voiceResult.features.speech_habits.map((h: string, i: number) => <li key={i}>{h}</li>)}
                      </ul>
                    </div>
                  )}

                  {voiceResult.features.catchphrases?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>口头禅</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                        {voiceResult.features.catchphrases.map((c: string, i: number) => (
                          <span key={i} style={{ padding: '2px 10px', background: '#fce7f3', borderRadius: 10, fontSize: 12, fontWeight: 500 }}>"{c}"</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sample dialogues */}
              {voiceResult.sample_dialogues?.length > 0 && (
                <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8 }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>🎭 示例对话</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {voiceResult.sample_dialogues.map((d: any, i: number) => (
                      <div key={i} style={{ padding: 8, background: '#fff', borderRadius: 6, borderLeft: '3px solid #10b981' }}>
                        <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{d.context}</div>
                        <div style={{ fontSize: 13, lineHeight: 1.5 }}>"{d.line}"</div>
                        {d.features_shown?.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                            {d.features_shown.map((f: string, j: number) => (
                              <span key={j} style={{ padding: '1px 6px', background: '#e0e7ff', borderRadius: 8, fontSize: 10 }}>{f}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Consistency tips */}
              {voiceResult.consistency_tips?.length > 0 && (
                <div style={{ padding: 12, background: '#fffbeb', borderRadius: 8 }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 14 }}>💡 保持一致性技巧</h4>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                    {voiceResult.consistency_tips.map((t: string, i: number) => <li key={i} style={{ marginBottom: 2 }}>{t}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
