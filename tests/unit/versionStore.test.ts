/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/versionService', () => ({
  versionService: {
    list: vi.fn(),
    create: vi.fn(),
    rollback: vi.fn(),
    remove: vi.fn(),
  },
}));

import { useVersionStore } from '@/stores/versionStore';
import { versionService } from '@/services/versionService';
import type { ChapterVersion } from '@/types/project';

const mockVersionService = versionService as unknown as {
  list: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  rollback: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

const fakeVersion: ChapterVersion = {
  id: 'v1',
  chapter_id: 'ch1',
  project_id: 'p1',
  version_number: 1,
  content_hash: 'abc123',
  word_count: 1000,
  snapshot_type: 'manual',
  label: 'First draft',
  created_at: '2026-01-01T00:00:00Z',
};

describe('versionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useVersionStore.setState({
      versions: [],
      isLoading: false,
      previewVersion: null,
      compareVersionId: null,
    });
  });

  describe('initial state', () => {
    it('starts with empty versions and no preview', () => {
      const state = useVersionStore.getState();
      expect(state.versions).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.previewVersion).toBeNull();
      expect(state.compareVersionId).toBeNull();
    });
  });

  describe('loadVersions', () => {
    it('loads versions on success', async () => {
      mockVersionService.list.mockResolvedValue({
        success: true,
        data: [fakeVersion],
        error: null,
      });

      await useVersionStore.getState().loadVersions('p1', 'ch1');

      expect(useVersionStore.getState().versions).toEqual([fakeVersion]);
      expect(useVersionStore.getState().isLoading).toBe(false);
    });

    it('sets isLoading during fetch', async () => {
      let loadingDuringFetch = false;
      mockVersionService.list.mockImplementation(async () => {
        loadingDuringFetch = useVersionStore.getState().isLoading;
        return { success: true, data: [], error: null };
      });

      await useVersionStore.getState().loadVersions('p1', 'ch1');

      expect(loadingDuringFetch).toBe(true);
      expect(useVersionStore.getState().isLoading).toBe(false);
    });

    it('sets empty array on failure', async () => {
      mockVersionService.list.mockResolvedValue({
        success: false,
        data: null,
        error: 'Network error',
      });

      await useVersionStore.getState().loadVersions('p1', 'ch1');

      expect(useVersionStore.getState().versions).toEqual([]);
      expect(useVersionStore.getState().isLoading).toBe(false);
    });
  });

  describe('createSnapshot', () => {
    it('creates a snapshot and reloads versions', async () => {
      const newVersion: ChapterVersion = {
        ...fakeVersion,
        id: 'v2',
        version_number: 2,
      };

      mockVersionService.create.mockResolvedValue({
        success: true,
        data: newVersion,
        error: null,
      });
      mockVersionService.list.mockResolvedValue({
        success: true,
        data: [fakeVersion, newVersion],
        error: null,
      });

      await useVersionStore.getState().createSnapshot('p1', 'ch1', 'Checkpoint');

      expect(mockVersionService.create).toHaveBeenCalledWith('p1', 'ch1', { label: 'Checkpoint' });
      expect(useVersionStore.getState().versions).toHaveLength(2);
    });

    it('creates a snapshot without label', async () => {
      mockVersionService.create.mockResolvedValue({
        success: true,
        data: null,
        error: null,
      });
      mockVersionService.list.mockResolvedValue({
        success: true,
        data: [],
        error: null,
      });

      await useVersionStore.getState().createSnapshot('p1', 'ch1');

      expect(mockVersionService.create).toHaveBeenCalledWith('p1', 'ch1', undefined);
    });
  });

  describe('rollback', () => {
    it('returns content on successful rollback', async () => {
      mockVersionService.rollback.mockResolvedValue({
        success: true,
        data: { content: 'Restored content here' },
        error: null,
      });
      mockVersionService.list.mockResolvedValue({
        success: true,
        data: [fakeVersion],
        error: null,
      });

      const result = await useVersionStore.getState().rollback('p1', 'ch1', 'v1');

      expect(result).toBe('Restored content here');
      expect(mockVersionService.rollback).toHaveBeenCalledWith('p1', 'ch1', 'v1');
    });

    it('returns null on rollback failure', async () => {
      mockVersionService.rollback.mockResolvedValue({
        success: false,
        data: null,
        error: 'Version not found',
      });

      const result = await useVersionStore.getState().rollback('p1', 'ch1', 'bad-id');

      expect(result).toBeNull();
    });
  });

  describe('deleteVersion', () => {
    it('deletes version and reloads list', async () => {
      mockVersionService.remove.mockResolvedValue({
        success: true,
        data: null,
        error: null,
      });
      mockVersionService.list.mockResolvedValue({
        success: true,
        data: [],
        error: null,
      });

      useVersionStore.setState({ versions: [fakeVersion] });
      await useVersionStore.getState().deleteVersion('p1', 'ch1', 'v1');

      expect(mockVersionService.remove).toHaveBeenCalledWith('p1', 'ch1', 'v1');
      expect(useVersionStore.getState().versions).toEqual([]);
    });
  });

  describe('setPreviewVersion', () => {
    it('sets preview version', () => {
      useVersionStore.getState().setPreviewVersion(fakeVersion);

      expect(useVersionStore.getState().previewVersion).toEqual(fakeVersion);
    });

    it('clears preview version with null', () => {
      useVersionStore.getState().setPreviewVersion(fakeVersion);
      useVersionStore.getState().setPreviewVersion(null);

      expect(useVersionStore.getState().previewVersion).toBeNull();
    });
  });

  describe('setCompareVersionId', () => {
    it('sets compare version id', () => {
      useVersionStore.getState().setCompareVersionId('v2');

      expect(useVersionStore.getState().compareVersionId).toBe('v2');
    });

    it('clears compare version id with null', () => {
      useVersionStore.getState().setCompareVersionId('v2');
      useVersionStore.getState().setCompareVersionId(null);

      expect(useVersionStore.getState().compareVersionId).toBeNull();
    });
  });

  describe('clear', () => {
    it('resets all state to initial values', () => {
      useVersionStore.setState({
        versions: [fakeVersion],
        isLoading: true,
        previewVersion: fakeVersion,
        compareVersionId: 'v2',
      });

      useVersionStore.getState().clear();

      expect(useVersionStore.getState().versions).toEqual([]);
      expect(useVersionStore.getState().isLoading).toBe(false);
      expect(useVersionStore.getState().previewVersion).toBeNull();
      expect(useVersionStore.getState().compareVersionId).toBeNull();
    });
  });
});
