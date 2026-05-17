const API_BASE = '/api/prompt-templates';

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
  tags: string;
  created_at: string;
  updated_at: string;
}

export async function getTemplates(category?: string, search?: string): Promise<PromptTemplate[]> {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (search) params.set('search', search);
  const res = await fetch(`${API_BASE}?${params}`);
  const json = await res.json();
  return json.data;
}

export async function getTemplate(id: string): Promise<PromptTemplate> {
  const res = await fetch(`${API_BASE}/${id}`);
  const json = await res.json();
  return json.data;
}

export async function createTemplate(data: { name: string; systemPrompt: string; description?: string; category?: string; tags?: string[] }): Promise<PromptTemplate> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export async function useTemplate(id: string): Promise<PromptTemplate> {
  const res = await fetch(`${API_BASE}/${id}/use`, { method: 'POST' });
  const json = await res.json();
  return json.data;
}

export async function initBuiltinTemplates(): Promise<PromptTemplate[]> {
  const res = await fetch(`${API_BASE}/init-builtin`, { method: 'POST' });
  const json = await res.json();
  return json.data;
}

export async function updateTemplate(id: string, data: Partial<PromptTemplate>): Promise<PromptTemplate> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export async function deleteTemplate(id: string): Promise<void> {
  await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
}
