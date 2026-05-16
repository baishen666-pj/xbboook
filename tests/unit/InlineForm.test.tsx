// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InlineForm } from '@/components/ui/InlineForm';

describe('InlineForm', () => {
  it('renders input with the provided value', () => {
    render(
      <InlineForm
        value="hello"
        onChange={() => {}}
        onSubmit={() => {}}
        onCancel={() => {}}
      />
    );
    const input = screen.getByDisplayValue('hello') as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.value).toBe('hello');
  });

  it('renders input with placeholder text', () => {
    render(
      <InlineForm
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        onCancel={() => {}}
        placeholder="Enter name..."
      />
    );
    const input = screen.getByPlaceholderText('Enter name...') as HTMLInputElement;
    expect(input).toBeDefined();
  });

  it('uses default placeholder when none provided', () => {
    render(
      <InlineForm
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        onCancel={() => {}}
      />
    );
    const input = screen.getByPlaceholderText('输入名称...') as HTMLInputElement;
    expect(input).toBeDefined();
  });

  it('calls onChange when typing', () => {
    const handleChange = vi.fn();
    render(
      <InlineForm
        value=""
        onChange={handleChange}
        onSubmit={() => {}}
        onCancel={() => {}}
      />
    );
    const input = screen.getByPlaceholderText('输入名称...');
    fireEvent.change(input, { target: { value: 'new text' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith('new text');
  });

  it('calls onSubmit on Enter key', () => {
    const handleSubmit = vi.fn();
    render(
      <InlineForm
        value="some text"
        onChange={() => {}}
        onSubmit={handleSubmit}
        onCancel={() => {}}
      />
    );
    const input = screen.getByDisplayValue('some text');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel on Escape key', () => {
    const handleCancel = vi.fn();
    render(
      <InlineForm
        value="some text"
        onChange={() => {}}
        onSubmit={() => {}}
        onCancel={handleCancel}
      />
    );
    const input = screen.getByDisplayValue('some text');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it('does not call onSubmit on other keys', () => {
    const handleSubmit = vi.fn();
    render(
      <InlineForm
        value="some text"
        onChange={() => {}}
        onSubmit={handleSubmit}
        onCancel={() => {}}
      />
    );
    const input = screen.getByDisplayValue('some text');
    fireEvent.keyDown(input, { key: 'Tab' });
    fireEvent.keyDown(input, { key: 'a' });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('disables submit button when value is empty', () => {
    render(
      <InlineForm
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        onCancel={() => {}}
      />
    );
    const submitButton = screen.getByText('确定') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
  });

  it('disables submit button when value is only whitespace', () => {
    render(
      <InlineForm
        value="   "
        onChange={() => {}}
        onSubmit={() => {}}
        onCancel={() => {}}
      />
    );
    const submitButton = screen.getByText('确定') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
  });

  it('enables submit button when value has non-whitespace text', () => {
    render(
      <InlineForm
        value="valid"
        onChange={() => {}}
        onSubmit={() => {}}
        onCancel={() => {}}
      />
    );
    const submitButton = screen.getByText('确定') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(false);
  });

  it('submit button shows default label "确定"', () => {
    render(
      <InlineForm
        value="text"
        onChange={() => {}}
        onSubmit={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText('确定')).toBeDefined();
  });

  it('submit button shows custom submitLabel', () => {
    render(
      <InlineForm
        value="text"
        onChange={() => {}}
        onSubmit={() => {}}
        onCancel={() => {}}
        submitLabel="Save"
      />
    );
    expect(screen.getByText('Save')).toBeDefined();
  });

  it('renders a cancel button with text "取消"', () => {
    render(
      <InlineForm
        value="text"
        onChange={() => {}}
        onSubmit={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText('取消')).toBeDefined();
  });

  it('calls onSubmit when submit button is clicked', () => {
    const handleSubmit = vi.fn();
    render(
      <InlineForm
        value="text"
        onChange={() => {}}
        onSubmit={handleSubmit}
        onCancel={() => {}}
      />
    );
    const submitButton = screen.getByText('确定');
    fireEvent.click(submitButton);
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button is clicked', () => {
    const handleCancel = vi.fn();
    render(
      <InlineForm
        value="text"
        onChange={() => {}}
        onSubmit={() => {}}
        onCancel={handleCancel}
      />
    );
    const cancelButton = screen.getByText('取消');
    fireEvent.click(cancelButton);
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });
});
