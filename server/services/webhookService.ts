import crypto from 'node:crypto';

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  projectId?: string;
  headers?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEvent {
  event: string;
  projectId: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  statusCode: number;
  duration: number;
  success: boolean;
  error?: string;
  createdAt: string;
}

interface StoredWebhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string;
  enabled: number;
  project_id: string | null;
  headers: string;
  created_at: string;
  updated_at: string;
}

interface StoredDelivery {
  id: string;
  webhook_id: string;
  event: string;
  status_code: number;
  duration_ms: number;
  success: number;
  error: string | null;
  created_at: string;
}

const SUPPORTED_EVENTS = [
  'chapter:create', 'chapter:update', 'chapter:delete',
  'project:create', 'project:update', 'project:delete',
  'export:complete', 'checkin:after', 'ai:response',
] as const;

export type SupportedEvent = typeof SUPPORTED_EVENTS[number];

export function getSupportedEvents(): string[] {
  return [...SUPPORTED_EVENTS];
}

export function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export async function deliverWebhook(
  config: WebhookConfig,
  event: WebhookEvent,
): Promise<WebhookDelivery> {
  const deliveryId = crypto.randomUUID();
  const body = JSON.stringify(event);
  const signature = signPayload(body, config.secret);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
    'X-Webhook-Event': event.event,
    'X-Webhook-Delivery': deliveryId,
    ...(config.headers || {}),
  };

  const start = Date.now();
  let statusCode = 0;
  let success = false;
  let errorMessage: string | undefined;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(config.url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    statusCode = res.status;
    success = statusCode >= 200 && statusCode < 300;

    if (!success) {
      errorMessage = `HTTP ${statusCode}`;
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Unknown error';
  }

  return {
    id: deliveryId,
    webhookId: config.id,
    event: event.event,
    statusCode,
    duration: Date.now() - start,
    success,
    error: errorMessage,
    createdAt: new Date().toISOString(),
  };
}
