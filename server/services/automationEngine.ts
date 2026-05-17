import crypto from 'node:crypto';

export interface AutomationRule {
  id: string;
  projectId: string;
  name: string;
  enabled: boolean;
  trigger: {
    type: string;
    condition?: Record<string, unknown>;
  };
  action: {
    type: string;
    config: Record<string, unknown>;
  };
  lastTriggeredAt: string | null;
  runCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationExecution {
  id: string;
  ruleId: string;
  triggerEvent: string;
  actionType: string;
  success: boolean;
  error?: string;
  durationMs: number;
  createdAt: string;
}

const TRIGGER_TYPES = [
  'chapter:create', 'chapter:update', 'chapter:delete',
  'project:create', 'checkin:after', 'export:complete',
  'wordcount:threshold', 'ai:response',
] as const;

const ACTION_TYPES = [
  'webhook:send', 'notion:sync', 'feishu:sync',
  'notify:log', 'chapter:tag', 'export:auto',
] as const;

export function getTriggerTypes(): string[] { return [...TRIGGER_TYPES]; }
export function getActionTypes(): string[] { return [...ACTION_TYPES]; }

export function matchesTrigger(rule: AutomationRule, event: string, context?: Record<string, unknown>): boolean {
  if (!rule.enabled) return false;
  if (rule.trigger.type !== event) return false;

  if (rule.trigger.condition) {
    for (const [key, value] of Object.entries(rule.trigger.condition)) {
      if (context?.[key] !== value) return false;
    }
  }

  return true;
}

export async function executeAction(
  action: AutomationRule['action'],
  context: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const start = Date.now();

  try {
    switch (action.type) {
      case 'webhook:send': {
        const url = action.config.url as string;
        if (!url) throw new Error('Missing webhook URL');
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: action.type, context, timestamp: new Date().toISOString() }),
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { success: true };
      }

      case 'notify:log':
        return { success: true };

      case 'chapter:tag':
        return { success: true };

      case 'export:auto':
        return { success: true };

      default:
        return { success: false, error: `Unknown action type: ${action.type}` };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
