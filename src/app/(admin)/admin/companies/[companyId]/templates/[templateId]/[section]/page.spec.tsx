import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { renderWithSession, routeParams, stubFetch, type StubReply } from '@test/harness';
import {
  ARCHIVED, BSD_CITY, DEFAULT_TEMPLATE, PIPELINE, PRUDENTIAL, RATIOS, SUPER_ADMIN, TAXONOMY, kindView,
} from '@test/kpm-template-fixtures';
import SectionPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/companies/c1/templates/t-default/activity',
}));

const clean = async () =>
  expect((await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations ?? [])
    .toHaveLength(0);

/** The save state's words — the shared label, by its own mark (the toast host is a status region too). */
const saveState = () => document.querySelector('[data-state]');

/** Autosave waits for a pause; a test waits a little longer than it. */
const SAVED = { timeout: 3000 };

function render(section: string, routes: Record<string, StubReply | StubReply[]>, templateId = 't-default') {
  const stub = stubFetch({
    '/admin/companies': { body: [PRUDENTIAL] },
    '/admin/companies/c1/templates': { body: [DEFAULT_TEMPLATE, BSD_CITY, ARCHIVED] },
    ...routes,
  });
  const view = renderWithSession(
    <SectionPage params={routeParams({ companyId: 'c1', templateId, section })} />,
    { me: SUPER_ADMIN },
  );
  return { ...view, stub };
}

/** The activity section: the taxonomy published as v3, the ratios as v1. */
const activity = (extra: Record<string, StubReply | StubReply[]> = {}) => render('activity', {
  '/admin/companies/c1/template/activity_taxonomy': { body: kindView('activity_taxonomy', TAXONOMY, { version: 3, publishedVersion: 3 }) },
  '/admin/companies/c1/template/ratio_set': { body: kindView('ratio_set', RATIOS) },
  ...extra,
});

/** Open one row for editing and hand back its field (a row reads as text until *Edit*, P4-T24). */
async function openRow(name: string, field = 'Name') {
  const row = (await screen.findByText(name)).closest('li, [data-row]') as HTMLElement;
  await userEvent.click(within(row).getByRole('button', { name: 'Edit' }));
  return within(row).getByLabelText(field);
}

/**
 * **One section of a template** (ADR-0185 §3; P18.11-T20 AC-3): its parts as pills, its draft saved as it is made, its
 * own *Publish*, and the existing editors behind it.
 */
describe('P18.11-T20 a template section', () => {
  beforeEach(() => window.history.replaceState(null, '', '/'));
  afterEach(() => vi.unstubAllGlobals());

  it('names the section and its template, leads back to the checklist, and draws its parts as pills', async () => {
    activity();
    expect(await screen.findByRole('heading', { level: 1, name: 'Activities & ratios' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Prudential template' }))
      .toHaveAttribute('href', '/admin/companies/c1/templates/t-default');
    const pills = within(screen.getByRole('navigation', { name: 'Activities & ratios parts' }));
    expect(pills.getAllByRole('link').map((l) => l.textContent)).toEqual(['Activity types', 'Ratio benchmarks']);
    expect(await screen.findByText('Submission polis')).toBeInTheDocument();
    expect(screen.getByText('Published v3')).toBeInTheDocument();
    expect(saveState()).toHaveTextContent('Saved ✓');
  });

  it('AC-3 saves the draft by itself after a pause — the whole payload, the code untouched — and says so', async () => {
    const { stub } = activity({
      'PUT /admin/companies/c1/template/activity_taxonomy': ({ body }) => ({
        body: kindView('activity_taxonomy', (body as { payload: Record<string, unknown> }).payload, {
          status: 'draft', version: 4, publishedVersion: 3,
        }),
      }),
    });
    const label = await openRow('Submission polis');
    await userEvent.clear(label);
    await userEvent.type(label, 'Closing');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(saveState()).toHaveTextContent('Not saved yet');
    // No Save draft button: nothing waits anywhere but the server.
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();

    await vi.waitFor(() => expect(saveState()).toHaveTextContent('Saved ✓'), SAVED);
    const puts = stub.calls.filter((c) => c.init.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0].url).toContain('/admin/companies/c1/template/activity_taxonomy?templateId=t-default');
    const { payload } = JSON.parse(String(puts[0].init.body));
    expect(payload.categories).toHaveLength(1);
    expect(payload.types[0]).toMatchObject({ code: 'SELL_SUBMISSION', label: 'Closing' });
    expect(screen.getByText('Draft v4 · v3 published')).toBeInTheDocument();
  });

  it('P10.1-T5 AC-5 says a refused draft in its own words, keeps the reader’s, and tries again', async () => {
    const { stub } = activity({
      'PUT /admin/companies/c1/template/activity_taxonomy': [
        {
          status: 422,
          body: {
            error: {
              code: 'CONFIG_SUMMARY_GROUP_LABEL_MISMATCH', message: 'The sections in summary tile SELLING must share one label.',
              requestId: 'r-7', details: { summaryGroupCode: 'SELLING', labels: ['Selling', 'Sales'] },
            },
          },
        },
        { body: kindView('activity_taxonomy', TAXONOMY, { status: 'draft', version: 4, publishedVersion: 3 }) },
      ],
    });
    const label = await openRow('Submission polis');
    await userEvent.type(label, ' baru');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    const banner = await screen.findByText(/One summary tile, two names/, undefined, SAVED);
    expect(banner.closest('[role="alert"]')).toHaveTextContent('CONFIG_SUMMARY_GROUP_LABEL_MISMATCH · r-7');
    expect(saveState()).toHaveTextContent('Not saved yet');
    expect(screen.getByText('Submission polis baru')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await vi.waitFor(() => expect(saveState()).toHaveTextContent('Saved ✓'), SAVED);
    expect(stub.calls.filter((c) => c.init.method === 'PUT')).toHaveLength(2);
  });

  it('Publish sends the section’s drafts, the taxonomy before the ratios built on it, and says offices do not change', async () => {
    const { stub } = activity({
      '/admin/companies/c1/template/activity_taxonomy': {
        body: kindView('activity_taxonomy', TAXONOMY, { status: 'draft', version: 4, publishedVersion: 3 }),
      },
      '/admin/companies/c1/template/ratio_set': {
        body: kindView('ratio_set', RATIOS, { status: 'draft', version: 2, publishedVersion: 1 }),
      },
      'POST /admin/companies/c1/template/activity_taxonomy/publish': {
        body: kindView('activity_taxonomy', TAXONOMY, { version: 4, publishedVersion: 4 }),
      },
      'POST /admin/companies/c1/template/ratio_set/publish': {
        body: kindView('ratio_set', RATIOS, { version: 2, publishedVersion: 2 }),
      },
    });
    expect(await screen.findByText('Draft v4 · v3 published')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    // *Amended 2026-11-05 (P19.4-T1, ADR-0208 §4):* existing offices are asked about after it, not ruled out.
    expect(await screen.findByText('Published.')).toBeInTheDocument();
    expect(stub.calls.filter((c) => c.init.method === 'POST').map((c) => c.url.replace(/^.*\/template\//, ''))).toEqual([
      'activity_taxonomy/publish?templateId=t-default', 'ratio_set/publish?templateId=t-default',
    ]);
    expect(screen.getByText('Published v4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
  });

  it('holds Publish, saying why, while nothing has changed since the last publish', async () => {
    activity();
    const publish = await screen.findByRole('button', { name: 'Publish' });
    expect(publish).toBeDisabled();
    expect(publish).toHaveAttribute('title', 'Nothing has changed since the last publish.');
  });

  it('says a refused publish in the API’s words, and stops there', async () => {
    const { stub } = activity({
      '/admin/companies/c1/template/activity_taxonomy': {
        body: kindView('activity_taxonomy', TAXONOMY, { status: 'draft', version: 4, publishedVersion: 3 }),
      },
      '/admin/companies/c1/template/ratio_set': {
        body: kindView('ratio_set', RATIOS, { status: 'draft', version: 2, publishedVersion: 1 }),
      },
      'POST /admin/companies/c1/template/activity_taxonomy/publish': {
        status: 400, body: { error: { code: 'VALIDATION_FAILED', message: 'Add at least one activity type.', requestId: 'r' } },
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Add at least one activity type.')).toBeInTheDocument();
    expect(stub.calls.filter((c) => c.init.method === 'POST')).toHaveLength(1);
  });

  it('P4-T22 the ratios name the activity types of the taxonomy beside them, by name', async () => {
    activity();
    await userEvent.click(await screen.findByRole('link', { name: 'Ratio benchmarks' }));
    expect(window.location.hash).toBe('#ratios');
    const counts = await screen.findByRole('group', { name: 'Counts' });
    expect(within(counts).getByLabelText('Submission polis')).toBeInTheDocument();
    expect(screen.getByText('Published v1')).toBeInTheDocument();
  });

  it('lands on the part the address names', async () => {
    window.history.replaceState(null, '', '/x#ratios');
    activity();
    expect(await screen.findByRole('group', { name: 'Counts' })).toBeInTheDocument();
  });

  it('switches Sales and Recruitment without reading again, so an edit on its way survives', async () => {
    const { stub } = render('leads', {
      '/admin/companies/c1/template/lead_pipeline': { body: kindView('lead_pipeline', PIPELINE) },
    });
    expect(await screen.findByText('Not yet approached')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Recruitment' }));
    expect(await screen.findByText('Not approached')).toBeInTheDocument();
    expect(stub.calls.filter((c) => c.url.includes('/template/lead_pipeline'))).toHaveLength(1);
  });

  it('ADR-0116 says an empty capability ladder gives offices the standard one', async () => {
    render('capability', {
      '/admin/companies/c1/template/capability_ladder': {
        body: kindView('capability_ladder', {}, { id: '', status: 'draft', version: 0, publishedVersion: null }),
      },
    });
    expect(await screen.findByText('Empty: an office made from this template gets AgencyBoost’s standard ladder.'))
      .toBeInTheDocument();
  });

  it('P5-T3 the checklist offers this template’s training modules', async () => {
    render('activation', {
      '/admin/companies/c1/template/activation_checklist': {
        body: kindView('activation_checklist', {
          aspects: [{
            code: 'INTRODUCTION', label: '1. Introduction',
            items: [{ code: 'INSURANCE_BASICS', label: 'Learn insurance basics', autoLink: null }],
          }],
        }),
      },
      '/admin/companies/c1/template/training_taxonomy': {
        body: kindView('training_taxonomy', {
          categories: [{ code: 'SALES', label: 'Sales', description: null }],
          skills: [{ code: 'PROSPECTING', categoryCode: 'SALES', label: 'Prospecting' }],
          modules: [{ code: 'PROSPECT_LIST', skillCode: 'PROSPECTING', title: 'Building Your Prospect List', publishState: 'published' }],
        }),
      },
    });
    expect(screen.queryByRole('navigation', { name: /parts/ })).toBeNull();
    const itemRow = (await screen.findByText('Learn insurance basics')).closest('li')!;
    await userEvent.click(within(itemRow).getByRole('button', { name: 'Edit' }));
    await vi.waitFor(() => expect(within(screen.getByLabelText('Completes from')).getAllByRole('option').map((o) => o.textContent))
      .toContain('Training · Building Your Prospect List'));
  });

  it('an archived template is read only: no Publish, nothing to edit', async () => {
    render('events', {
      '/admin/companies/c1/template/event_types': {
        body: kindView('event_types', { types: [{ code: 'TRAINING', label: 'Training session', displayOrder: 1 }] }),
      },
    }, 't-old');
    expect(await screen.findByText('Archived: read only.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
    for (const edit of screen.queryAllByRole('button', { name: 'Edit' })) expect(edit).toBeDisabled();
  });

  it('says a section that does not exist, and leads back', async () => {
    render('nothing', {});
    expect(await screen.findByText('This section does not exist.')).toBeInTheDocument();
    expect((await screen.findAllByRole('link', { name: 'Prudential template' }))[0])
      .toHaveAttribute('href', '/admin/companies/c1/templates/t-default');
  });

  it('says a failed read, and reads again on Try again', async () => {
    activity({
      '/admin/companies/c1/template/ratio_set': [
        { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side.', requestId: 'r' } } },
        { body: kindView('ratio_set', RATIOS) },
      ],
    });
    expect(await screen.findByText('Something went wrong on our side.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Submission polis')).toBeInTheDocument();
  });

  it('AC-3 sends an edit still waiting when the section is left', async () => {
    const { stub, unmount } = activity({
      'PUT /admin/companies/c1/template/activity_taxonomy': { body: kindView('activity_taxonomy', TAXONOMY, { status: 'draft' }) },
    });
    const label = await openRow('Submission polis');
    await userEvent.type(label, ' baru');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    unmount();
    await vi.waitFor(() => expect(stub.calls.filter((c) => c.init.method === 'PUT')).toHaveLength(1));
  });

  it('has no axe violations: the section, its bar and both parts', async () => {
    activity();
    await screen.findByText('Submission polis');
    await clean();
    await userEvent.click(screen.getByRole('link', { name: 'Ratio benchmarks' }));
    await screen.findByRole('group', { name: 'Counts' });
    await clean();
  });
});
