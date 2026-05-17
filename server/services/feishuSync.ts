export interface FeishuSyncConfig {
  id: string;
  projectId: string;
  appId: string;
  appSecret: string;
  docToken: string;
  syncMode: 'chapters' | 'outline' | 'characters' | 'all';
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const FEISHU_API = 'https://open.feishu.cn/open-apis';

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getTenantToken(appId: string, appSecret: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const res = await fetch(`${FEISHU_API}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });

  if (!res.ok) throw new Error(`Feishu auth failed: ${res.status}`);
  const data = await res.json() as any;

  if (data.code !== 0) throw new Error(`Feishu auth error: ${data.msg}`);

  cachedToken = {
    token: data.tenant_access_token,
    expiresAt: Date.now() + (data.expire - 300) * 1000,
  };
  return cachedToken.token;
}

export async function validateFeishuApp(appId: string, appSecret: string): Promise<boolean> {
  try {
    await getTenantToken(appId, appSecret);
    return true;
  } catch {
    return false;
  }
}

export async function syncChapterToFeishu(
  token: string,
  docToken: string,
  chapter: { id: string; title: string; content: string },
): Promise<{ blockId: string }> {
  const body = {
    children: [
      {
        block_type: 3,
        heading1: { elements: [{ text_run: { content: chapter.title } }] },
      },
      {
        block_type: 2,
        text: {
          style: {},
          elements: [{ text_run: { content: chapter.content.slice(0, 4000) } }],
        },
      },
    ],
  };

  const res = await fetch(
    `${FEISHU_API}/docx/v1/documents/${docToken}/blocks/${docToken}/children`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Feishu API error: ${res.status} ${err}`);
  }

  const data = await res.json() as any;
  return { blockId: data?.data?.children?.[0]?.block_id || '' };
}
