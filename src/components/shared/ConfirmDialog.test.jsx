import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmDialog from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <ConfirmDialog open={false} title="Test" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders title and buttons when open=true', () => {
    render(
      <ConfirmDialog open title="Delete match?" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByText('Delete match?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
  });

  it('renders without error when message prop is omitted', () => {
    expect(() =>
      render(<ConfirmDialog open title="Title" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    ).not.toThrow();
  });

  it('danger=false — confirm button does NOT have bg-red-600', () => {
    render(
      <ConfirmDialog open title="T" danger={false} onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    const btn = screen.getByRole('button', { name: /confirm/i });
    expect(btn.className).not.toContain('bg-red-600');
  });

  it('danger=true — confirm button has bg-red-600 class', () => {
    render(
      <ConfirmDialog open title="T" danger onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    const btn = screen.getByRole('button', { name: /confirm/i });
    expect(btn.className).toContain('bg-red-600');
  });

  it('calls onConfirm when Confirm is clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open title="T" onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="T" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('disabled=true — confirm button is disabled and not called on click', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open title="T" disabled onConfirm={onConfirm} onCancel={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /confirm/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('both buttons have type="button" attribute', () => {
    render(
      <ConfirmDialog open title="T" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    const [cancel, confirm] = screen.getAllByRole('button');
    expect(cancel).toHaveAttribute('type', 'button');
    expect(confirm).toHaveAttribute('type', 'button');
  });

  it('renders custom confirmLabel', () => {
    render(
      <ConfirmDialog open title="T" confirmLabel="Delete" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });
});
