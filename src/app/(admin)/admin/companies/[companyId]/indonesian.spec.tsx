import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { englishOnly, englishShown } from '@test/english-left';
import { renderInIndonesian, routeParams, stubFetch } from '@test/harness';
import {
  ALLIANZ, ALLIANZ_DEFAULT, ARCHIVED, BSD_CITY, DEFAULT_TEMPLATE, LIBRARY, LIBRARY_DEFAULT, PIPELINE, PRUDENTIAL,
  SUPER_ADMIN, kindView,
} from '@test/kpm-template-fixtures';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';
import CompanyPage from './page';
import CompanySettingsPage from './settings/page';
import TemplatePage from './templates/[templateId]/page';
import SectionPage from './templates/[templateId]/[section]/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/companies/c1',
}));
// The parts their own specs cover, as doubles; what loads on demand since 2026-11-06 (the bundle) — a section's editor,
// the checklist's dialogs — loads as it does in the app.
vi.mock('next/dynamic', async () => {
  const actual = await vi.importActual<typeof import('next/dynamic')>('next/dynamic');
  return {
    default: (load: () => Promise<unknown>, options?: Parameters<typeof actual.default>[1]) => {
      const source = String(load);
      const double = ['products-tab', 'recruitment-playbook-tab', 'analytics-editor'].some((name) => source.includes(name));
      return double ? () => <div data-testid="lazy" /> : actual.default(load as Parameters<typeof actual.default>[0], options);
    },
  };
});

/**
 * **P18.11-T20, the KPM template in ID mode** (ADR-0185 §1): *Template KPM*, *Pengaturan perusahaan*, *Template bawaan
 * AgencyBoost*, the checklist's *Terbit vN · Draf · Kosong* and *Terbitkan semua* — the developer's words for the
 * product owner, the rest the approved glossary's — with the section names an Owner's settings keep (§A.3) and every
 * template and company name as typed. The same pages in English are their own `page.spec.tsx`.
 */
