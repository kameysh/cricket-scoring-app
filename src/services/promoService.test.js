import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted ensures these are available when vi.mock factory runs (hoisted to top)
const { mockUpload, mockGetPublicUrl, mockStorageFrom } = vi.hoisted(() => ({
  mockUpload:       vi.fn(),
  mockGetPublicUrl: vi.fn(),
  mockStorageFrom:  vi.fn(() => ({ upload: mockUpload, getPublicUrl: mockGetPublicUrl })),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    storage: { from: mockStorageFrom },
  },
}));

import { supabase } from '../lib/supabase';
import { getActivePromo, publishPromo, deactivatePromo } from './promoService';

// Builds a fluent Supabase query chain that resolves to { data, error }
function makeChain(data = null, error = null) {
  const chain = {
    select:      vi.fn().mockReturnThis(),
    eq:          vi.fn().mockReturnThis(),
    order:       vi.fn().mockReturnThis(),
    limit:       vi.fn().mockReturnThis(),
    update:      vi.fn().mockReturnThis(),
    insert:      vi.fn().mockReturnThis(),
    single:      vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  return chain;
}

beforeEach(() => vi.clearAllMocks());

// ── getActivePromo ─────────────────────────────────────────────────────────────

describe('getActivePromo', () => {
  it('returns the active promo row', async () => {
    const promo = { id: 'p1', banner_url: 'https://x.com/img.png', is_active: true };
    supabase.from.mockReturnValue(makeChain(promo));
    expect(await getActivePromo()).toEqual(promo);
  });

  it('returns null when no active promo', async () => {
    supabase.from.mockReturnValue(makeChain(null));
    expect(await getActivePromo()).toBeNull();
  });

  it('throws on DB error', async () => {
    supabase.from.mockReturnValue(makeChain(null, { message: 'DB error' }));
    await expect(getActivePromo()).rejects.toMatchObject({ message: 'DB error' });
  });
});

// ── publishPromo ──────────────────────────────────────────────────────────────

describe('publishPromo', () => {
  const fakeFile = new File(['data'], 'banner.png', { type: 'image/png' });
  const fakePublicUrl = 'https://cdn.test/promo-banners/123.png';

  function setupPublishMocks({ uploadError = null, deactError = null, insertError = null } = {}) {
    mockStorageFrom.mockReturnValue({ upload: mockUpload, getPublicUrl: mockGetPublicUrl });
    mockUpload.mockResolvedValue({ error: uploadError });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: fakePublicUrl } });

    const deactChain = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: deactError }) };
    const insertedPromo = { id: 'new-promo', banner_url: fakePublicUrl, is_active: true };
    const insertChain = makeChain(insertedPromo, insertError);

    supabase.from
      .mockReturnValueOnce(deactChain)
      .mockReturnValueOnce(insertChain);
  }

  it('uploads file and returns inserted promo', async () => {
    setupPublishMocks();
    const result = await publishPromo({
      bannerFile: fakeFile,
      tournamentName: 'GPL 2026',
      team1Name: 'CSK', captain1Name: 'Kamesh',
      team2Name: 'RCB', captain2Name: 'Balaji',
      eventDate: '2026-06-28',
    });
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^promo-banners\/\d+\.png$/),
      fakeFile,
      { upsert: true }
    );
    expect(result).toMatchObject({ banner_url: fakePublicUrl, is_active: true });
  });

  it('throws when storage upload fails', async () => {
    mockStorageFrom.mockReturnValue({ upload: mockUpload, getPublicUrl: mockGetPublicUrl });
    mockUpload.mockResolvedValue({ error: { message: 'Upload failed' } });
    await expect(publishPromo({ bannerFile: fakeFile })).rejects.toMatchObject({ message: 'Upload failed' });
  });

  it('throws when deactivate step fails', async () => {
    mockStorageFrom.mockReturnValue({ upload: mockUpload, getPublicUrl: mockGetPublicUrl });
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: fakePublicUrl } });
    const deactChain = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: { message: 'Deact failed' } }) };
    supabase.from.mockReturnValueOnce(deactChain);
    await expect(publishPromo({ bannerFile: fakeFile })).rejects.toMatchObject({ message: 'Deact failed' });
  });

  it('throws when insert fails', async () => {
    setupPublishMocks({ insertError: { message: 'Insert failed' } });
    await expect(publishPromo({ bannerFile: fakeFile })).rejects.toMatchObject({ message: 'Insert failed' });
  });
});

// ── deactivatePromo ───────────────────────────────────────────────────────────

describe('deactivatePromo', () => {
  it('updates is_active=false for the given id', async () => {
    const chain = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    supabase.from.mockReturnValue(chain);
    await expect(deactivatePromo('p1')).resolves.toBeUndefined();
    expect(chain.update).toHaveBeenCalledWith({ is_active: false });
    expect(chain.eq).toHaveBeenCalledWith('id', 'p1');
  });

  it('throws on DB error', async () => {
    const chain = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: { message: 'fail' } }) };
    supabase.from.mockReturnValue(chain);
    await expect(deactivatePromo('p1')).rejects.toMatchObject({ message: 'fail' });
  });
});
