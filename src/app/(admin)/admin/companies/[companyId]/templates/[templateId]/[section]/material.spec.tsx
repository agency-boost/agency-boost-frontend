import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { renderWithSession, routeParams, stubFetch, type StubReply } from '@test/harness';
import {
  ARCHIVED, BSD_CITY, DEFAULT_TEMPLATE, PRUDENTIAL, SUPER_ADMIN, kindView,
} from '@test/kpm-template-fixtures';
import SectionPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/companies/c1/templates/t-default/training',
}));

const clean = async () =>
  expect((await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations ?? [])
    .toHaveLength(0);

/** The template's training: one category, one skill, two modules — the first with a link of the template's. */
const TRAINING = {
  categories: [{ code: 'SALES', label: 'Sales' }],
  skills: [{ code: 'PROSPECTING', categoryCode: 'SALES', label: 'Prospecting' }],
  modules: [
    {
      code: 'PROSPECT_LIST', skillCode: 'PROSPECTING', title: 'Daftar prospek', publishState: 'published',
      content: { links: [{ id: 'l1', label: 'Bacaan', url: 'https://example.com/' }] },
    },
    { code: 'REFERRALS', skillCode: 'PROSPECTING', title: 'Referensi', publishState: 'published' },
  ],
};

function render(routes: Record<string, StubReply | StubReply[]> = {}) {
  const stub = stubFetch({
    '/admin/companies': { body: [PRUDENTIAL] },
    '/admin/companies/c1/templates': { body: [DEFAULT_TEMPLATE, BSD_CITY, ARCHIVED] },
    '/admin/companies/c1/template/training_taxonomy': { body: kindView('training_taxonomy', TRAINING, { revision: 3 }) },
    ...routes,
  });
  renderWithSession(
    <SectionPage params={routeParams({ companyId: 'c1', templateId: 't-default', section: 'training' })} />,
    { me: SUPER_ADMIN },
  );
  return stub;
}

/**
 * **The template's *Training* section with its material** (P19.4-T1 AC-1, AC-5; ADR-0208 §1), and the question after a
 * section's *Terbitkan* (AC-6, §4).
 */
describe('P19.4-T1 the template’s Training section', () => {
  beforeEach(() => window.history.replaceState(null, '', '/#modules'));
  afterEach(() => vi.unstubAllGlobals());

  it('P19.4-T1 AC-5 says how many of the section’s modules have material', async () => {
    render();
    expect(await screen.findByText('1 / 2 modules have material')).toBeInTheDocument();
  });

  it('P19.4-T1 AC-1 opens a module’s material from its row, and takes the draft the save answers', async () => {
    const saved = kindView('training_taxonomy', {
      ...TRAINING,
      modules: TRAINING.modules.map((m) => (m.code === 'REFERRALS'
        ? { ...m, content: { links: [{ id: 'l2', label: 'Panduan', url: 'https://example.com/p' }] } } : m)),
    }, { status: 'draft', version: 2, revision: 4 });
    const stub = render({ 'PUT /admin/companies/c1/templates/t-default/training/modules/REFERRALS/content': { body: saved } });
    await userEvent.click(await screen.findByRole('button', { name: 'Material for Daftar prospek' }));
    expect(screen.getByRole('button', { name: 'Material for Daftar prospek' })).toHaveTextContent('Material (1)');
    const first = within(screen.getByRole('dialog', { name: 'Material: Daftar prospek' }));
    expect(first.getByText('Bacaan')).toBeInTheDocument();
    await clean();
    await userEvent.click(first.getByRole('button', { name: 'Cancel' }));

    await userEvent.click(screen.getByRole('button', { name: 'Material for Referensi' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Material: Referensi' }));
    await userEvent.type(dialog.getByLabelText('Link name'), 'Panduan');
    await userEvent.type(dialog.getByLabelText('Address'), 'https://example.com/p');
    await userEvent.click(dialog.getByRole('button', { name: 'Add link' }));
    await userEvent.click(dialog.getByRole('button', { name: 'Save material' }));

    const put = stub.calls.find((c) => c.init.method === 'PUT' && c.url.includes('/training/modules/'))!;
    expect(JSON.parse(String(put.init.body))).toMatchObject({ expectedRevision: 3, links: [{ label: 'Panduan' }] });
    // The draft the answer carries is the section's now: both modules count.
    expect(await screen.findByText('2 / 2 modules have material')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('P19.4-T1 AC-6 after a section’s Terbitkan, asks whether the offices made from the template take it too', async () => {
    const stub = render({
      '/admin/companies/c1/template/training_taxonomy': {
        body: kindView('training_taxonomy', TRAINING, { status: 'draft', version: 2, publishedVersion: 1, revision: 3 }),
      },
      'POST /admin/companies/c1/template/training_taxonomy/publish': {
        body: kindView('training_taxonomy', TRAINING, { version: 2, publishedVersion: 2 }),
      },
      '/admin/companies/c1/templates/t-default/offices?kind=': {
        body: [{
          id: 'k-0417', code: '0417', branchName: 'BSD', behind: ['training_taxonomy'], unrecorded: [], state: 'unchanged',
          kinds: [{ kind: 'training_taxonomy', state: 'unchanged', givenVersion: 1, newestVersion: 2, differences: [] }],
        }],
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Apply to existing offices too?' }));
    expect(await dialog.findByRole('checkbox', { name: /KPM 0417/ })).toBeChecked();
    expect(stub.calls.some((c) => c.url.includes('/offices?kind=training_taxonomy'))).toBe(true);
    await userEvent.click(dialog.getByRole('button', { name: 'Not now' }));
    expect(stub.calls.some((c) => c.url.endsWith('/apply'))).toBe(false);
  });
});
