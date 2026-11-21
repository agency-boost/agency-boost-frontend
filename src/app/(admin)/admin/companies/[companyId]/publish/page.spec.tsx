import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, renderInIndonesian, routeParams, stubFetch } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { adminCompaniesConsoleMessages } from '@/i18n/messages/admin-companies-console';
import { LIBRARY, PRUDENTIAL, SUPER_ADMIN } from '@test/kpm-template-fixtures';
import PublishToKpmsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/companies/c1/publish',
}));

const change = (over: Record<string, unknown>) => ({
  type: 'setting', setting: null, kinds: [], productId: null, productCode: null, productName: null, draft: true,
  reach: 'chosen', overwrites: true, added: 0, changed: 0, removed: 0, missing: 0, ...over,
});
const VIEW = {
  companyId: 'c1', templateId: 't1', library: false,
  changes: [
    change({ id: 'product:p1', type: 'product_new', productId: 'p1', productName: 'PRUWell Medical', overwrites: false, missing: 5 }),
    change({ id: 'setting:activity_types', setting: 'activity_types', kinds: ['activity_taxonomy', 'ratio_set'], added: 1 }),
    change({ id: 'setting:lead_statuses', setting: 'lead_statuses', kinds: ['lead_pipeline'], changed: 1 }),
  ],
  kpms: [
    { id: 'k1', code: '0417', name: 'BSD City Branch', ownEdits: ['setting:activity_types'], upToDate: [] },
    { id: 'k2', code: '0418', name: 'Tangerang Branch', ownEdits: [], upToDate: [] },
    { id: 'k3', code: '0419', name: 'Cikarang Branch', ownEdits: ['setting:lead_statuses'], upToDate: [] },
  ],
};

function render(view: unknown = VIEW, post?: (call: { body: unknown }) => { status?: number; body?: unknown }) {
  const sent: unknown[] = [];
  stubFetch({
    '/admin/companies': { body: [PRUDENTIAL, LIBRARY] },
    'GET /admin/companies/c1/publication': { body: view },
    'POST /admin/companies/c1/publication': (call: { body: unknown }) => { sent.push(call.body); return post ? post(call) : { body: { results: [] } }; },
  } as never);
  renderInIndonesian(<PublishToKpmsPage params={routeParams({ companyId: 'c1' })} />, { me: SUPER_ADMIN });
  return sent;
}

const box = (name: RegExp | string) => screen.getByRole('checkbox', { name });

/**
 * **P19.23-T4 AC-5 — *Terbitkan ke KPM*** (ADR-0278 §5–§7; frames 36–40): nothing pre-selected, step 1 the changes, step
 * 2 the KPMs, one confirmation; a new product only adds, a settings change overwrites — *akan tertimpa* and the tick.
 */
