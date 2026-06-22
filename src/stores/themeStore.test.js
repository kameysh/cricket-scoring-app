import { describe, it, expect, beforeEach, vi } from 'vitest';
import { applyTheme } from './themeStore';

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('adds dark class for "dark"', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes dark class for "light"', () => {
    document.documentElement.classList.add('dark');
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('applies system preference for "system" — light system', () => {
    // jsdom matchMedia returns false by default
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    applyTheme('system');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    vi.unstubAllGlobals();
  });

  it('applies dark for "system" when system prefers dark', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    applyTheme('system');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    vi.unstubAllGlobals();
  });
});
