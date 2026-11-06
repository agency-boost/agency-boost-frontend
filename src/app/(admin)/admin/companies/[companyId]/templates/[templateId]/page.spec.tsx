import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { renderWithSession, routeParams, stubFetch, type StubReply } from '@test/harness';
import {
  ALLIANZ, ARCHIVED, BSD_CITY, DEFAULT_TEMPLATE, LIBRARY, PRUDENTIAL, SUPER_ADMIN, namedTemplate, sections,
} from '@test/kpm-template-fixtures';
import TemplatePage from './page';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/admin/companies/c1/templates/t-bsd',
}));

const clean = async () =>
  expect((await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations ?? [])
    .toHaveLength(0);

const OFFICES = [
  { id: 'k-0417', code: '0417', branchName: 'BSD City Branch', behind: ['activity_taxonomy', 'lead_pipeline'], unrecorded: [] },
  { id: 'k-0418', code: '0418', branchName: 'Serpong Branch', behind: [], unrecorded: ['event_types'] },
  { id: 'k-0419', code: '0419', branchName: 'Tangerang Branch', behind: [], unrecorded: [] },
];

function render(templateId = 't-bsd', extra: Record<string, StubReply | StubReply[]> = {}) {
  const stub = stubFetch({
    '/admin/companies': { body: [PRUDENTIAL, ALLIANZ, LIBRARY] },
    '/admin/companies/c1/templates': { body: [DEFAULT_TEMPLATE, BSD_CITY, ARCHIVED] },
    [`/admin/companies/c1/templates/${templateId}/offices`]: { body: OFFICES },
    ...extra,
  });
  const view = renderWithSession(
    <TemplatePage params={routeParams({ companyId: 'c1', templateId })} />,
    { me: SUPER_ADMIN },
  );
  return { ...view, stub };
}

const rows = async () => within(await screen.findByRole('list', { name: 'Template sections' })).getAllByRole('link');

/**
 * **A template as a checklist of its sections** (ADR-0185 §3–§4; P18.11-T20 AC-2): each section's state, *Publish all*
 * and what it did, the offices on an older version, and the template's ⋮.
 */
describe('P18.11-T20 a template’s checklist', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    push.mockReset();
  });

  it('AC-2, P19.4-T5 AC-6, P19.5-T1 AC-1 lists the eight sections in the Owner’s order, Rekrutmen then Advanced analytics last', async () => {
    render();
    const list = await rows();
    expect(list.map((r) => r.getAttribute('href'))).toEqual([
      'activity', 'leads', 'activation', 'training', 'capability', 'events', 'recruitment', 'branding', 'analytics',
    ].map((s) => `/admin/companies/c1/templates/t-bsd/${s}`));
    expect(list[6]).toHaveTextContent('Recruitment');
    // P19.6-T1 (ADR-0218 §3): *Branding*, before the last.
    expect(list[7]).toHaveTextContent('Branding');
    expect(list[8]).toHaveTextContent('Advanced analytics');
    // Two kinds, one empty: partly published, each named.
    expect(list[0]).toHaveTextContent('Activities & ratios');
    expect(within(list[0]).getByText('Partly published')).toHaveAttribute('data-tone', 'blue');
    expect(list[0]).toHaveTextContent('Activities v1 · Ratios empty');
    // A draft over a published version, and one never published.
    expect(within(list[1]).getByText('Draft')).toHaveAttribute('data-tone', 'amber');
    expect(list[1]).toHaveTextContent('Lead pipeline');
    expect(list[1]).toHaveTextContent('v1 published');
    expect(within(list[2]).getByText('Empty')).toHaveAttribute('data-tone', 'grey');
    expect(within(list[3]).getByText('Published v1')).toHaveAttribute('data-tone', 'green');
    expect(list[5]).toHaveTextContent('never published');
  });

  it('a two-kind section published whole says each kind’s version', async () => {
    render('t-default');
    const list = await rows();
    expect(within(list[0]).getByText('Published')).toBeInTheDocument();
    expect(list[0]).toHaveTextContent('Activities v3 · Ratios v1');
    expect(screen.getByText('Every change is published.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish all (0)' })).toBeDisabled();
  });

  it('names the template, marks the default, counts its offices, and leads back to the company', async () => {
    render('t-default');
    expect(await screen.findByRole('heading', { level: 1, name: 'Prudential template' })).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByText('Used by 3 offices')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Prudential' })).toHaveAttribute('href', '/admin/companies/c1');
  });

  describe('Publish all (AC-2)', () => {
    it('says how many sections changed, asks naming them and what publishing does not do, then publishes', async () => {
      const after = namedTemplate({
        ...BSD_CITY,
        sections: sections({ publishedVersion: 1, hasDraft: false }, {
          lead_pipeline: { publishedVersion: 2, hasDraft: false },
          event_types: { publishedVersion: null, hasDraft: true },
          activation_checklist: { publishedVersion: null, hasDraft: false },
          ratio_set: { publishedVersion: null, hasDraft: false },
        }),
      });
      const { stub } = render('t-bsd', {
        'POST /admin/companies/c1/templates/t-bsd/publish': {
          body: {
            template: after,
            results: [
              { kind: 'activity_taxonomy', outcome: 'skipped', reason: 'no_changes' },
              { kind: 'ratio_set', outcome: 'skipped', reason: 'no_changes' },
              { kind: 'lead_pipeline', outcome: 'published', version: 2 },
              { kind: 'training_taxonomy', outcome: 'skipped', reason: 'no_changes' },
              { kind: 'activation_checklist', outcome: 'skipped', reason: 'no_changes' },
              { kind: 'capability_ladder', outcome: 'skipped', reason: 'no_changes' },
              {
                kind: 'event_types', outcome: 'refused',
                error: { code: 'VALIDATION_FAILED', message: 'Add at least one event type before publishing.' },
              },
            ],
          },
        },
      });
      expect(await screen.findByText('2 sections changed')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Publish all (2)' }));

      const dialog = within(screen.getByRole('dialog', { name: 'Publish all changes?' }));
      expect(dialog.getByText('These sections will be published:')).toBeInTheDocument();
      expect(dialog.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Lead pipeline', 'Events']);
      // *Amended 2026-11-05 (P19.4-T1, ADR-0208 §4):* existing offices may take it, asked after the publish.
      expect(dialog.getByText('Afterwards you choose whether the offices that already exist take it too.'))
        .toBeInTheDocument();
      expect(stub.calls.some((c) => c.init.method === 'POST')).toBe(false);
      await userEvent.click(dialog.getByRole('button', { name: 'Publish all' }));

      expect(await screen.findByText('Published: Lead pipeline.')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Events was not published: Add at least one event type before publishing.');
      // The refused section is still a draft; the published one says its new version.
      const list = await rows();
      expect(within(list[1]).getByText('Published v2')).toBeInTheDocument();
      expect(within(list[5]).getByText('Draft')).toBeInTheDocument();
      expect(screen.getByText('1 section changed')).toBeInTheDocument();
      // The offices are read again: what is behind may have changed.
      expect(stub.calls.filter((c) => c.url.endsWith('/t-bsd/offices'))).toHaveLength(2);
    });

    it('Cancel publishes nothing', async () => {
      const { stub } = render();
      await userEvent.click(await screen.findByRole('button', { name: 'Publish all (2)' }));
      await userEvent.click(within(screen.getByRole('dialog', { name: 'Publish all changes?' })).getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(stub.calls.some((c) => c.init.method === 'POST')).toBe(false);
    });

    it('says a refusal of the whole as the API said it', async () => {
      render('t-bsd', {
        'POST /admin/companies/c1/templates/t-bsd/publish': {
          status: 403, body: { error: { code: 'PERM_DENIED', message: 'You do not have permission to do that.', requestId: 'r' } },
        },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Publish all (2)' }));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish all' }));
      expect(await screen.findByText('You do not have permission to do that.')).toBeInTheDocument();
    });
  });

  /*
   * *Amended 2026-11-05 (P19.4-T1 AC-6, ADR-0208 §4):* the offices on an older version were information only (ADR-0185
   * §4). The count now opens *Terapkan juga ke KPM yang sudah ada?*, where the newest version can be pushed.
   */
  it('P19.4-T1 AC-6 says how many offices are on an older version, and opens the push for them', async () => {
    render('t-bsd', {
      '/admin/companies/c1/templates/t-bsd/offices?kind=': { body: OFFICES.map((o) => ({ ...o, state: 'unchanged', kinds: [] })) },
    });
    await userEvent.click(await screen.findByRole('button', { name: '1 office is on an older version' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Apply to existing offices too?' }));
    expect(await dialog.findByText('KPM 0417 · BSD City Branch')).toBeInTheDocument();
    await userEvent.click(dialog.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('draws no offices line when none is behind, or when they could not be read', async () => {
    render('t-default', { '/admin/companies/c1/templates/t-default/offices': { status: 500, body: {} } });
    await rows();
    expect(screen.queryByText(/older version/)).toBeNull();
  });

  describe('the ⋮ (ADR-0185 §3)', () => {
    it('makes it the default after asking, the others no longer the default', async () => {
      const { stub } = render('t-bsd', {
        'PATCH /admin/companies/c1/templates/t-bsd': { body: { ...BSD_CITY, isDefault: true } },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Actions for BSD City settings' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Make default' }));
      expect(screen.getByRole('dialog')).toHaveTextContent('Make BSD City settings the default?');
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Make default' }));
      const sent = stub.calls.find((c) => c.init.method === 'PATCH');
      expect(JSON.parse(String(sent?.init.body))).toEqual({ isDefault: true });
      expect(await screen.findByText('Default')).toBeInTheDocument();
    });

    it('holds Make default and Archive on the default, saying why', async () => {
      render('t-default');
      await userEvent.click(await screen.findByRole('button', { name: 'Actions for Prudential template' }));
      expect(screen.getByRole('menuitem', { name: 'Make default' })).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('menuitem', { name: 'Archive' })).toHaveAccessibleDescription(
        'The default cannot be archived. Make another template the default first.',
      );
    });

    it('renames, refusing a taken name under the field', async () => {
      render('t-bsd', {
        'PATCH /admin/companies/c1/templates/t-bsd': [
          { status: 409, body: { error: { code: 'TEMPLATE_NAME_TAKEN', message: 'That name is taken.', requestId: 'r' } } },
          { body: { ...BSD_CITY, name: 'BSD settings' } },
        ],
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Actions for BSD City settings' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
      const dialog = within(screen.getByRole('dialog', { name: 'Rename template' }));
      const name = dialog.getByLabelText('Name');
      await userEvent.clear(name);
      await userEvent.type(name, 'BSD settings');
      await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
      expect(await dialog.findByText('That name is taken.')).toBeInTheDocument();
      await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
      expect(await screen.findByRole('heading', { level: 1, name: 'BSD settings' })).toBeInTheDocument();
    });

    it('Duplicate opens New template copying this one, and opens the copy', async () => {
      const { stub } = render('t-bsd', {
        '/admin/companies/c2/templates': { body: [] },
        '/admin/companies/lib/templates': { body: [] },
        'POST /admin/companies/c1/templates': { status: 201, body: { ...BSD_CITY, id: 't-copy', name: 'BSD City settings (copy)' } },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Actions for BSD City settings' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
      const dialog = within(screen.getByRole('dialog', { name: 'New template' }));
      expect(dialog.getByRole('radio', { name: /^Copy from/ })).toBeChecked();
      expect(dialog.getByLabelText('Name')).toHaveValue('BSD City settings (copy)');
      expect(await dialog.findByLabelText('Source template')).toHaveDisplayValue('BSD City settings');
      await userEvent.click(dialog.getByRole('button', { name: 'Create template' }));
      const sent = stub.calls.find((c) => c.init.method === 'POST');
      expect(JSON.parse(String(sent?.init.body))).toEqual({ name: 'BSD City settings (copy)', from: { templateId: 't-bsd' } });
      await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/admin/companies/c1/templates/t-copy'));
    });

    it('archives another after asking', async () => {
      render('t-bsd', {
        'POST /admin/companies/c1/templates/t-bsd/archive': { body: { ...BSD_CITY, status: 'archived' } },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Actions for BSD City settings' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Archive' }));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Archive template' }));
      expect(await screen.findByText('Archived: it can be read and copied, not changed.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Publish all/ })).toBeNull();
    });
  });

  it('an archived template is read, never published', async () => {
    render('t-old');
    expect(await screen.findByText('Archived: it can be read and copied, not changed.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Publish all/ })).toBeNull();
    expect(await rows()).toHaveLength(9);
  });

  it('says a template the company does not hold, and leads back', async () => {
    render('t-nope');
    expect(await screen.findByText('This template does not exist in this company.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Prudential' })[0]).toHaveAttribute('href', '/admin/companies/c1');
  });

  it('waits with the checklist’s own shape', async () => {
    render();
    expect(screen.getByText('Loading the templates…').closest('[role="status"]')).not.toBeNull();
    await rows();
  });

  it('has no axe violations: the checklist, Publish all asked, and the offices listed', async () => {
    render();
    await rows();
    await clean();
    await userEvent.click(screen.getByRole('button', { name: 'Publish all (2)' }));
    await clean();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: '1 office is on an older version' }));
    await clean();
  });
});
