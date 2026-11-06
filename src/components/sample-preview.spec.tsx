import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { NoKpmYet } from '@/components/no-kpm-yet';
import { RequireSession } from '@/components/require-session';
import { NoDataLine, SamplePreview } from '@/components/sample-preview';
import { Button } from '@/components/ui/field';
import { makeMe, renderInIndonesian, renderInLayout, renderWithSession, stubFetch } from '@test/harness';

const nav = vi.hoisted(() => ({ pathname: '/leads' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  nav.pathname = '/leads';
});

/** Somebody signed in who has joined no office yet (UI-166): the join flow's grants, their inbox, their profile. */
const NO_KPM = makeMe({
  membership: null,
  permissions: ['kpm:read_directory', 'kpm_registration:create', 'notification:read_inbox', 'profile:read_self', 'profile:update_self'],
});

/**
 * **The *Contoh* sample** (P19-T4 AC-3; D-37, UI-159 item 3; ADR-0189 §3): the page's own layout, greyed and inert,
 * labelled, with one live step.
 */
describe('P19-T4 SamplePreview', () => {
  it('P19-T4 AC-3 labels the sample Contoh, greys it, takes it out of reach and names it for a screen reader', () => {
    renderInIndonesian(
      <SamplePreview
        sample={<a href="/somewhere">Agen contoh 1</a>}
        action={<Button>Tambah agent pertama</Button>}
      />,
    );
    const section = screen.getByRole('region', { name: 'Contoh tampilan halaman ini setelah ada data. Bukan data sebenarnya.' });
    expect(within(section).getByText('Contoh')).toBeInTheDocument();
    const sample = section.querySelector('[data-sample]')!;
    expect(sample).toHaveAttribute('aria-hidden', 'true');
    expect(sample.hasAttribute('inert')).toBe(true);
    expect(sample.className).toMatch(/grayscale/);
    expect(sample.className).toMatch(/pointer-events-none/);
    // Nothing in the sample is offered: its link is hidden; the one step is live.
    expect(screen.queryByRole('link', { name: 'Agen contoh 1' })).not.toBeInTheDocument();
    expect(within(section).getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Tambah agent pertama' })).toBeEnabled();
  });

  it('P19-T4 AC-3 Belum ada data is the short grey line, in either language', () => {
    renderInIndonesian(<NoDataLine />);
    expect(screen.getByText('Belum ada data')).toHaveClass('text-muted');
  });
});

/**
 * **Somebody in no office** (P19-T4 AC-4; UI-166 items 1–2; ADR-0189 §5): every page that needs a KPM shows its sample
 * and the owner's line with *Cari / Daftar KPM* and *Cari leader*, never *PERM_DENIED* or *Tidak tersedia*.
 */
describe('P19-T4 the no-office card', () => {
  it('P19-T4 AC-4 says what to do, in the owner’s words, with Cari / Daftar KPM and Cari leader', async () => {
    renderInIndonesian(<NoKpmYet title="Leads" pathname="/leads" />, { me: NO_KPM });
    expect(screen.getByRole('heading', { level: 1, name: 'Leads' })).toBeInTheDocument();
    expect(screen.getByText('Daftar ke KPM atau minta leader Anda menerima Anda dulu')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cari / Daftar KPM' })).toHaveAttribute('href', '/user-management/kpm');
    expect(screen.getByRole('link', { name: 'Cari leader' })).toHaveAttribute('href', '/user-management/leader');
    expect(screen.getByText('Belum ada data')).toBeInTheDocument();
    expect(screen.getByText('Contoh')).toBeInTheDocument();
    expect(document.querySelector('[data-sample]')!.textContent).toContain('Agen contoh 1');
  });

  it('P19-T4 AC-4 on Home, the sample is Home’s own tiles and chart', () => {
    renderWithSession(<NoKpmYet pathname="/home" />, { me: NO_KPM });
    const sample = document.querySelector('[data-sample]')!;
    expect(sample.querySelector('[data-home-tiles]')).not.toBeNull();
    expect(within(sample as HTMLElement).getByText('My activity')).toBeInTheDocument();
  });

  it('P19-T4 AC-4 RequireSession shows it, never Tidak tersedia, to somebody in no office missing the grant', async () => {
    renderInIndonesian(
      <RequireSession permission="lead:read" title="Leads"><p>the page</p></RequireSession>,
      { me: NO_KPM },
    );
    expect(await screen.findByText('Daftar ke KPM atau minta leader Anda menerima Anda dulu')).toBeInTheDocument();
    expect(screen.queryByText('Tidak tersedia untuk Anda')).not.toBeInTheDocument();
    expect(screen.queryByText('the page')).not.toBeInTheDocument();
  });

  it('P19-T4 a member of an office without the grant is still told Not available to you (ADR-0189 §6)', () => {
    renderWithSession(<RequireSession permission="kpm_analytics:read"><p>the page</p></RequireSession>, { me: makeMe() });
    expect(screen.getByRole('alert')).toHaveTextContent('Not available to you');
    expect(screen.queryByText(/Register with a KPM/)).not.toBeInTheDocument();
  });

  it.each(['/home', '/activity/log', '/calendar', '/summary', '/leads', '/goals', '/training', '/attack-plan',
    '/recruitment/attack-plan', '/campaigns', '/events'])(
    'P19-T4 AC-4, AC-6 the field shell draws the card on %s inside its chrome and mounts nothing that reads an office',
    async (path) => {
      nav.pathname = path;
      const { calls } = stubFetch({ '/notifications': { body: { count: 0, items: [], unread: 0 } } });
      renderInLayout(AgentLayout, <p>the page</p>, { me: NO_KPM });
      expect(await screen.findByText('Register with a KPM or ask your leader to accept you first')).toBeInTheDocument();
      expect(screen.queryByText('the page')).not.toBeInTheDocument();
      // The chrome is there — the menu with every Agent item — and no office's endpoint was asked.
      expect(screen.getAllByRole('link', { name: /Leads/ }).length).toBeGreaterThan(0);
      await waitFor(() => expect(calls.some((c) => /\/kpm\/|\/home|\/leads|\/calendar/.test(c.url))).toBe(false));
    },
  );

  it.each(['/user-management/kpm', '/user-management/leader', '/profile', '/notifications'])(
    'P19-T4 AC-4 leaves %s to itself: it is how somebody in no office joins one, or their own',
    (path) => {
      nav.pathname = path;
      stubFetch({ '/notifications': { body: { count: 0, items: [], unread: 0 } } });
      renderInLayout(AgentLayout, <p>the page</p>, { me: NO_KPM });
      expect(screen.getByText('the page')).toBeInTheDocument();
    },
  );
});
