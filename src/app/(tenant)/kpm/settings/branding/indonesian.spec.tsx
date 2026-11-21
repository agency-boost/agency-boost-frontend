import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { englishOnly, englishShown } from '@test/english-left';
import { brandingMessages } from '@/i18n/messages/branding';
import { makeMe, renderInIndonesian, stubFetch } from '@test/harness';
import BrandingPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/branding',
  useSearchParams: () => new URLSearchParams(),
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: '66f0000000000000000000a1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['tenant_config:read', 'tenant_config:write'],
});
const SETTINGS = {
  own: null, template: null, version: 0, canWrite: true,
  shown: { kpmId: 'k', version: 'v', palette: null, logo: null, logoSquare: false, icons: false, mascotPoses: [], lesson: null, source: { logos: null, colours: null, mascot: null } },
};

/**
 * **P19.6-T1, *Tampilan KPM* in ID mode** — *redrawn by P19.21-T4*: the rows, the phone and the two actions in the 19
 * November mockup's Indonesian (frame 24).
 */
describe('P19.6-T1 Tampilan KPM in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.21-T4 AC-2 P19.6-T1 AC-2 names the page, its six rows, the phone and its actions in the mockup’s Indonesian', async () => {
    stubFetch({ '/kpm/settings/branding': { body: SETTINGS } });
    const { container } = renderInIndonesian(<BrandingPage />, { me: OWNER });
    expect(await screen.findByRole('heading', { name: 'Tampilan KPM' })).toBeInTheDocument();
    for (const words of [
      'Nama sistem', 'Warna utama', 'Warna kedua', 'Maskot', 'Logo persegi', 'Pratinjau langsung', 'Simpan', 'Kembalikan ke default',
      'Target bulan ini', 'Catat aktivitas',
    ]) {
      expect(screen.getAllByText(words).length).toBeGreaterThan(0);
    }
    expect(englishShown(container, englishOnly(brandingMessages))).toEqual([]);
  });
});
