// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Component, type ReactNode, type ErrorInfo } from 'react';

// ---------------------------------------------------------------------------
// ErrorBoundary — tested via a local thin wrapper since the component uses
// getDerivedStateFromError (which @testing-library/react cannot trigger by
// simply rendering bad JSX inline — we need to throw during render).
// ---------------------------------------------------------------------------

// Import the real ErrorBoundary.  Because it is a class component that uses
// getDerivedStateFromError we will test it by rendering a child that throws
// during render.
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

// A helper component that throws on render when `shouldThrow` is true.
function ThrowOnRender({ shouldThrow, message }: { shouldThrow: boolean; message: string }) {
  if (shouldThrow) {
    throw new Error(message);
  }
  return <div>Child content</div>;
}

// Because React error boundaries only catch errors during rendering, and
// jsdom + our test setup may swallow unhandled errors, we temporarily silence
// console.error for the error-boundary tests.
const originalConsoleError = console.error;

function silenceConsoleError() {
  console.error = (...args: unknown[]) => {
    // React prints the error + component stack when a boundary catches; ignore it.
    if (typeof args[0] === 'string' && args[0].includes('The above error occurred in')) return;
    if (typeof args[0] === 'string' && args[0].includes('Consider adding an error boundary')) return;
  };
}

function restoreConsoleError() {
  console.error = originalConsoleError;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    silenceConsoleError();
  });

  // restore after each describe block — but we also restore in afterEach style
  // via the `afterAll` equivalent below.  For safety we do it per-test with
  // the `finally` pattern inside relevant tests, but having a baseline
  // restore is fine too.

  it('renders children normally when no error', () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender shouldThrow={false} message="" />
      </ErrorBoundary>
    );
    expect(screen.getByText('Child content')).toBeDefined();
    restoreConsoleError();
  });

  it('shows error UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender shouldThrow={true} message="Something broke" />
      </ErrorBoundary>
    );

    expect(screen.getByText('渲染出错')).toBeDefined();
    expect(screen.getByText('Something broke')).toBeDefined();
    expect(screen.queryByText('Child content')).toBeNull();
    restoreConsoleError();
  });

  it('has a retry button that resets error state', () => {
    let shouldThrow = true;

    // We need a controlled wrapper so the child can stop throwing after retry.
    function ControlledChild() {
      if (shouldThrow) throw new Error('Boom');
      return <div>Recovered</div>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ControlledChild />
      </ErrorBoundary>
    );

    // Boundary caught the error — shows error UI
    expect(screen.getByText('渲染出错')).toBeDefined();

    // Fix the underlying problem
    shouldThrow = false;

    // Click retry
    const retryButton = screen.getByText('重试');
    fireEvent.click(retryButton);

    // Now the child should render normally
    expect(screen.getByText('Recovered')).toBeDefined();
    expect(screen.queryByText('渲染出错')).toBeNull();
    restoreConsoleError();
  });

  it('uses design token var(--color-text-muted) not hardcoded colors', () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender shouldThrow={true} message="token test" />
      </ErrorBoundary>
    );

    // The error message div should use the design token class
    const errorElement = screen.getByText('token test');
    expect(errorElement.className).toContain('text-[var(--color-text-muted)]');

    // The retry button should use the primary design token
    const retryButton = screen.getByText('重试');
    expect(retryButton.className).toContain('bg-[var(--color-primary)]');
    restoreConsoleError();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowOnRender shouldThrow={true} message="ignored" />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom fallback')).toBeDefined();
    expect(screen.queryByText('渲染出错')).toBeNull();
    restoreConsoleError();
  });
});

// ---------------------------------------------------------------------------
// ResizablePanel
// ---------------------------------------------------------------------------

import { ResizablePanel } from '@/components/layout/ResizablePanel';