describe('P19.23-T4 AC-5 Terbitkan ke KPM', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([390, 1024])('P19.23-T4 AC-5 at %ipx pre-selects nothing and holds Terbitkan until a change and a KPM are chosen', async (px) => {
    atWidth(px);
    render();
    expect(await screen.findByText('Produk baru · PRUWell Medical')).toBeInTheDocument();
    for (const b of screen.getAllByRole('checkbox')) expect(b).not.toBeChecked();
    expect(screen.getByText('Belum ada yang dipilih · tidak ada yang diterbitkan otomatis')).toBeInTheDocument();
    // Both steps: three changes, three KPMs, none chosen.
    expect(screen.getAllByText('0 dari 3 dipilih')).toHaveLength(2);
    const publish = screen.getByRole('button', { name: 'Terbitkan...' });
    expect(publish).toBeDisabled();
    await userEvent.click(box(/Produk baru · PRUWell Medical/));
    expect(publish).toBeDisabled();
    await userEvent.click(box('Tangerang Branch'));
    expect(publish).toBeEnabled();
    expect(screen.getByText('1 perubahan ke 1 KPM')).toBeInTheDocument();
  });

  it('P19.23-T4 AC-5 a new product only adds: the confirmation says so, asks no tick, and sends what was chosen', async () => {
    atWidth(1024);
    const sent = render();
    await userEvent.click(await screen.findByRole('checkbox', { name: /Produk baru · PRUWell Medical/ }));
    expect(screen.getByText('Menambah produk + tabel premi · tidak mengubah pengaturan KPM')).toBeInTheDocument();
    await userEvent.click(box('BSD City Branch'));
    await userEvent.click(box('Tangerang Branch'));
    await userEvent.click(screen.getByRole('button', { name: 'Terbitkan...' }));
    const dialog = await screen.findByRole('dialog', { name: 'Terbitkan 1 perubahan ke 2 KPM?' });
    expect(within(dialog).getByText('Ke: BSD City Branch, Tangerang Branch')).toBeInTheDocument();
    expect(within(dialog).getByText('Hanya menambah · pengaturan KPM tidak berubah.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox')).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Terbitkan' }));
    await vi.waitFor(() => expect(sent).toEqual([{ changes: ['product:p1'], kpmIds: ['k1', 'k2'] }]));
  });

  it('P19.23-T4 AC-5 a setting a KPM changed itself: akan tertimpa, and Terbitkan held until the tick', async () => {
    atWidth(1280);
    const sent = render();
    await screen.findByText('Produk baru · PRUWell Medical');
    // Before the setting is chosen the KPM's own change is said in grey; chosen, it will be overwritten.
    const bsd = screen.getByText('BSD City Branch').closest('li')!;
    expect(within(bsd).getByText('Activity types sudah diubah KPM ini')).toBeInTheDocument();
    await userEvent.click(box(/^Activity types · 1 baru/));
    expect(screen.getByText('Menimpa daftar Activity types di KPM')).toBeInTheDocument();
    expect(within(bsd).getByText('Activity types sudah diubah KPM ini · akan tertimpa')).toBeInTheDocument();
    await userEvent.click(box('BSD City Branch'));
    await userEvent.click(box('Tangerang Branch'));
    expect(screen.getByText(/menimpa pengaturan KPM/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Terbitkan...' }));
    const dialog = await screen.findByRole('dialog', { name: 'Terbitkan 1 perubahan ke 2 KPM?' });
    expect(within(dialog).getByText('Ini akan menimpa pengaturan KPM.')).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: 'Terbitkan' });
    expect(confirm).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Saya paham pengaturan KPM ini akan ditimpa' }));
    await userEvent.click(confirm);
    await vi.waitFor(() => expect(sent).toEqual([
      { changes: ['setting:activity_types'], kpmIds: ['k1', 'k2'], overwriteConfirmed: true },
    ]));
  });

  it('P19.23-T4 AC-5 says the server’s refusal in its own words, and reports a change refused alone', async () => {
    atWidth(1024);
    render(VIEW, () => ({ status: 409, body: { error: { code: 'TEMPLATE_APPLY_UNCONFIRMED', message: 'Cikarang Branch sudah mengubah pengaturan ini sendiri.' } } }));
    await userEvent.click(await screen.findByRole('checkbox', { name: /^Lead statuses · 1 diubah/ }));
    await userEvent.click(box('Tangerang Branch'));
    await userEvent.click(screen.getByRole('button', { name: 'Terbitkan...' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Terbitkan' }));
    expect(await within(dialog).findByText('Cikarang Branch sudah mengubah pengaturan ini sendiri.')).toBeInTheDocument();
  });

  it('P19.23-T4 AC-5 says when nothing waits, and that the Default template has no KPM', async () => {
    render({ ...VIEW, changes: [], kpms: [] });
    expect(await screen.findByText('Tidak ada yang menunggu: semua KPM memakai versi terbaru.')).toBeInTheDocument();
    expect(screen.getByText('Perusahaan ini belum punya KPM.')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('P19.23-T4 AC-5 passes axe with changes and KPMs chosen, and with the question open', async () => {
    atWidth(1280);
    render();
    await userEvent.click(await screen.findByRole('checkbox', { name: /^Activity types · 1 baru/ }));
    await userEvent.click(box('BSD City Branch'));
    const rules = { 'color-contrast': { enabled: false }, region: { enabled: false } };
    expect((await axe(document.body, { rules })).violations ?? []).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Terbitkan...' }));
    await screen.findByRole('dialog');
    expect((await axe(document.body, { rules })).violations ?? []).toHaveLength(0);
  });

  it('P18.10-T7 AC-1 in Indonesian, no English of the page’s own is left, the question open too', async () => {
    atWidth(1280);
    render();
    await userEvent.click(await screen.findByRole('checkbox', { name: /^Activity types · 1 baru/ }));
    await userEvent.click(box('BSD City Branch'));
    expect(englishShown(document.body, englishOnly(adminCompaniesConsoleMessages))).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Terbitkan...' }));
    await screen.findByRole('dialog');
    expect(englishShown(document.body, englishOnly(adminCompaniesConsoleMessages))).toEqual([]);
  });
});
