import { test, expect, BASE_URL } from './helpers/testFixtures';

const uid = () => Date.now().toString(36);

test.describe('Version Management', () => {
  let projectId: string;
  let chapterId: string;

  test.beforeEach(async ({ page }) => {
    const projRes = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { name: `版本测试${uid()}` },
    });
    projectId = (await projRes.json()).data.id;

    const chRes = await page.request.post(`${BASE_URL}/api/projects/${projectId}/chapters`, {
      data: { title: '版本测试章节' },
    });
    chapterId = (await chRes.json()).data.id;
  });

  test('save a manual version', async ({ page }) => {
    await page.request.put(`${BASE_URL}/api/projects/${projectId}/chapters/${chapterId}/content`, {
      data: { content: '第一版内容，原始文字。' },
    });

    const res = await page.request.post(
      `${BASE_URL}/api/projects/${projectId}/chapters/${chapterId}/versions`,
      { data: { label: '初稿' } },
    );
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeTruthy();
    expect(body.data.label).toBe('初稿');
  });

  test('list versions for a chapter', async ({ page }) => {
    await page.request.put(`${BASE_URL}/api/projects/${projectId}/chapters/${chapterId}/content`, {
      data: { content: '版本A内容' },
    });
    await page.request.post(
      `${BASE_URL}/api/projects/${projectId}/chapters/${chapterId}/versions`,
      { data: { label: '版本A' } },
    );

    await page.request.put(`${BASE_URL}/api/projects/${projectId}/chapters/${chapterId}/content`, {
      data: { content: '版本B内容，有修改。' },
    });
    await page.request.post(
      `${BASE_URL}/api/projects/${projectId}/chapters/${chapterId}/versions`,
      { data: { label: '版本B' } },
    );

    const res = await page.request.get(
      `${BASE_URL}/api/projects/${projectId}/chapters/${chapterId}/versions`,
    );
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(2);
  });

  test('rollback to a previous version', async ({ page }) => {
    await page.request.put(`${BASE_URL}/api/projects/${projectId}/chapters/${chapterId}/content`, {
      data: { content: '原始内容，非常重要。' },
    });

    const vRes = await page.request.post(
      `${BASE_URL}/api/projects/${projectId}/chapters/${chapterId}/versions`,
      { data: { label: '保存点' } },
    );
    const versionId = (await vRes.json()).data.id;

    await page.request.put(`${BASE_URL}/api/projects/${projectId}/chapters/${chapterId}/content`, {
      data: { content: '修改后的内容。' },
    });

    const rbRes = await page.request.post(
      `${BASE_URL}/api/projects/${projectId}/chapters/${chapterId}/versions/${versionId}/rollback`,
    );
    expect(rbRes.ok()).toBe(true);
    const rbBody = await rbRes.json();
    expect(rbBody.success).toBe(true);
    expect(rbBody.data.content).toContain('原始内容');
  });

  test('get version content', async ({ page }) => {
    await page.request.put(`${BASE_URL}/api/projects/${projectId}/chapters/${chapterId}/content`, {
      data: { content: '可读回的内容。' },
    });

    const vRes = await page.request.post(
      `${BASE_URL}/api/projects/${projectId}/chapters/${chapterId}/versions`,
      { data: {} },
    );
    const versionId = (await vRes.json()).data.id;

    const getRes = await page.request.get(
      `${BASE_URL}/api/projects/${projectId}/chapters/${chapterId}/versions/${versionId}`,
    );
    expect(getRes.ok()).toBe(true);
    const body = await getRes.json();
    expect(body.data.content).toContain('可读回的内容');
  });

  test('delete a version', async ({ page }) => {
    await page.request.put(`${BASE_URL}/api/projects/${projectId}/chapters/${chapterId}/content`, {
      data: { content: '待删除版本内容。' },
    });

    const vRes = await page.request.post(
      `${BASE_URL}/api/projects/${projectId}/chapters/${chapterId}/versions`,
      { data: { label: '待删除' } },
    );
    const versionId = (await vRes.json()).data.id;

    const delRes = await page.request.delete(
      `${BASE_URL}/api/projects/${projectId}/chapters/${chapterId}/versions/${versionId}`,
    );
    expect(delRes.ok()).toBe(true);

    const getRes = await page.request.get(
      `${BASE_URL}/api/projects/${projectId}/chapters/${chapterId}/versions/${versionId}`,
    );
    expect(getRes.status()).toBe(404);
  });
});