describe('ResizablePanel', () => {
  const defaultProps = {
    defaultWidth: 300,
    minWidth: 200,
    maxWidth: 500,
    side: 'left' as const,
    children: <div>Panel content</div>,
  };

  it('renders children', () => {
    render(<ResizablePanel {...defaultProps} />);
    expect(screen.getByText('Panel content')).toBeDefined();
  });

  it('has a separator element with role="separator"', () => {
    const { container } = render(<ResizablePanel {...defaultProps} />);
    const separator = container.querySelector('[role="separator"]');
    expect(separator).not.toBeNull();
  });

  it('separator has tabIndex={0}', () => {
    const { container } = render(<ResizablePanel {...defaultProps} />);
    const separator = container.querySelector('[role="separator"]')!;
    expect(separator.getAttribute('tabindex')).toBe('0');
  });

  it('separator has aria-valuenow, aria-valuemin, aria-valuemax', () => {
    const { container } = render(<ResizablePanel {...defaultProps} />);
    const separator = container.querySelector('[role="separator"]')!;

    expect(separator.getAttribute('aria-valuenow')).toBe('300');
    expect(separator.getAttribute('aria-valuemin')).toBe('200');
    expect(separator.getAttribute('aria-valuemax')).toBe('500');
  });

  it('separator has aria-label="调整面板宽度"', () => {
    const { container } = render(<ResizablePanel {...defaultProps} />);
    const separator = container.querySelector('[role="separator"]')!;
    expect(separator.getAttribute('aria-label')).toBe('调整面板宽度');
  });

  it('has aria-orientation="vertical" on separator', () => {
    const { container } = render(<ResizablePanel {...defaultProps} />);
    const separator = container.querySelector('[role="separator"]')!;
    expect(separator.getAttribute('aria-orientation')).toBe('vertical');
  });

  it('renders with correct initial width style', () => {
    const { container } = render(<ResizablePanel {...defaultProps} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.width).toBe('300px');
  });

  it('calls onResize after keyboard navigation', () => {
    const onResize = vi.fn();
    const { container } = render(
      <ResizablePanel {...defaultProps} onResize={onResize} />
    );
    const separator = container.querySelector('[role="separator"]')!;

    fireEvent.keyDown(separator, { key: 'ArrowRight' });

    expect(onResize).toHaveBeenCalledTimes(1);
    // For side="left", ArrowRight increases by step=20 → 320
    expect(onResize).toHaveBeenCalledWith(320);
  });
});

// ---------------------------------------------------------------------------
// StoryArcPanel
// ---------------------------------------------------------------------------

import { StoryArcPanel } from '@/components/story-arcs/StoryArcPanel';

// Mock the stores before importing the component — the import above is hoisted
// alongside the vi.mock calls.

const mockFetchArcs = vi.fn().mockResolvedValue(undefined);
const mockFetchThreads = vi.fn().mockResolvedValue(undefined);
const mockUpdateArc = vi.fn().mockResolvedValue(undefined);
const mockDeleteArc = vi.fn().mockResolvedValue(undefined);
const mockDeleteThread = vi.fn().mockResolvedValue(undefined);
const mockClearError = vi.fn();

let mockArcsState: Array<{
  id: string;
  name: string;
  status: string;
  description: string | null;
  start_chapter: number | null;
  end_chapter: number | null;
}> = [];

let mockThreadsState: Array<{
  id: string;
  name: string;
  arc_id: string | null;
  status: string;
  priority: string;
}> = [];

let mockIsLoading = false;

vi.mock('@/stores/storyArcStore', () => ({
  useStoryArcStore: vi.fn(() => ({
    arcs: mockArcsState,
    threads: mockThreadsState,
    isLoading: mockIsLoading,
    error: null,
    fetchArcs: mockFetchArcs,
    fetchThreads: mockFetchThreads,
    updateArc: mockUpdateArc,
    deleteArc: mockDeleteArc,
    deleteThread: mockDeleteThread,
    clearError: mockClearError,
  })),
}));

let mockCurrentProject: { id: string } | null = { id: 'proj-1' };

vi.mock('@/stores/projectStore', () => ({
  useProjectStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) => {
    const state = {
      currentProject: mockCurrentProject,
      chapters: [],
    };
    return selector(state);
  }),
}));

