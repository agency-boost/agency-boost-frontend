import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import ActivationChecklistPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/activation-checklist',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    status: 'active', isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  // The checklist's read is the office's administration's own since P18.5-T3 (`activation_settings:read`), and
  // its module picker reads Settings › Training (`training_settings:read`, P18.5-T1 AC-8).
  permissions: ['tenant_config:read', 'tenant_config:write', 'activation_settings:read', 'training_settings:read'],
});

const READER = makeMe({ ...OWNER, permissions: ['tenant_config:read', 'activation_settings:read', 'training_settings:read'] });

/** A field member: every rung holds `tenant_config:read`, and none holds the checklist's read. */
const FIELD_MEMBER = makeMe({
  ...OWNER,
  membership: { ...OWNER.membership!, isKpmOwner: false, orgLevelCode: 'AGENT', hierarchyRole: 'agent' },
  permissions: ['tenant_config:read'],
});

const item = (over: Record<string, unknown> = {}) => ({
  code: 'INSURANCE_BASICS', label: 'Learn insurance basics', displayOrder: 1,
  autoLink: null, link: null, ...over,
});

const goalItem = item({
  code: 'GOAL_SETTING',
  label: 'Goal setting: APE & activity targets',
  displayOrder: 1,
  autoLink: 'feature:goals',
  link: {
    kind: 'feature:goals', label: 'Goal Settings', route: '/goals',
    completesWhen: 'the hire has saved any goal since joining', live: true,
  },
});

/** A training link as the API resolves it: the module's title, and not live (P13-T3 AC-1). */
const PROSPECT_LINK = {
  kind: 'training:PROSPECT_LIST', label: 'Building Your Prospect List', route: '/training',
  completesWhen: 'the hire has completed that training module', live: false,
};

const PUBLISHED = {
  id: 'v1', version: 1, status: 'published', publishedAt: '2026-09-01T00:00:00.000Z',
  aspects: [
    {
      code: 'INTRODUCTION',
      label: '1. Introduction',
      displayOrder: 1,
      items: [item(), item({ code: 'CAREER_MINDSET', label: 'Learn agency career mindset', displayOrder: 2 })],
    },
    { code: 'INITIAL_SETUP', label: '2. Initial Setup', displayOrder: 2, items: [goalItem] },
  ],
};

const CHECKLIST = { published: PUBLISHED, draft: null, windowDays: 90 };

const TRAINING = [{
  id: 'c1', code: 'SALES', label: 'Sales', description: null, displayOrder: 1, version: 1, status: 'active',
  skills: [{
    id: 's1', code: 'PROSPECTING', categoryCode: 'SALES', label: 'Prospecting', displayOrder: 1,
    version: 1, status: 'active',
    modules: [
      {
        id: 'm1', code: 'PROSPECT_LIST', skillCode: 'PROSPECTING', title: 'Building Your Prospect List',
        publishState: 'published', displayOrder: 1, version: 1, status: 'active',
      },
      {
        id: 'm2', code: 'COLD_CALLS', skillCode: 'PROSPECTING', title: 'Cold calls',
        publishState: 'draft', displayOrder: 2, version: 1, status: 'active',
      },
    ],
  }],
}];

function render(
  me = OWNER,
  checklist: unknown = CHECKLIST,
  writes: { status?: number; body?: unknown } = { body: CHECKLIST },
) {
  const stub = stubFetch({
    '/kpm/settings/activation-checklist': [{ body: checklist }, writes],
    '/kpm/settings/training': { body: TRAINING },
  });
  renderWithSession(<ActivationChecklistPage />, { me });
  return stub;
}

const rowOf = (text: string) => screen.getByText(text).closest('li') as HTMLElement;
const sent = (calls: { url: string; init: RequestInit }[], method: string) =>
  JSON.parse(calls.find((c) => c.init.method === method)!.init.body as string);

