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
vi.mock('next/dynamic', () => ({ default: () => () => <div data-testid="lazy" /> }));

/**
 * **P18.99-T20, the KPM template in ID mode** (ADR-0185 §1): *Template KPM*, *Pengaturan perusahaan*, *Template bawaan
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

describe('P18.99-T20 the KPM template in Indonesian', () => {
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
    expect(cards[0]).toHaveTextContent('Dipakai 3 KPM · 6/6 bagian terbit');
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
      'Aktivitas & rasio', 'Pipeline lead', 'Checklist aktivasi', 'Training', 'Capability Mapping', 'Events',
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
    const dialog = within(screen.getByRole('dialog', { name: 'Terbitkan semua perubahan?' }));
    expect(dialog.getByText('Bagian berikut akan diterbitkan:')).toBeInTheDocument();
    expect(dialog.getByText('KPM yang sudah ada tidak berubah; hanya KPM baru yang memakai versi ini.')).toBeInTheDocument();
    noEnglishLeft();
    await clean();
    await userEvent.click(dialog.getByRole('button', { name: 'Batal' }));

    await userEvent.click(screen.getByRole('button', { name: '1 KPM memakai versi lama' }));
    const offices = within(screen.getByRole('dialog', { name: 'KPM yang memakai versi lama' }));
    expect(offices.getByRole('link', { name: 'KPM 0417 · BSD City Branch' })).toBeInTheDocument();
    expect(offices.getByText('Versi lama: Pipeline lead')).toBeInTheDocument();
    await userEvent.click(offices.getByRole('button', { name: 'Tutup' }));

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

  it('Pengaturan perusahaan: the one line, Produk · Campaign · Rekrutmen', async () => {
    stubFetch(ROUTES);
    renderInIndonesian(<CompanySettingsPage params={routeParams({ companyId: 'c1' })} />, { me: SUPER_ADMIN });
    expect(await screen.findByText('Berlaku langsung untuk semua KPM perusahaan ini.')).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Pengaturan perusahaan' })).getAllByRole('link').map((l) => l.textContent))
      .toEqual(['Produk', 'Campaign', 'Rekrutmen']);
    noEnglishLeft();
    await clean();
  });
});
