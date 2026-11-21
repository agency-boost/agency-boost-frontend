import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { englishOnly, englishShown } from '@test/english-left';
import { makeMe, renderInIndonesian, renderWithSession, routeParams, stubFetch } from '@test/harness';
import { kpmReportMessages } from '@/i18n/messages/kpm-report';
import KpmReportLinkPage from './page';

const saveFile = vi.fn();
vi.mock('@/lib/save-file', () => ({ saveFile: (...args: unknown[]) => saveFile(...args) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/laporan-kpm/tok',
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * **The KPM report link the Owner opens** (`/laporan-kpm/[token]`; P19.24-T2 AC-1; ADR-0280 §5): signed out, *Sign in*
 * coming back here; signed in, *Download PDF*, again as often as wanted until the link expires; every refusal the
 * server's sentence. The token's first half names the month for the heading; nothing else is read from it.
 */
const TOKEN = `${btoa(JSON.stringify({ v: 1, k: 'kpm-0417', m: '2026-10', s: 'sa', e: 1, i: 'x' })).replace(/=+$/, '')}.c2lnbg`;
const SHELL = { '/notifications': { body: { items: [], unread: 0 } } };
const OWNER = makeMe();
const page = (token = TOKEN) => <KpmReportLinkPage params={routeParams({ token })} />;

afterEach(() => {
  vi.unstubAllGlobals();
  saveFile.mockReset();
});

describe('P19.24-T2 the KPM report link', () => {
  it('P19.24-T2 AC-1 signed out: the report’s month, then sign in, coming back here', () => {
    renderWithSession(page(), { me: null });
    expect(screen.getByText('KPM report · October 2026')).toBeInTheDocument();
    expect(screen.getByText(/Sign in as the KPM's owner or admin first/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', `/login?next=${encodeURIComponent(`/laporan-kpm/${TOKEN}`)}`);
    expect(screen.queryByRole('button', { name: 'Download PDF' })).not.toBeInTheDocument();
  });

  it('P19.24-T2 AC-1 signed in: Download PDF fetches the link’s file and saves it, as often as wanted', async () => {
    const { calls } = stubFetch({ ...SHELL, [`GET /kpm-report/shared/${TOKEN}`]: { body: new Blob(['%PDF-1.3']) } });
    renderWithSession(page(), { me: OWNER });
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), 'Laporan-KPM-2026-10.pdf'));
    expect(await screen.findByRole('status', { name: '' })).toHaveTextContent('You can open this link again until it expires.');
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(saveFile).toHaveBeenCalledTimes(2));
    expect(calls.filter((c) => c.url.includes('/kpm-report/shared/')).length).toBe(2);
  });

  it('P19.24-T2 AC-1 an expired link says so in the server’s words', async () => {
    stubFetch({
      ...SHELL,
      [`GET /kpm-report/shared/${TOKEN}`]: {
        status: 404, body: { error: { code: 'NOT_FOUND', message: 'This KPM report link has expired. Ask AgencyBoost to send it again.', requestId: 'r1' } },
      },
    });
    renderWithSession(page(), { me: OWNER });
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    expect(await screen.findByText(/This KPM report link has expired/)).toBeInTheDocument();
    expect(saveFile).not.toHaveBeenCalled();
  });

  it('P19.24-T2 AC-1 a token that names no month still offers the download under a plain heading', () => {
    stubFetch(SHELL);
    renderWithSession(page('nonsense'), { me: OWNER });
    expect(screen.getAllByText('KPM report').length).toBeGreaterThan(0);
    expect(screen.queryByText(/KPM report ·/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
  });

  it('P18.10-T7 AC-1 in Indonesian, signed out and signed in, no English of the page’s own is left', () => {
    stubFetch(SHELL);
    const signedOut = renderInIndonesian(page(), { me: null });
    expect(englishShown(document.body, englishOnly(kpmReportMessages))).toEqual([]);
    signedOut.unmount();
    renderInIndonesian(page(), { me: OWNER });
    expect(englishShown(document.body, englishOnly(kpmReportMessages))).toEqual([]);
  });

  it('P19.24-T2 has no axe violations, signed in', async () => {
    stubFetch(SHELL);
    const { container } = renderWithSession(page(), { me: OWNER });
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations ?? []).toEqual([]);
  });
});
