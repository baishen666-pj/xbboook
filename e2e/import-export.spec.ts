import { test, expect, BASE_URL } from './helpers/testFixtures';

const uid = () => Date.now().toString(36);

test.describe('Import/Export Flow', () => {
  test('imports a TXT file and shows chapters', async ({ page }) => {
    const name = `导入测试${uid()}`;
    const res = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { name },
    });
    const { data: project } = await res.json();
    const projectId = project.id;

    await page.goto(`/project/${projectId}`);
    await expect(page.locator('header')).toContainText(name, { timeout: 10000 });

    // Navigate to settings/import
    const importPanel = page.getByText('导入作品');
    if (await importPanel.isVisible()) {
      await importPanel.click();
    }

    // Export TXT via API and verify
    const exportRes = await page.request.get(`${BASE_URL}/api/projects/${projectId}/export/txt`);
    expect(exportRes.status()).toBe(404); // No chapters yet

    // Import via API
    const content = '第一章 开始\n这是第一章的内容。\n\n第二章 发展\n这是第二章的内容。';
    const formData = new FormData();
    formData.append('file', new Blob([content], { type: 'text/plain' }), 'test.txt');

    const importRes = await page.request.post(`${BASE_URL}/api/projects/${projectId}/import`, {
      multipart: { file: { name: 'test.txt', mimeType: 'text/plain', buffer: Buffer.from(content) } },
    });
    expect(importRes.status()).toBe(200);

    // Verify chapters exist
    const chaptersRes = await page.request.get(`${BASE_URL}/api/projects/${projectId}/chapters`);
    const chapters = await chaptersRes.json();
    expect(chapters.data.length).toBeGreaterThanOrEqual(2);
  });

  test('exports project as EPUB via API', async ({ page }) => {
    const name = `导出测试${uid()}`;
    const res = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { name },
    });
    const { data: project } = await res.json();
    const projectId = project.id;

    // Create a chapter
    await page.request.post(`${BASE_URL}/api/projects/${projectId}/chapters`, {
      data: { title: 'Test Chapter' },
    });

    // Export EPUB
    const epubRes = await page.request.get(`${BASE_URL}/api/projects/${projectId}/export/epub`);
    expect(epubRes.status()).toBe(200);
    expect(epubRes.headers()['content-type']).toContain('application/epub+zip');
  });

  test('exports project as PDF via API', async ({ page }) => {
    const name = `PDF测试${uid()}`;
    const res = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { name },
    });
    const { data: project } = await res.json();

    await page.request.post(`${BASE_URL}/api/projects/${project.id}/chapters`, {
      data: { title: 'PDF Chapter' },
    });

    const pdfRes = await page.request.get(`${BASE_URL}/api/projects/${project.id}/export/pdf`);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers()['content-type']).toContain('application/pdf');
  });
});
