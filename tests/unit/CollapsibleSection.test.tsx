// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';

describe('CollapsibleSection', () => {
  it('renders title text', () => {
    render(
      <CollapsibleSection title="Chapter List" isOpen={false} onToggle={() => {}}>
        <div>Content</div>
      </CollapsibleSection>
    );
    expect(screen.getByText('Chapter List')).toBeDefined();
  });

  it('renders title as ReactNode', () => {
    render(
      <CollapsibleSection title={<span>Dynamic Title</span>} isOpen={false} onToggle={() => {}}>
        <div>Content</div>
      </CollapsibleSection>
    );
    expect(screen.getByText('Dynamic Title')).toBeDefined();
  });

  it('hides children when isOpen is false', () => {
    render(
      <CollapsibleSection title="Section" isOpen={false} onToggle={() => {}}>
        <div>Hidden Content</div>
      </CollapsibleSection>
    );
    expect(screen.queryByText('Hidden Content')).toBeNull();
  });

  it('shows children when isOpen is true', () => {
    render(
      <CollapsibleSection title="Section" isOpen={true} onToggle={() => {}}>
        <div>Visible Content</div>
      </CollapsibleSection>
    );
    expect(screen.getByText('Visible Content')).toBeDefined();
  });

  it('calls onToggle when header button is clicked', () => {
    const handleToggle = vi.fn();
    render(
      <CollapsibleSection title="Section" isOpen={false} onToggle={handleToggle}>
        <div>Content</div>
      </CollapsibleSection>
    );
    const toggleButton = screen.getByText('Section').closest('button')!;
    fireEvent.click(toggleButton);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('sets aria-expanded to true when isOpen is true', () => {
    render(
      <CollapsibleSection title="Section" isOpen={true} onToggle={() => {}}>
        <div>Content</div>
      </CollapsibleSection>
    );
    const button = screen.getByText('Section').closest('button')!;
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('sets aria-expanded to false when isOpen is false', () => {
    render(
      <CollapsibleSection title="Section" isOpen={false} onToggle={() => {}}>
        <div>Content</div>
      </CollapsibleSection>
    );
    const button = screen.getByText('Section').closest('button')!;
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders badge when provided', () => {
    render(
      <CollapsibleSection
        title="Section"
        isOpen={false}
        onToggle={() => {}}
        badge={<span data-testid="badge">5 items</span>}
      >
        <div>Content</div>
      </CollapsibleSection>
    );
    expect(screen.getByTestId('badge')).toBeDefined();
    expect(screen.getByText('5 items')).toBeDefined();
  });

  it('does not render badge when not provided', () => {
    render(
      <CollapsibleSection title="Section" isOpen={false} onToggle={() => {}}>
        <div>Content</div>
      </CollapsibleSection>
    );
    expect(screen.queryByTestId('badge')).toBeNull();
  });

  it('renders actions when provided', () => {
    render(
      <CollapsibleSection
        title="Section"
        isOpen={false}
        onToggle={() => {}}
        actions={<button data-testid="action-btn">Add</button>}
      >
        <div>Content</div>
      </CollapsibleSection>
    );
    expect(screen.getByTestId('action-btn')).toBeDefined();
    expect(screen.getByText('Add')).toBeDefined();
  });

  it('does not render actions when not provided', () => {
    render(
      <CollapsibleSection title="Section" isOpen={false} onToggle={() => {}}>
        <div>Content</div>
      </CollapsibleSection>
    );
    expect(screen.queryByTestId('action-btn')).toBeNull();
  });

  it('renders both badge and actions simultaneously', () => {
    render(
      <CollapsibleSection
        title="Section"
        isOpen={true}
        onToggle={() => {}}
        badge={<span data-testid="badge">3</span>}
        actions={<button data-testid="action-btn">Edit</button>}
      >
        <div>Content</div>
      </CollapsibleSection>
    );
    expect(screen.getByTestId('badge')).toBeDefined();
    expect(screen.getByTestId('action-btn')).toBeDefined();
    expect(screen.getByText('Content')).toBeDefined();
  });

  it('renders chevron icon with rotation when open', () => {
    const { container } = render(
      <CollapsibleSection title="Section" isOpen={true} onToggle={() => {}}>
        <div>Content</div>
      </CollapsibleSection>
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
    expect(svg!.getAttribute('class')).toContain('rotate-90');
  });

  it('renders chevron icon without rotation when closed', () => {
    const { container } = render(
      <CollapsibleSection title="Section" isOpen={false} onToggle={() => {}}>
        <div>Content</div>
      </CollapsibleSection>
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
    expect(svg!.getAttribute('class')).not.toContain('rotate-90');
  });

  it('chevron icon is aria-hidden', () => {
    const { container } = render(
      <CollapsibleSection title="Section" isOpen={false} onToggle={() => {}}>
        <div>Content</div>
      </CollapsibleSection>
    );
    const svg = container.querySelector('svg');
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
  });
});
