import { test, expect, BASE_URL } from './helpers/testFixtures';

const uid = () => Date.now().toString(36);

test.describe('AI Flow', () => {
  test('returns AI skill list', async ({ page }) => {
    const res = await page.request.get(`${BASE_URL}/api/ai/skills`);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(20);
  });

  test('returns context source info for a project', async ({ page }) => {
    const projRes = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { name: `AI上下文${uid()}`, genre: '玄幻' },
    });
    const { data: project } = await projRes.json();

    const res = await page.request.get(
      `${BASE_URL}/api/ai/projects/${project.id}/context-info`
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.sources)).toBe(true);
    expect(body.data.sources.length).toBeGreaterThanOrEqual(5);
    expect(body.data).toHaveProperty('totalTokens');
  });

  test('respects disabledSources param', async ({ page }) => {
    const projRes = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { name: `AI禁用${uid()}`, genre: '都市' },
    });
    const { data: project } = await projRes.json();

    const res = await page.request.get(
      `${BASE_URL}/api/ai/projects/${project.id}/context-info?disabledSources=世界设定,伏笔线索`
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    const disabled = body.data.sources.filter(
      (s: { enabled: boolean }) => !s.enabled
    );
    const disabledLabels = disabled.map((s: { label: string }) => s.label);
    expect(disabledLabels).toContain('世界设定');
    expect(disabledLabels).toContain('伏笔线索');
  });
});
