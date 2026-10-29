import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderInIndonesian, stubFetch, wears } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { settingsMessages } from '@/i18n/messages/settings';
import { settingsProductsMessages } from '@/i18n/messages/settings-products';
import KpmProductsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/products',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    status: 'active', isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['tenant_config:read', 'product_settings:read', 'tenant_config:write', 'sales_script:approve'],
});

const field = <T,>(value: T, overridden = false) => ({ value, overridden });
const script = (over: Record<string, unknown> = {}) => ({
  goodFit: field('Keluarga muda'),
  opening: field('Halo, boleh saya tanya sebentar?'),
  benefits: field(['Proteksi jiwa']),
  fullScript: field('Halo. Ini scriptnya.'),
  objectionTheySay: field('Terlalu mahal.'),
  objectionYouSay: field('Preminya bisa disesuaikan.'),
  nextAction: field('Boleh saya siapkan ilustrasinya?'),
  ...over,
});
const product = (over: Record<string, unknown> = {}) => ({
  productId: 'p1', code: 'PRUMAPAN', companyName: 'PRUMapan', channel: 'conventional', category: 'life',
  lifecycle: 'active', sellable: true, active: field(true), displayName: field('PRUMapan'),
  description: field('Dana pensiun yang cair rutin dari usia 55.'), script: script(), reviewState: 'none',
  rejectionReason: null,
  documents: [
    { slot: 'brochure', label: 'Brosur', storageKey: 'k1', filename: 'kami.pdf', source: 'kpm' },
    { slot: 'illustration', label: 'Ilustrasi', storageKey: 'k2', filename: 'mereka.pdf', source: 'company' },
    { slot: 'productDoc', label: 'Dokumen produk', storageKey: null, filename: null, source: 'none' },
  ],
  ...over,
});

function render(rows: unknown[]) {
  const waiting = (rows as { reviewState?: string }[]).filter((p) => p.reviewState === 'pending' || p.reviewState === 'rejected');
  stubFetch({
    '/kpm/settings/products': { body: rows },
    '/kpm/settings/products/script-reviews': { body: waiting },
    '/kpm/settings/products/p1/script/effective': { body: { source: 'company', script: script() } },
    '/kpm/settings/products/p2/script/effective': { body: { source: 'kpm', script: script() } },
    '/kpm/settings/branch-info': { body: { _id: 'k1', companyId: 'c1', companyName: 'Allianz Life', code: '0417' } },
    '/kpm/settings/publish-state': {
      body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null },
    },
  });
  renderInIndonesian(<KpmProductsPage />, { me: OWNER });
}

const SHELF = [
  product(),
  product({
    productId: 'p2', code: 'PRUSYARIAH', companyName: 'PRUSyariah', displayName: field('Syariah Kami', true),
    channel: 'syariah', reviewState: 'pending', script: script({ opening: field('Halo dari kami.', true) }),
  }),
  product({ productId: 'p3', code: 'PGB', companyName: 'PGB', displayName: field('PGB'), sellable: false, lifecycle: 'withdrawn' }),
];

/** The screen's English that ID mode must not show — its own, and the settings frame's it draws. */
const PRODUCTS_ENGLISH = englishOnly(settingsProductsMessages, settingsMessages);
const noEnglishLeft = () => expect(englishShown(document.body, PRODUCTS_ENGLISH)).toEqual([]);

/**
 * **P18.98-T4, Settings › Products in ID mode** (ADR-0179 §3–§5): the shelf, a product opened and *Script approvals* in
 * the approved glossary's Indonesian; the title, the tabs, *Attack Plan*, *Documents* and *KPM* English (§A); the
 * company's name, every product's name, description, script and document as typed. In English: `page.spec.tsx`.
 */
