import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRole } from './useRole';
import { useAuthStore } from '../stores/authStore';

vi.mock('../stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

function mockAuth(role, userId = 'user-1') {
  useAuthStore.mockImplementation(selector =>
    selector({ role, user: { id: userId } })
  );
}

describe('useRole', () => {
  it('admin has all capabilities', () => {
    mockAuth('admin');
    const { result } = renderHook(() => useRole());
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.canScore).toBe(true);
    expect(result.current.canManagePlayers).toBe(true);
    expect(result.current.canManageTournaments).toBe(true);
    expect(result.current.canManageVenues).toBe(true);
    expect(result.current.canCreatePlayer).toBe(true);
    expect(result.current.canManageOwnProfile).toBe(true);
    expect(result.current.isPlayer).toBe(false);
  });

  it('scorer can score and create players but cannot manage players/tournaments', () => {
    mockAuth('scorer');
    const { result } = renderHook(() => useRole());
    expect(result.current.canScore).toBe(true);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.canManagePlayers).toBe(false);
    expect(result.current.canManageTournaments).toBe(false);
    expect(result.current.canCreatePlayer).toBe(true);
    expect(result.current.canManageOwnProfile).toBe(true);
  });

  it('captain can create players but cannot score or manage players', () => {
    mockAuth('captain');
    const { result } = renderHook(() => useRole());
    expect(result.current.canScore).toBe(false);
    expect(result.current.canCreatePlayer).toBe(true);
    expect(result.current.canManagePlayers).toBe(false);
    expect(result.current.canManageOwnProfile).toBe(true);
  });

  it('player can manage own profile but cannot score or manage players', () => {
    mockAuth('player');
    const { result } = renderHook(() => useRole());
    expect(result.current.isPlayer).toBe(true);
    expect(result.current.canManageOwnProfile).toBe(true);
    expect(result.current.canScore).toBe(false);
    expect(result.current.canManagePlayers).toBe(false);
    expect(result.current.canCreatePlayer).toBe(true);
  });

  it('viewer has no capability flags', () => {
    mockAuth('viewer');
    const { result } = renderHook(() => useRole());
    expect(result.current.canScore).toBe(false);
    expect(result.current.canManagePlayers).toBe(false);
    expect(result.current.canCreatePlayer).toBe(false);
    expect(result.current.canManageOwnProfile).toBe(false);
    expect(result.current.canManageTournaments).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isPlayer).toBe(false);
  });

  it('undefined role → all capability flags false, userId still set', () => {
    mockAuth(undefined, 'u-42');
    const { result } = renderHook(() => useRole());
    expect(result.current.canScore).toBe(false);
    expect(result.current.canManagePlayers).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.userId).toBe('u-42');
  });
});
