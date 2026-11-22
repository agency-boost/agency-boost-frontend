import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import type { BoxPreview, Illustration } from '@/lib/product-data-intake';
import { makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { IllustrationTab } from './illustration-tab';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/companies/co-1/proposal',
}));
// The PDF's own drawing is `pdf-pages`'s to test; here it only has to be handed the file.
vi.mock('@/components/proposal/pdf-pages', () => ({
  PdfPages: ({ file }: { file: Blob }) => <p>pdf-pages {file.size}</p>,
}));

const ME = makeMe({ membership: null, permissions: ['product_data:read', 'product_data:manage'] });

const check = (state: 'match' | 'mismatch' | 'unchecked') => ({
  state, reason: state === 'match' ? null : state === 'mismatch' ? 'differs' as const : 'few_samples' as const,
  samples: state === 'mismatch' ? [{ page: 2, inputs: { up: 50_000_000_000 }, printedMinor: 50_000_000_000, computedMinor: 100_000_000_000, match: false }] : [],
});

const illustration = (over: Partial<Illustration> = {}): Illustration => ({
  id: 'il-1', companyId: 'co-1', productId: 'p-1', plan: null, fileName: 'ilustrasi.pdf', hasFile: true, illustrationDate: '2026-11-01',
  status: 'draft', failure: null,
  blocks: [
    { block: 'manfaat', page: 2, rows: [{ id: 'r-1', label: 'Meninggal dunia', note: null, formula: '2 × up', text: null, page: 2, check: check('mismatch') }] },
    { block: 'pengecualian', page: 7, rows: [{ id: 'r-2', label: 'Bunuh diri 2 tahun pertama', note: null, formula: null, text: 'Tidak ditanggung', page: 7, check: null }] },
  ],
  dropped: ['Deskripsi dana investasi'], sampleInputs: { up: 50_000_000_000 }, formulaNames: ['up'], mismatches: 1, unchecked: 0,
  intakeItemId: null, publishedAt: null, supersededAt: null, createdAt: '2026-11-12T03:00:00.000Z', ...over,
});

const fixed = illustration({
  mismatches: 0,
  blocks: [
    { block: 'manfaat', page: 2, rows: [{ id: 'r-1', label: 'Meninggal dunia', note: null, formula: '100% × up', text: null, page: 2, check: check('match') }] },
    illustration().blocks[1],
  ],
});

const preview: BoxPreview = {
  rows: [
    { label: 'Uang pertanggungan', value: 'Rp 500 juta', block: null, kind: 'value' },
    { label: 'Meninggal dunia', value: 'Rp 500 juta', block: 'manfaat', kind: 'detail' },
  ],
  withTwo: { kept: 2, dropped: [] },
  withMore: { kept: 2, dropped: [] },
  missing: [],
  fits: true,
};

const BASE = '/product-data/companies/co-1';
afterEach(() => vi.unstubAllGlobals());

