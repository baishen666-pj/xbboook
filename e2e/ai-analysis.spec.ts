import { test, expect, BASE_URL } from './helpers/testFixtures';

const uid = () => Date.now().toString(36);

test.describe('AI Analysis', () => {
  let projectId: string;
  let chapterId: string;

  test.beforeEach(async ({ page }) => {
    const projRes = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { name: `分析测试${uid()}`, genre: 'fantasy' },
    });
    projectId = (await projRes.json()).data.id;

    const chRes = await page.request.post(`${BASE_URL}/api/projects/${projectId}/chapters`, {
      data: { title: '第一章' },
    });
    chapterId = (await chRes.json()).data.id;

    await page.request.put(`${BASE_URL}/api/projects/${projectId}/chapters/${chapterId}/content`, {
      data: { content: '少年李明站在悬崖之上，望着远方的云海翻涌。他紧握手中的木剑，心中暗下决心。身后传来一声叹息："你又来了。"转过身，一位白发老者正注视着他。' },
    });
  });

  test('quick analysis returns stats', async ({ page }) => {
    const res = await page.request.get(
      `${BASE_URL}/api/projects/${projectId}/analysis/quick`,
    );
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeTruthy();
    expect(body.data.totalChapters).toBeGreaterThanOrEqual(1);
    expect(body.data.totalWords).toBeGreaterThanOrEqual(0);
  });

  test('get available analysis types', async ({ page }) => {
    const res = await page.request.get(
      `${BASE_URL}/api/projects/${projectId}/analysis/types`,
    );
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);

    const typeIds = body.data.map((t: { id: string }) => t.id);
    expect(typeIds).toContain('story-analysis');
    expect(typeIds).toContain('pacing-analysis');
    expect(typeIds).toContain('emotion-arc');
    expect(typeIds).toContain('character-arc');
    expect(typeIds).toContain('outline-generate');
  });

  test('deep analysis returns result when AI is configured', async ({ page }) => {
    // Check if AI is configured by trying to read config
    const configRes = await page.request.get(`${BASE_URL}/api/ai/providers/config`);
    const configBody = await configRes.json();
    const hasProviders = configBody.data && configBody.data.length > 0;

    test.skip(!hasProviders, 'AI not configured — skipping deep analysis test');

    const res = await page.request.post(
      `${BASE_URL}/api/projects/${projectId}/analysis`,
      {
        data: {
          analysisType: 'story-analysis',
          chapterIds: [chapterId],
        },
      },
    );
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeTruthy();
    expect(body.data.analysisType).toBe('story-analysis');
    expect(body.data.chaptersAnalyzed).toBeGreaterThanOrEqual(1);
  });

  test('unsupported analysis type returns error', async ({ page }) => {
    const res = await page.request.post(
      `${BASE_URL}/api/projects/${projectId}/analysis`,
      {
        data: {
          analysisType: 'invalid-type',
          chapterIds: [chapterId],
        },
      },
    );
    expect(res.status()).toBe(400);
  });
});
