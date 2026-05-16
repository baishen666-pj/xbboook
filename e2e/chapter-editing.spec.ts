import { test, expect, BASE_URL } from './helpers/testFixtures';

const uid = () => Date.now().toString(36);

test.describe('Chapter Editing Flow', () => {
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    const res = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { name: `章节测试${uid()}`, genre: 'fantasy' },
    });
    projectId = (await res.json()).data.id;
  });

  test('shows placeholder when no chapter selected', async ({ page }) => {
    await page.goto(`/project/${projectId}`);
    await expect(page.getByText('选择章节开始写作')).toBeVisible({ timeout: 10000 });
  });

  test('creates and selects a chapter', async ({ page }) => {
    // Create chapter via API
    await page.request.post(`${BASE_URL}/api/projects/${projectId}/chapters`, {
      data: { title: '第一章 测试' },
    });

    await page.goto(`/project/${projectId}`);
    await page.waitForTimeout(1000);

    // Click the chapter in sidebar
    await page.getByText('第一章 测试').first().click();
    await page.waitForTimeout(500);

    // Editor should be visible (ProseMirror)
    await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 5000 });
  });

  test('typing in editor shows word count', async ({ page }) => {
    const chRes = await page.request.post(
      `${BASE_URL}/api/projects/${projectId}/chapters`,
      { data: { title: '内容章节' } },
    );
    const chId = (await chRes.json()).data.id;

    await page.request.put(
      `${BASE_URL}/api/projects/${projectId}/chapters/${chId}/content`,
      { data: { content: '这是测试内容，用于验证字数统计功能。' } },
    );

    await page.goto(`/project/${projectId}`);
    await page.waitForTimeout(1000);
    await page.getByText('内容章节').first().click();
    await page.waitForTimeout(1000);

    await expect(page.locator('footer')).toContainText(/\d+ 字/, { timeout: 10000 });
  });
});
