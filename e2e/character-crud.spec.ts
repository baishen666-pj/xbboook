import { test, expect, BASE_URL } from './helpers/testFixtures';

const uid = () => Date.now().toString(36);

test.describe('Character CRUD', () => {
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    const res = await page.request.post(`${BASE_URL}/api/projects`, {
      data: { name: `角色测试${uid()}` },
    });
    projectId = (await res.json()).data.id;
  });

  test('create characters with different roles', async ({ page }) => {
    const roles = [
      { name: '李明', roleType: 'protagonist', personality: '热血正义' },
      { name: '魔王', roleType: 'antagonist', personality: '阴险狡诈' },
      { name: '师傅', roleType: 'supporting', personality: '沉稳睿智' },
    ];

    for (const char of roles) {
      const res = await page.request.post(`${BASE_URL}/api/projects/${projectId}/characters`, {
        data: char,
      });
      expect(res.ok()).toBe(true);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.name).toBe(char.name);
      expect(body.data.role_type).toBe(char.roleType);
    }

    const listRes = await page.request.get(`${BASE_URL}/api/projects/${projectId}/characters`);
    const listBody = await listRes.json();
    expect(listBody.data.characters.length).toBe(3);
  });

  test('update character personality', async ({ page }) => {
    const createRes = await page.request.post(`${BASE_URL}/api/projects/${projectId}/characters`, {
      data: { name: '角色A', roleType: 'protagonist', personality: '初始性格' },
    });
    const charId = (await createRes.json()).data.id;

    const updateRes = await page.request.put(
      `${BASE_URL}/api/projects/${projectId}/characters/${charId}`,
      { data: { personality: '成长后的性格', background: '经历了重大变故' } },
    );
    expect(updateRes.ok()).toBe(true);
    const body = await updateRes.json();
    expect(body.data.personality).toBe('成长后的性格');
    expect(body.data.background).toBe('经历了重大变故');
  });

  test('delete a character', async ({ page }) => {
    const createRes = await page.request.post(`${BASE_URL}/api/projects/${projectId}/characters`, {
      data: { name: '临时角色', roleType: 'minor' },
    });
    const charId = (await createRes.json()).data.id;

    const delRes = await page.request.delete(
      `${BASE_URL}/api/projects/${projectId}/characters/${charId}`,
    );
    expect(delRes.ok()).toBe(true);

    const getRes = await page.request.get(
      `${BASE_URL}/api/projects/${projectId}/characters/${charId}`,
    );
    expect(getRes.status()).toBe(404);
  });

  test('create and manage character relations', async ({ page }) => {
    const charARes = await page.request.post(`${BASE_URL}/api/projects/${projectId}/characters`, {
      data: { name: '张三', roleType: 'protagonist' },
    });
    const charAId = (await charARes.json()).data.id;

    const charBRes = await page.request.post(`${BASE_URL}/api/projects/${projectId}/characters`, {
      data: { name: '李四', roleType: 'supporting' },
    });
    const charBId = (await charBRes.json()).data.id;

    const relRes = await page.request.post(
      `${BASE_URL}/api/projects/${projectId}/characters/relations`,
      {
        data: {
          characterAId: charAId,
          characterBId: charBId,
          relationType: '师徒',
          description: '张三是李四的师傅',
        },
      },
    );
    expect(relRes.ok()).toBe(true);
    const relBody = await relRes.json();
    expect(relBody.data.relation_type).toBe('师徒');
    const relId = relBody.data.id;

    const updateRelRes = await page.request.put(
      `${BASE_URL}/api/projects/${projectId}/characters/relations/${relId}`,
      { data: { relationType: '仇敌', description: '关系破裂后反目成仇' } },
    );
    expect(updateRelRes.ok()).toBe(true);
    const updatedRel = await updateRelRes.json();
    expect(updatedRel.data.relation_type).toBe('仇敌');

    const delRelRes = await page.request.delete(
      `${BASE_URL}/api/projects/${projectId}/characters/relations/${relId}`,
    );
    expect(delRelRes.ok()).toBe(true);
  });

  test('character list includes relations', async ({ page }) => {
    const charARes = await page.request.post(`${BASE_URL}/api/projects/${projectId}/characters`, {
      data: { name: '甲', roleType: 'protagonist' },
    });
    const charAId = (await charARes.json()).data.id;

    const charBRes = await page.request.post(`${BASE_URL}/api/projects/${projectId}/characters`, {
      data: { name: '乙', roleType: 'supporting' },
    });
    const charBId = (await charBRes.json()).data.id;

    await page.request.post(`${BASE_URL}/api/projects/${projectId}/characters/relations`, {
      data: { characterAId: charAId, characterBId: charBId, relationType: '朋友' },
    });

    const listRes = await page.request.get(`${BASE_URL}/api/projects/${projectId}/characters`);
    const listBody = await listRes.json();
    expect(listBody.data.relations.length).toBeGreaterThanOrEqual(1);
    expect(listBody.data.relations[0].relation_type).toBe('朋友');
  });
});
