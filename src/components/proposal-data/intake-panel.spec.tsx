import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import type { Intake, IntakeCard, IntakeDetail } from '@/lib/product-data-intake';
import { makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { IntakeButton } from './intake-button';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/companies/co-1/proposal',
}));

const ME = makeMe({ membership: null, permissions: ['product_data:read', 'product_data:manage'] });

const intake = (over: Partial<Intake> = {}): Intake => ({
  id: 'in-1', companyId: 'co-1', companyName: 'Prudential', status: 'needs_answers', failure: null,
  files: [{ index: 0, name: 'tarif.xlsx', kind: 'xlsx', bytes: 1000, status: 'read', failure: null, items: 1, kept: true }],
  uploadedBy: 'u-1', uploadedByName: 'Superadmin', createdAt: '2026-11-12T03:00:00.000Z', readAt: '2026-11-12T03:01:00.000Z',
  items: 1, open: 1, ...over,
});

const question = { id: 'q-1', kind: 'column' as const, text: 'Kolom "Rate A" ini tarif laki-laki atau perempuan?', choices: [{ value: 'rate:male', label: 'Tarif laki-laki' }, { value: 'rate:female', label: 'Tarif perempuan' }], about: 'column:B', when: null, answer: null, answeredBy: null, answeredAt: null, open: true, asked: true };

const card = (over: Partial<IntakeCard> = {}): IntakeCard => ({
  id: 'it-1', companyId: 'co-1', productId: 'p-1', productName: 'PRUCerah', productAsWritten: 'PRU Cerah', kind: 'premium_table',
  summary: 'Tabel premi baru PRUCerah, berlaku 1 Des 2026', effectiveFrom: '2026-12-01', effectiveTo: null,
  source: { file: 0, fileName: 'tarif.xlsx', page: null, sheet: 'Tarif', cell: 'A1:C4', quote: null },
  diff: [{ key: 'table', label: 'Tabel premi', old: 'Belum ada', new: 'Tabel premi baru, berlaku 1 Des 2026, 6 baris', certain: true, source: { file: 0, fileName: 'tarif.xlsx', page: null, sheet: 'Tarif', cell: 'A1:C4', quote: null } }],
  table: { rows: 3, columns: [], gaps: ['Usia 33–60 tidak ada di tabel'], basis: 'per_mille', currency: 'IDR' },
  percent: null, newProductName: null, questions: [question], confidence: 'low', status: 'needs_answers',
  appliedRef: null, decidedBy: null, decidedAt: null, ...over,
});

const detail = (over: Partial<IntakeDetail> = {}): IntakeDetail => ({ ...intake(), canManage: true, cards: [card()], ...over });

afterEach(() => vi.unstubAllGlobals());

