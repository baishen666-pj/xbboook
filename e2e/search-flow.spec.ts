import { test, expect, BASE_URL } from './helpers/testFixtures';

const uid = () => Date.now().toString(36);

test.describe('Search Flow', () => {
  test('searches across project content', async ({ page }) => {
    const projRes = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { name: `搜索测试${uid()}`, genre: '科幻' },
    });
    const { data: project } = await projRes.json();

    await page.request.post(`${BASE_URL}/api/projects/${project.id}/characters`, {
      data: { name: '搜索角色A', roleType: 'protagonist', gender: '男', personality: '勇敢' },
    });

    await page.request.post(`${BASE_URL}/api/projects/${project.id}/chapters`, {
      data: { title: '搜索章节', content: '<p>这是搜索测试的内容段落。</p>' },
    });

    const res = await page.request.get(
      `${BASE_URL}/api/projects/${project.id}/search?q=搜索`
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('returns empty for unmatched query', async ({ page }) => {
    const projRes = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { name: `空搜${uid()}`, genre: '都市' },
    });
    const { data: project } = await projRes.json();

    const res = await page.request.get(
      `${BASE_URL}/api/projects/${project.id}/search?q=完全不存在的关键词xyz`
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });
});
