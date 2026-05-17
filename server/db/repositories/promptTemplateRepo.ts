import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  system_prompt: string;
  user_prompt_template: string;
  suggested_temperature: number;
  suggested_max_tokens: number;
  is_builtin: number;
  is_public: number;
  usage_count: number;
  tags: string; // JSON
  created_at: string;
  updated_at: string;
}

export function create(data: {
  name: string;
  description?: string;
  category?: string;
  systemPrompt: string;
  userPromptTemplate?: string;
  suggestedTemperature?: number;
  suggestedMaxTokens?: number;
  isBuiltin?: boolean;
  isPublic?: boolean;
  tags?: string[];
}): PromptTemplate {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO prompt_templates (id, name, description, category, system_prompt, user_prompt_template, suggested_temperature, suggested_max_tokens, is_builtin, is_public, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, data.name, data.description || '', data.category || 'custom',
    data.systemPrompt, data.userPromptTemplate || '',
    data.suggestedTemperature ?? 0.7, data.suggestedMaxTokens ?? 2048,
    data.isBuiltin ? 1 : 0, data.isPublic ? 1 : 0,
    JSON.stringify(data.tags || []),
    now, now,
  );
  return findById(id)!;
}

export function findById(id: string): PromptTemplate | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(id) as PromptTemplate | undefined;
}

export function findAll(category?: string): PromptTemplate[] {
  const db = getDb();
  if (category) {
    return db.prepare('SELECT * FROM prompt_templates WHERE category = ? ORDER BY usage_count DESC, name ASC').all(category) as PromptTemplate[];
  }
  return db.prepare('SELECT * FROM prompt_templates ORDER BY category, usage_count DESC, name ASC').all() as PromptTemplate[];
}

export function findBuiltin(): PromptTemplate[] {
  const db = getDb();
  return db.prepare('SELECT * FROM prompt_templates WHERE is_builtin = 1 ORDER BY category, name ASC').all() as PromptTemplate[];
}

export function search(query: string): PromptTemplate[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM prompt_templates WHERE name LIKE ? OR description LIKE ? OR tags LIKE ? ORDER BY usage_count DESC LIMIT 20",
  ).all(`%${query}%`, `%${query}%`, `%${query}%`) as PromptTemplate[];
}

export function incrementUsage(id: string): void {
  const db = getDb();
  db.prepare('UPDATE prompt_templates SET usage_count = usage_count + 1, updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
}

export function update(id: string, data: Partial<Pick<PromptTemplate, 'name' | 'description' | 'category' | 'system_prompt' | 'user_prompt_template' | 'suggested_temperature' | 'suggested_max_tokens' | 'tags'>>): void {
  const db = getDb();
  const sets: string[] = ['updated_at = ?'];
  const values: unknown[] = [new Date().toISOString()];

  if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
  if (data.description !== undefined) { sets.push('description = ?'); values.push(data.description); }
  if (data.category !== undefined) { sets.push('category = ?'); values.push(data.category); }
  if (data.system_prompt !== undefined) { sets.push('system_prompt = ?'); values.push(data.system_prompt); }
  if (data.user_prompt_template !== undefined) { sets.push('user_prompt_template = ?'); values.push(data.user_prompt_template); }
  if (data.suggested_temperature !== undefined) { sets.push('suggested_temperature = ?'); values.push(data.suggested_temperature); }
  if (data.suggested_max_tokens !== undefined) { sets.push('suggested_max_tokens = ?'); values.push(data.suggested_max_tokens); }
  if (data.tags !== undefined) { sets.push('tags = ?'); values.push(data.tags); }

  values.push(id);
  db.prepare(`UPDATE prompt_templates SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteById(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM prompt_templates WHERE id = ? AND is_builtin = 0').run(id);
}
