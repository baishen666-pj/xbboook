const API_BASE = '/api/ai';

export interface ComparisonResult {
  providerId: string;
  providerName: string;
  model: string;
  content: string;
  durationMs: number;
  charCount: number;
  error?: string;
}

export async function compareModels(
  prompt: string,
  providerIds: string[],
  systemPrompt?: string,
): Promise<ComparisonResult[]> {
  const res = await fetch(`${API_BASE}/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, providerIds, systemPrompt }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}
