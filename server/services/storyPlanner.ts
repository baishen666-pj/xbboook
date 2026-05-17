import { completeChat } from '../ai/agentFactory.js';
import { buildContext, contextToString, type ContextSource } from '../ai/contextBuilder.js';
import * as storyPlanRepo from '../db/repositories/storyPlanRepo.js';
import * as chapterRepo from '../db/repositories/chapterRepo.js';
import { readChapter } from './fileService.js';
import { analyzeContent } from './contentAnalysis.js';
import { logger } from '../middleware/logger.js';

export interface PlanTargetData {
  theme?: string;
  conflictCore?: string;
  resolution?: string;
  keyEvents?: string[];
  characterArcs?: Array<{ characterId: string; from: string; to: string }>;
  chapterCount?: { min: number; max: number };
  wordCountTarget?: number;
  pacingTarget?: { start: number; middle: number; end: number };
}

export interface PacingSnapshot {
  planId: string;
  chapterIndex: number;
  chapterTitle: string;
  tension: number;
  emotion: number;
  action: number;
  dialogueRatio: number;
  wordCount: number;
  deviation: number;
}

const PLAN_GENERATION_PROMPT = `你是一位专业的网文故事策划师。请基于项目信息生成长篇叙事规划。

严格按照以下 JSON 格式输出（不要加 markdown 代码块标记）：
{
  "arcs": [
    {
      "title": "故事弧名称",
      "description": "弧线概述",
      "theme": "核心主题",
      "conflictCore": "核心冲突",
      "resolution": "解决方式",
      "keyEvents": ["关键事件1", "关键事件2"],
      "volumes": [
        {
          "title": "卷名",
          "description": "卷概述",
          "chapterCount": { "min": 10, "max": 15 },
          "wordCountTarget": 30000,
          "pacingTarget": { "start": 5, "middle": 8, "end": 7 },
          "milestones": [
            {
              "title": "里程碑名称",
              "description": "里程碑描述",
              "keyEvents": ["事件"],
              "characterArcs": [{"characterId": "角色名", "from": "起点", "to": "终点"}]
            }
          ]
        }
      ]
    }
  ]
}

确保规划合理、节奏张弛有度、角色成长有弧线。`;

export async function generateStoryPlan(
  projectId: string,
  scope: 'full_novel' | 'next_volume' | 'next_arc',
): Promise<storyPlanRepo.StoryPlan[]> {
  const sources = await buildContext({ projectId, maxTokens: 12000 });
  const contextText = contextToString(sources);

  const scopeNote = scope === 'full_novel' ? '请生成完整的小说规划'
    : scope === 'next_volume' ? '请生成下一卷的规划'
    : '请生成下一个故事弧的规划';

  const result = await completeChat(
    [
      { role: 'system', content: PLAN_GENERATION_PROMPT },
      { role: 'user', content: `${scopeNote}\n\n项目上下文：\n${contextText}` },
    ],
    { maxTokens: 4000, temperature: 0.7 },
  );

  let parsed: { arcs: Array<Record<string, unknown>> };
  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    logger.error({ result: result.slice(200) }, 'Story plan parse failed');
    throw new Error('规划生成结果解析失败');
  }

  // Clear existing plans
  storyPlanRepo.deleteByProject(projectId);

  const created: storyPlanRepo.StoryPlan[] = [];
  let arcOrder = 0;

  for (const arc of parsed.arcs || []) {
    const arcPlan = storyPlanRepo.create(projectId, {
      title: String(arc.title || '故事弧'),
      description: String(arc.description || ''),
      planType: 'arc',
      targetData: {
        theme: arc.theme,
        conflictCore: arc.conflictCore,
        resolution: arc.resolution,
        keyEvents: arc.keyEvents,
      },
      sortOrder: arcOrder++,
    });
    created.push(arcPlan);

    const volumes = (arc.volumes || []) as Array<Record<string, unknown>>;
    let volOrder = 0;

    for (const vol of volumes) {
      const volPlan = storyPlanRepo.create(projectId, {
        title: String(vol.title || '卷'),
        description: String(vol.description || ''),
        planType: 'volume',
        parentId: arcPlan.id,
        targetData: {
          chapterCount: vol.chapterCount,
          wordCountTarget: vol.wordCountTarget,
          pacingTarget: vol.pacingTarget,
        },
        sortOrder: volOrder++,
      });
      created.push(volPlan);

      const milestones = (vol.milestones || []) as Array<Record<string, unknown>>;
      for (let mi = 0; mi < milestones.length; mi++) {
        const ms = milestones[mi]!;
        const msPlan = storyPlanRepo.create(projectId, {
          title: String(ms.title || `里程碑${mi + 1}`),
          description: String(ms.description || ''),
          planType: 'milestone',
          parentId: volPlan.id,
          targetData: {
            keyEvents: ms.keyEvents,
            characterArcs: ms.characterArcs,
          },
          sortOrder: mi,
        });
        created.push(msPlan);
      }
    }
  }

  return created;
}

