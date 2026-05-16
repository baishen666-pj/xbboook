import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useToastStore, toast } from '../../src/stores/toastStore';

describe('toastStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Clear all toasts
    const { toasts } = useToastStore.getState();
    for (const t of toasts) {
      useToastStore.getState().removeToast(t.id);
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should add and remove toasts', () => {
    const store = useToastStore.getState();
    store.addToast('success', '保存成功');

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].message).toBe('保存成功');

    useToastStore.getState().removeToast(toasts[0].id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('should store toast with duration for component-driven removal', () => {
    useToastStore.getState().addToast('info', '提示', 2000);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].duration).toBe(2000);

    // Removal is now handled by ToastContainer component after exit animation
    useToastStore.getState().removeToast(useToastStore.getState().toasts[0].id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('should support multiple toast types', () => {
    useToastStore.getState().addToast('success', '成功', 0);
    useToastStore.getState().addToast('error', '失败', 0);
    useToastStore.getState().addToast('warning', '警告', 0);
    useToastStore.getState().addToast('info', '信息', 0);
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(4);
    expect(toasts.map((t) => t.type)).toEqual(['success', 'error', 'warning', 'info']);
  });

  it('toast helper function should work', () => {
    toast('error', '测试错误', 0);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].message).toBe('测试错误');
  });
});
