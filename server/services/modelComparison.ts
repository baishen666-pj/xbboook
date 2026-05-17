import { completeChat } from '../ai/agentFactory.js';
import { getProviderConfigs } from '../ai/configStore.js';

export interface ComparisonRequest {
  prompt: string;
  providerIds: string[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ComparisonResult {
  providerId: string;
  providerName: string;
  model: string;
  content: string;
  durationMs: number;
  charCount: number;
  error?: string;
}

export async function compareModels(req: ComparisonRequest): Promise<ComparisonResult[]> {
  const providers = getProviderConfigs();
  const selected = providers.filter(p => req.providerIds.includes(p.id));

  if (selected.length === 0) {
    throw new Error('未选择提供商');
  }

  const messages = [
    ...(req.systemPrompt ? [{ role: 'system' as const, content: req.systemPrompt }] : []),
    { role: 'user' as const, content: req.prompt },
  ];

  const results = await Promise.allSettled(
    selected.map(async (p) => {
      const start = Date.now();
      try {
        const content = await completeChat(messages, {
          providerId: p.id,
          maxTokens: req.maxTokens || 2000,
          temperature: req.temperature ?? 0.7,
        });
        return {
          providerId: p.id,
          providerName: p.name,
          model: p.model,
          content,
          durationMs: Date.now() - start,
          charCount: content.length,
        } satisfies ComparisonResult;
      } catch (err) {
        return {
          providerId: p.id,
          providerName: p.name,
          model: p.model,
          content: '',
          durationMs: Date.now() - start,
          charCount: 0,
          error: err instanceof Error ? err.message : 'Unknown error',
        } satisfies ComparisonResult;
      }
    }),
  );

  return results.map(r => r.status === 'fulfilled' ? r.value : {
    providerId: '', providerName: '', model: '', content: '', durationMs: 0, charCount: 0,
    error: r.reason?.message || 'Failed',
  });
}
