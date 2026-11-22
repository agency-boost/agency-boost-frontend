import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, renderWithSession, stubFetch } from '@test/harness';
import { reportMonths } from '@/lib/kpm-report';
import { KpmReportDialog } from './kpm-report-dialog';
import { KpmReportSlot } from './kpm-report-slot';

const saveFile = vi.fn();
vi.mock('@/lib/save-file', () => ({ saveFile: (...args: unknown[]) => saveFile(...args) }));

/**
 * ***Laporan KPM*** **— the dialog** (P19.24-T2 AC-1; ADR-0280; the Super Admin spec §4): the month — the KPM's and the
 * twelve before it, last month first — *Kirim ke owner* (the Super Admin's own WhatsApp with the link, nothing sent by the
 * app) and *Unduh PDF* (the file, saved). English is this spec's; the console reads in Indonesian by default.
 */
const KPM = { kpmId: 'kpm-0417', kpmName: 'BSD City Branch', companyName: 'Prudential' };
const LINK = {
  link: 'https://agencyboost.id/laporan-kpm/eyJ2IjoxLCJtIjoiMjAyNi0xMCJ9.c2ln', month: '2026-10', expiresAt: '2026-11-27T03:00:00.000Z',
  kpmName: 'BSD City Branch', kpmCode: '0417', companyName: 'Prudential', ownerName: 'Wilson Tanoto', ownerPhone: '0811 2000 300',
  owners: [{ userId: 'u-wilson', name: 'Wilson Tanoto', phone: '0811 2000 300' }],
};
/** The KPM page and the Dashboard know how many owners the KPM has: one, here, unless a case says otherwise. */
const dialog = (onClose = vi.fn(), ownerCount: number | undefined = 1) => <KpmReportDialog {...KPM} ownerCount={ownerCount} onClose={onClose} />;
const { months, initial } = reportMonths();

