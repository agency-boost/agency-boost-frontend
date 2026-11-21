import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { ALLIANZ, LIBRARY, PRUDENTIAL, SUPER_ADMIN } from '@test/kpm-template-fixtures';
import CompaniesPage from './page';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/admin/companies',
}));

const OVERVIEW = {
  companies: [
    { companyId: 'c1', name: 'Prudential', initials: 'PR', kpmCount: 7, memberCount: 65, ladder: ['Agent', 'AAB', 'AB'] },
    { companyId: 'c2', name: 'Allianz Life', initials: 'AL', kpmCount: 0, memberCount: 0, ladder: ['Agent', 'Unit Manager', 'AB'] },
  ],
};
const RUNGS = ['Agent', 'AAB', 'AB'].map((label, i) => ({
  orgLevelId: `r${i}`, companyId: 'lib', code: label.toUpperCase(), label, displayOrder: i + 1, leaderTier: null,
  status: 'active', archivedAt: null, version: 0,
}));

function routes(extra: Record<string, unknown> = {}) {
  return stubFetch({
    '/admin/companies': { body: [PRUDENTIAL, ALLIANZ, LIBRARY] },
    '/admin/overview': { body: OVERVIEW },
    '/admin/org-levels': { body: RUNGS },
    '/admin/companies/c1/publication?summary=true': { body: { companyId: 'c1', changes: 2, templateEmpty: false, kpms: 7 } },
    '/admin/companies/c2/publication?summary=true': { body: { companyId: 'c2', changes: 0, templateEmpty: true, kpms: 0 } },
    '/product-data/intakes': { body: { aiReading: false, intakes: [] } },
    ...extra,
  } as never);
}

const card = async (id: string) => (await screen.findAllByRole('article')).find((a) => a.dataset.companyCard === id)!;

/**
 * **P19.23-T4 AC-1 — *Perusahaan & template*** (ADR-0278 §2, §3; frames 27–28): the Default template first, then a card
 * per company with its ladder, KPMs, members and template line; *Perusahaan baru* from the Default template or a copy.
 */
