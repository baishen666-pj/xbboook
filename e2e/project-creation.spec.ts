import { test, expect, BASE_URL } from './helpers/testFixtures';

const uid = () => Date.now().toString(36);

test.describe('Project Creation Flow', () => {
  test('has project creation UI elements', async ({ page }) => {
    await page.goto('/');
    // Should show either empty state or existing project grid
    await expect(page.getByText('新建作品')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h1')).toContainText('网文笔阁');
  });

  test('opens create modal and fills form', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /新建作品/ }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Fill form
    await page.getByPlaceholder(/输入你的书名/).fill(`E2E测试${uid()}`);
    await page.getByPlaceholder(/玄幻、言情/).fill('玄幻');

    // Modal should have create button
    await expect(page.getByRole('button', { name: /^创建作品$/ })).toBeVisible();
  });

  test('creates project via API and navigates to it', async ({ page }) => {
    const name = `导航测试${uid()}`;
    const res = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { name, genre: '科幻' },
    });
    const { data } = await res.json();
    expect(data.id).toBeTruthy();

    await page.goto(`/project/${data.id}`);
    await expect(page.locator('header')).toContainText(name, { timeout: 10000 });
  });
});