beforeEach(() => saveFile.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe('P19.24-T2 the KPM report dialog', () => {
  it('P19.24-T2 AC-1 offers the KPM’s month and the twelve before it, the last whole month chosen', () => {
    renderWithSession(dialog());
    const box = screen.getByRole('dialog', { name: 'KPM report' });
    expect(within(box).getByText('BSD City Branch · Prudential')).toBeInTheDocument();
    const month = within(box).getByRole('combobox', { name: 'Month' });
    expect(within(month).getAllByRole('option')).toHaveLength(13);
    expect(month).toHaveValue(initial);
    expect(months[0] > months[12]).toBe(true);
    expect(month).toHaveAccessibleDescription(/PDF report, about 22 pages/);
    expect(within(box).getByRole('button', { name: 'Send to owner' })).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
  });

  it('P19.24-T2 AC-1 Download PDF asks for the month chosen and saves the file under its name', async () => {
    const { calls } = stubFetch({ 'GET /admin/tenants/kpm-0417/report': { body: new Blob(['%PDF-1.3']) } });
    renderWithSession(dialog());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Month' }), months[2]);
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), `Laporan-KPM-BSD-City-Branch-${months[2]}.pdf`));
    expect(calls[0].url).toContain(`/admin/tenants/kpm-0417/report?month=${months[2]}`);
    expect(await screen.findByText('The PDF is downloaded.')).toBeInTheDocument();
  });

  it('P19.24-T2 AC-1 Send to owner opens WhatsApp to the Owner with the link — the app sends nothing', async () => {
    const opened = { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
    vi.stubGlobal('open', vi.fn(() => opened));
    const { calls } = stubFetch({ 'POST /admin/tenants/kpm-0417/report/link': { body: LINK } });
    renderWithSession(dialog());
    await userEvent.click(screen.getByRole('button', { name: 'Send to owner' }));
    await waitFor(() => expect(opened.location.href).toMatch(/^https:\/\/wa\.me\/628112000300\?text=/));
    const text = decodeURIComponent(opened.location.href.split('?text=')[1]);
    expect(text).toContain('Wilson Tanoto');
    expect(text).toContain(LINK.link);
    expect(text).toContain('Oktober 2026');
    expect(opened.opener).toBeNull();
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ month: initial });
    expect(await screen.findByText('WhatsApp is open for Wilson Tanoto. Send the message there.')).toBeInTheDocument();
  });

  it('P19.27-T5 AC-1 several owners: one pick-list, every owner chosen, one WhatsApp link each (OD-455)', async () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    stubFetch({
      'POST /admin/tenants/kpm-0417/report/link': {
        body: { ...LINK, owners: [...LINK.owners, { userId: 'u-sari', name: 'Sari Puspita', phone: '0812 9999 0000' }] },
      },
    });
    renderWithSession(dialog(vi.fn(), 2));
    await userEvent.click(screen.getByRole('button', { name: 'Send to owner' }));
    const list = await screen.findByRole('group', { name: 'Send to the owners' });
    // No window opened in the press — none flashes open and shut (the integration round's walk): each owner is a tap.
    expect(open).not.toHaveBeenCalled();
    const boxes = within(list).getAllByRole('checkbox');
    expect(boxes.map((b) => (b as HTMLInputElement).checked)).toEqual([true, true]);
    const sari = within(list).getByRole('link', { name: 'Send to Sari Puspita on WhatsApp' });
    expect(sari).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\/6281299990000\?text=Hi%20Sari%20Puspita|^https:\/\/wa\.me\/6281299990000\?text=Halo%20Sari%20Puspita/));
    expect(sari).toHaveAttribute('target', '_blank');
    // Unticked, an owner's link goes.
    await userEvent.click(boxes[1]);
    expect(within(list).queryByRole('link', { name: 'Send to Sari Puspita on WhatsApp' })).not.toBeInTheDocument();
    expect(within(list).getByRole('link', { name: 'Send to Wilson Tanoto on WhatsApp' })).toBeInTheDocument();
  });

  it('P19.27-T5 AC-1 a second owner added since the page was read: the window opened in the press is closed, and the list drawn', async () => {
    const opened = { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
    vi.stubGlobal('open', vi.fn(() => opened));
    stubFetch({
      'POST /admin/tenants/kpm-0417/report/link': {
        body: { ...LINK, owners: [...LINK.owners, { userId: 'u-sari', name: 'Sari Puspita', phone: '0812 9999 0000' }] },
      },
    });
    renderWithSession(dialog());
    await userEvent.click(screen.getByRole('button', { name: 'Send to owner' }));
    const list = await screen.findByRole('group', { name: 'Send to the owners' });
    expect(opened.close).toHaveBeenCalled();
    expect(within(list).getAllByRole('link')).toHaveLength(2);
  });

  it('the owners not known to the page: no window in the press, one link to tap', async () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    stubFetch({ 'POST /admin/tenants/kpm-0417/report/link': { body: LINK } });
    // No `ownerCount` (a default parameter would read `undefined` as one owner).
    renderWithSession(<KpmReportDialog {...KPM} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Send to owner' }));
    const list = await screen.findByRole('group', { name: 'Send to the owners' });
    expect(open).not.toHaveBeenCalled();
    expect(within(list).getByRole('link', { name: 'Send to Wilson Tanoto on WhatsApp' }))
      .toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\/628112000300\?text=/));
  });

  it('P19.24-T2 AC-1 with no number on file WhatsApp asks whom to send it to', async () => {
    const opened = { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
    vi.stubGlobal('open', vi.fn(() => opened));
    stubFetch({ 'POST /admin/tenants/kpm-0417/report/link': { body: { ...LINK, ownerPhone: null } } });
    renderWithSession(dialog());
    await userEvent.click(screen.getByRole('button', { name: 'Send to owner' }));
    await waitFor(() => expect(opened.location.href).toMatch(/^https:\/\/wa\.me\/\?text=/));
    expect(await screen.findByText('WhatsApp is open. Choose the owner and send the message there.')).toBeInTheDocument();
  });

  it('P19.24-T2 AC-1 a blocked window and a refusal are said in the dialog, the window closed again', async () => {
    vi.stubGlobal('open', vi.fn(() => null));
    renderWithSession(dialog());
    await userEvent.click(screen.getByRole('button', { name: 'Send to owner' }));
    expect(await screen.findByText(/The browser blocked the new window/)).toBeInTheDocument();

    const opened = { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
    vi.stubGlobal('open', vi.fn(() => opened));
    stubFetch({
      'POST /admin/tenants/kpm-0417/report/link': {
        status: 400, body: { error: { code: 'VALIDATION_FAILED', message: 'A KPM report can be made for Oktober 2025 to November 2026 only.', requestId: 'r1' } },
      },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Send to owner' }));
    expect(await screen.findByText(/can be made for Oktober 2025 to November 2026 only/)).toBeInTheDocument();
    expect(opened.close).toHaveBeenCalled();
  });

  it('P19.24-T2 AC-1 holds both buttons still while one runs', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    renderWithSession(dialog());
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    expect(await screen.findByRole('button', { name: 'Making the PDF…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send to owner' })).toBeDisabled();
  });

  it('P19.24-T2 §12 is a bottom sheet on a phone and a centred dialog from a tablet up', () => {
    atWidth(390);
    const { unmount } = renderWithSession(dialog());
    expect(screen.getByRole('dialog').closest('[data-placement]')).toHaveAttribute('data-placement', 'sheet');
    unmount();
    atWidth(820);
    renderWithSession(dialog());
    expect(screen.getByRole('dialog').closest('[data-placement]')).toHaveAttribute('data-placement', 'center');
  });

  it('P19.24-T2 AC-1 the PDF icon is named for its KPM and opens the dialog', async () => {
    renderWithSession(<KpmReportSlot kpm={{ kpmId: 'kpm-0417', name: 'BSD City Branch', code: '0417', companyName: 'Prudential' }} placement="row" />);
    await userEvent.click(screen.getByRole('button', { name: 'KPM report for BSD City Branch (PDF)' }));
    // Loaded the first time it opens.
    expect(await screen.findByRole('dialog', { name: 'KPM report' })).toBeInTheDocument();
  });

  it('P19.26-T6 AC-3 on a phone the month is the app’s own picker, never a native select (UI-218 (21 Nov))', async () => {
    atWidth(375);
    const { calls } = stubFetch({ 'GET /admin/tenants/kpm-0417/report': { body: new Blob(['%PDF-1.3']) } });
    renderWithSession(dialog());
    const box = screen.getByRole('dialog', { name: 'KPM report' });
    expect(within(box).queryByRole('combobox', { name: 'Month' })).toBeNull();
    expect(box.querySelector('select')).toBeNull();
    // *"PDF report, about 22 pages…"* is not drawn on a phone (the integration round's walk, 2026-11-22); from 768px it is.
    expect(within(box).getByText(/PDF report, about 22 pages/)).toHaveClass('max-md:hidden');
    const picker = within(box).getByRole('button', { name: /^Month/ });
    expect(picker).toHaveAttribute('aria-haspopup', 'listbox');
    await userEvent.click(picker);
    const list = await screen.findByRole('listbox');
    expect(within(list).getAllByRole('option')).toHaveLength(13);
    await userEvent.click(within(list).getAllByRole('option')[2]);
    await userEvent.click(within(box).getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(calls[0]?.url).toContain(`/admin/tenants/kpm-0417/report?month=${months[2]}`));
  });

  it('P19.24-T2 has no axe violations', async () => {
    const { baseElement } = renderWithSession(dialog());
    // Colour contrast is jsdom's blind spot (no layout, no computed colour): the tokens are pinned by `a11y.spec.tsx`.
    const results = await axe(baseElement, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations ?? []).toEqual([]);
  });
});
