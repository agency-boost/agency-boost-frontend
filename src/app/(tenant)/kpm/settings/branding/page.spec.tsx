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
const PREVIEW = {
  palette: PALETTE,
  primary: { contrast: 'light', ratio: 6.21, fill: '#0a6e5c', adjusted: false },
  secondary: { contrast: 'light', ratio: 14.06, fill: '#1b2b4b', adjusted: false },
};
/** The client's `#a96800`, as the API answers it since P19.12-T3 (ADR-0246): painted `#a66600`, white text at 4.64:1. */
const ADJUSTED = {
  palette: { ...PALETTE, primary: '#a66600', primaryHover: '#925a00', primaryInk: '#a66600', primaryDeep: '#a66600', focusRing: '#a66600' },
  primary: { contrast: 'light', ratio: 4.64, fill: '#a66600', adjusted: true },
  secondary: PREVIEW.secondary,
};
const OWN_A96800 = { ...OWN, own: { ...OWN.own, primary: '#a96800' } };

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

  it('P19.12-T3 AC-1, AC-3 #a96800 is accepted: its field says to which shade it was adjusted, and Simpan stays enabled', async () => {
    stubFetch({ '/kpm/settings/branding': { body: OWN_A96800 }, 'POST /kpm/settings/branding/preview': { body: ADJUSTED } });
    renderWithSession(<InLanguage language="id"><BrandingPage /></InLanguage>, { me: OWNER });
    // The note under *Warna utama*, muted, in the slot the contrast line uses; the ratio written the Indonesian way.
    expect(await screen.findByText('Disesuaikan ke #a66600 agar teks putih terbaca 4,64:1.', {}, { timeout: 4000 })).toHaveClass('text-muted');
    expect(screen.getByText('Teks putih terbaca 14,06:1 di atasnya.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/Warna terlalu terang\/gelap/)).not.toBeInTheDocument();
    // The field keeps the colour chosen; the preview paints the shade.
    expect(screen.getAllByDisplayValue('#a96800').length).toBeGreaterThan(0);
    expect(document.querySelector('[data-preview-frame="phone"] > div')?.getAttribute('style')).toContain('--color-primary: #a66600');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Simpan' })).toBeEnabled(), { timeout: 4000 });
  });

  it('P19.12-T3 AC-3 writes the adjusted note in English too, dark text where the shade is lighter', async () => {
    const lighter = { ...ADJUSTED, primary: { contrast: 'dark', ratio: 4.57, fill: '#05a95b', adjusted: true } };
    stubFetch({ '/kpm/settings/branding': { body: OWN }, 'POST /kpm/settings/branding/preview': { body: lighter } });
    renderWithSession(<BrandingPage />, { me: OWNER });
    expect(await screen.findByText('Adjusted to #05a95b so dark text reads 4.57:1.', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('P19.12-T3 AC-1 blocks Simpan only while a colour is not #rrggbb', async () => {
    stubFetch({ '/kpm/settings/branding': { body: OWN }, 'POST /kpm/settings/branding/preview': { body: PREVIEW } });
    renderWithSession(<InLanguage language="id"><BrandingPage /></InLanguage>, { me: OWNER });
    const save = await screen.findByRole('button', { name: 'Simpan' });
    await waitFor(() => expect(save).toBeEnabled(), { timeout: 4000 });
    const primary = screen.getByLabelText('Warna utama');
    await userEvent.clear(primary);
    await userEvent.type(primary, '#a968');
    await waitFor(() => expect(save).toBeDisabled(), { timeout: 4000 });
    await userEvent.type(primary, '00');
    await waitFor(() => expect(save).toBeEnabled(), { timeout: 4000 });
  });

  it('P19.12-T3 AC-1 a preview that did not arrive blocks nothing: Simpan answers for itself', async () => {
    stubFetch({
      '/kpm/settings/branding': { body: OWN },
      'POST /kpm/settings/branding/preview': { status: 500, body: { error: { code: 'INTERNAL', message: 'x' } } },
    });
    renderWithSession(<InLanguage language="id"><BrandingPage /></InLanguage>, { me: OWNER });
    const save = await screen.findByRole('button', { name: 'Simpan' });
    await new Promise((resolve) => { setTimeout(resolve, 400); });
    expect(save).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
