import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlayerAvatar from './PlayerAvatar';

describe('PlayerAvatar — explicit props', () => {
  it('renders photo when photoUrl is provided', () => {
    render(<PlayerAvatar name="Ravi" photoUrl="https://example.com/ravi.jpg" />);
    const img = screen.getByAltText('Ravi');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/ravi.jpg');
  });

  it('renders initials when no photoUrl', () => {
    render(<PlayerAvatar name="Ravi Kumar" />);
    expect(screen.getByText('RK')).toBeInTheDocument();
  });

  it('uses numeric size directly', () => {
    render(<PlayerAvatar name="Ravi Kumar" size={64} />);
    const el = screen.getByText('RK').parentElement;
    expect(el.style.width).toBe('64px');
    expect(el.style.height).toBe('64px');
  });
});

describe('PlayerAvatar — player shorthand prop', () => {
  it('shows photo from player.photo_url', () => {
    const player = { name: 'Suresh', photo_url: 'https://example.com/suresh.jpg' };
    render(<PlayerAvatar player={player} />);
    const img = screen.getByAltText('Suresh');
    expect(img).toHaveAttribute('src', 'https://example.com/suresh.jpg');
  });

  it('shows initials from player.name when no photo_url', () => {
    render(<PlayerAvatar player={{ name: 'Suresh Raina', photo_url: null }} />);
    expect(screen.getByText('SR')).toBeInTheDocument();
  });

  it('explicit name/photoUrl take priority over player prop', () => {
    const player = { name: 'Suresh', photo_url: 'https://example.com/suresh.jpg' };
    render(<PlayerAvatar player={player} name="Override" photoUrl="https://example.com/other.jpg" />);
    const img = screen.getByAltText('Override');
    expect(img).toHaveAttribute('src', 'https://example.com/other.jpg');
  });
});

describe('PlayerAvatar — named sizes', () => {
  it('sm resolves to 32px', () => {
    render(<PlayerAvatar name="A" size="sm" />);
    const el = screen.getByText('A').parentElement;
    expect(el.style.width).toBe('32px');
  });

  it('md resolves to 44px', () => {
    render(<PlayerAvatar name="A" size="md" />);
    const el = screen.getByText('A').parentElement;
    expect(el.style.width).toBe('44px');
  });

  it('unknown string size falls back to 40px', () => {
    render(<PlayerAvatar name="A" size="huge" />);
    const el = screen.getByText('A').parentElement;
    expect(el.style.width).toBe('40px');
  });

  it('default size is 40px when no size prop given', () => {
    render(<PlayerAvatar name="A" />);
    const el = screen.getByText('A').parentElement;
    expect(el.style.width).toBe('40px');
  });
});