export async function analyzePacing(
  projectId: string,
  _planId?: string,
): Promise<PacingSnapshot[]> {
  const chapters = chapterRepo.findByProject(projectId);
  const snapshots: PacingSnapshot[] = [];

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i]!;
    let content: string;
    try {
      content = await readChapter(projectId, ch.id);
    } catch {
      continue;
    }

    if (!content.trim()) continue;

    const analysis = analyzeContent(content);
    const wordCount = content.replace(/\s/g, '').length;

    // Derive tension/emotion/action from content analysis
    const dialogueRatio = analysis.dialogueRatio;
    const rhythmScore = analysis.rhythmScore;
    const readability = analysis.readabilityScore;

    // Simple heuristic: shorter paragraphs and more dialogue = higher tension
    const tension = Math.min(10, Math.max(1,
      10 - analysis.avgParagraphLength / 50 + dialogueRatio * 3,
    ));
    const emotion = Math.min(10, Math.max(1,
      readability * 0.8 + rhythmScore * 0.2,
    ));
    const action = Math.min(10, Math.max(1,
      10 - analysis.avgParagraphLength / 40 + (1 - dialogueRatio) * 2,
    ));

    snapshots.push({
      planId: '',
      chapterIndex: i,
      chapterTitle: ch.title,
      tension: Math.round(tension * 10) / 10,
      emotion: Math.round(emotion * 10) / 10,
      action: Math.round(action * 10) / 10,
      dialogueRatio: Math.round(dialogueRatio * 100) / 100,
      wordCount,
      deviation: 0,
    });
  }

  // Calculate deviations if plan exists
  if (_planId) {
    const plan = storyPlanRepo.findById(_planId);
    if (plan) {
      const target = JSON.parse(plan.target_data) as PlanTargetData;
      if (target.pacingTarget) {
        const { start, middle, end } = target.pacingTarget;
        for (const snap of snapshots) {
          const ratio = snapshots.length > 1 ? snap.chapterIndex / (snapshots.length - 1) : 0;
          const expectedTension = start + (end - start) * ratio + (middle - (start + end) / 2) * Math.sin(ratio * Math.PI);
          snap.deviation = Math.round(Math.abs(snap.tension - expectedTension) * 10) / 10;
        }
      }
    }
  }

  return snapshots;
}

export function getPlans(projectId: string): storyPlanRepo.StoryPlan[] {
  return storyPlanRepo.findByProject(projectId);
}

export function getPlanWithChildren(planId: string): { plan: storyPlanRepo.StoryPlan; children: storyPlanRepo.StoryPlan[] } | null {
  const plan = storyPlanRepo.findById(planId);
  if (!plan) return null;
  const children = storyPlanRepo.findChildren(planId);
  return { plan, children };
}

export function getActivePlan(projectId: string): storyPlanRepo.StoryPlan | null {
  const plans = storyPlanRepo.findByProject(projectId, 'in_progress');
  return plans[0] || null;
}

export function buildPlanContext(projectId: string, plan?: storyPlanRepo.StoryPlan): ContextSource | null {
  const activePlan = plan || getActivePlan(projectId);
  if (!activePlan) return null;

  const target = JSON.parse(activePlan.target_data) as PlanTargetData;
  const lines: string[] = [`当前规划: ${activePlan.title}`, activePlan.description];

  if (target.theme) lines.push(`主题: ${target.theme}`);
  if (target.conflictCore) lines.push(`核心冲突: ${target.conflictCore}`);
  if (target.keyEvents?.length) lines.push(`关键事件: ${target.keyEvents.join('、')}`);
  if (target.pacingTarget) lines.push(`节奏目标: 开头${target.pacingTarget.start}/中段${target.pacingTarget.middle}/结尾${target.pacingTarget.end}`);

  // Add children milestones
  const children = storyPlanRepo.findChildren(activePlan.id);
  const milestones = children.filter(c => c.plan_type === 'milestone');
  if (milestones.length > 0) {
    lines.push(`里程碑: ${milestones.map(m => m.title).join(' → ')}`);
  }

  return {
    priority: 8,
    label: '长篇规划',
    content: lines.join('\n'),
  };
}

export async function updatePlanProgress(
  projectId: string,
  _chapterId: string,
): Promise<PacingSnapshot | null> {
  const activePlan = getActivePlan(projectId);
  if (!activePlan) return null;

  // Non-blocking: just log that we checked
  logger.info({ projectId, planId: activePlan.id }, 'Plan progress updated');
  return null;
}
