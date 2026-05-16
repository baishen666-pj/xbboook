// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DeleteButton } from '@/components/ui/DeleteButton';

describe('DeleteButton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initially shows times button, not confirming state', () => {
    render(<DeleteButton onDelete={() => {}} />);
    // The × character is rendered as HTML entity &times;
    const button = screen.getByLabelText('删除');
    expect(button).toBeDefined();
    expect(button.textContent).toBe('×'); // × character
    expect(screen.queryByText('确认')).toBeNull();
  });

  it('has aria-label "删除" on initial button', () => {
    render(<DeleteButton onDelete={() => {}} />);
    const button = screen.getByLabelText('删除');
    expect(button).toBeDefined();
  });

  it('shows "确认" button after first click (confirming state)', () => {
    render(<DeleteButton onDelete={() => {}} />);
    const button = screen.getByLabelText('删除');
    fireEvent.click(button);
    expect(screen.getByText('确认')).toBeDefined();
    // Original × button should no longer be in the document
    expect(screen.queryByLabelText('删除')).toBeNull();
  });

  it('calls onDelete on second click', () => {
    const handleDelete = vi.fn();
    render(<DeleteButton onDelete={handleDelete} />);

    // First click: enter confirming state
    const button = screen.getByLabelText('删除');
    fireEvent.click(button);

    // Second click: confirm delete
    const confirmButton = screen.getByText('确认');
    fireEvent.click(confirmButton);

    expect(handleDelete).toHaveBeenCalledTimes(1);
  });

  it('does not call onDelete on first click', () => {
    const handleDelete = vi.fn();
    render(<DeleteButton onDelete={handleDelete} />);
    const button = screen.getByLabelText('删除');
    fireEvent.click(button);
    expect(handleDelete).not.toHaveBeenCalled();
  });

  it('auto-resets to initial state after timeout', () => {
    render(<DeleteButton onDelete={() => {}} />);

    // Enter confirming state
    const button = screen.getByLabelText('删除');
    fireEvent.click(button);
    expect(screen.getByText('确认')).toBeDefined();

    // Advance time past the 2000ms timeout
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Should be back to initial state
    expect(screen.queryByText('确认')).toBeNull();
    expect(screen.getByLabelText('删除')).toBeDefined();
  });

  it('does not auto-reset before timeout elapses', () => {
    render(<DeleteButton onDelete={() => {}} />);

    const button = screen.getByLabelText('删除');
    fireEvent.click(button);

    // Advance time just before the timeout
    act(() => {
      vi.advanceTimersByTime(1999);
    });

    // Still in confirming state
    expect(screen.getByText('确认')).toBeDefined();
  });

  it('uses default confirmMessage "确认删除?"', () => {
    render(<DeleteButton onDelete={() => {}} />);
    const button = screen.getByLabelText('删除');
    fireEvent.click(button);
    const confirmButton = screen.getByText('确认');
    expect(confirmButton.title).toBe('确认删除?');
  });

  it('uses custom confirmMessage when provided', () => {
    render(<DeleteButton onDelete={() => {}} confirmMessage="Sure?" />);
    const button = screen.getByLabelText('删除');
    fireEvent.click(button);
    const confirmButton = screen.getByText('确认');
    expect(confirmButton.title).toBe('Sure?');
  });

  it('applies xs size class by default', () => {
    render(<DeleteButton onDelete={() => {}} />);
    const button = screen.getByLabelText('删除');
    expect(button.className).toContain('text-[10px]');
    expect(button.className).toContain('px-1');
  });

  it('applies sm size class when specified', () => {
    render(<DeleteButton onDelete={() => {}} size="sm" />);
    const button = screen.getByLabelText('删除');
    expect(button.className).toContain('text-[var(--text-xs)]');
    expect(button.className).toContain('px-1.5');
  });

  it('clears timeout when onDelete is called mid-countdown', () => {
    const handleDelete = vi.fn();
    render(<DeleteButton onDelete={handleDelete} />);

    // Enter confirming state
    const button = screen.getByLabelText('删除');
    fireEvent.click(button);

    // Advance time partway
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Click confirm before timeout fires
    const confirmButton = screen.getByText('确认');
    fireEvent.click(confirmButton);

    expect(handleDelete).toHaveBeenCalledTimes(1);

    // Advance past original timeout -- should not cause issues (timer was cleared)
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // onDelete should still only have been called once
    expect(handleDelete).toHaveBeenCalledTimes(1);
  });
});
