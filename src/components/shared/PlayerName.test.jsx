import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlayerName from './PlayerName';

describe('PlayerName', () => {
  it('renders player name as primary text', () => {
    render(<PlayerName player={{ name: 'Kamesh Waran', nickname: '' }} />);
    expect(screen.getByText('Kamesh Waran')).toBeDefined();
  });

  it('shows nickname in small text when set', () => {
    render(<PlayerName player={{ name: 'Kamesh Waran', nickname: 'KW' }} />);
    expect(screen.getByText('Kamesh Waran')).toBeDefined();
    expect(screen.getByText('"KW"')).toBeDefined();
  });

  it('does not show nickname element when nickname is empty string', () => {
    render(<PlayerName player={{ name: 'Ravi Kumar', nickname: '' }} />);
    expect(screen.queryByText(/"/)).toBeNull();
  });

  it('does not show nickname element when nickname is whitespace only', () => {
    render(<PlayerName player={{ name: 'Ravi Kumar', nickname: '   ' }} />);
    expect(screen.queryByText(/"/)).toBeNull();
  });

  it('does not show nickname element when nickname is undefined', () => {
    render(<PlayerName player={{ name: 'Ravi Kumar' }} />);
    expect(screen.queryByText(/"/)).toBeNull();
  });

  it('renders nothing when player is null', () => {
    const { container } = render(<PlayerName player={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('applies nameClass to the name span', () => {
    render(<PlayerName player={{ name: 'Ravi' }} nameClass="text-xl font-bold" />);
    const nameEl = screen.getByText('Ravi');
    expect(nameEl.className).toContain('text-xl');
    expect(nameEl.className).toContain('font-bold');
  });

  it('name is always primary — nickname never replaces it', () => {
    render(<PlayerName player={{ name: 'Full Name', nickname: 'Nick' }} />);
    const name = screen.getByText('Full Name');
    const nick = screen.getByText('"Nick"');
    // name must appear before nickname in the DOM
    expect(name.compareDocumentPosition(nick) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
