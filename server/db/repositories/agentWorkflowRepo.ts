import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface AgentWorkflow {
  id: string;
  name: string;
  description: string;
  steps: string; // JSON array of WorkflowStep
  is_builtin: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'plan' | 'generate' | 'review' | 'revise' | 'polish' | 'deai' | 'custom';
  prompt: string;
  temperature: number;
  maxTokens: number;
  providerId?: string;
  condition?: 'always' | 'review_failed' | 'review_score_below_7';
}

export function create(data: {
  name: string;
  description?: string;
  steps: WorkflowStep[];
  isBuiltin?: boolean;
}): AgentWorkflow {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO agent_workflows (id, name, description, steps, is_builtin, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, data.name, data.description || '', JSON.stringify(data.steps), data.isBuiltin ? 1 : 0, now, now);
  return findById(id)!;
}

export function findById(id: string): AgentWorkflow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM agent_workflows WHERE id = ?').get(id) as AgentWorkflow | undefined;
}

export function findAll(): AgentWorkflow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM agent_workflows ORDER BY is_builtin DESC, name ASC').all() as AgentWorkflow[];
}

export function update(id: string, data: Partial<Pick<AgentWorkflow, 'name' | 'description' | 'steps'>>): void {
  const db = getDb();
  const sets: string[] = ['updated_at = ?'];
  const values: unknown[] = [new Date().toISOString()];

  if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
  if (data.description !== undefined) { sets.push('description = ?'); values.push(data.description); }
  if (data.steps !== undefined) { sets.push('steps = ?'); values.push(typeof data.steps === 'string' ? data.steps : JSON.stringify(data.steps)); }

  values.push(id);
  db.prepare(`UPDATE agent_workflows SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteById(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM agent_workflows WHERE id = ? AND is_builtin = 0').run(id);
}

export const BUILTIN_WORKFLOWS: Array<Omit<Parameters<typeof create>[0], 'isBuiltin'> & { isBuiltin: true }> = [
  {
    name: '快速草稿',
    description: '规划后直接生成，2步快速出文',
    steps: [
      { id: 's1', name: '规划', type: 'plan', prompt: '规划本章写作内容', temperature: 0.7, maxTokens: 1500 },
      { id: 's2', name: '生成', type: 'generate', prompt: '根据规划生成完整章节', temperature: 0.85, maxTokens: 4096 },
    ],
    isBuiltin: true,
  },
  {
    name: '深度写作',
    description: '6步深度流程：规划→生成→审稿→修订→去AI味→润色',
    steps: [
      { id: 's1', name: '规划', type: 'plan', prompt: '规划本章写作内容', temperature: 0.7, maxTokens: 1500 },
      { id: 's2', name: '生成', type: 'generate', prompt: '根据规划生成完整章节', temperature: 0.85, maxTokens: 4096 },
      { id: 's3', name: '审稿', type: 'review', prompt: '审查草稿质量', temperature: 0.3, maxTokens: 1500 },
      { id: 's4', name: '修订', type: 'revise', prompt: '根据审稿意见修订', temperature: 0.6, maxTokens: 4096, condition: 'review_failed' },
      { id: 's5', name: '去AI味', type: 'deai', prompt: '消除AI生成痕迹', temperature: 0.6, maxTokens: 4096 },
      { id: 's6', name: '润色', type: 'polish', prompt: '最终润色', temperature: 0.5, maxTokens: 4096 },
    ],
    isBuiltin: true,
  },
  {
    name: '风格克隆',
    description: '注入风格指纹后生成，模仿作者笔触',
    steps: [
      { id: 's1', name: '风格注入', type: 'custom', prompt: '分析风格指纹并注入写作指令', temperature: 0.5, maxTokens: 1000 },
      { id: 's2', name: '生成', type: 'generate', prompt: '严格按风格生成', temperature: 0.8, maxTokens: 4096 },
      { id: 's3', name: '风格审校', type: 'review', prompt: '检查风格匹配度', temperature: 0.3, maxTokens: 1000 },
      { id: 's4', name: '修正', type: 'revise', prompt: '修正风格偏差', temperature: 0.6, maxTokens: 4096, condition: 'review_failed' },
    ],
    isBuiltin: true,
  },
  {
    name: '审校流程',
    description: '3步纯优化：审稿→去AI味→润色',
    steps: [
      { id: 's1', name: '审稿', type: 'review', prompt: '全面审查章节质量', temperature: 0.3, maxTokens: 1500 },
      { id: 's2', name: '去AI味', type: 'deai', prompt: '消除AI痕迹', temperature: 0.6, maxTokens: 4096 },
      { id: 's3', name: '润色', type: 'polish', prompt: '文学润色', temperature: 0.5, maxTokens: 4096 },
    ],
    isBuiltin: true,
  },
];