describe('StoryArcPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockArcsState = [];
    mockThreadsState = [];
    mockCurrentProject = { id: 'proj-1' };
  });

  it('renders arc header with role="button" that is clickable', () => {
    mockArcsState = [
      {
        id: 'arc-1',
        name: '主线剧情',
        status: 'planned',
        description: null,
        start_chapter: null,
        end_chapter: null,
      },
    ];

    render(<StoryArcPanel />);

    const arcHeader = screen.getByRole('button', { name: /主线剧情/ });
    expect(arcHeader).toBeDefined();

    // Clicking should expand the arc (making description area visible)
    fireEvent.click(arcHeader);
    // After expansion, the description prompt becomes visible
    expect(screen.getByText('点击添加描述...')).toBeDefined();
  });

  it('arc header has aria-expanded attribute', () => {
    mockArcsState = [
      {
        id: 'arc-1',
        name: 'Test Arc',
        status: 'planned',
        description: null,
        start_chapter: null,
        end_chapter: null,
      },
    ];

    render(<StoryArcPanel />);

    const arcHeader = screen.getByRole('button', { name: /Test Arc/ });
    // Initially collapsed
    expect(arcHeader.getAttribute('aria-expanded')).toBe('false');

    // Expand it
    fireEvent.click(arcHeader);
    expect(arcHeader.getAttribute('aria-expanded')).toBe('true');

    // Collapse it
    fireEvent.click(arcHeader);
    expect(arcHeader.getAttribute('aria-expanded')).toBe('false');
  });

  it('arc status cycling button has aria-label', () => {
    mockArcsState = [
      {
        id: 'arc-1',
        name: 'Test Arc',
        status: 'planned',
        description: null,
        start_chapter: null,
        end_chapter: null,
      },
    ];

    render(<StoryArcPanel />);

    // The status cycling button for the arc has aria-label
    const statusButton = screen.getByLabelText('切换弧线状态: 计划中');
    expect(statusButton).toBeDefined();
  });

  it('thread status cycling button has aria-label inside expanded arc', () => {
    mockArcsState = [
      {
        id: 'arc-1',
        name: 'Test Arc',
        status: 'planned',
        description: null,
        start_chapter: null,
        end_chapter: null,
      },
    ];
    mockThreadsState = [
      {
        id: 'thread-1',
        name: '线索A',
        arc_id: 'arc-1',
        status: 'open',
        priority: 'normal',
      },
    ];

    render(<StoryArcPanel />);

    // Expand the arc first
    const arcHeader = screen.getByRole('button', { name: /Test Arc/ });
    fireEvent.click(arcHeader);

    // The thread status button should have aria-label
    const threadStatusButton = screen.getByLabelText('切换线索状态: 开放');
    expect(threadStatusButton).toBeDefined();
  });

  it('thread priority button has aria-label inside expanded arc', () => {
    mockArcsState = [
      {
        id: 'arc-1',
        name: 'Test Arc',
        status: 'planned',
        description: null,
        start_chapter: null,
        end_chapter: null,
      },
    ];
    mockThreadsState = [
      {
        id: 'thread-1',
        name: '线索A',
        arc_id: 'arc-1',
        status: 'open',
        priority: 'normal',
      },
    ];

    render(<StoryArcPanel />);

    // Expand the arc
    const arcHeader = screen.getByRole('button', { name: /Test Arc/ });
    fireEvent.click(arcHeader);

    // The priority cycling button should have aria-label
    const priorityButton = screen.getByLabelText('切换优先级: 普通');
    expect(priorityButton).toBeDefined();
  });

  it('unassigned thread status and priority buttons have aria-label', () => {
    mockArcsState = [];
    mockThreadsState = [
      {
        id: 'thread-1',
        name: '孤线索',
        arc_id: null,
        status: 'dormant',
        priority: 'high',
      },
    ];

    render(<StoryArcPanel />);

    const threadStatusButton = screen.getByLabelText('切换线索状态: 休眠');
    expect(threadStatusButton).toBeDefined();

    const priorityButton = screen.getByLabelText('切换优先级: 高');
    expect(priorityButton).toBeDefined();
  });

  it('calls fetchArcs and fetchThreads on mount with project id', () => {
    render(<StoryArcPanel />);

    expect(mockFetchArcs).toHaveBeenCalledWith('proj-1');
    expect(mockFetchThreads).toHaveBeenCalledWith('proj-1');
  });

  it('does not fetch when no project is selected', () => {
    mockCurrentProject = null;

    render(<StoryArcPanel />);

    expect(mockFetchArcs).not.toHaveBeenCalled();
    expect(mockFetchThreads).not.toHaveBeenCalled();
  });

  it('shows loading state', () => {
    mockIsLoading = true;

    render(<StoryArcPanel />);

    expect(screen.getByText('加载中...')).toBeDefined();

    mockIsLoading = false;
  });

  it('shows empty state when no arcs or threads', () => {
    render(<StoryArcPanel />);

    expect(screen.getByText('暂无故事弧线，点击上方按钮创建')).toBeDefined();
  });

  it('shows header title', () => {
    render(<StoryArcPanel />);

    expect(screen.getByText('故事弧线')).toBeDefined();
  });
});
