import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetchForeshadowing = vi.fn();
const mockCreateForeshadowing = vi.fn();
const mockUpdateForeshadowing = vi.fn();
const mockDeleteForeshadowing = vi.fn();

vi.mock('../../src/services/foreshadowingService', () => ({
  foreshadowingService: {
    fetchForeshadowing: (...args: unknown[]) => mockFetchForeshadowing(...args),
    createForeshadowing: (...args: unknown[]) => mockCreateForeshadowing(...args),
    updateForeshadowing: (...args: unknown[]) => mockUpdateForeshadowing(...args),
    deleteForeshadowing: (...args: unknown[]) => mockDeleteForeshadowing(...args),
  },
}));

import { useForeshadowingStore } from '../../src/stores/foreshadowingStore';
import type { Foreshadowing } from '../../src/types/project';

function makeForeshadowing(overrides: Partial<Foreshadowing> = {}): Foreshadowing {
  return {
    id: 'fs-1',
    projectId: 'proj-1',
    title: '神秘老人',
    description: null,
    plantChapterId: null,
    expectedHarvestChapterId: null,
    actualHarvestChapterId: null,
    status: 'planted',
    importance: 'normal',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('foreshadowingStore', () => {
  beforeEach(() => {
    useForeshadowingStore.setState({ items: [], loading: false });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchForeshadowing', () => {
    it('fetches items and updates state', async () => {
      const items = [makeForeshadowing(), makeForeshadowing({ id: 'fs-2', title: '伏笔B' })];
      mockFetchForeshadowing.mockResolvedValue({
        success: true,
        data: items,
        error: null,
      });

      await useForeshadowingStore.getState().fetchForeshadowing('proj-1');

      expect(mockFetchForeshadowing).toHaveBeenCalledWith('proj-1', undefined);
      expect(useForeshadowingStore.getState().items).toEqual(items);
      expect(useForeshadowingStore.getState().loading).toBe(false);
    });

    it('fetches with status filter', async () => {
      const items = [makeForeshadowing({ status: 'planted' })];
      mockFetchForeshadowing.mockResolvedValue({
        success: true,
        data: items,
        error: null,
      });

      await useForeshadowingStore.getState().fetchForeshadowing('proj-1', 'planted');

      expect(mockFetchForeshadowing).toHaveBeenCalledWith('proj-1', 'planted');
    });

    it('handles fetch failure gracefully', async () => {
      mockFetchForeshadowing.mockResolvedValue({
        success: false,
        data: null,
        error: 'Network error',
      });

      await useForeshadowingStore.getState().fetchForeshadowing('proj-1');

      expect(useForeshadowingStore.getState().items).toEqual([]);
      expect(useForeshadowingStore.getState().loading).toBe(false);
    });
  });

  describe('addForeshadowing', () => {
    it('adds a new item to the list', async () => {
      const newItem = makeForeshadowing();
      mockCreateForeshadowing.mockResolvedValue({
        success: true,
        data: newItem,
        error: null,
      });

      await useForeshadowingStore.getState().addForeshadowing('proj-1', {
        title: '神秘老人',
      });

      expect(useForeshadowingStore.getState().items).toHaveLength(1);
      expect(useForeshadowingStore.getState().items[0].id).toBe('fs-1');
    });

    it('does not add item on failure', async () => {
      mockCreateForeshadowing.mockResolvedValue({
        success: false,
        data: null,
        error: 'Create failed',
      });

      await useForeshadowingStore.getState().addForeshadowing('proj-1', {
        title: 'Test',
      });

      expect(useForeshadowingStore.getState().items).toHaveLength(0);
    });
  });

  describe('updateForeshadowing', () => {
    it('updates an existing item in the list', async () => {
      const original = makeForeshadowing();
      useForeshadowingStore.setState({ items: [original] });

      const updated = makeForeshadowing({ status: 'harvested' });
      mockUpdateForeshadowing.mockResolvedValue({
        success: true,
        data: updated,
        error: null,
      });

      await useForeshadowingStore.getState().updateForeshadowing('proj-1', 'fs-1', {
        status: 'harvested',
      });

      expect(useForeshadowingStore.getState().items[0].status).toBe('harvested');
    });

    it('does not update on failure', async () => {
      const original = makeForeshadowing();
      useForeshadowingStore.setState({ items: [original] });

      mockUpdateForeshadowing.mockResolvedValue({
        success: false,
        data: null,
        error: 'Update failed',
      });

      await useForeshadowingStore.getState().updateForeshadowing('proj-1', 'fs-1', {
        status: 'harvested',
      });

      expect(useForeshadowingStore.getState().items[0].status).toBe('planted');
    });
  });

  describe('removeForeshadowing', () => {
    it('removes an item from the list', async () => {
      const item = makeForeshadowing();
      useForeshadowingStore.setState({ items: [item] });

      mockDeleteForeshadowing.mockResolvedValue({
        success: true,
        data: null,
        error: null,
      });

      await useForeshadowingStore.getState().removeForeshadowing('proj-1', 'fs-1');

      expect(useForeshadowingStore.getState().items).toHaveLength(0);
    });

    it('does not remove on failure', async () => {
      const item = makeForeshadowing();
      useForeshadowingStore.setState({ items: [item] });

      mockDeleteForeshadowing.mockResolvedValue({
        success: false,
        data: null,
        error: 'Delete failed',
      });

      await useForeshadowingStore.getState().removeForeshadowing('proj-1', 'fs-1');

      expect(useForeshadowingStore.getState().items).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('clears all items and resets loading', () => {
      useForeshadowingStore.setState({
        items: [makeForeshadowing(), makeForeshadowing({ id: 'fs-2' })],
        loading: true,
      });

      useForeshadowingStore.getState().clear();

      expect(useForeshadowingStore.getState().items).toEqual([]);
      expect(useForeshadowingStore.getState().loading).toBe(false);
    });
  });
});