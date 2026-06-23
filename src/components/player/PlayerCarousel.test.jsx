import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../player/PlayerAvatar', () => ({
  default: () => <div data-testid="avatar" />,
}));

vi.mock('../../lib/cricketUtils', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual };
});

import PlayerCarousel from './PlayerCarousel';

const player = { id: 'p1', name: 'Kamesh Waran', nickname: 'KW', role: 'batsman', photo_url: null };
const playerNoNick = { id: 'p2', name: 'Ravi Kumar', nickname: '', role: 'bowler', photo_url: null };

function renderCarousel(players, props = {}) {
  return render(
    <MemoryRouter>
      <PlayerCarousel
        players={players}
        activeIndex={0}
        onChangeIndex={vi.fn()}
        onSelect={vi.fn()}
        statsMap={{}}
        {...props}
      />
    </MemoryRouter>
  );
}

describe('PlayerCarousel — name/nickname display', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows player.name as primary text on front face', () => {
    renderCarousel([player]);
    // Carousel renders multiple card slots — getAllByText is correct
    const names = screen.getAllByText('Kamesh Waran');
    expect(names.length).toBeGreaterThan(0);
  });

  it('shows nickname in quotes as secondary text when set', () => {
    renderCarousel([player]);
    const nicks = screen.getAllByText('"KW"');
    expect(nicks.length).toBeGreaterThan(0);
  });

  it('does not show nickname element when nickname is empty', () => {
    renderCarousel([playerNoNick]);
    expect(screen.getAllByText('Ravi Kumar').length).toBeGreaterThan(0);
    expect(screen.queryByText(/^".*"$/)).toBeNull();
  });

  it('name appears before nickname in the DOM on the active card', () => {
    renderCarousel([player]);
    const names = screen.getAllByText('Kamesh Waran');
    const nicks = screen.getAllByText('"KW"');
    // On each card instance the name precedes the nickname
    expect(names[0].compareDocumentPosition(nicks[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('full name is always present alongside nickname', () => {
    renderCarousel([player]);
    expect(screen.getAllByText('Kamesh Waran').length).toBeGreaterThan(0);
    expect(screen.getAllByText('"KW"').length).toBeGreaterThan(0);
  });
});
