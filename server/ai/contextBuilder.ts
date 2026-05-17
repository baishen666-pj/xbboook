import { findByProject as findChapters } from '../db/repositories/chapterRepo.js';
import { readChapter } from '../services/fileService.js';
import { findByProject as findCharacters, findById as findCharacterById, findRelationsForCharacter, findRelations } from '../db/repositories/characterRepo.js';
import { findByProject as findArcs } from '../db/repositories/storyArcRepo.js';
import { findByProject as findThreads } from '../db/repositories/plotThreadRepo.js';
import { findByProject as findWorldviews } from '../db/repositories/worldviewRepo.js';
import { findAll as findAllForeshadowing } from '../db/repositories/foreshadowingRepo.js';
import { findByProject as findOutlines } from '../db/repositories/outlineRepo.js';
import { findById as findProject } from '../db/repositories/projectRepo.js';
import { get as getPreference } from '../db/repositories/userPreferenceRepo.js';
import { findRelevant as findRelevantMemories } from '../db/repositories/memoryRepo.js';
import { retrieve as ragRetrieve } from './ragRetriever.js';
import type { Chapter, Character, CharacterRelation } from '../types/index.js';

export interface ContextSource {
  priority: number;
  label: string;
  content: string;
}

export interface BuildContextOptions {
  projectId: string;
  currentChapterId?: string;
  selectedText?: string;
  maxTokens?: number;
  outlineContent?: string;
  skillId?: string;
  pipelinePreviousChapter?: string;
  disabledSources?: string[];
}

export interface ContextSourceInfo {
  label: string;
  description: string;
  estimatedTokens: number;
  enabled: boolean;
}

const CHARS_PER_TOKEN = 2.5;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjkCount = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
  const cjkRatio = cjkCount / text.length;
  const effectiveCharsPerToken = cjkRatio * 1.5 + (1 - cjkRatio) * 4.0;
  return Math.ceil(text.length / effectiveCharsPerToken);
}

function getEffectiveCharsPerToken(text: string): number {
  if (!text) return CHARS_PER_TOKEN;
  const cjkCount = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
  const cjkRatio = cjkCount / text.length;
  return cjkRatio * 1.5 + (1 - cjkRatio) * 4.0;
}

export function truncateToTokens(text: string, maxTokens: number): string {
  const effectiveCharsPerToken = getEffectiveCharsPerToken(text);
  const maxChars = Math.floor(maxTokens * effectiveCharsPerToken);
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function truncateHistory(
  history: HistoryMessage[],
  maxTokens: number,
): HistoryMessage[] {
  if (history.length === 0) return [];

  let totalTokens = 0;
  for (const msg of history) {
    totalTokens += estimateTokens(msg.content) + 4;
  }

  if (totalTokens <= maxTokens) return history;

  const result: HistoryMessage[] = [];
  let remaining = maxTokens;

  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    const msgTokens = estimateTokens(msg.content) + 4;

    if (msgTokens > remaining) {
      const available = remaining - 4;
      if (available > 20) {
        result.unshift({
          role: msg.role,
          content: truncateToTokens(msg.content, available),
        });
      }
      break;
    }

    result.unshift(msg);
    remaining -= msgTokens;
  }

  return result;
}

function characterProfiles(characters: Character[]): string {
  if (characters.length === 0) return '';
  return characters
    .map((c) => {
      const parts = [`【${c.name}】`];
      if (c.nickname) parts.push(`别名: ${c.nickname}`);
      parts.push(`角色: ${c.role_type}`);
      if (c.gender) parts.push(`性别: ${c.gender}`);
      if (c.age) parts.push(`年龄: ${c.age}`);
      if (c.appearance) parts.push(`外貌: ${c.appearance}`);
      if (c.personality) parts.push(`性格: ${c.personality}`);
      if (c.background) parts.push(`背景: ${c.background}`);
      if (c.abilities) parts.push(`能力: ${c.abilities}`);
      if (c.speech_style) parts.push(`说话风格: ${c.speech_style}`);
      if (c.verbal_tics) parts.push(`口癖: ${c.verbal_tics}`);
      if (c.vocabulary_level && c.vocabulary_level !== 'common') parts.push(`词汇水平: ${c.vocabulary_level}`);
      if (c.sentence_length_pref && c.sentence_length_pref !== 'medium') parts.push(`句式偏好: ${c.sentence_length_pref}`);
      if (c.emotional_expressiveness && c.emotional_expressiveness !== 'moderate') parts.push(`情感表达: ${c.emotional_expressiveness}`);
      if (c.voice_examples) parts.push(`对话示例:\n${c.voice_examples}`);
      return parts.join('\n');
    })
    .join('\n\n');
}