describe('P19.15-T3 Unggah file on the Proposal tab', () => {
  it('P19.15-T3 AC-5 is disabled without the Anthropic key, saying so in one line', async () => {
    stubFetch({ '/product-data/companies/co-1/intakes': { body: { aiReading: false, intakes: [] } } });
    renderWithSession(<IntakeButton companyId="co-1" canManage />, { me: ME });
    const button = await screen.findByRole('button', { name: 'Upload file' });
    await waitFor(() => expect(button).toBeDisabled());
    expect(screen.getByText(/Reading files is not switched on yet/)).toBeInTheDocument();
    expect(button).toHaveAccessibleDescription(/Excel or CSV in Premium table/);
  });

  it('P19.15-T3 AC-1 uploads several files at once and opens Yang kami pahami', async () => {
    const { calls } = stubFetch({
      'GET /product-data/companies/co-1/intakes': { body: { aiReading: true, intakes: [] } },
      'POST /product-data/companies/co-1/intakes': { status: 201, body: intake({ status: 'reading', open: 0 }) },
      '/product-data/intakes/in-1': { body: detail() },
    });
    renderInIndonesian(<IntakeButton companyId="co-1" canManage />, { me: ME });
    await userEvent.click(await screen.findByRole('button', { name: 'Unggah file' }));
    expect(screen.getByText(/Jangan unggah file berisi data pribadi nasabah/)).toBeInTheDocument();
    const files = [new File(['x'], 'tarif.xlsx'), new File(['%PDF-'], 'ilustrasi.pdf', { type: 'application/pdf' })];
    await userEvent.upload(screen.getByLabelText('Pilih file'), files);
    expect(screen.getByText('2 file dipilih')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Unggah' }));

    const post = calls.find((c) => c.init.method === 'POST')!;
    expect((post.init.body as FormData).getAll('files').map((f) => (f as File).name)).toEqual(['tarif.xlsx', 'ilustrasi.pdf']);
    const sheet = await screen.findByRole('dialog', { name: 'Yang kami pahami' });
    const group = within(sheet).getByRole('group', { name: 'PRUCerah' });
    expect(within(group).getByText('Belum ada')).toBeInTheDocument();
    expect(within(group).getByText('Tabel premi baru, berlaku 1 Des 2026, 6 baris')).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Buka tarif.xlsx' })).toBeInTheDocument();
    expect(within(group).getByText('Usia 33–60 tidak ada di tabel')).toBeInTheDocument();
  });

  it('P19.15-T3 AC-3 keeps Konfirmasi disabled while a question is open, and answers it in place', async () => {
    const answered = card({ status: 'ready', questions: [{ ...question, answer: 'rate:male', open: false }] });
    const { calls } = stubFetch({
      'GET /product-data/companies/co-1/intakes': { body: { aiReading: true, intakes: [intake()] } },
      'GET /product-data/intakes/in-1': [{ body: detail() }, { body: detail({ status: 'ready', open: 0, cards: [answered] }) }],
      'POST /product-data/intakes/in-1/items/it-1/answers': { body: answered },
    });
    renderInIndonesian(<IntakeButton companyId="co-1" canManage />, { me: ME });
    await userEvent.click(await screen.findByRole('button', { name: /Unggahan \(1\) · 1 pertanyaan menunggu jawaban/ }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Unggahan' })).getByRole('button', { name: 'Buka' }));
    const sheet = await screen.findByRole('dialog', { name: 'Yang kami pahami' });
    expect(within(sheet).getByRole('button', { name: 'Konfirmasi' })).toBeDisabled();
    expect(within(sheet).getByText('Jawab dulu pertanyaan di atas.')).toBeInTheDocument();

    await userEvent.click(within(sheet).getByRole('radio', { name: 'Tarif laki-laki' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Simpan jawaban' }));
    const post = calls.find((c) => c.url.includes('/answers'))!;
    expect(JSON.parse(post.init.body as string)).toEqual({ questionId: 'q-1', answer: 'rate:male' });
    expect(await within(sheet).findByText('Dijawab: Tarif laki-laki')).toBeInTheDocument();
    await waitFor(() => expect(within(sheet).getByRole('button', { name: 'Konfirmasi' })).toBeEnabled());
  });

  it('P19.15-T3 AC-4 says where a confirmed premium table goes next', async () => {
    const ready = card({ status: 'ready', questions: [] });
    const applied = card({ status: 'applied', questions: [], appliedRef: { kind: 'rate_table', id: 'rt-1' } });
    stubFetch({
      'GET /product-data/companies/co-1/intakes': { body: { aiReading: true, intakes: [intake({ open: 0, status: 'ready' })] } },
      'GET /product-data/intakes/in-1': [{ body: detail({ cards: [ready] }) }, { body: detail({ status: 'applied', cards: [applied] }) }],
      'POST /product-data/intakes/in-1/items/it-1/confirm': { body: applied },
    });
    renderInIndonesian(<IntakeButton companyId="co-1" canManage />, { me: ME });
    await userEvent.click(await screen.findByRole('button', { name: /Unggahan \(1\)/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Buka' }));
    const sheet = await screen.findByRole('dialog', { name: 'Yang kami pahami' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Konfirmasi' }));
    expect(await within(sheet).findByText(/Draf tabel premi dibuat\. Selesaikan di Tabel premi/)).toBeInTheDocument();
  });

  it('shows a reader who may only read the uploads, with no button and no controls', async () => {
    stubFetch({
      'GET /product-data/companies/co-1/intakes': { body: { aiReading: true, intakes: [intake()] } },
      'GET /product-data/intakes/in-1': { body: detail({ canManage: false }) },
    });
    renderWithSession(<IntakeButton companyId="co-1" canManage={false} />, { me: ME });
    await userEvent.click(await screen.findByRole('button', { name: /Uploads \(1\)/ }));
    expect(screen.queryByRole('button', { name: 'Upload file' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    const sheet = await screen.findByRole('dialog', { name: 'What we understood' });
    expect(within(sheet).getByText(/View only/)).toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    expect(within(sheet).getByRole('radio', { name: 'Tarif laki-laki' })).toBeDisabled();
    // Rendered alone, outside a page's landmarks: `region` is the page's to pass (`screens.a11y.spec.tsx`).
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect((results.violations ?? []).map((v) => v.id)).toEqual([]);
  });

  it('asks again while the upload is read, and says why a file was not read', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stubFetch({
      'GET /product-data/intakes': { body: { aiReading: true, intakes: [intake({ companyId: null, status: 'reading', open: 0 })] } },
      'GET /product-data/intakes/in-1': [
        { body: detail({ companyId: null, status: 'reading', cards: [], files: [{ index: 0, name: 'foto.jpg', kind: 'image', bytes: 9, status: 'reading', failure: null, items: 0, kept: true }] }) },
        { body: detail({ companyId: null, status: 'failed', cards: [], files: [{ index: 0, name: 'foto.jpg', kind: 'image', bytes: 9, status: 'failed', failure: 'busy', items: 0, kept: true }] }) },
      ],
    });
    renderInIndonesian(<IntakeButton companyId={null} canManage />, { me: ME });
    await userEvent.click(await screen.findByRole('button', { name: /Unggahan \(1\)/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Buka' }));
    expect(await screen.findByText(/Sedang membaca file/)).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(2_600);
    expect(await screen.findByText('Layanan pembaca sedang sibuk. Unggah lagi nanti.')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
