const API_BASE = '/api/projects';

export interface StoryPlan {
  id: string;
  project_id: string;
  title: string;
  description: string;
  plan_type: 'arc' | 'volume' | 'chapter_group' | 'milestone';
  parent_id: string | null;
  start_chapter_index: number | null;
  end_chapter_index: number | null;
  target_data: string;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
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

export async function generateStoryPlan(projectId: string, scope: string): Promise<StoryPlan[]> {
  const res = await fetch(`${API_BASE}/${projectId}/story-planner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export async function getStoryPlans(projectId: string): Promise<StoryPlan[]> {
  const res = await fetch(`${API_BASE}/${projectId}/story-planner`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export async function getStoryPlan(projectId: string, planId: string): Promise<{ plan: StoryPlan; children: StoryPlan[] }> {
  const res = await fetch(`${API_BASE}/${projectId}/story-planner/${planId}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export async function updateStoryPlan(projectId: string, planId: string, data: Partial<StoryPlan>): Promise<StoryPlan> {
  const res = await fetch(`${API_BASE}/${projectId}/story-planner/${planId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export async function deleteStoryPlan(projectId: string, planId: string): Promise<void> {
  await fetch(`${API_BASE}/${projectId}/story-planner/${planId}`, { method: 'DELETE' });
}

export async function analyzePacing(projectId: string, planId: string): Promise<PacingSnapshot[]> {
  const res = await fetch(`${API_BASE}/${projectId}/story-planner/${planId}/pacing`, { method: 'POST' });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}