function buildChapterSummary(chapter: Chapter, index: number): string {
  const summary = chapter.summary || '(无摘要)';
  return `第${index + 1}章「${chapter.title}」— ${summary}`;
}

function lostInMiddleSort(sources: ContextSource[]): ContextSource[] {
  const sorted = [...sources].sort((a, b) => b.priority - a.priority);
  const result: ContextSource[] = [];
  let front = true;

  for (const source of sorted) {
    if (front) {
      result.unshift(source);
    } else {
      result.push(source);
    }
    front = !front;
  }

  return result;
}

const ALL_SOURCE_LABELS = [
  '选中内容', '当前章节', '前文', '上一章生成内容',
  '大纲内容', '角色设定', '章节概要', '故事弧线与情节线索',
  '项目设定', '世界设定', '伏笔线索', '角色关系', '大纲结构',
  'AI记忆', 'RAG检索',
];

export function getContextSourceLabels(): string[] {
  return [...ALL_SOURCE_LABELS];
}

export async function getContextSources(projectId: string, disabledSources?: string[]): Promise<ContextSourceInfo[]> {
  const disabled = new Set(disabledSources ?? []);
  const sources: ContextSourceInfo[] = [];

  const chapters = findChapters(projectId);
  const characters = findCharacters(projectId);
  const project = findProject(projectId);

  sources.push({ label: '当前章节', description: '当前打开章节的完整内容', estimatedTokens: Math.floor(10000 * 0.4), enabled: !disabled.has('当前章节') });
  sources.push({ label: '角色设定', description: '所有角色的姓名、性格、说话风格等', estimatedTokens: Math.ceil(characters.length * 60 / 2.5), enabled: !disabled.has('角色设定') });
  sources.push({ label: '章节概要', description: '所有章节的标题和摘要', estimatedTokens: Math.ceil(chapters.length * 40 / 2.5), enabled: !disabled.has('章节概要') });
  sources.push({ label: '项目设定', description: '题材、写作风格、作品简介', estimatedTokens: 50, enabled: !disabled.has('项目设定') });

  try {
    const worldviews = findWorldviews(projectId);
    sources.push({ label: '世界设定', description: `世界观设定（${worldviews.length} 项）`, estimatedTokens: Math.min(500, Math.ceil(worldviews.length * 60 / 2.5)), enabled: !disabled.has('世界设定') });
  } catch { /* skip */ }

  try {
    const foreshadowings = findAllForeshadowing(projectId);
    sources.push({ label: '伏笔线索', description: `伏笔与线索（${foreshadowings.length} 个）`, estimatedTokens: Math.min(400, Math.ceil(foreshadowings.length * 30 / 2.5)), enabled: !disabled.has('伏笔线索') });
  } catch { /* skip */ }

  try {
    const relations = findRelations(projectId);
    sources.push({ label: '角色关系', description: `角色间关系（${relations.length} 对）`, estimatedTokens: Math.ceil(relations.length * 25 / 2.5), enabled: !disabled.has('角色关系') });
  } catch { /* skip */ }

  try {
    const arcs = findArcs(projectId);
    const threads = findThreads(projectId);
    sources.push({ label: '故事弧线与情节线索', description: `弧线 ${arcs.length} 个，线索 ${threads.length} 条`, estimatedTokens: Math.ceil((arcs.length + threads.length) * 30 / 2.5), enabled: !disabled.has('故事弧线与情节线索') });
  } catch { /* skip */ }

  try {
    const outlines = findOutlines(projectId);
    sources.push({ label: '大纲结构', description: `大纲节点 ${outlines.length} 个`, estimatedTokens: Math.min(400, Math.ceil(outlines.length * 20 / 2.5)), enabled: !disabled.has('大纲结构') });
  } catch { /* skip */ }

  sources.push({ label: '前文', description: '当前章节前 2 章内容', estimatedTokens: Math.floor(10000 * 0.15) * 2, enabled: !disabled.has('前文') });

  return sources;
}

