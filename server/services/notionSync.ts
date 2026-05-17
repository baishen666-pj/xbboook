import crypto from 'node:crypto';

export interface NotionSyncConfig {
  id: string;
  projectId: string;
  notionToken: string;
  databaseId: string;
  syncMode: 'chapters' | 'outline' | 'characters' | 'all';
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SyncResult {
  synced: number;
  errors: number;
  details: Array<{ chapterId: string; status: string }>;
}

const NOTION_API = 'https://api.notion.com/v1';

export async function validateToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${NOTION_API}/users/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function listDatabases(token: string): Promise<Array<{ id: string; title: string }>> {
  const res = await fetch(`${NOTION_API}/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filter: { property: 'object', value: 'database' } }),
  });

  if (!res.ok) return [];
  const data = await res.json() as any;
  return (data.results || []).map((db: any) => ({
    id: db.id,
    title: db.title?.map((t: any) => t.plain_text).join('') || 'Untitled',
  }));
}

export async function syncChapterToNotion(
  token: string,
  databaseId: string,
  chapter: { id: string; title: string; content: string; wordCount: number; status: string },
): Promise<{ pageId: string; url: string } | null> {
  const body = {
    parent: { database_id: databaseId },
    properties: {
      'Name': { title: [{ text: { content: chapter.title } }] },
      'Word Count': { number: chapter.wordCount },
      'Status': { select: { name: chapter.status } },
      'Chapter ID': { rich_text: [{ text: { content: chapter.id } }] },
    },
    children: [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ text: { content: chapter.content.slice(0, 2000) } }],
        },
      },
    ],
  };

  const res = await fetch(`${NOTION_API}/pages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion API error: ${res.status} ${err}`);
  }

  const data = await res.json() as any;
  return { pageId: data.id, url: data.url };
}
