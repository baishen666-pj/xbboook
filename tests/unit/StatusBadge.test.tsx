// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/ui/StatusBadge';

describe('StatusBadge', () => {
  it('renders label text', () => {
    render(<StatusBadge label="Draft" color="blue" />);
    expect(screen.getByText('Draft')).toBeDefined();
  });

  it('applies correct color class for blue', () => {
    render(<StatusBadge label="Draft" color="blue" />);
    const el = screen.getByText('Draft');
    expect(el.className).toContain('bg-blue-500/15');
    expect(el.className).toContain('text-blue-400');
  });

  it('applies correct color class for green', () => {
    render(<StatusBadge label="Active" color="green" />);
    const el = screen.getByText('Active');
    expect(el.className).toContain('bg-green-500/15');
    expect(el.className).toContain('text-green-400');
  });

  it('applies correct color class for red', () => {
    render(<StatusBadge label="Error" color="red" />);
    const el = screen.getByText('Error');
    expect(el.className).toContain('bg-red-500/15');
    expect(el.className).toContain('text-red-400');
  });

  it('applies correct color class for gray', () => {
    render(<StatusBadge label="Idle" color="gray" />);
    const el = screen.getByText('Idle');
    expect(el.className).toContain('bg-gray-500/15');
    expect(el.className).toContain('text-gray-400');
  });

  it('applies correct color class for amber', () => {
    render(<StatusBadge label="Pending" color="amber" />);
    const el = screen.getByText('Pending');
    expect(el.className).toContain('bg-amber-500/15');
    expect(el.className).toContain('text-amber-400');
  });

  it('applies correct color class for purple', () => {
    render(<StatusBadge label="Review" color="purple" />);
    const el = screen.getByText('Review');
    expect(el.className).toContain('bg-purple-500/15');
    expect(el.className).toContain('text-purple-400');
  });

  it('applies correct color class for orange', () => {
    render(<StatusBadge label="Warning" color="orange" />);
    const el = screen.getByText('Warning');
    expect(el.className).toContain('bg-orange-500/15');
    expect(el.className).toContain('text-orange-400');
  });

  it('applies correct color class for emerald', () => {
    render(<StatusBadge label="Success" color="emerald" />);
    const el = screen.getByText('Success');
    expect(el.className).toContain('bg-emerald-500/15');
    expect(el.className).toContain('text-emerald-400');
  });

  it('applies xs size class by default', () => {
    render(<StatusBadge label="Small" color="blue" />);
    const el = screen.getByText('Small');
    expect(el.className).toContain('text-[10px]');
    expect(el.className).toContain('px-1.5');
    expect(el.className).toContain('py-0.5');
  });

  it('applies sm size class when specified', () => {
    render(<StatusBadge label="Medium" color="blue" size="sm" />);
    const el = screen.getByText('Medium');
    expect(el.className).toContain('text-[var(--text-xs)]');
    expect(el.className).toContain('px-2');
    expect(el.className).toContain('py-0.5');
  });

  it('always includes base styling classes', () => {
    render(<StatusBadge label="Test" color="blue" />);
    const el = screen.getByText('Test');
    expect(el.className).toContain('inline-flex');
    expect(el.className).toContain('items-center');
    expect(el.className).toContain('rounded-full');
    expect(el.className).toContain('font-medium');
  });
});
