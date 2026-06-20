import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import BottomSheet from './BottomSheet';

describe('BottomSheet', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <BottomSheet open={false} title="Test" onClose={vi.fn()}>Content</BottomSheet>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders title and children when open=true', () => {
    render(
      <BottomSheet open title="Filter Options" onClose={vi.fn()}>
        <p>Sheet body</p>
      </BottomSheet>
    );
    expect(screen.getByText('Filter Options')).toBeInTheDocument();
    expect(screen.getByText('Sheet body')).toBeInTheDocument();
  });

  it('sets body overflow to "hidden" when opened', () => {
    render(<BottomSheet open title="T" onClose={vi.fn()}>x</BottomSheet>);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body overflow to "" when unmounted (sheet closed)', () => {
    const { rerender } = render(
      <BottomSheet open title="T" onClose={vi.fn()}>x</BottomSheet>
    );
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<BottomSheet open={false} title="T" onClose={vi.fn()}>x</BottomSheet>);
    expect(document.body.style.overflow).toBe('');
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<BottomSheet open title="T" onClose={onClose}>x</BottomSheet>);
    // The backdrop is the `absolute inset-0` div
    const backdrop = document.querySelector('.absolute.inset-0.bg-black\\/50');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn();
    render(<BottomSheet open title="T" onClose={onClose}>x</BottomSheet>);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('noScroll=true → content area has overflow-hidden class', () => {
    render(<BottomSheet open title="T" onClose={vi.fn()} noScroll>x</BottomSheet>);
    const contentDiv = document.querySelector('.overflow-hidden.flex-1, .flex-1.overflow-hidden');
    expect(contentDiv).not.toBeNull();
  });

  it('noScroll=false (default) → content area has overflow-y-auto class', () => {
    render(<BottomSheet open title="T" onClose={vi.fn()}>x</BottomSheet>);
    const contentDiv = document.querySelector('.overflow-y-auto');
    expect(contentDiv).not.toBeNull();
  });
});
