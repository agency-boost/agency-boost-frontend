import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HomePage from '@/app/(agent)/home/page';
import { atWidth, renderWithSession, stubFetch, wears } from '@test/harness';
import { AGUS, LEADER } from '@test/home-fixtures';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/home',
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.unstubAllGlobals());

/**
 * **Home's tiles on a tablet** (P19.1-T1 AC-5, ADR-0196; UI-124: *"Active Agent November" wraps to 2 lines in a 4-across
 * tile row*; `home-tablet`: *the 4 tiles 2×2 across the full width, no label wraps*).
 */
describe('P19.1-T1 AC-5 Home’s tiles (UI-124)', () => {
  const open = async (px: number) => {
    atWidth(px);
    stubFetch({ '/home': { body: LEADER } });
    renderWithSession(<HomePage />, { me: AGUS });
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(document.querySelector('[data-home-tiles]')).not.toBeNull());
    return document.querySelector('[data-home-tiles]') as HTMLElement;
  };

  it('P19.1-T1 AC-5 at 768px: the four tiles two by two, across the full width', async () => {
    const tiles = await open(768);
    expect(tiles.querySelectorAll(':scope > a')).toHaveLength(4);
    const worn = wears(tiles, 768).split(' ');
    expect(worn).toContain('grid-cols-2');
    expect(worn).not.toContain('grid-cols-4');
    // Both of Home's columns, so each tile is half the page: *Active Agent November* keeps one line.
    expect(worn).toContain('col-span-2');
    expect(screen.getByText(/^Active Agent /).closest('a')).toBeInTheDocument();
  });

  it.each([375, 1024, 1280])('P19.1-T1 AC-7 at %ipx the tiles are two by two, as before', async (px) => {
    const tiles = await open(px);
    const worn = wears(tiles, px).split(' ');
    expect(worn).toContain('grid-cols-2');
    expect(worn).not.toContain('grid-cols-4');
  });
});