describe('Settings › Activation checklist (P5-T3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('says which version hires are given, and carries the prototype’s own sentence', async () => {
    render();

    expect(await screen.findByText(/Hires starting now are given/)).toBeInTheDocument();
    expect(screen.getByText(/version 1/)).toBeInTheDocument();
    expect(screen.getByText(/Applies to every new hire’s 90-day activation/)).toBeInTheDocument();
  });

  it('shows the window read-only, and sends nobody to change it where it cannot be changed', async () => {
    // It used to say "— change it in Branch info" and link there. Branch info has no window field,
    // and no screen edits the window, so the link led to a page that could not do what it said (X-45).
    render();
    await screen.findByText(/Hires starting now/);

    expect(screen.getByText('90 days')).toBeInTheDocument();
    expect(screen.getByText('90 days').closest('p')).toHaveTextContent(/^The window is 90 days\.$/);
    expect(screen.queryByRole('link', { name: 'Branch info' })).not.toBeInTheDocument();
  });

  it('draws each aspect with its items, and marks a linked one Auto', async () => {
    render();
    await screen.findByText('1. Introduction');

    expect(screen.getByRole('heading', { name: '2. Initial Setup' })).toBeInTheDocument();
    const linked = rowOf('Goal setting: APE & activity targets');
    expect(within(linked).getByText('Auto')).toBeInTheDocument();
    // The select says what it completes from, as the prototype's row does (`KPM_Owner.html:1539`).
    expect(within(linked).getByLabelText('Completes from')).toHaveValue('feature:goals');
    // A manual item says nothing about completing on its own.
    expect(within(rowOf('Learn insurance basics')).queryByText('Auto')).not.toBeInTheDocument();
  });

  it('puts nothing under a linked item, and names no phase anywhere', async () => {
    // A sub-line here said *"ticked by the leader until the link starts working in phase 11"*: our
    // schedule, in the old plan's numbers, about a leader screen that does not exist yet (P10.1-T2
    // AC-13). The prototype's row is the item, the AUTO badge and the select, and nothing under them.
    render();
    await screen.findByText('1. Introduction');

    const linked = rowOf('Goal setting: APE & activity targets');
    expect(within(linked).getByText('Goal setting: APE & activity targets').nextElementSibling).toBeNull();
    expect(linked).not.toHaveTextContent(/ticked by the leader|starts working/);
    expect(document.body).not.toHaveTextContent(/phase/i);
  });

  it('offers the three features and only the modules agents are offered', async () => {
    render();
    await screen.findByText('1. Introduction');

    const select = within(rowOf('Learn insurance basics')).getByLabelText('Completes from');
    const options = within(select).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual([
      'No link (manual)', 'Goal Settings', 'Leads Management', 'Activity Management',
      'Building Your Prospect List',
    ]);
    // `Cold calls` is a draft module: no agent is offered it, so no item may wait for it.
    expect(options).not.toContain('Cold calls');
  });

  it('holds an edit until Save draft, then sends the whole checklist', async () => {
    const { calls } = render();
    await screen.findByText('1. Introduction');
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();

    await userEvent.selectOptions(
      within(rowOf('Learn insurance basics')).getByLabelText('Completes from'),
      'training:PROSPECT_LIST',
    );
    // Whether this link works is the server's to say, and it has not been asked yet (P13-T3 AC-1).
    expect(within(rowOf('Learn insurance basics')).queryByText('Auto')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    const body = sent(calls, 'PUT');
    expect(body.aspects).toHaveLength(2);
    expect(body.aspects[0].items[0]).toEqual({
      code: 'INSURANCE_BASICS', label: 'Learn insurance basics', autoLink: 'training:PROSPECT_LIST',
    });
  });

  it('renames an item and keeps the code it cannot change', async () => {
    const { calls } = render();
    await screen.findByText('1. Introduction');
    await userEvent.click(within(rowOf('Learn insurance basics')).getByRole('button', { name: 'Edit' }));

    expect(screen.getByLabelText('Code')).toHaveValue('INSURANCE_BASICS');
    const field = screen.getByLabelText('Item');
    await userEvent.clear(field);
    await userEvent.type(field, 'Learn the basics');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(sent(calls, 'PUT').aspects[0].items[0]).toEqual({
      code: 'INSURANCE_BASICS', label: 'Learn the basics', autoLink: null,
    });
  });

  it('renames an aspect, which nothing could do before', async () => {
    // A typo in a section name was permanent: the only way out was removing the aspect and
    // every item under it.
    const { calls } = render();
    await screen.findByText('1. Introduction');
    const head = screen.getByRole('heading', { name: '1. Introduction' }).closest('.flex') as HTMLElement;

    await userEvent.click(within(head).getByRole('button', { name: 'Rename' }));
    const name = screen.getByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, '1. Pengenalan');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    const body = sent(calls, 'PUT');
    expect(body.aspects[0]).toMatchObject({ code: 'INTRODUCTION', label: '1. Pengenalan' });
  });

  it('adds an item with its code filled in from what was typed', async () => {
    const { calls } = render();
    await screen.findByText('1. Introduction');
    const card = screen.getByRole('heading', { name: '1. Introduction' }).closest('.rounded-lg') as HTMLElement;
    await userEvent.click(within(card).getByRole('button', { name: '+ Add item' }));
    await userEvent.type(within(card).getByLabelText('Item'), 'Shadow a senior agent');

    expect(within(card).getByLabelText('Code')).toHaveValue('SHADOW_A_SENIOR_AGENT');

    await userEvent.click(within(card).getByRole('button', { name: 'Add' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(sent(calls, 'PUT').aspects[0].items).toHaveLength(3);
    expect(sent(calls, 'PUT').aspects[0].items[2]).toEqual({
      code: 'SHADOW_A_SENIOR_AGENT', label: 'Shadow a senior agent', autoLink: null,
    });
  });

  it('adds an aspect with its first item, because an empty aspect is a heading over nothing', async () => {
    const { calls } = render();
    await screen.findByText('1. Introduction');
    await userEvent.click(screen.getByRole('button', { name: '+ Add aspect' }));

    const add = screen.getByRole('button', { name: 'Add the aspect' });
    expect(add).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Aspect'), 'Compliance');
    await userEvent.type(screen.getByLabelText('Its first item'), 'Read the code of conduct');
    await userEvent.click(add);
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(sent(calls, 'PUT').aspects.at(-1)).toEqual({
      code: 'COMPLIANCE',
      label: 'Compliance',
      items: [{ code: 'READ_THE_CODE_OF_CONDUCT', label: 'Read the code of conduct', autoLink: null }],
    });
  });

  it('will not remove the last item of an aspect, and says to remove the aspect instead', async () => {
    render();
    await screen.findByText('1. Introduction');

    const only = within(rowOf('Goal setting: APE & activity targets')).getByRole('button', { name: 'Remove' });
    expect(only).toBeDisabled();
    expect(only).toHaveAttribute('title', expect.stringContaining('remove the aspect instead'));
  });

it('removes an aspect with its items, and says how many are going', async () => {
    const { calls } = render();
    await screen.findByText('1. Introduction');
    const card = screen.getByRole('heading', { name: '1. Introduction' }).closest('.rounded-lg') as HTMLElement;

    // The aspect's own Remove sits in the card head, before the items' own.
    const removeAspect = within(card).getAllByRole('button', { name: 'Remove' })[0];
    expect(removeAspect).toHaveAttribute('title', expect.stringContaining('and its 2 items'));

    await userEvent.click(removeAspect);
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(sent(calls, 'PUT').aspects.map((a: { code: string }) => a.code)).toEqual(['INITIAL_SETUP']);
  });

  it('takes an edit back without touching what the office has saved', async () => {
    const { calls } = render();
    await screen.findByText('1. Introduction');
    await userEvent.selectOptions(
      within(rowOf('Learn insurance basics')).getByLabelText('Completes from'),
      'feature:leads',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Undo my edits' }));

    expect(within(rowOf('Learn insurance basics')).queryByText('Auto')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    expect(calls.some((c) => c.init.method === 'PUT')).toBe(false);
  });

  it('holds Publish until the draft is saved, then publishes the next version', async () => {
    const withDraft = {
      published: PUBLISHED,
      draft: { ...PUBLISHED, id: 'v2', version: 2, status: 'draft', publishedAt: null },
      windowDays: 90,
    };
    const { calls } = render(OWNER, withDraft, { body: { ...withDraft, draft: null } });
    await screen.findByText(/unpublished draft/);

    await userEvent.click(screen.getByRole('button', { name: 'Publish version 2' }));

    expect(calls.some((c) => c.url.includes('/activation-checklist/publish') && c.init.method === 'POST'))
      .toBe(true);
  });

  it('shows what the server refused, and keeps the edit', async () => {
    const { calls } = render(OWNER, CHECKLIST, {
      status: 400,
      body: {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'PROSPECT_LIST is a draft, so no agent is offered it.',
          requestId: 'r-1',
        },
      },
    });
    await screen.findByText('1. Introduction');
    await userEvent.selectOptions(
      within(rowOf('Learn insurance basics')).getByLabelText('Completes from'),
      'training:PROSPECT_LIST',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText(/no agent is offered it/)).toBeInTheDocument();
    expect(within(rowOf('Learn insurance basics')).getByLabelText('Completes from')).toHaveValue('training:PROSPECT_LIST');
    expect(calls.some((c) => c.init.method === 'PUT')).toBe(true);
  });

  /*
   * An office created before P5-T3, whose database has not had migration 0012 run yet, has no
   * checklist of its own. The API answers with the standard one, unsaved; the screen used to
   * dereference a null here and throw, and `toDisplayError` reported that crash as *"Could not
   * reach the server"* — sending the reader to check their connection over a bug on the page.
   * Reported from a real office.
   */
  it('opens an office that has no checklist yet on the standard one, ready to save', async () => {
    const starting = {
      published: null,
      draft: { ...PUBLISHED, id: '', version: 1, status: 'draft', publishedAt: null },
      windowDays: 90,
    };
    render(OWNER, starting);

    expect(await screen.findByText(/standard checklist/)).toBeInTheDocument();
    expect(screen.queryByText(/Could not reach the server/)).not.toBeInTheDocument();
    expect(screen.getByText('Learn insurance basics')).toBeInTheDocument();
    // Savable as it stands — saving it is what gives the office a checklist — and nothing to
    // publish until it has been saved.
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Publish version 1' })).toBeDisabled();
  });

  it('says so plainly when the office has no checklist at all', async () => {
    render(OWNER, { published: null, draft: null, windowDays: 90 });

    expect(await screen.findByText('This office has no activation checklist yet.')).toBeInTheDocument();
    expect(screen.queryByText(/Could not reach the server/)).not.toBeInTheDocument();
    expect(screen.queryByText(/standard checklist/)).not.toBeInTheDocument();
  });

  it('P13.2-T6 AC-8: an office started Empty authors its first aspect from nothing, and saves it', async () => {
    // ADR-0115 §8: its source held no checklist, so its Owner builds the first one.
    const saved = {
      published: null, windowDays: 90,
      draft: { id: 'd-1', version: 1, status: 'draft', publishedAt: null, aspects: [] },
    };
    const { calls } = render(OWNER, { published: null, draft: null, windowDays: 90 }, { body: saved });

    expect(await screen.findByText(/Add its first aspect/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: '+ Add aspect' }));
    await userEvent.type(screen.getByLabelText('Aspect'), 'First steps');
    await userEvent.type(screen.getByLabelText('Its first item'), 'Meet your leader');
    await userEvent.click(screen.getByRole('button', { name: 'Add the aspect' }));
    expect(screen.queryByText('This office has no activation checklist yet.')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    const body = sent(calls, 'PUT');
    expect(body.aspects).toEqual([expect.objectContaining({
      code: 'FIRST_STEPS', label: 'First steps', items: [expect.objectContaining({ label: 'Meet your leader' })],
    })]);
  });

  it('P18.5-T3 refuses a field member, who holds tenant_config:read but not activation_settings:read, and asks for nothing', async () => {
    const { calls } = render(FIELD_MEMBER);

    expect(await screen.findByRole('alert')).toHaveAttribute('data-permission', 'activation_settings:read');
    expect(screen.getByText('Not available to you')).toBeInTheDocument();
    expect(calls.filter((c) => c.url.includes('/kpm/settings/'))).toEqual([]);
  });

  it('gives a reader without write permission the checklist and none of the controls', async () => {
    render(READER);
    await screen.findByText('1. Introduction');

    expect(screen.getByText('Learn insurance basics')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add aspect' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Completes from')).not.toBeInTheDocument();
  });
});

/*
 * P13-T3 AC-1, parity I-80: the settings screen says *whether* an item's link completes it, never when
 * (ADR-0062 §3). The badge used to read *Auto* for any link, so an item bound to a training module — which
 * nothing evaluates, and which the hire or a leader ticks by hand — told the Owner it ticked itself.
 */
describe('Phase 13 exit review — the badge says whether a link works, never when', () => {
  afterEach(() => vi.unstubAllGlobals());

  const trainingItem = item({
    code: 'MANDATORY_TRAINING',
    label: 'Mandatory training: selling skill & product knowledge',
    displayOrder: 1,
    autoLink: 'training:PROSPECT_LIST',
    link: PROSPECT_LINK,
  });
  const WITH_TRAINING = {
    ...CHECKLIST,
    published: {
      ...PUBLISHED,
      aspects: [
        ...PUBLISHED.aspects,
        { code: 'TRAINING', label: '3. Training & Certification', displayOrder: 3, items: [trainingItem] },
      ],
    },
  };
  const badgeOf = (label: string) => within(rowOf(label)).queryByRole('button', { name: /^(Auto|Ticked by hand) — / });

  it('Phase 13 exit review: a live link reads Auto, with the registry’s sentence as its tooltip and in its name', async () => {
    render(OWNER, WITH_TRAINING);
    await screen.findByText('1. Introduction');

    const auto = within(rowOf('Goal setting: APE & activity targets'))
      .getByRole('button', { name: 'Auto — completes when the hire has saved any goal since joining' });
    expect(auto).toHaveAccessibleDescription('Completes when the hire has saved any goal since joining.');
    await userEvent.click(auto);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Completes when the hire has saved any goal since joining.');
  });

  it('Phase 13 exit review: a link that does not work reads Ticked by hand, never Auto, and says who ticks it — not when it will work', async () => {
    render(OWNER, WITH_TRAINING);
    await screen.findByText('1. Introduction');

    const training = within(rowOf('Mandatory training: selling skill & product knowledge'));
    expect(training.queryByText('Auto')).not.toBeInTheDocument();
    const hand = training.getByRole('button', {
      name: 'Ticked by hand — this link does not complete the item on its own, so the hire or one of their leaders ticks it',
    });
    expect(hand).toHaveTextContent(/^Ticked by hand/);
    expect(hand).toHaveAccessibleDescription(
      'This link does not complete the item on its own, so the hire or one of their leaders ticks it.',
    );
    // Its words, its name and its tooltip together: whether, and never when.
    expect(hand.parentElement!.textContent).not.toMatch(/phase|until|\byet\b|soon|\d/i);
    // The select still says what it completes from, as the prototype's row does.
    expect(training.getByLabelText('Completes from')).toHaveValue('training:PROSPECT_LIST');
    // A manual item says nothing about completing on its own.
    expect(badgeOf('Learn insurance basics')).toBeNull();
  });

  it('Phase 13 exit review: a link chosen and not saved claims nothing until the save answers whether it works', async () => {
    const saved = {
      ...CHECKLIST,
      draft: {
        ...PUBLISHED, id: 'v2', version: 2, status: 'draft', publishedAt: null,
        aspects: [
          { ...PUBLISHED.aspects[0], items: [item({ autoLink: 'training:PROSPECT_LIST', link: PROSPECT_LINK }), PUBLISHED.aspects[0].items[1]] },
          PUBLISHED.aspects[1],
        ],
      },
    };
    render(OWNER, CHECKLIST, { body: saved });
    await screen.findByText('1. Introduction');

    // A kind the server has already resolved says whether at once: Goal Settings works.
    await userEvent.selectOptions(within(rowOf('Learn agency career mindset')).getByLabelText('Completes from'), 'feature:goals');
    expect(badgeOf('Learn agency career mindset')).toHaveAccessibleName(/^Auto — /);

    // One it has not is unresolved, and the row claims neither.
    await userEvent.selectOptions(within(rowOf('Learn insurance basics')).getByLabelText('Completes from'), 'training:PROSPECT_LIST');
    expect(badgeOf('Learn insurance basics')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await within(rowOf('Learn insurance basics')).findByRole('button', { name: /^Ticked by hand — / })).toBeInTheDocument();
    expect(within(rowOf('Learn insurance basics')).queryByText('Auto')).not.toBeInTheDocument();
  });
});

/**
 * **P18.96-T7 G2: the three data-backed items read as data-backed** (ADR-0171 §3). They store no link — their kind is
 * bound by their code — and the settings read serves each its kind as `link`: *Auto*, and the select holding what it
 * completes from, *From Sales data* or *From Coaching sessions*, and offering nothing else. Saved back as stored.
 */
describe('Settings › Activation checklist — the data-backed items (P18.96-T7 G2)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const dataLink = (kind: string, label: string, completesWhen: string, form: string) => ({
    kind, label, route: null, completesWhen, live: true, form,
  });
  const FIRST_SALE = dataLink(
    'sales:first', 'Sales data',
    'the hire has a first sale since joining: a sales lead paid and issued, or a policy in the production file', 'closing',
  );
  const CHECK_IN = dataLink(
    'coaching:weekly:4', 'Coaching sessions', '4 1:1s with the hire are recorded in coaching sessions since joining', 'one_on_one',
  );
  const MILESTONE = dataLink('sales:closings:3', 'Sales data', 'the hire has 3 sales leads paid and issued since joining', 'closing');
  const WITH_DATA = {
    ...CHECKLIST,
    published: {
      ...PUBLISHED,
      aspects: [
        ...PUBLISHED.aspects,
        {
          code: 'FIRST_SALE', label: '4. First Sale', displayOrder: 4,
          items: [
            item({ code: 'JOINT_FIELD_WORK', label: 'Joint Field Work with leader', displayOrder: 1 }),
            item({ code: 'FIRST_CASE_CLOSED', label: 'Close first case independently', displayOrder: 2, link: FIRST_SALE }),
          ],
        },
        {
          code: 'ONGOING_HABITS', label: '5. Ongoing Habits', displayOrder: 5,
          items: [
            item({ code: 'WEEKLY_CHECK_IN', label: 'Weekly 1-on-1 check-in (4 weeks)', displayOrder: 1, link: CHECK_IN }),
            item({
              code: 'INDEPENDENT_AGENT_MILESTONE', label: 'Reach Independent Agent milestone (3 independent closings)',
              displayOrder: 2, link: MILESTONE,
            }),
          ],
        },
      ],
    },
  };

  it('P18.96-T7 G2 draws each as data-backed — Auto, and the select holding From Sales data or From Coaching sessions — and never No link (manual)', async () => {
    render(OWNER, WITH_DATA);
    await screen.findByText('4. First Sale');
    for (const [label, words, completesWhen] of [
      ['Close first case independently', 'From Sales data', FIRST_SALE.completesWhen],
      ['Weekly 1-on-1 check-in (4 weeks)', 'From Coaching sessions', CHECK_IN.completesWhen],
      ['Reach Independent Agent milestone (3 independent closings)', 'From Sales data', MILESTONE.completesWhen],
    ] as const) {
      const row = within(rowOf(label));
      expect(row.getByRole('button', { name: `Auto — completes when ${completesWhen}` })).toBeInTheDocument();
      const select = row.getByLabelText('Completes from');
      // The one thing it completes from, and nothing to choose: not re-linked here.
      expect(select).toBeDisabled();
      expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([words]);
      expect(row.queryByText('No link (manual)')).not.toBeInTheDocument();
    }
    // A manual item beside them keeps the select as it was, and its badge-less row.
    const manual = within(rowOf('Joint Field Work with leader'));
    expect(manual.getByLabelText('Completes from')).toBeEnabled();
    expect(manual.getByLabelText('Completes from')).toHaveValue('');
    expect(manual.queryByText('Auto')).not.toBeInTheDocument();
  });

  it('P18.96-T7 G2 saves them back as stored — no link — when the draft is saved, their labels still the Owner’s to edit', async () => {
    const { calls } = render(OWNER, WITH_DATA);
    await screen.findByText('4. First Sale');
    await userEvent.click(within(rowOf('Weekly 1-on-1 check-in (4 weeks)')).getByRole('button', { name: 'Edit' }));
    const field = screen.getByLabelText('Item');
    await userEvent.clear(field);
    await userEvent.type(field, 'Weekly 1:1 with your leader');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    const items = sent(calls, 'PUT').aspects.flatMap((a: { items: unknown[] }) => a.items);
    expect(items).toEqual(expect.arrayContaining([
      { code: 'FIRST_CASE_CLOSED', label: 'Close first case independently', autoLink: null },
      { code: 'WEEKLY_CHECK_IN', label: 'Weekly 1:1 with your leader', autoLink: null },
      { code: 'INDEPENDENT_AGENT_MILESTONE', label: 'Reach Independent Agent milestone (3 independent closings)', autoLink: null },
    ]));
  });

  it('P18.96-T7 G2 a reader who may not edit sees the three as Auto, and no select at all', async () => {
    render(READER, WITH_DATA);
    await screen.findByText('4. First Sale');
    const row = within(rowOf('Close first case independently'));
    expect(row.getByRole('button', { name: `Auto — completes when ${FIRST_SALE.completesWhen}` })).toBeInTheDocument();
    expect(row.queryByLabelText('Completes from')).not.toBeInTheDocument();
  });
});