describe('P19.23-T4 AC-1 the companies page', () => {
  afterEach(() => { vi.unstubAllGlobals(); push.mockReset(); });

  it('P19.23-T4 AC-1 draws the Default template first, then each company with its ladder, counts and template line', async () => {
    atWidth(1024);
    routes();
    renderInIndonesian(<CompaniesPage />, { me: SUPER_ADMIN });
    const cards = await screen.findAllByRole('article');
    expect(cards.map((c) => c.dataset.companyCard)).toEqual(['library', 'c2', 'c1']);
    const library = await card('library');
    expect(within(library).getByText('Dasar untuk setiap perusahaan baru')).toBeInTheDocument();
    expect(await within(library).findByText('Agent → AAB → AB')).toBeInTheDocument();
    expect(within(library).getByRole('link', { name: /Ubah default template/ })).toHaveAttribute('href', '/admin/companies/lib');

    const prudential = await card('c1');
    expect(within(prudential).getByText('Agent → AAB → AB')).toBeInTheDocument();
    expect(within(prudential).getByText('7 KPM')).toBeInTheDocument();
    expect(within(prudential).getByText('65 anggota')).toBeInTheDocument();
    expect(await within(prudential).findByText('2 perubahan belum diterbitkan')).toBeInTheDocument();
    expect(within(prudential).getByRole('link', { name: /Buka template/ })).toHaveAttribute('href', '/admin/companies/c1');
    expect(await within(await card('c2')).findByText('Template masih kosong')).toBeInTheDocument();
  });

  it('P19.23-T4 AC-1 makes a company from the Default template, its slug from the name, and opens it', async () => {
    atWidth(1280);
    const sent: unknown[] = [];
    routes({
      'POST /admin/companies/setup': ({ body }: { body: unknown }) => { sent.push(body); return { status: 201, body: { ...PRUDENTIAL, _id: 'c9', templateId: 't9' } }; },
    });
    renderInIndonesian(<CompaniesPage />, { me: SUPER_ADMIN });
    await userEvent.click(await screen.findByRole('button', { name: /Perusahaan baru/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Perusahaan baru' });
    // The Default template is chosen first; nothing is sent while the name is empty.
    expect(within(dialog).getByRole('radio', { name: /Default template · disarankan/ })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: /Buat perusahaan/ }));
    expect(within(dialog).getByText('Wajib diisi.')).toBeInTheDocument();
    expect(sent).toEqual([]);

    await userEvent.type(within(dialog).getByLabelText('Nama perusahaan'), 'AIA Financial');
    await userEvent.click(screen.getByRole('button', { name: /Buat perusahaan/ }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/admin/companies/c9'));
    expect(sent).toEqual([{ name: 'AIA Financial', slug: 'aia-financial', from: 'default' }]);
  });

  it('P19.23-T4 AC-1 copies another company, and says a taken slug on the name', async () => {
    atWidth(375);
    const sent: unknown[] = [];
    routes({
      'POST /admin/companies/setup': ({ body }: { body: unknown }) => {
        sent.push(body);
        return { status: 409, body: { error: { code: 'COMPANY_SLUG_TAKEN', message: 'Slug ini sudah dipakai Prudential.' } } };
      },
    });
    renderInIndonesian(<CompaniesPage />, { me: SUPER_ADMIN });
    await userEvent.click(await screen.findByRole('button', { name: /Perusahaan baru/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Perusahaan baru' });
    await userEvent.type(within(dialog).getByLabelText('Nama perusahaan'), 'Prudential');
    await userEvent.click(within(dialog).getByRole('radio', { name: /Salin dari perusahaan lain/ }));
    await userEvent.click(screen.getByRole('button', { name: /Buat perusahaan/ }));
    expect(within(dialog).getByText('Wajib diisi.')).toBeInTheDocument();
    await userEvent.selectOptions(within(dialog).getByLabelText('Perusahaan yang disalin'), 'c2');
    await userEvent.click(screen.getByRole('button', { name: /Buat perusahaan/ }));
    expect(await within(dialog).findByText('Slug ini sudah dipakai Prudential.')).toBeInTheDocument();
    expect(sent).toEqual([{ name: 'Prudential', slug: 'prudential', from: 'company', fromCompanyId: 'c2' }]);
    expect(push).not.toHaveBeenCalled();
  });

  it('P19.23-T4 AC-1 keeps ⋯ Ubah and Tangguhkan on a company’s card', async () => {
    atWidth(1024);
    routes();
    renderInIndonesian(<CompaniesPage />, { me: SUPER_ADMIN });
    await userEvent.click(within(await card('c1')).getByRole('button', { name: /Prudential/ }));
    expect(screen.getByRole('menuitem', { name: /Ubah/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Tangguhkan/ })).toBeInTheDocument();
  });

  it('P19.23-T4 AC-1 says a list it could not read, with Try again', async () => {
    stubFetch({ '/admin/companies': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Down' } } }, '/admin/overview': { body: OVERVIEW }, '/product-data/intakes': { body: { aiReading: false, intakes: [] } } });
    renderWithSession(<CompaniesPage />, { me: SUPER_ADMIN });
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('P19.23-T4 AC-1 passes axe with its cards and with the dialog open', async () => {
    atWidth(1280);
    routes();
    renderInIndonesian(<CompaniesPage />, { me: SUPER_ADMIN });
    await screen.findByText('2 perubahan belum diterbitkan');
    const rules = { 'color-contrast': { enabled: false }, region: { enabled: false } };
    expect((await axe(document.body, { rules })).violations ?? []).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: /Perusahaan baru/ }));
    await screen.findByRole('dialog', { name: 'Perusahaan baru' });
    expect((await axe(document.body, { rules })).violations ?? []).toHaveLength(0);
  });
});
