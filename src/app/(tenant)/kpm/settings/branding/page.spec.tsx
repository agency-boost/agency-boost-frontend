import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InLanguage, makeMe, renderWithSession, stubFetch } from '@test/harness';
import BrandingPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/branding',
  useSearchParams: () => new URLSearchParams(),
}));

const membership = {
  membershipId: 'mem-1', kpmId: '66f0000000000000000000a1', orgLevelCode: 'AB', hierarchyRole: 'ab' as const,
  status: 'active' as const, isKpmOwner: true, isKpmAdmin: false, directCount: 0,
};
const OWNER = makeMe({ membership, permissions: ['tenant_config:read', 'tenant_config:write'] });
const VIEW_AS = makeMe({ membership, permissions: ['tenant_config:read'], isImpersonating: true, impersonationReadOnly: true } as never);

const PALETTE = {
  primary: '#0a6e5c', primaryHover: '#095b4f', primaryContrast: '#ffffff', primaryInk: '#0a6e5c', primaryDeep: '#0a6e5c',
  primaryOnSecondary: '#ffffff', primary50: '#ebf3f2', primary100: '#d8e9e6', focusRing: '#0a6e5c',
  secondary: '#1b2b4b', secondaryHover: '#182642', secondaryContrast: '#ffffff', secondaryInk: '#1b2b4b',
  secondaryMuted: '#ffffff', secondary50: '#eeeff2', secondary100: '#dde0e6', today: '#d8e9e6', todayInk: '#0a6e5c',
  sidebarText: '#ffffff',
};
const SHOWN = {
  kpmId: membership.kpmId, version: 'abc123def456', palette: null, logo: null, logoSquare: false, icons: false,
  mascotPoses: [], lesson: null, source: { logos: null, colours: null, mascot: null },
};
const EMPTY = { own: null, template: null, shown: SHOWN, version: 0, canWrite: true };
const OWN = {
  ...EMPTY,
  own: {
    logo: { key: 'dev/k/branding/01JC0000000000000000000001', url: 'https://cdn.test/logo.png', width: 480, height: 96 },
    logoSquare: null, primary: '#0a6e5c', secondary: '#1b2b4b', mascot: null,
  },
  version: 3,
};
const PREVIEW = { palette: PALETTE, primary: { contrast: 'light', ratio: 6.21 }, secondary: { contrast: 'light', ratio: 14.06 } };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('P19.6-T1 /kpm/settings/branding — Tampilan KPM', () => {
  it('P19.6-T1 AC-2 the Owner sees the five fields, the preview, Simpan and Kembalikan ke default', async () => {
    stubFetch({ '/kpm/settings/branding': { body: OWN }, 'POST /kpm/settings/branding/preview': { body: PREVIEW } });
    renderWithSession(<InLanguage language="id"><BrandingPage /></InLanguage>, { me: OWNER });
    expect(await screen.findByRole('heading', { name: 'Tampilan KPM' })).toBeInTheDocument();
    for (const label of ['Logo', 'Logo (persegi, opsional)', 'Warna utama', 'Warna kedua', 'Maskot']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByDisplayValue('#0a6e5c').length).toBeGreaterThan(0);
    expect(screen.getByRole('region', { name: 'Pratinjau langsung' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Kembalikan ke default' })).toBeEnabled();
  });

  it('P19.6-T1 AC-9 sets the palette the API answered on the preview frames alone, never on the page', async () => {
    stubFetch({ '/kpm/settings/branding': { body: OWN }, 'POST /kpm/settings/branding/preview': { body: PREVIEW } });
    renderWithSession(<BrandingPage />, { me: OWNER });
    await waitFor(() => expect(document.querySelector('[data-preview-frame="phone"] > div')?.getAttribute('style')).toContain('--color-primary: #0a6e5c'), { timeout: 4000 });
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('');
    expect(screen.getAllByText(/reads 6\.21:1/).length).toBe(1);
  });

  it('B7-AC2 P19.6-T1 AC-7 says “Warna terlalu terang/gelap untuk teks” under the colour and blocks Simpan', async () => {
    stubFetch({
      '/kpm/settings/branding': { body: OWN },
      'POST /kpm/settings/branding/preview': {
        status: 422, body: { error: { code: 'BRANDING_COLOUR_UNREADABLE', message: 'x', details: { field: 'secondary' } } },
      },
    });
    renderWithSession(<InLanguage language="id"><BrandingPage /></InLanguage>, { me: OWNER });
    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toHaveTextContent('Warna terlalu terang/gelap untuk teks');
    // The editor draws the note in its own render and tells the page through an effect (`onCheck`), so *Simpan* is
    // blocked one commit later: wait for it, as the enabled checks below do — under load the two commits come apart.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Simpan' })).toBeDisabled(), { timeout: 4000 });
  });

  it('P19.6-T1 AC-5 Simpan sends the groups whole by their folders, with the version read', async () => {
    const saved = vi.fn();
    stubFetch({
      '/kpm/settings/branding': [{ body: OWN }],
      'PUT /kpm/settings/branding': (req) => { saved(req.body); return { body: { ...OWN, version: 4 } }; },
      'POST /kpm/settings/branding/preview': { body: PREVIEW },
      '/auth/me': { body: OWNER },
    });
    renderWithSession(<BrandingPage />, { me: OWNER });
    const save = await screen.findByRole('button', { name: 'Save' });
    await waitFor(() => expect(save).toBeEnabled(), { timeout: 4000 });
    await userEvent.click(save);
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(saved.mock.calls[0][0]).toEqual({
      logo: { key: 'dev/k/branding/01JC0000000000000000000001' }, logoSquare: null,
      primary: '#0a6e5c', secondary: '#1b2b4b', mascot: null, expectedVersion: 3,
    });
  });

  it('B7-AC3 P19.6-T1 AC-10 Kembalikan ke default asks first, says what shows after, and resets at the version read', async () => {
    const reset = vi.fn();
    stubFetch({
      '/kpm/settings/branding': { body: OWN },
      'POST /kpm/settings/branding/reset': (req) => { reset(req.body); return { body: EMPTY }; },
      'POST /kpm/settings/branding/preview': { body: PREVIEW },
      '/auth/me': { body: OWNER },
    });
    renderWithSession(<InLanguage language="id"><BrandingPage /></InLanguage>, { me: OWNER });
    await userEvent.click(await screen.findByRole('button', { name: 'Kembalikan ke default' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('logo, warna, dan Boost dari AgencyBoost');
    await userEvent.click(screen.getByRole('button', { name: 'Kembalikan' }));
    await waitFor(() => expect(reset).toHaveBeenCalledWith({ expectedVersion: 3 }));
  });

  it('B7-AC5 P19.6-T1 AC-17 a view-as session sees the branding with every input disabled and no Simpan', async () => {
    stubFetch({ '/kpm/settings/branding': { body: { ...OWN, canWrite: false } }, 'POST /kpm/settings/branding/preview': { body: PREVIEW } });
    renderWithSession(<BrandingPage />, { me: VIEW_AS });
    expect((await screen.findAllByDisplayValue('#0a6e5c'))[0]).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
    expect(screen.getByRole('note')).toHaveTextContent('Nothing here can be changed');
  });

  it('P19.6-T1 AC-12 a 409 reads the page again and says so', async () => {
    stubFetch({
      '/kpm/settings/branding': { body: OWN },
      'PUT /kpm/settings/branding': { status: 409, body: { error: { code: 'VERSION_CONFLICT', message: 'x' } } },
      'POST /kpm/settings/branding/preview': { body: PREVIEW },
    });
    renderWithSession(<BrandingPage />, { me: OWNER });
    const save = await screen.findByRole('button', { name: 'Save' });
    await waitFor(() => expect(save).toBeEnabled(), { timeout: 4000 });
    await act(async () => { await userEvent.click(save); });
    expect(await screen.findByRole('status')).toHaveTextContent('Someone else saved this page');
  });
});
