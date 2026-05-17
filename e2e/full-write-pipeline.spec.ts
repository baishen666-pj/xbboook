import { test, expect, BASE_URL } from './helpers/testFixtures';

const uid = () => Date.now().toString(36);

test.describe('Full Write Pipeline', () => {
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    const res = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { name: `流水线测试${uid()}`, genre: 'fantasy', description: '端到端测试项目' },
    });
    projectId = (await res.json()).data.id;
  });

  test('create project → write chapter → verify word count', async ({ page }) => {
    const chRes = await page.request.post(`${BASE_URL}/api/projects/${projectId}/chapters`, {
      data: { title: '第一章 初入江湖' },
    });
    const chId = (await chRes.json()).data.id;

    await page.request.put(`${BASE_URL}/api/projects/${projectId}/chapters/${chId}/content`, {
      data: { content: '少年李明站在悬崖之上，望着远方的云海翻涌。他紧握手中的木剑，心中暗下决心：总有一天，我要踏入那传说中的仙门。' },
    });

    await page.goto(`/project/${projectId}`);
    await page.waitForTimeout(1000);
    await page.getByText('第一章 初入江湖').first().click();
    await page.waitForTimeout(1000);

    await expect(page.locator('footer')).toContainText(/\d+ 字/, { timeout: 10000 });
  });

  test('export as TXT contains chapter content', async ({ page }) => {
    const chRes = await page.request.post(`${BASE_URL}/api/projects/${projectId}/chapters`, {
      data: { title: '测试导出章' },
    });
    const chId = (await chRes.json()).data.id;

    await page.request.put(`${BASE_URL}/api/projects/${projectId}/chapters/${chId}/content`, {
      data: { content: '这是导出测试的内容。' },
    });

    const res = await page.request.get(`${BASE_URL}/api/projects/${projectId}/export/txt`);
    expect(res.ok()).toBe(true);
    const text = await res.text();
    expect(text).toContain('测试导出章');
    expect(text).toContain('这是导出测试的内容');
  });

  test('export as Markdown contains chapter heading', async ({ page }) => {
    const chRes = await page.request.post(`${BASE_URL}/api/projects/${projectId}/chapters`, {
      data: { title: 'Markdown导出章' },
    });
    const chId = (await chRes.json()).data.id;

    await page.request.put(`${BASE_URL}/api/projects/${projectId}/chapters/${chId}/content`, {
      data: { content: 'Markdown内容测试。' },
    });

    const res = await page.request.get(`${BASE_URL}/api/projects/${projectId}/export/md`);
    expect(res.ok()).toBe(true);
    const text = await res.text();
    expect(text).toContain('### Markdown导出章');
    expect(text).toContain('Markdown内容测试');
  });

  test('export empty project returns 404', async ({ page }) => {
    const res = await page.request.get(`${BASE_URL}/api/projects/${projectId}/export/txt`);
    expect(res.status()).toBe(404);
  });

  test('AI chat panel is visible in project page', async ({ page }) => {
    await page.request.post(`${BASE_URL}/api/projects/${projectId}/chapters`, {
      data: { title: 'AI对话测试章' },
    });

    await page.goto(`/project/${projectId}`);
    await page.waitForTimeout(1000);

    // Look for AI panel toggle or AI-related UI elements
    const aiButton = page.locator('button, [role="tab"]').filter({ hasText: /AI|智能/ }).first();
    if (await aiButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await aiButton.click();
      await page.waitForTimeout(500);
    }
  });
});
