import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({ select: vi.fn(() => ({ order: vi.fn(() => ({ data: USERS, error: null })) })) })),
    functions: { invoke: vi.fn() },
  },
}));
vi.mock('../hooks/useRole', () => ({ useRole: () => ({ isAdmin: true }) }));
vi.mock('../stores/authStore', () => ({
  useAuthStore: (sel) => sel({ user: { id: 'me', email: 'admin@test.com' } }),
}));
vi.mock('../services/playerService', () => ({ masterReset: vi.fn() }));
vi.mock('lucide-react', () => ({
  UserPlus: () => null, ChevronLeft: () => null, Shield: () => null,
  Trash2: () => null, RotateCcw: () => null, Search: () => null,
}));

const USERS = [
  { id: 'u1', full_name: 'Kamesh S',   email: 'kamesh@test.com',  role: 'admin',  created_at: '2026-01-01' },
  { id: 'u2', full_name: 'Vignesh RT', email: 'vignesh@test.com', role: 'scorer', created_at: '2026-01-02' },
  { id: 'u3', full_name: 'Santosh',    email: 'santosh@test.com', role: 'player', created_at: '2026-01-03' },
];

import AdminUsers from './AdminUsers';

async function renderAdminUsers() {
  let result;
  await act(async () => { result = render(<AdminUsers />); });
  return result;
}

describe('AdminUsers — search filter', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows all users when search is empty', async () => {
    await renderAdminUsers();
    expect(screen.getByText('Kamesh S')).toBeTruthy();
    expect(screen.getByText('Vignesh RT')).toBeTruthy();
    expect(screen.getByText('Santosh')).toBeTruthy();
  });

  it('filters by name (case-insensitive)', async () => {
    await renderAdminUsers();
    await act(async () => {
      await userEvent.type(screen.getByPlaceholderText(/search/i), 'vign');
    });
    expect(screen.getByText('Vignesh RT')).toBeTruthy();
    expect(screen.queryByText('Kamesh S')).toBeNull();
    expect(screen.queryByText('Santosh')).toBeNull();
  });

  it('filters by email', async () => {
    await renderAdminUsers();
    await act(async () => {
      await userEvent.type(screen.getByPlaceholderText(/search/i), 'santosh@');
    });
    expect(screen.getByText('Santosh')).toBeTruthy();
    expect(screen.queryByText('Kamesh S')).toBeNull();
  });

  it('shows no-match message when search has no results', async () => {
    await renderAdminUsers();
    await act(async () => {
      await userEvent.type(screen.getByPlaceholderText(/search/i), 'zzznobody');
    });
    expect(screen.getByText(/no users match/i)).toBeTruthy();
    expect(screen.queryByText('Kamesh S')).toBeNull();
  });

  it('restores full list when search is cleared', async () => {
    await renderAdminUsers();
    const input = screen.getByPlaceholderText(/search/i);
    await act(async () => { await userEvent.type(input, 'vign'); });
    expect(screen.queryByText('Kamesh S')).toBeNull();
    await act(async () => { await userEvent.clear(input); });
    expect(screen.getByText('Kamesh S')).toBeTruthy();
    expect(screen.getByText('Vignesh RT')).toBeTruthy();
    expect(screen.getByText('Santosh')).toBeTruthy();
  });
});
