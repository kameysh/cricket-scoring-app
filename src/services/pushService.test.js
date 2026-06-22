import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing pushService
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      delete: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }) },
  },
}));

import { isPushSupported } from './pushService';

describe('pushService — isPushSupported', () => {
  it('returns false when serviceWorker is not available', () => {
    const orig = navigator.serviceWorker;
    // Remove serviceWorker
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
    expect(isPushSupported()).toBe(false);
    Object.defineProperty(navigator, 'serviceWorker', { value: orig, configurable: true });
  });

  it('returns false when VAPID_PUBLIC_KEY env var is not set', () => {
    // In test env, VITE_VAPID_PUBLIC_KEY is undefined → isPushSupported = false
    expect(isPushSupported()).toBe(false);
  });
});
