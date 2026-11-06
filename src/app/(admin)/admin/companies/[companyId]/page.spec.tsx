import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, renderWithSession, routeParams, stubFetch } from '@test/harness';
import { smallTargets } from '@test/touch-audit';
import {
  ALLIANZ, ALLIANZ_DEFAULT, ARCHIVED, BSD_CITY, DEFAULT_TEMPLATE, LIBRARY, LIBRARY_DEFAULT, PRUDENTIAL, SUPER_ADMIN,
} from '@test/kpm-template-fixtures';
import CompanyPage from './page';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/admin/companies/c1',
}));

const clean = async (root: Element = document.body) =>
  expect((await axe(root, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations ?? [])
    .toHaveLength(0);

function render(templates: unknown = [DEFAULT_TEMPLATE, BSD_CITY, ARCHIVED], extra: Record<string, unknown> = {}) {
  const stub = stubFetch({
    '/admin/companies': { body: [PRUDENTIAL, ALLIANZ, LIBRARY] },
    '/admin/companies/c1/templates': { body: templates },
    '/admin/companies/c2/templates': { body: [ALLIANZ_DEFAULT] },
    '/admin/companies/lib/templates': { body: [LIBRARY_DEFAULT] },
    ...extra as Record<string, { body?: unknown; status?: number }>,
  });
  const view = renderWithSession(<CompanyPage params={routeParams({ companyId: 'c1' })} />, { me: SUPER_ADMIN });
  return { ...view, stub };
}

/**
 * **A company's page, tab *Template KPM*** (ADR-0185 §2; P18.11-T20 AC-1): a card per template, its two tabs, and
 * *New template* with the one *Start from* picker.
 */
describe('P18.11-T20 a company’s KPM templates', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    push.mockReset();
  });

  it('AC-1 names the company, and draws its two tabs, the first current', async () => {
    render();
    expect(await screen.findByRole('heading', { level: 1, name: 'Prudential' })).toBeInTheDocument();
    const tabs = within(screen.getByRole('navigation', { name: 'Company pages' }));
    expect(tabs.getByRole('link', { name: 'KPM template' })).toHaveAttribute('href', '/admin/companies/c1');
    expect(tabs.getByRole('link', { name: 'KPM template' })).toHaveAttribute('aria-current', 'page');
    expect(tabs.getByRole('link', { name: 'Company settings' })).toHaveAttribute('href', '/admin/companies/c1/settings');
    expect(screen.getByRole('link', { name: 'Companies' })).toHaveAttribute('href', '/admin/companies');
  });

  it('AC-1 a card per template: the default marked, offices, sections published, changes waiting, the archived last', async () => {
    render([ARCHIVED, DEFAULT_TEMPLATE, BSD_CITY]);
    const list = within(await screen.findByRole('list', { name: 'Templates' }));
    const cards = list.getAllByRole('link');
    expect(cards.map((c) => c.getAttribute('href'))).toEqual([
      '/admin/companies/c1/templates/t-default', '/admin/companies/c1/templates/t-bsd', '/admin/companies/c1/templates/t-old',
    ]);
    expect(cards[0]).toHaveTextContent('Prudential template');
    expect(within(cards[0]).getByText('Default')).toBeInTheDocument();
    // Seven sections since ADR-0210 (P19.4-T5): Rekrutmen is one.
    // P19.5-T1: eight sections, *Advanced analytics* the eighth.
    // P19.6-T1: nine, *Branding* before it.
    expect(cards[0]).toHaveTextContent('Used by 3 offices · 9/9 sections published');
    expect(cards[0]).not.toHaveTextContent('not published');
    // Two sections wait (Lead pipeline, Events); five of eight are published whole (ratios, checklist and events not;
    // *Advanced analytics*, the eighth since P19.5-T1, is).
    // P19.6-T1: and *Branding*, the ninth, published too.
    expect(cards[1]).toHaveTextContent('Used by 0 offices · 6/9 sections published');
    expect(cards[1]).toHaveTextContent('2 changes not published');
    expect(within(cards[1]).queryByText('Default')).toBeNull();
    expect(within(cards[2]).getByText('Archived')).toBeInTheDocument();
    expect(cards[2]).toHaveTextContent('Used by 1 office');
  });

  it('waits with cards shaped like the cards, then says when there is no template', async () => {
    render([]);
    expect(screen.getByText('Loading the templates…').closest('[role="status"]')).not.toBeNull();
    expect(await screen.findByText(/^This company has no template yet\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New template' })).toBeInTheDocument();
  });

  it('P19.4-T5 AC-5 a new company opens on + Template baru: the empty state carries it, its first becomes the default', async () => {
    render([]);
    expect(await screen.findByText(
      'This company has no template yet. Its first, made empty or copied from any template, becomes its default.',
    )).toBeInTheDocument();
    // The one way on, once: the empty state's action, with no second button under an empty list.
    expect(screen.getAllByRole('button', { name: 'New template' })).toHaveLength(1);
    const button = screen.getByRole('button', { name: 'New template' });
    await userEvent.click(button);
    expect(screen.getByRole('dialog', { name: 'New template' })).toBeInTheDocument();
  });

  it('says a failed read as the API said it, and reads again on Try again', async () => {
    const { stub } = render(undefined, {
      '/admin/companies/c1/templates': [
        { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Company not found.', requestId: 'r-1' } } },
        { body: [DEFAULT_TEMPLATE] },
      ],
    });
    expect(await screen.findByText('Company not found.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('list', { name: 'Templates' })).toBeInTheDocument();
    expect(stub.calls.filter((c) => c.url.endsWith('/admin/companies/c1/templates'))).toHaveLength(2);
  });

  it('the library’s own page is named as the built-in templates, and links its ladder', async () => {
    stubFetch({
      '/admin/companies': { body: [PRUDENTIAL, LIBRARY] },
      '/admin/companies/lib/templates': { body: [LIBRARY_DEFAULT] },
    });
    renderWithSession(<CompanyPage params={routeParams({ companyId: 'lib' })} />, { me: SUPER_ADMIN });
    expect(await screen.findByRole('heading', { level: 1, name: 'AgencyBoost built-in templates' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Role ladder' })).toHaveAttribute('href', '/admin/org-levels');
  });

  describe('New template (ADR-0185 §5; AC-4)', () => {
    it('makes an empty template and opens it', async () => {
      const { stub } = render(undefined, {
        'POST /admin/companies/c1/templates': { status: 201, body: { ...BSD_CITY, id: 't-new', name: 'Jakarta' } },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'New template' }));
      const dialog = within(screen.getByRole('dialog', { name: 'New template' }));
      expect(dialog.getByRole('radio', { name: /^Empty/ })).toBeChecked();
      expect(dialog.queryByText(/AgencyBoost defaults/)).toBeNull();
      await userEvent.type(dialog.getByLabelText('Name'), 'Jakarta');
      await userEvent.click(dialog.getByRole('button', { name: 'Create template' }));

      const sent = stub.calls.find((c) => c.init.method === 'POST');
      expect(JSON.parse(String(sent?.init.body))).toEqual({ name: 'Jakarta', from: 'empty' });
      await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/admin/companies/c1/templates/t-new'));
    });

    it('offers every template the console can read, grouped by whose it is, the built-in ones last', async () => {
      render();
      await userEvent.click(await screen.findByRole('button', { name: 'New template' }));
      const dialog = within(screen.getByRole('dialog', { name: 'New template' }));
      await userEvent.click(dialog.getByRole('radio', { name: /^Copy from/ }));
      const source = await dialog.findByLabelText('Source template');
      const groups = within(source).getAllByRole('group');
      expect(groups.map((g) => g.getAttribute('label'))).toEqual(['Prudential', 'Allianz Life', 'AgencyBoost built-in templates']);
      expect(within(groups[0]).getAllByRole('option').map((o) => o.textContent)).toEqual([
        'Prudential template · Default', 'BSD City settings', 'Old branches (archived)',
      ]);
      expect(within(groups[1]).getAllByRole('option').map((o) => o.textContent)).toEqual(['Allianz Life template · Default']);
      // The built-in default is named *Default template* already: not marked again on another company's page.
      expect(within(groups[2]).getAllByRole('option').map((o) => o.textContent)).toEqual(['Default template']);
      // The default is chosen, and the name follows it until the reader writes their own.
      expect(source).toHaveDisplayValue('Prudential template · Default');
      expect(dialog.getByLabelText('Name')).toHaveValue('Prudential template (copy)');
    });

    it('copies this company’s own as a copy, and another company’s through the import', async () => {
      const { stub } = render(undefined, {
        'POST /admin/companies/c1/templates/import': { status: 201, body: { ...BSD_CITY, id: 't-imp' } },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'New template' }));
      const dialog = within(screen.getByRole('dialog', { name: 'New template' }));
      await userEvent.click(dialog.getByRole('radio', { name: /^Copy from/ }));
      await userEvent.selectOptions(await dialog.findByLabelText('Source template'), 'c2:t-allianz');
      expect(dialog.getByLabelText('Name')).toHaveValue('Allianz Life template (copy)');
      await userEvent.click(dialog.getByRole('button', { name: 'Create template' }));

      const sent = stub.calls.find((c) => c.url.includes('/templates/import'));
      expect(JSON.parse(String(sent?.init.body))).toEqual({
        fromCompanyId: 'c2', templateId: 't-allianz', name: 'Allianz Life template (copy)',
      });
      await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/admin/companies/c1/templates/t-imp'));
    });

    it('says a taken name under Name, keeping the dialog open', async () => {
      render(undefined, {
        'POST /admin/companies/c1/templates': {
          status: 409,
          body: { error: { code: 'TEMPLATE_NAME_TAKEN', message: 'Prudential already has a template named BSD.', requestId: 'r' } },
        },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'New template' }));
      const dialog = within(screen.getByRole('dialog', { name: 'New template' }));
      await userEvent.type(dialog.getByLabelText('Name'), 'BSD');
      await userEvent.click(dialog.getByRole('button', { name: 'Create template' }));
      expect(await dialog.findByText('Prudential already has a template named BSD.')).toBeInTheDocument();
      expect(dialog.getByLabelText('Name')).toHaveAccessibleDescription('Prudential already has a template named BSD.');
      expect(screen.getByRole('dialog', { name: 'New template' })).toBeInTheDocument();
    });

    it('P19.4-T5 AC-4 a role this ladder lacks: asks which role each becomes, then copies with that map', async () => {
      const { stub } = render(undefined, {
        'POST /admin/companies/c1/templates/import': [
          {
            status: 409,
            body: {
              error: {
                code: 'TEMPLATE_RUNG_UNKNOWN', message: 'This company’s ladder has no SBP.', requestId: 'r',
                details: { codes: ['SBP'] },
              },
            },
          },
          { status: 201, body: { ...ALLIANZ_DEFAULT, id: 't-imp', companyId: 'c1', name: 'Dari Manulife' } },
        ],
        '/admin/org-levels': {
          body: [
            { orgLevelId: 'l-1', companyId: 'c1', code: 'AGENT', label: 'Agent', displayOrder: 1, leaderTier: null, status: 'active', archivedAt: null, version: 0 },
            { orgLevelId: 'l-2', companyId: 'c1', code: 'BP', label: 'Business Partner', displayOrder: 2, leaderTier: 'senior', status: 'active', archivedAt: null, version: 0 },
            { orgLevelId: 'l-3', companyId: 'c1', code: 'AB', label: 'AB', displayOrder: 3, leaderTier: 'senior', status: 'archived', archivedAt: null, version: 0 },
          ],
        },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'New template' }));
      const dialog = within(screen.getByRole('dialog', { name: 'New template' }));
      await userEvent.click(dialog.getByRole('radio', { name: /^Copy from/ }));
      await userEvent.selectOptions(await dialog.findByLabelText('Source template'), 'c2:t-allianz');
      await userEvent.click(dialog.getByRole('button', { name: 'Create template' }));

      const map = await dialog.findByRole('group', { name: 'Map the roles' });
      expect(map).toHaveTextContent('This company’s ladder has no SBP.');
      const sbp = await within(map).findByLabelText('SBP becomes');
      // Only the active roles are offered; the archived AB is not.
      await vi.waitFor(() => expect(within(sbp).getAllByRole('option').map((o) => o.textContent))
        .toEqual(['Choose a role', 'Agent (AGENT)', 'Business Partner (BP)']));
      expect(dialog.getByRole('button', { name: 'Create template' })).toBeDisabled();
      await userEvent.selectOptions(sbp, 'BP');
      await userEvent.click(dialog.getByRole('button', { name: 'Create template' }));

      const imports = stub.calls.filter((c) => c.url.includes('/templates/import'));
      expect(JSON.parse(String(imports.at(-1)?.init.body))).toMatchObject({ rungMap: { SBP: 'BP' } });
      await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/admin/companies/c1/templates/t-imp'));
    });

    it('asks for a name before anything is sent', async () => {
      const { stub } = render();
      await userEvent.click(await screen.findByRole('button', { name: 'New template' }));
      const dialog = within(screen.getByRole('dialog', { name: 'New template' }));
      await userEvent.click(dialog.getByRole('button', { name: 'Create template' }));
      expect(await dialog.findByText('Give the template a name.')).toBeInTheDocument();
      expect(stub.calls.some((c) => c.init.method === 'POST')).toBe(false);
    });
  });

  it('has no axe violations: the cards, and New template open on Copy from', async () => {
    const { container } = render();
    await screen.findByRole('list', { name: 'Templates' });
    await clean(container);
    await userEvent.click(screen.getByRole('button', { name: 'New template' }));
    await userEvent.click(screen.getByRole('radio', { name: /^Copy from/ }));
    await screen.findByLabelText('Source template');
    await clean();
  });
});

/**
 * **P19.2-T2 AC-5 — a company's page at 375 and 768** (UI-135: *Template KPM / Pengaturan perusahaan 34px*, *fields and
 * buttons 40px*): measured inside the shared shell's frame (`data-surface="v1"`, P19.2-T1), whose `RouteTabs` are 12px
 * above and below their line (`TAB_TOUCH`) and whose buttons are 44px below 1024px — the tabs, the cards and *Template
 * baru*, and *Template baru*'s dialog.
 */
describe('P19.2-T2 AC-5 a company’s page, its targets (UI-135)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([375, 768])('P19.2-T2 AC-5 at %ipx finds no target under 44px in the page: its tabs, its cards and the way back', async (px) => {
    atWidth(px);
    stubFetch({
      '/admin/companies': { body: [PRUDENTIAL, ALLIANZ, LIBRARY] },
      '/admin/companies/c1/templates': { body: [DEFAULT_TEMPLATE, BSD_CITY, ARCHIVED] },
      '/admin/companies/c2/templates': { body: [ALLIANZ_DEFAULT] },
      '/admin/companies/lib/templates': { body: [LIBRARY_DEFAULT] },
    });
    renderWithSession(
      <div data-surface="v1"><main><CompanyPage params={routeParams({ companyId: 'c1' })} /></main></div>,
      { me: SUPER_ADMIN },
    );
    await screen.findByRole('list', { name: 'Templates' });
    expect(smallTargets(document.querySelector('main')!, px)).toEqual([]);
  });
});

