import { test, expect, BASE_URL } from './helpers/testFixtures';

const uid = () => Date.now().toString(36);

test.describe('Character & Worldview Flow', () => {
  test('creates and lists characters via API', async ({ page }) => {
    const name = `角色测试${uid()}`;
    const res = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { name },
    });
    const { data: project } = await res.json();

    // Create characters
    const char1 = await page.request.post(`${BASE_URL}/api/projects/${project.id}/characters`, {
      data: { name: '林风', role_type: 'protagonist', personality: '勇敢正义' },
    });
    expect(char1.status()).toBe(200);

    const char2 = await page.request.post(`${BASE_URL}/api/projects/${project.id}/characters`, {
      data: { name: '苏瑶', role_type: 'supporting', personality: '聪明温柔' },
    });
    expect(char2.status()).toBe(200);

    // List characters
    const listRes = await page.request.get(`${BASE_URL}/api/projects/${project.id}/characters`);
    const list = await listRes.json();
    expect(list.data.length).toBeGreaterThanOrEqual(2);
    const names = list.data.map((c: any) => c.name);
    expect(names).toContain('林风');
    expect(names).toContain('苏瑶');
  });

  test('creates worldview entries via API', async ({ page }) => {
    const name = `世界观测试${uid()}`;
    const res = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { name },
    });
    const { data: project } = await res.json();

    // Create worldview entry
    const wvRes = await page.request.post(`${BASE_URL}/api/projects/${project.id}/worldviews`, {
      data: { category: '地理', title: '九州大陆', content: '故事发生在九州大陆...' },
    });
    expect(wvRes.status()).toBe(200);

    // List worldviews
    const listRes = await page.request.get(`${BASE_URL}/api/projects/${project.id}/worldviews`);
    const list = await listRes.json();
    expect(list.data.length).toBeGreaterThanOrEqual(1);
  });

  test('creates character relations via API', async ({ page }) => {
    const name = `关系测试${uid()}`;
    const res = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { name },
    });
    const { data: project } = await res.json();

    const char1Res = await page.request.post(`${BASE_URL}/api/projects/${project.id}/characters`, {
      data: { name: '主角' },
    });
    const char1 = await char1Res.json();

    const char2Res = await page.request.post(`${BASE_URL}/api/projects/${project.id}/characters`, {
      data: { name: '对手' },
    });
    const char2 = await char2Res.json();

    const relRes = await page.request.post(`${BASE_URL}/api/projects/${project.id}/characters/${char1.data.id}/relations`, {
      data: { targetId: char2.data.id, relationType: '宿敌', description: '势不两立' },
    });
    expect(relRes.status()).toBe(200);
  });
});
