import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { characterService } from '@/services/characterService';
import { apiClient } from '@/services/apiClient';

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);
const mockedPut = vi.mocked(apiClient.put);
const mockedDelete = vi.mocked(apiClient.delete);

describe('characterService', () => {
  const projectId = 'proj-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('获取项目角色列表及关系', async () => {
      const data = {
        characters: [{ id: 'c1', name: '张三' }],
        relations: [{ id: 'r1', characterAId: 'c1', characterBId: 'c2', relationType: '朋友' }],
      };
      mockedGet.mockResolvedValue({ success: true, data, error: null });

      const result = await characterService.list(projectId);

      expect(mockedGet).toHaveBeenCalledWith(`/projects/${projectId}/characters`);
      expect(result.data).toEqual(data);
      expect(result.data!.characters).toHaveLength(1);
      expect(result.data!.relations).toHaveLength(1);
    });

    it('返回空列表', async () => {
      const data = { characters: [], relations: [] };
      mockedGet.mockResolvedValue({ success: true, data, error: null });

      const result = await characterService.list(projectId);

      expect(result.data!.characters).toEqual([]);
    });
  });

  describe('getById', () => {
    it('获取单个角色详情及关系', async () => {
      const data = {
        character: { id: 'c1', name: '张三', roleType: 'protagonist' },
        relations: [{ id: 'r1', relationType: '师徒' }],
      };
      mockedGet.mockResolvedValue({ success: true, data, error: null });

      const result = await characterService.getById(projectId, 'c1');

      expect(mockedGet).toHaveBeenCalledWith(`/projects/${projectId}/characters/c1`);
      expect(result.data!.character.name).toBe('张三');
      expect(result.data!.relations).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('创建角色并发送完整数据', async () => {
      const input = {
        name: '李四',
        nickname: '四哥',
        roleType: 'antagonist',
        gender: '男',
        age: '30',
        appearance: '高大威猛',
        personality: '阴险',
        background: '出身名门',
        abilities: '剑术',
        notes: '重要反派',
      };
      const created = { id: 'c2', ...input };
      mockedPost.mockResolvedValue({ success: true, data: created, error: null });

      const result = await characterService.create(projectId, input);

      expect(mockedPost).toHaveBeenCalledWith(`/projects/${projectId}/characters`, input);
      expect(result.data).toEqual(created);
    });

    it('创建角色时仅 name 为必填', async () => {
      const input = { name: '王五' };
      mockedPost.mockResolvedValue({ success: true, data: { id: 'c3', ...input }, error: null });

      await characterService.create(projectId, input);

      expect(mockedPost).toHaveBeenCalledWith(`/projects/${projectId}/characters`, input);
    });
  });

  describe('update', () => {
    it('更新角色部分字段', async () => {
      const data = { name: '张三更新', personality: '善良' };
      const updated = { id: 'c1', ...data };
      mockedPut.mockResolvedValue({ success: true, data: updated, error: null });

      const result = await characterService.update(projectId, 'c1', data);

      expect(mockedPut).toHaveBeenCalledWith(`/projects/${projectId}/characters/c1`, data);
      expect(result.data).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('删除角色', async () => {
      mockedDelete.mockResolvedValue({ success: true, data: null, error: null });

      const result = await characterService.remove(projectId, 'c1');

      expect(mockedDelete).toHaveBeenCalledWith(`/projects/${projectId}/characters/c1`);
      expect(result.success).toBe(true);
    });
  });

  describe('createRelation', () => {
    it('创建角色关系', async () => {
      const data = {
        characterAId: 'c1',
        characterBId: 'c2',
        relationType: '师徒',
        description: '师父和徒弟',
      };
      const created = { id: 'r1', ...data };
      mockedPost.mockResolvedValue({ success: true, data: created, error: null });

      const result = await characterService.createRelation(projectId, data);

      expect(mockedPost).toHaveBeenCalledWith(`/projects/${projectId}/characters/relations`, data);
      expect(result.data).toEqual(created);
    });

    it('创建关系时 description 可选', async () => {
      const data = { characterAId: 'c1', characterBId: 'c2', relationType: '朋友' };
      mockedPost.mockResolvedValue({ success: true, data: { id: 'r2', ...data }, error: null });

      await characterService.createRelation(projectId, data);

      expect(mockedPost).toHaveBeenCalledWith(`/projects/${projectId}/characters/relations`, data);
    });
  });

  describe('deleteRelation', () => {
    it('删除角色关系', async () => {
      mockedDelete.mockResolvedValue({ success: true, data: null, error: null });

      const result = await characterService.deleteRelation(projectId, 'r1');

      expect(mockedDelete).toHaveBeenCalledWith(`/projects/${projectId}/characters/relations/r1`);
      expect(result.success).toBe(true);
    });
  });

  describe('updateRelation', () => {
    it('更新角色关系', async () => {
      const data = { relationType: '敌人', description: '变成了敌人' };
      const updated = { id: 'r1', ...data };
      mockedPut.mockResolvedValue({ success: true, data: updated, error: null });

      const result = await characterService.updateRelation(projectId, 'r1', data);

      expect(mockedPut).toHaveBeenCalledWith(`/projects/${projectId}/characters/relations/r1`, data);
      expect(result.data).toEqual(updated);
    });

    it('仅更新 relationType', async () => {
      const data = { relationType: '盟友' };
      mockedPut.mockResolvedValue({ success: true, data: { id: 'r1', relationType: '盟友' }, error: null });

      await characterService.updateRelation(projectId, 'r1', data);

      expect(mockedPut).toHaveBeenCalledWith(`/projects/${projectId}/characters/relations/r1`, data);
    });
  });

  describe('错误处理', () => {
    it('API 返回失败时传递错误', async () => {
      mockedGet.mockResolvedValue({ success: false, data: null, error: '角色不存在' });

      const result = await characterService.getById(projectId, 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('角色不存在');
    });
  });
});
