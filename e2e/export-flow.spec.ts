import { test, expect, BASE_URL } from './helpers/testFixtures';

const uid = () => Date.now().toString(36);

test.describe('Export Flow', () => {
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    const projRes = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { name: `导出测试${uid()}`, genre: 'fantasy' },
    });
    projectId = (await projRes.json()).data.id;

    const chRes = await page.request.post(
      `${BASE_URL}/api/projects/${projectId}/chapters`,
      { data: { title: '第一章 测试' } },
    );
    const chId = (await chRes.json()).data.id;

    await page.request.put(
      `${BASE_URL}/api/projects/${projectId}/chapters/${chId}/content`,
      { data: { content: '这是导出测试的章节内容。' } },
    );
  });

  test('exports as TXT via API', async ({ page }) => {
    const res = await page.request.get(`${BASE_URL}/api/projects/${projectId}/export/txt`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/plain');
    expect(await res.text()).toContain('这是导出测试的章节内容');
  });

  test('exports as Markdown via API', async ({ page }) => {
    const res = await page.request.get(`${BASE_URL}/api/projects/${projectId}/export/md`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/markdown');
    expect(await res.text()).toContain('## 第一章 测试');
  });

  test('returns 404 for project with no chapters', async ({ page }) => {
    const emptyRes = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { name: `空项目${uid()}` },
    });
    const emptyId = (await emptyRes.json()).data.id;

    const res = await page.request.get(`${BASE_URL}/api/projects/${emptyId}/export/txt`);
    expect(res.status()).toBe(404);
  });

  test('export dropdown shows all formats', async ({ page }) => {
    await page.goto(`/project/${projectId}`);
    await page.waitForTimeout(1500);

    await page.getByRole('button', { name: '导出' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText('导出 TXT')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('导出 EPUB')).toBeVisible();
    await expect(page.getByText('导出 PDF')).toBeVisible();
  });
});