describe('P18.98-T4 Settings › Products in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-2 the shelf: its line, the count, the badges and the switch in Indonesian, the company and products as typed', async () => {
    atWidth(1280);
    render(SHELF);
    await screen.findByText('Syariah Kami');
    expect(screen.getByRole('heading', { level: 1, name: 'Products' })).toBeInTheDocument();
    expect(screen.getByText('Yang dijual KPM Anda dari katalog Allianz Life, dan kata-kata yang Anda pakai untuk menjualnya.'))
      .toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'Bagian produk' });
    expect(within(tabs).getAllByRole('link').map((l) => l.textContent)).toEqual(['Products', 'Script approvals']);
    const count = screen.getByText(/^3 produk · /);
    expect(count).toHaveTextContent('3 produk · 2 dapat dijual agent Anda · 1 ditarik oleh Allianz Life');
    expect(within(count).getByText('2').tagName).toBe('STRONG');
    expect(screen.getAllByText('Perubahan Anda hanya berlaku untuk KPM ini.').find((el) => el.tagName === 'P'))
      .toBeInTheDocument();
    expect(screen.getAllByText('Konvensional')).toHaveLength(2);
    expect(screen.getByText('Syariah')).toBeInTheDocument();
    expect(screen.getByText('Allianz Life menyebutnya PRUSyariah')).toBeInTheDocument();
    expect(screen.getByText('Ditarik oleh Allianz Life')).toBeInTheDocument();
    expect(screen.getByText('Menunggu persetujuan Anda')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tinjau Syariah Kami' })).toHaveTextContent(/^Tinjau$/);
    expect(screen.getAllByRole('switch', { name: 'Agent menjualnya' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Sesuaikan' })).toHaveLength(3);
    noEnglishLeft();
  });

  it('AC-1 the grey sentence keeps its verdict per size in Indonesian: behind its ⓘ below 1024px', async () => {
    atWidth(768);
    render(SHELF);
    const tip = await screen.findByRole('button', { name: 'Perubahan Anda hanya berlaku untuk KPM ini.' });
    expect(wears(tip.parentElement!, 768).split(' ')).not.toContain('hidden');
  });

  it('AC-2 a product opened: its name, description, the plan’s seven fields and its documents in Indonesian', async () => {
    render(SHELF);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Sesuaikan' }))[0]);
    expect(screen.getByRole('button', { name: 'Tutup' })).toBeInTheDocument();
    expect(screen.getByLabelText('Kode')).toHaveAccessibleDescription(
      'Milik perusahaan Anda. Setiap KPM di Allianz Life memakai kode yang sama.',
    );
    expect(screen.getByLabelText('Nama yang dipakai KPM Anda')).toHaveValue('PRUMapan');
    expect(screen.getByRole('button', { name: 'Simpan nama' })).toBeInTheDocument();
    expect(screen.getByLabelText('Deskripsi singkat (ditampilkan ke agent)'))
      .toHaveValue('Dana pensiun yang cair rutin dari usia 55.');
    expect(screen.getByRole('heading', { name: 'Attack Plan' })).toBeInTheDocument();
    for (const label of [
      '0 · Cocok untuk', '1 · Kalimat pembuka', '2 · Tekankan manfaat berikut', '3 · Script lengkap — cara menyampaikannya',
      '4a · Jika ada keberatan — dia berkata', '4b · Jika ada keberatan — Anda menjawab', '5 · Tindakan berikutnya',
    ]) {
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription('Mengikuti Allianz Life.');
    }
    expect(screen.getByRole('heading', { name: 'Documents' })).toBeInTheDocument();
    expect(screen.getByText('Diunggah oleh KPM Anda — kami.pdf')).toBeInTheDocument();
    expect(screen.getByText('Dari katalog Allianz Life')).toBeInTheDocument();
    expect(screen.getByText('Belum ada yang melampirkan dokumen.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ganti Brosur' })).toHaveTextContent(/^Ganti$/);
    expect(screen.getByRole('button', { name: 'Unggah Dokumen produk' })).toHaveTextContent(/^\+ Unggah$/);
    expect(screen.getByRole('button', { name: 'Gunakan milik Allianz Life' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 a renamed product says whose its name is, and offers the company’s back, in Indonesian', async () => {
    render(SHELF);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Sesuaikan' }))[1]);
    expect(screen.getByLabelText('Nama yang dipakai KPM Anda'))
      .toHaveAccessibleDescription('Milik Anda. Allianz Life menyebutnya PRUSyariah.');
    expect(screen.getByRole('button', { name: 'Gunakan nama dari Allianz Life' })).toBeInTheDocument();
    expect(screen.getByLabelText('1 · Kalimat pembuka')).toHaveAccessibleDescription('Milik Anda.');
  });

  it('AC-2 Script approvals: the gate’s words, the queue and a send-back in Indonesian, the words being approved as typed', async () => {
    render([
      ...SHELF,
      product({ productId: 'p4', code: 'PRUTERM', displayName: field('PRUterm'), reviewState: 'rejected', rejectionReason: 'Terlalu kuat.' }),
    ]);
    await screen.findByText('Syariah Kami');
    await userEvent.click(screen.getByRole('link', { name: 'Script approvals' }));
    expect(await screen.findByText('Ini pemeriksaan KPM Anda sendiri, bukan tinjauan oleh pihak lain.')).toBeInTheDocument();
    expect(screen.getByText(/^Tidak ada seorang pun di Allianz Life maupun di platform/)).toBeInTheDocument();
    expect(screen.getByText(/atau kata-kata Allianz Life sendiri\. Setiap baris di bawah menyebutkan yang mana\.$/))
      .toBeInTheDocument();
    expect(await screen.findByText('Agent Anda membaca versi sebelumnya yang disetujui KPM Anda.')).toBeInTheDocument();
    expect(screen.getByText('Halo dari kami.')).toBeInTheDocument();
    expect(screen.getByText('Dikembalikan: Terlalu kuat.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Kembalikan' }));
    expect(screen.getByLabelText('Mengapa Anda mengembalikannya?')).toHaveAccessibleDescription(/^Wajib diisi —/);
    expect(screen.getByRole('button', { name: 'Kembalikan script ini' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Setujui' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 nothing waiting, and no product on the catalog, say so in Indonesian', async () => {
    render([]);
    expect(await screen.findByText('Allianz Life belum punya produk di katalognya.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Script approvals' }));
    expect(await screen.findByText(/^Tidak ada yang menunggu Anda\./)).toBeInTheDocument();
    noEnglishLeft();
  });
});