const ENGLISH = englishOnly(adminTemplateMessages);
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);
const clean = async () =>
  expect((await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations ?? [])
    .toHaveLength(0);

const ROUTES = {
  '/admin/companies': { body: [PRUDENTIAL, ALLIANZ, LIBRARY] },
  '/admin/companies/c1/templates': { body: [DEFAULT_TEMPLATE, BSD_CITY, ARCHIVED] },
  '/admin/companies/c2/templates': { body: [ALLIANZ_DEFAULT] },
  '/admin/companies/lib/templates': { body: [LIBRARY_DEFAULT] },
  '/admin/companies/c1/templates/t-bsd/offices': {
    body: [{ id: 'k-0417', code: '0417', branchName: 'BSD City Branch', behind: ['lead_pipeline'], unrecorded: [] }],
  },
};

describe('P18.11-T20 the KPM template in Indonesian', () => {
  beforeEach(() => window.history.replaceState(null, '', '/'));
  afterEach(() => vi.unstubAllGlobals());

  it('reads the English it is looking for, so a silent zero cannot pass', () => {
    expect(ENGLISH).toEqual(expect.arrayContaining(['KPM template', 'Company settings', 'Publish all changes?']));
  });

  it('the company page: Template KPM and Pengaturan perusahaan, each card in Indonesian, Template baru', async () => {
    stubFetch(ROUTES);
    renderInIndonesian(<CompanyPage params={routeParams({ companyId: 'c1' })} />, { me: SUPER_ADMIN });
    const list = within(await screen.findByRole('list', { name: 'Daftar template' }));
    const tabs = within(screen.getByRole('navigation', { name: 'Halaman perusahaan' }));
    expect(tabs.getAllByRole('link').map((l) => l.textContent)).toEqual(['Template KPM', 'Pengaturan perusahaan']);
    const cards = list.getAllByRole('link');
    expect(cards[0]).toHaveTextContent('Prudential template');
    // P19.5-T1: eight sections, *Advanced analytics* the eighth.
    // P19.6-T1: nine, *Tampilan* before it.
    expect(cards[0]).toHaveTextContent('Dipakai 3 KPM · 9/9 bagian terbit');
    expect(cards[1]).toHaveTextContent('2 perubahan belum terbit');
    expect(within(cards[2]).getByText('Diarsipkan')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Perusahaan' })).toHaveAttribute('href', '/admin/companies');

    await userEvent.click(screen.getByRole('button', { name: 'Template baru' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Template baru' }));
    expect(dialog.getByRole('radio', { name: /^Kosong/ })).toBeChecked();
    await userEvent.click(dialog.getByRole('radio', { name: /^Salin dari…/ }));
    const source = await dialog.findByLabelText('Template sumber');
    expect(within(source).getAllByRole('group').map((g) => g.getAttribute('label')))
      .toEqual(['Prudential', 'Allianz Life', 'Template bawaan AgencyBoost']);
    expect(dialog.getByLabelText('Nama')).toHaveValue('Prudential template (salinan)');
    expect(dialog.getByRole('button', { name: 'Buat template' })).toBeInTheDocument();
    noEnglishLeft();
    await clean();
  });

  it('a template’s checklist: each state, Terbitkan semua asked, the offices on an older version', async () => {
    stubFetch(ROUTES);
    renderInIndonesian(<TemplatePage params={routeParams({ companyId: 'c1', templateId: 't-bsd' })} />, { me: SUPER_ADMIN });
    const rows = within(await screen.findByRole('list', { name: 'Bagian template' })).getAllByRole('link');
    expect(rows.map((r) => within(r).getAllByText(/./)[0].textContent)).toEqual([
      'Aktivitas & rasio', 'Pipeline lead', 'Checklist aktivasi', 'Training', 'Capability Mapping', 'Events', 'Rekrutmen',
      // P19.6-T1 (ADR-0218 §3): *Tampilan*, before the last.
      'Tampilan', 'Advanced analytics',
    ]);
    expect(within(rows[0]).getByText('Sebagian terbit')).toBeInTheDocument();
    expect(rows[0]).toHaveTextContent('Aktivitas v1 · Rasio kosong');
    expect(within(rows[1]).getByText('Draf')).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent('v1 terbit');
    expect(within(rows[2]).getByText('Kosong')).toBeInTheDocument();
    expect(within(rows[3]).getByText('Terbit v1')).toBeInTheDocument();
    expect(rows[5]).toHaveTextContent('belum pernah terbit');
    expect(screen.getByText('2 bagian berubah')).toBeInTheDocument();
    expect(screen.getByText('Dipakai 0 KPM')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Terbitkan semua (2)' }));
    // The dialog loads on the first tap (the bundle, 2026-11-06).
    const dialog = within(await screen.findByRole('dialog', { name: 'Terbitkan semua perubahan?' }));
    expect(dialog.getByText('Bagian berikut akan diterbitkan:')).toBeInTheDocument();
    // *Amended 2026-11-05 (P19.4-T1, ADR-0208 §4):* existing KPMs are asked about after the publish.
    expect(dialog.getByText('Setelah itu, Anda memilih apakah KPM yang sudah ada ikut memakainya.')).toBeInTheDocument();
    noEnglishLeft();
    await clean();
    await userEvent.click(dialog.getByRole('button', { name: 'Batal' }));

    // *Amended 2026-11-05 (P19.4-T1 AC-6, ADR-0208 §4):* the count opens the push, no longer an information-only list.
    await userEvent.click(screen.getByRole('button', { name: '1 KPM memakai versi lama' }));
    const offices = within(screen.getByRole('dialog', { name: 'Terapkan juga ke KPM yang sudah ada?' }));
    expect(await offices.findByText('KPM 0417 · BSD City Branch')).toBeInTheDocument();
    expect(offices.getByText('Belum diubah KPM')).toBeInTheDocument();
    noEnglishLeft();
    await userEvent.click(offices.getByRole('button', { name: 'Tidak sekarang' }));

    await userEvent.click(screen.getByRole('button', { name: 'Aksi untuk BSD City settings' }));
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent?.split(/(?=Template)/)[0]))
      .toEqual(['Jadikan default', 'Ganti nama', 'Duplikat', 'Arsipkan']);
    noEnglishLeft();
  });

  it('a section: its pills kept, its save state and the draft’s words in Indonesian, Terbitkan', async () => {
    stubFetch({
      ...ROUTES,
      '/admin/companies/c1/template/lead_pipeline': {
        body: kindView('lead_pipeline', PIPELINE, { status: 'draft', version: 2, publishedVersion: 1, templateId: 't-bsd' }),
      },
    });
    renderInIndonesian(
      <SectionPage params={routeParams({ companyId: 'c1', templateId: 't-bsd', section: 'leads' })} />,
      { me: SUPER_ADMIN },
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Pipeline lead' })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Bagian Pipeline lead' })).getAllByRole('link').map((l) => l.textContent))
      .toEqual(['Sales', 'Recruitment']);
    expect(await screen.findByText('Draf v2 · v1 terbit')).toBeInTheDocument();
    expect(document.querySelector('[data-state]')).toHaveTextContent('Tersimpan ✓');
    expect(screen.getByRole('button', { name: 'Terbitkan' })).toBeEnabled();
    noEnglishLeft();
    await clean();
  });

  it('Pengaturan perusahaan: the one line, Produk · Campaign (P19.4-T5: Rekrutmen is a template section)', async () => {
    stubFetch(ROUTES);
    renderInIndonesian(<CompanySettingsPage params={routeParams({ companyId: 'c1' })} />, { me: SUPER_ADMIN });
    expect(await screen.findByText('Berlaku langsung untuk semua KPM perusahaan ini.')).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Pengaturan perusahaan' })).getAllByRole('link').map((l) => l.textContent))
      .toEqual(['Produk', 'Campaign']);
    noEnglishLeft();
    await clean();
  });
});