describe('P19.15-T2 the Ilustrasi tab', () => {
  it('P19.15-T2 AC-1 AC-2 shows each block with its page and each formula’s check, and refuses to publish a mismatch', async () => {
    stubFetch({ [`GET ${BASE}/products/p-1/illustrations`]: { body: { aiReading: true, illustrations: [illustration()] } } });
    renderInIndonesian(<IllustrationTab companyId="co-1" productId="p-1" canManage />, { me: ME });
    const benefits = await screen.findByRole('group', { name: 'Manfaat utama · hal. 2' });
    expect(within(benefits).getByLabelText('Rumus')).toHaveValue('2 × up');
    expect(within(benefits).getByText('Tidak cocok')).toBeInTheDocument();
    expect(within(benefits).getByText('Hasilnya tidak sama dengan angka di ilustrasi.')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Yang tidak ditanggung · hal. 7' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terbitkan' })).toBeDisabled();
    expect(screen.getByText('Perbaiki atau hapus dulu 1 rumus yang tidak cocok.')).toBeInTheDocument();
    expect(screen.getByText('Rumus boleh memakai: up')).toBeInTheDocument();
  });

  it('P19.15-T2 AC-2 AC-3 saves an edited formula, previews the box and its PDF, and publishes', async () => {
    const { calls } = stubFetch({
      [`GET ${BASE}/products/p-1/illustrations`]: [
        { body: { aiReading: true, illustrations: [illustration()] } },
        { body: { aiReading: true, illustrations: [{ ...fixed, status: 'published', publishedAt: '2026-11-12T04:00:00.000Z' }] } },
      ],
      [`PATCH ${BASE}/illustrations/il-1`]: { body: fixed },
      [`GET ${BASE}/illustrations/il-1/preview.pdf`]: { body: new Blob(['%PDF-1.4']) },
      [`GET ${BASE}/illustrations/il-1/preview`]: { body: preview },
      [`POST ${BASE}/illustrations/il-1/publish`]: { body: { ...fixed, status: 'published' } },
    });
    renderInIndonesian(<IllustrationTab companyId="co-1" productId="p-1" canManage />, { me: ME });
    const formula = within(await screen.findByRole('group', { name: 'Manfaat utama · hal. 2' })).getByLabelText('Rumus');
    await userEvent.clear(formula);
    await userEvent.type(formula, '100% × up');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan perubahan' }));
    const patch = calls.find((c) => c.init.method === 'PATCH')!;
    expect(JSON.parse(patch.init.body as string).blocks[0]).toEqual({
      block: 'manfaat', rows: [{ id: 'r-1', label: 'Meninggal dunia', note: null, formula: '100% × up', text: null }],
    });
    expect(await screen.findByText('Tersimpan. Setiap rumus sudah dicek ulang.')).toBeInTheDocument();
    expect(screen.getByText('Cocok')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Pratinjau kotak PDF' }));
    expect(await screen.findByText('Kotak PDF, seperti yang dicetak agen')).toBeInTheDocument();
    expect(screen.getByText('Dengan 2 produk: memuat 2 baris')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Lihat PDF' }));
    expect(await screen.findByText(/^pdf-pages/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Terbitkan' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/publish'))).toBe(true));
  });

  it('uploads an illustration PDF with its date, and says when reading is off', async () => {
    const { calls } = stubFetch({
      [`GET ${BASE}/products/p-1/illustrations`]: { body: { aiReading: true, illustrations: [] } },
      [`POST ${BASE}/products/p-1/illustrations`]: { status: 201, body: illustration({ status: 'reading', blocks: [] }) },
    });
    renderWithSession(<IllustrationTab companyId="co-1" productId="p-1" canManage />, { me: ME });
    expect(await screen.findByText('No illustration yet.')).toBeInTheDocument();
    await userEvent.upload(screen.getByLabelText('Illustration (PDF)'), new File(['%PDF-'], 'ilustrasi.pdf', { type: 'application/pdf' }));
    await userEvent.type(screen.getByLabelText('Illustration date'), '2026-11-01');
    await userEvent.click(screen.getByRole('button', { name: 'Upload illustration' }));
    const form = calls.find((c) => c.init.method === 'POST')!.init.body as FormData;
    expect(form.get('illustrationDate')).toBe('2026-11-01');
    expect((form.get('file') as File).name).toBe('ilustrasi.pdf');
  });

  it('is read-only for a reader who may only read, and says reading is off without the key', async () => {
    stubFetch({ [`GET ${BASE}/products/p-1/illustrations`]: { body: { aiReading: false, illustrations: [fixed] } } });
    renderWithSession(<IllustrationTab companyId="co-1" productId="p-1" canManage={false} />, { me: ME });
    expect(await screen.findByText('View only.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Illustration (PDF)')).not.toBeInTheDocument();
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect((results.violations ?? []).map((v) => v.id)).toEqual([]);
  });

  it('P19.15-T3 AC-5 tells a manager reading is off without the key', async () => {
    stubFetch({ [`GET ${BASE}/products/p-1/illustrations`]: { body: { aiReading: false, illustrations: [] } } });
    renderWithSession(<IllustrationTab companyId="co-1" productId="p-1" canManage />, { me: ME });
    expect(await screen.findByText(/Reading illustrations is not switched on yet/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Illustration (PDF)')).not.toBeInTheDocument();
  });
});