export async function buildContext(options: BuildContextOptions): Promise<ContextSource[]> {
  const {
    projectId,
    currentChapterId,
    selectedText,
    maxTokens = 10000,
    outlineContent,
    skillId = '',
    pipelinePreviousChapter,
    disabledSources = [],
  } = options;

  const disabled = new Set(disabledSources);

  const sources: ContextSource[] = [];

  // Priority 10: selected text (user is directly working with this)
  if (selectedText && !disabled.has('选中内容')) {
    sources.push({
      priority: 10,
      label: '选中内容',
      content: selectedText,
    });
  }

  // Priority 8: current chapter content
  const chapters = findChapters(projectId);
  const currentChapter = currentChapterId
    ? chapters.find((c) => c.id === currentChapterId)
    : undefined;

  if (currentChapter && !disabled.has('当前章节')) {
    const content = await readChapter(projectId, currentChapter.id);
    if (content) {
      const idx = chapters.findIndex((c) => c.id === currentChapter.id);
      sources.push({
        priority: 8,
        label: `当前章节「${currentChapter.title}」`,
        content: truncateToTokens(content, Math.floor(maxTokens * 0.4)),
      });

      // Priority 7: previous 2 chapters for continuity
      for (let i = Math.max(0, idx - 2); i < idx && !disabled.has('前文'); i++) {
        const prev = chapters[i];
        const prevContent = await readChapter(projectId, prev.id);
        if (prevContent) {
          sources.push({
            priority: 7,
            label: `前文「${prev.title}」`,
            content: truncateToTokens(prevContent, Math.floor(maxTokens * 0.15)),
          });
        }
      }
    }
  }

  // Priority 8: pipeline previous chapter content (for sequential generation)
  if (pipelinePreviousChapter && !disabled.has('上一章生成内容')) {
    sources.push({
      priority: 8,
      label: '上一章生成内容',
      content: truncateToTokens(pipelinePreviousChapter, Math.floor(maxTokens * 0.2)),
    });
  }

  // Priority 9: outline content (for chapter-generate skill)
  if (outlineContent && !disabled.has('大纲内容')) {
    sources.push({
      priority: 9,
      label: '大纲内容',
      content: outlineContent,
    });
  }

  // Priority 8: character profiles (elevated — voice consistency is critical)
  const characters = findCharacters(projectId);
  const charText = characterProfiles(characters);
  if (charText && !disabled.has('角色设定')) {
    sources.push({
      priority: 8,
      label: '角色设定',
      content: charText,
    });
  }

  // Priority 4: chapter summaries for plot awareness
  if (chapters.length > 0 && !disabled.has('章节概要')) {
    const summaries = chapters.map((c, i) => buildChapterSummary(c, i)).join('\n');
    sources.push({
      priority: 4,
      label: '章节概要',
      content: summaries,
    });
  }

  // Priority 5: story arcs and plot threads
  let arcs: any[] = [];
  let threads: any[] = [];
  try {
    arcs = findArcs(projectId);
    threads = findThreads(projectId);
  } catch (err) {
    console.warn('[contextBuilder] Failed to load arcs/threads:', err instanceof Error ? err.message : err);
  }
  if ((arcs.length > 0 || threads.length > 0) && !disabled.has('故事弧线与情节线索')) {
    const arcText = arcs.map(a => `【${a.name}】(${a.status}) ${a.description || ''}`).join('\n');
    const threadText = threads.map(t => `线索「${t.name}」(${t.status}, 优先级: ${t.priority}) ${t.description || ''}`).join('\n');
    sources.push({
      priority: 5,
      label: '故事弧线与情节线索',
      content: [arcText, threadText].filter(Boolean).join('\n'),
    });
  }

  // Priority 9: project-level settings (genre, writing style, description)
  const project = findProject(projectId);
  if (project) {
    const parts: string[] = [];
    if (project.genre) parts.push(`题材: ${project.genre}`);
    if (project.writing_style) parts.push(`写作风格: ${project.writing_style}`);
    if (project.description) parts.push(`作品简介: ${project.description}`);
    if (project.writing_mode && project.writing_mode !== 'webnovel') {
      parts.push(`写作模式: ${project.writing_mode}`);
    }
    if (parts.length > 0 && !disabled.has('项目设定')) {
      sources.push({ priority: 9, label: '项目设定', content: parts.join('\n') });
    }
  }

  // Priority 7: worldview (grouped by category)
  try {
    const worldviews = findWorldviews(projectId);
    if (worldviews.length > 0) {
      const grouped = new Map<string, string[]>();
      for (const w of worldviews) {
        const list = grouped.get(w.category) || [];
        list.push(w.content ? `${w.title}: ${truncateToTokens(w.content, 80)}` : w.title);
        grouped.set(w.category, list);
      }
      const wvText = Array.from(grouped.entries())
        .map(([cat, items]) => `【${cat}】\n${items.join('\n')}`)
        .join('\n\n');
      sources.push({ priority: 7, label: '世界设定', content: truncateToTokens(wvText, 500) });
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.warn('[contextBuilder] worldview load failed:', err);
  }

  // Priority 6: foreshadowing (skill-aware filtering)
  try {
    const foreshadowings = findAllForeshadowing(projectId);
    if (foreshadowings.length > 0 && !disabled.has('伏笔线索')) {
      const foreshadowingSkills = ['continue', 'plot-planning', 'foreshadowing-track', 'consistency', 'consistency-scan', 'inspiration', 'chapter-generate'];
      const filtered = foreshadowingSkills.includes(skillId)
        ? foreshadowings
        : foreshadowings.filter(f => f.status === 'planted');
      if (filtered.length > 0) {
        const fsText = filtered.map(f => {
          const status = f.status === 'planted' ? '已埋设' : f.status === 'harvested' ? '已回收' : '已遗忘';
          return `「${f.title}」(${status}, ${f.importance}) ${f.description || ''}`;
        }).join('\n');
        sources.push({ priority: 6, label: '伏笔线索', content: truncateToTokens(fsText, 400) });
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.warn('[contextBuilder] foreshadowing load failed:', err);
  }

  // Priority 6: character relations
  if (characters.length > 0 && !disabled.has('角色关系')) {
    try {
      const relations = findRelations(projectId);
      if (relations.length > 0) {
        const relationText = relations.map(r => {
          const charA = characters.find(c => c.id === r.character_a_id);
          const charB = characters.find(c => c.id === r.character_b_id);
          if (!charA || !charB) return '';
          return `${charA.name} ↔ ${charB.name}: ${r.relation_type}${r.description ? ` (${r.description})` : ''}`;
        }).filter(Boolean).join('\n');
        if (relationText) {
          sources.push({ priority: 6, label: '角色关系', content: relationText });
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.warn('[contextBuilder] relations load failed:', err);
    }
  }

  // Priority 5: outline structure (when not passed via outlineContent)
  if (!outlineContent && !disabled.has('大纲结构')) {
    try {
      const outlines = findOutlines(projectId);
      if (outlines.length > 0) {
        const outlineText = outlines
          .map(o => `${'  '.repeat(o.level)}${o.title}${o.content ? `: ${truncateToTokens(o.content, 50)}` : ''}`)
          .join('\n');
        sources.push({ priority: 5, label: '大纲结构', content: truncateToTokens(outlineText, 400) });
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.warn('[contextBuilder] outlines load failed:', err);
    }
  }

  // Priority 7: style profile
  try {
    const styleRaw = getPreference(`default_${projectId}`, 'style_profile');
    if (styleRaw) {
      const styleProfile = JSON.parse(styleRaw) as {
        dimensions: Record<string, number>;
        keywords: string[];
        summary: string;
      };
      const dimLabels: Record<string, string> = {
        language: '语言风格', narrative: '叙事节奏', emotional: '情感基调',
        dialogue: '对话风格', description: '描写特点', webNovel: '网文特质',
      };
      const dimText = Object.entries(styleProfile.dimensions)
        .map(([k, v]) => `${dimLabels[k] ?? k}: ${v}/10`)
        .join('\n');
      const kwText = styleProfile.keywords.length > 0 ? `关键词: ${styleProfile.keywords.join('、')}` : '';
      const styleText = [dimText, kwText, styleProfile.summary].filter(Boolean).join('\n');
      if (styleText) {
        sources.push({ priority: 7, label: '写作风格档案', content: styleText });
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.warn('[contextBuilder] style profile load failed:', err);
  }

  // Priority 9: deep style fingerprint (if available)
  try {
    const { getFingerprint, buildStyleInjectionSource } = await import('./styleLearner.js');
    const fp = getFingerprint(projectId);
    if (fp) {
      sources.push(buildStyleInjectionSource(fp));
    }
  } catch { /* skip if style fingerprint not available */ }

  // Priority 5: AI memories (auto-extracted and manual)
  if (!disabled.has('AI记忆')) {
    try {
      const memories = findRelevantMemories(projectId, 20);
      if (memories.length > 0) {
        const memText = memories.map(m => {
          const prefix = m.importance === 'critical' ? '【重要】' : m.importance === 'high' ? '【注意】' : '';
          return `${prefix}[${m.category}] ${m.title}: ${m.content}`;
        }).join('\n');
        sources.push({ priority: 5, label: 'AI记忆', content: truncateToTokens(memText, 600) });
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.warn('[contextBuilder] memory load failed:', err);
    }
  }

  // Priority 3: RAG retrieval (semantic search across all knowledge)
  if (!disabled.has('RAG检索') && currentChapterId) {
    try {
      const ragQuery = [
        selectedText || '',
        currentChapter?.summary || '',
        project?.genre || '',
      ].filter(Boolean).join(' ').slice(0, 200);

      if (ragQuery.length >= 4) {
        const ragResults = ragRetrieve(projectId, ragQuery, { maxTokens: 800, maxResults: 5 });
        if (ragResults.length > 0) {
          const ragText = ragResults.map(r => `[${r.sourceType}] ${r.content}`).join('\n');
          sources.push({ priority: 3, label: 'RAG检索', content: truncateToTokens(ragText, 800) });
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.warn('[contextBuilder] RAG retrieval failed:', err);
    }
  }

  // Apply Lost-in-Middle ordering and budget
  const ordered = lostInMiddleSort(sources);
  let remaining = maxTokens;

  return ordered
    .map((source) => {
      const tokens = estimateTokens(source.content);
      if (tokens > remaining) {
        return {
          ...source,
          content: truncateToTokens(source.content, remaining),
        };
      }
      remaining -= tokens;
      return source;
    })
    .filter((s) => s.content.length > 0);
}

export function characterDialogueProfiles(
  character1: Character,
  character2: Character,
  relations: CharacterRelation[],
): string {
  const profile = (c: Character) => {
    const parts = [`【${c.name}】`];
    if (c.nickname) parts.push(`别名: ${c.nickname}`);
    parts.push(`角色: ${c.role_type}`);
    if (c.gender) parts.push(`性别: ${c.gender}`);
    if (c.age) parts.push(`年龄: ${c.age}`);
    if (c.appearance) parts.push(`外貌: ${c.appearance}`);
    if (c.personality) parts.push(`性格: ${c.personality}`);
    if (c.background) parts.push(`背景: ${c.background}`);
    if (c.abilities) parts.push(`能力: ${c.abilities}`);
    if (c.notes) parts.push(`备注: ${c.notes}`);
    if (c.speech_style) parts.push(`说话风格: ${c.speech_style}`);
    if (c.verbal_tics) parts.push(`口头禅: ${c.verbal_tics}`);
    if (c.vocabulary_level && c.vocabulary_level !== 'common') parts.push(`用词水平: ${c.vocabulary_level}`);
    if (c.sentence_length_pref && c.sentence_length_pref !== 'medium') parts.push(`句式偏好: ${c.sentence_length_pref}`);
    if (c.emotional_expressiveness && c.emotional_expressiveness !== 'moderate') parts.push(`情感表达: ${c.emotional_expressiveness}`);
    if (c.voice_examples) parts.push(`对话示例: ${c.voice_examples}`);
    return parts.join('\n');
  };

  const relationText = relations.length > 0
    ? relations
        .map((r) => `${r.relation_type}${r.description ? `：${r.description}` : ''}`)
        .join('\n')
    : '（未设定关系）';

  return [
    '=== 角色A ===',
    profile(character1),
    '',
    '=== 角色B ===',
    profile(character2),
    '',
    '=== 两人关系 ===',
    relationText,
  ].join('\n');
}

export function contextToString(sources: ContextSource[]): string {
  return sources.map((s) => `=== ${s.label} ===\n${s.content}`).join('\n\n');
}
