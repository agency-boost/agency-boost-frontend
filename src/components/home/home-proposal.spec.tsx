import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HomePage from '@/app/(agent)/home/page';
import { makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { AGENT_VIEW, AGUS } from '@test/home-fixtures';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/home',
  useSearchParams: () => new URLSearchParams(),
}));

const PROPOSER = makeMe({
  user: { ...makeMe().user, fullName: 'Rina Wijaya' },
  permissions: ['personal_summary:read', 'proposal:read', 'proposal:create'],
});

async function open(me = PROPOSER, indonesian = false) {
  stubFetch({ '/home': { body: AGENT_VIEW } });
  (indonesian ? renderInIndonesian : renderWithSession)(<HomePage />, { me });
  await waitFor(() => expect(document.querySelector('[data-home-tiles]')).not.toBeNull());
}

afterEach(() => vi.unstubAllGlobals());

/**
 * **Home's *Buat proposal*** (P19.7-T2 AC-1; ADR-0221 §8): one 48px pill under the reader's tiles, with the document icon,
 * to step 1 — by role (`proposal:create`), never by what the reader has saved.
 */
describe('P19.7-T2 AC-1 Home’s Buat proposal pill', () => {
  it('P19.7-T2 AC-1 one 48px pill under the tiles, with the document icon, to /proposal/new', async () => {
    await open();
    const pill = screen.getByRole('link', { name: 'Make a proposal' });
    expect(pill).toHaveAttribute('href', '/proposal/new');
    expect(pill.className).toMatch(/min-h-12/);
    expect(pill.className).toMatch(/rounded-pill/);
    expect(pill.querySelector('svg')).not.toBeNull();
    const tiles = document.querySelector('[data-home-tiles]')!;
    expect(tiles.compareDocumentPosition(pill) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('P19.7-T2 AC-1 reads Buat proposal in Indonesian', async () => {
    await open(PROPOSER, true);
    expect(screen.getByRole('link', { name: 'Buat proposal' })).toHaveAttribute('href', '/proposal/new');
  });

  it('P19.7-T2 AC-1 is not drawn for a reader who may not make one — a view-only session holds no write', async () => {
    await open(AGUS);
    expect(screen.queryByRole('link', { name: 'Make a proposal' })).not.toBeInTheDocument();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    await open({ ...PROPOSER, isImpersonating: true, impersonationReadOnly: true, permissions: ['personal_summary:read', 'proposal:read'] });
    expect(screen.queryByRole('link', { name: 'Make a proposal' })).not.toBeInTheDocument();
  });
});
