import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { renderWithSession, routeParams, stubFetch } from '@test/harness';
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
 * **A company's page, tab *Template KPM*** (ADR-0185 §2; P18.99-T20 AC-1): a card per template, its two tabs, and
 * *New template* with the one *Start from* picker.
 */
describe('P18.99-T20 a company’s KPM templates', () => {
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
    expect(cards[0]).toHaveTextContent('Used by 3 offices · 6/6 sections published');
    expect(cards[0]).not.toHaveTextContent('not published');
    // Two sections wait (Lead pipeline, Events); three of six are published whole (ratios, checklist and events not).
    expect(cards[1]).toHaveTextContent('Used by 0 offices · 3/6 sections published');
    expect(cards[1]).toHaveTextContent('2 changes not published');
    expect(within(cards[1]).queryByText('Default')).toBeNull();
    expect(within(cards[2]).getByText('Archived')).toBeInTheDocument();
    expect(cards[2]).toHaveTextContent('Used by 1 office');
  });

  it('waits with cards shaped like the cards, then says when there is no template', async () => {
    render([]);
    expect(screen.getByText('Loading the templates…').closest('[role="status"]')).not.toBeNull();
    expect(await screen.findByText('This company has no template yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New template' })).toBeInTheDocument();
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

    it('says a taken name under Name, and a role this ladder lacks in the banner, keeping the dialog open', async () => {
      render(undefined, {
        'POST /admin/companies/c1/templates': {
          status: 409,
          body: { error: { code: 'TEMPLATE_NAME_TAKEN', message: 'Prudential already has a template named BSD.', requestId: 'r' } },
        },
        'POST /admin/companies/c1/templates/import': {
          status: 409,
          body: { error: { code: 'TEMPLATE_RUNG_UNKNOWN', message: 'This company’s ladder has no SM.', requestId: 'r' } },
        },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'New template' }));
      const dialog = within(screen.getByRole('dialog', { name: 'New template' }));
      await userEvent.type(dialog.getByLabelText('Name'), 'BSD');
      await userEvent.click(dialog.getByRole('button', { name: 'Create template' }));
      expect(await dialog.findByText('Prudential already has a template named BSD.')).toBeInTheDocument();
      expect(dialog.getByLabelText('Name')).toHaveAccessibleDescription('Prudential already has a template named BSD.');

      await userEvent.click(dialog.getByRole('radio', { name: /^Copy from/ }));
      await userEvent.selectOptions(await dialog.findByLabelText('Source template'), 'lib:t-lib');
      await userEvent.click(dialog.getByRole('button', { name: 'Create template' }));
      expect(await dialog.findByText('This company’s ladder has no SM.')).toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'New template' })).toBeInTheDocument();
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