/**
 * **P19.2-T2 AC-4 — *Template baru* below 1024px** (UI-134: *no native select on /admin at 375 or 768*): the source a pill
 * opening the templates, each under whose it is; a role to map a set of choice rows; *Kosong / Salin dari…* 44px. The
 * laptop keeps its selects. What each choice sends is the same.
 */
describe('P19.2-T2 AC-4 Template baru below 1024px (UI-134, UI-135)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const LADDER = {
    body: [
      { orgLevelId: 'l-1', companyId: 'c1', code: 'AGENT', label: 'Agent', displayOrder: 1, leaderTier: null, status: 'active', archivedAt: null, version: 0 },
      { orgLevelId: 'l-2', companyId: 'c1', code: 'BP', label: 'Business Partner', displayOrder: 2, leaderTier: 'senior', status: 'active', archivedAt: null, version: 0 },
      { orgLevelId: 'l-3', companyId: 'c1', code: 'AB', label: 'AB', displayOrder: 3, leaderTier: 'senior', status: 'archived', archivedAt: null, version: 0 },
    ],
  };
  const openCopy = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'New template' }));
    const dialog = screen.getByRole('dialog', { name: 'New template' });
    await userEvent.click(within(dialog).getByRole('radio', { name: /^Copy from/ }));
    return dialog;
  };

  it.each([375, 768])('P19.2-T2 AC-4 at %ipx the source is a pill: the templates under whose they are, and a choice copies it', async (px) => {
    atWidth(px);
    const { stub } = render(undefined, {
      'POST /admin/companies/c1/templates/import': { status: 201, body: { ...BSD_CITY, id: 't-imp' } },
    });
    const dialog = await openCopy();
    const pill = await within(dialog).findByRole('button', { name: 'Source template: Prudential template · Default' });
    expect(document.querySelector('select')).toBeNull();
    await userEvent.click(pill);
    const sheet = await screen.findByRole('dialog', { name: 'Choose source template' });
    const choices = within(sheet).getAllByRole('radio');
    expect(choices.map((r) => document.getElementById(r.getAttribute('aria-labelledby')!)?.textContent)).toEqual([
      'Prudential template · Default', 'BSD City settings', 'Old branches (archived)', 'Allianz Life template · Default',
      'Default template',
    ]);
    // Whose each is, as the select's groups said it.
    expect(within(sheet).getByRole('radio', { name: 'Allianz Life template · Default' })).toHaveAccessibleDescription('Allianz Life');
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Allianz Life template · Default' }));
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Allianz Life template (copy)');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create template' }));
    const sent = stub.calls.find((c) => c.url.includes('/templates/import'));
    expect(JSON.parse(String(sent?.init.body))).toEqual({ fromCompanyId: 'c2', templateId: 't-allianz', name: 'Allianz Life template (copy)' });
  });

  it.each([375, 768])('P19.2-T2 AC-4 at %ipx a role to map is a set of choice rows, the active roles only', async (px) => {
    atWidth(px);
    const { stub } = render(undefined, {
      'POST /admin/companies/c1/templates/import': [
        { status: 409, body: { error: { code: 'TEMPLATE_RUNG_UNKNOWN', message: 'This company’s ladder has no SBP.', requestId: 'r', details: { codes: ['SBP'] } } } },
        { status: 201, body: { ...ALLIANZ_DEFAULT, id: 't-imp', companyId: 'c1', name: 'Dari Manulife' } },
      ],
      '/admin/org-levels': LADDER,
    });
    const dialog = await openCopy();
    await userEvent.click(await within(dialog).findByRole('button', { name: /^Source template:/ }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Choose source template' })).getByRole('radio', { name: 'Allianz Life template · Default' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create template' }));
    const sbp = await within(dialog).findByRole('radiogroup', { name: 'SBP becomes' });
    await vi.waitFor(() => expect(within(sbp).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Agent (AGENT)', 'Business Partner (BP)']));
    expect(document.querySelector('select')).toBeNull();
    // Nothing chosen yet: the first takes the keyboard, and the copy waits.
    expect(within(sbp).getAllByRole('radio')[0]).toHaveAttribute('tabindex', '0');
    expect(within(dialog).getByRole('button', { name: 'Create template' })).toBeDisabled();
    await userEvent.click(within(sbp).getByRole('radio', { name: 'Business Partner (BP)' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create template' }));
    const imports = stub.calls.filter((c) => c.url.includes('/templates/import'));
    expect(JSON.parse(String(imports.at(-1)?.init.body))).toMatchObject({ rungMap: { SBP: 'BP' } });
  });

  it.each([1024, 1280])('P19.2-T2 AC-4 at %ipx keeps the source select, as the ticket allows a laptop', async (px) => {
    atWidth(px);
    render();
    const dialog = await openCopy();
    expect((await within(dialog).findByLabelText('Source template')).tagName).toBe('SELECT');
  });

  it.each([375, 768])('P19.2-T2 AC-5 at %ipx the open dialog has no target under 44px', async (px) => {
    atWidth(px);
    stubFetch({
      '/admin/companies': { body: [PRUDENTIAL, ALLIANZ, LIBRARY] },
      '/admin/companies/c1/templates': { body: [DEFAULT_TEMPLATE, BSD_CITY, ARCHIVED] },
      '/admin/companies/c2/templates': { body: [ALLIANZ_DEFAULT] },
      '/admin/companies/lib/templates': { body: [LIBRARY_DEFAULT] },
    });
    renderWithSession(
      <div data-surface="v1"><main><CompanyPage params={routeParams({ companyId: 'c1' })} /></main></div>,
      { me: SUPER_ADMIN },
    );
    const dialog = await openCopy();
    await within(dialog).findByRole('button', { name: /^Source template:/ });
    expect(smallTargets(dialog, px)).toEqual([]);
  });

  it.each([375, 1280])('P19.2-T2 AC-4 at %ipx has no axe violations, the dialog open on Copy from', async (px) => {
    atWidth(px);
    render();
    const dialog = await openCopy();
    await within(dialog).findByLabelText('Source template');
    await clean();
  });
});
