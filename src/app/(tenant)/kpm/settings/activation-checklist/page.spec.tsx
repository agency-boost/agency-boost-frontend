import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderWithSession, stubFetch } from '@test/harness';
import { axe } from 'vitest-axe';
import { smallTargets } from '@test/touch-audit';
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
  // The checklist's read is the office's administration's own since P18.2-T3 (`activation_settings:read`), and
  // its module picker reads Settings › Training (`training_settings:read`, P18.2-T1 AC-8).
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
const card = (name: RegExp | string) => screen.getByRole('region', { name });
/** Open an item's sheet from its row, as a tap does. */
async function openItem(label: string) {
  await userEvent.click(within(rowOf(label)).getByRole('button', { name: new RegExp(`^${label}`) }));
  return screen.findByRole('dialog', { name: label });
}
async function choose(name: string, item: string) {
  await userEvent.click(screen.getByRole('button', { name: `Actions for ${name}` }));
  await userEvent.click(within(screen.getByRole('menu', { name: `Actions for ${name}` })).getByRole('menuitem', { name: item }));
}

describe('P19.21-T3 AC-3 the activation checklist as the client’s 19 November card', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.21-T3 AC-3 says which version hires get and the window in one note, from the server', async () => {
    render();
    expect(await screen.findByText(
      'New hires are given version 1 · 90 days. Changes become a new version, for the next new hires only.',
    )).toBeInTheDocument();
    // Nothing waits to publish: no bar.
    expect(document.querySelector('[data-draft-bar]')).toBeNull();
  });

  it('P19.21-T3 AC-3 draws the aspects as numbered cards with “n item”, each item saying where it completes from', async () => {
    render();
    await screen.findByText('Learn insurance basics');
    expect(card('1. Introduction')).toHaveTextContent('2 item');
    expect(card('2. Initial Setup')).toHaveTextContent('1 item');
    expect(within(rowOf('Learn insurance basics')).getByText('Completes automatically from: ticked by hand')).toBeInTheDocument();
    expect(within(rowOf('Goal setting: APE & activity targets'))
      .getByText('Completes automatically from: Goal Setting')).toBeInTheDocument();
    expect(within(card('1. Introduction')).getByRole('button', { name: 'Add item to 1. Introduction' }))
      .toHaveTextContent('Add item');
  });

  it('P19.21-T3 AC-3 keeps an aspect’s actions in its ⋯: Rename, Move up, Move down, Remove', async () => {
    render();
    await screen.findByText('Learn insurance basics');
    await userEvent.click(screen.getByRole('button', { name: 'Actions for 1. Introduction' }));
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual([
      'Rename', 'Move 1. Introduction up', 'Move 1. Introduction down', 'Remove',
    ]);
  });

  it('P19.21-T3 AC-3 shows the orange bar once there is an edit, and Publish to agents waits for the draft to be saved', async () => {
    const savedDraft = {
      published: PUBLISHED,
      draft: { ...PUBLISHED, id: 'v2', version: 2, status: 'draft', publishedAt: null },
      windowDays: 90,
    };
    const { calls } = render(OWNER, CHECKLIST, { body: savedDraft });
    await screen.findByText('Learn insurance basics');
    const sheet = await openItem('Learn insurance basics');
    await userEvent.selectOptions(within(sheet).getByLabelText('Completes from'), 'feature:leads');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));

    const bar = document.querySelector<HTMLElement>('[data-draft-bar]')!;
    expect(bar).toHaveTextContent('Draft. Agents are still on version 1.');
    expect(within(bar).getByRole('button', { name: 'Publish to agents' })).toBeDisabled();
    expect(within(rowOf('Learn insurance basics')).getByText('Completes automatically from: Leads')).toBeInTheDocument();
    await userEvent.click(within(bar).getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(calls.some((c) => c.init.method === 'PUT')).toBe(true));
    expect(sent(calls, 'PUT').aspects[0].items[0]).toEqual({ code: 'INSURANCE_BASICS', label: 'Learn insurance basics', autoLink: 'feature:leads' });
  });

  it('P19.21-T3 AC-3 publishes a saved draft from the bar, as the next version', async () => {
    const withDraft = {
      published: PUBLISHED,
      draft: { ...PUBLISHED, id: 'v2', version: 2, status: 'draft', publishedAt: null },
      windowDays: 90,
    };
    const { calls } = render(OWNER, withDraft, { body: { ...withDraft, draft: null } });
    await screen.findByText('Learn insurance basics');
    const publish = screen.getByRole('button', { name: 'Publish to agents' });
    expect(publish).toHaveAttribute('title', 'Publish version 2');
    await userEvent.click(publish);
    await waitFor(() => expect(calls.some((c) => c.url.includes('/activation-checklist/publish') && c.init.method === 'POST')).toBe(true));
  });

  it('P19.21-T3 AC-3 is clean under axe, populated, with an item’s sheet open', async () => {
    const view = stubFetch({
      '/kpm/settings/activation-checklist': { body: CHECKLIST },
      '/kpm/settings/training': { body: TRAINING },
    });
    void view;
    const { container } = renderWithSession(<ActivationChecklistPage />, { me: OWNER });
    await screen.findByText('Learn insurance basics');
    expect((await axe(container, { rules: { 'color-contrast': { enabled: false } } })).violations.map((v) => v.id)).toEqual([]);
    await openItem('Learn insurance basics');
    // The sheet is portalled to the body, outside the page's own landmarks here (the layout's are not rendered).
    expect((await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } }))
      .violations.map((v) => v.id)).toEqual([]);
  });
});

describe('Settings › Activation checklist (P5-T3), inside the 19 November card', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('offers the three features and only the modules agents are offered, in an item’s sheet', async () => {
    render();
    await screen.findByText('Learn insurance basics');
    const sheet = await openItem('Learn insurance basics');
    const options = [...within(sheet).getByLabelText('Completes from').querySelectorAll('option')].map((o) => o.textContent);
    expect(options).toEqual(['No link (manual)', 'Goal Settings', 'Leads Management', 'Activity Management', 'Building Your Prospect List']);
  });

  it('renames an item in its sheet and keeps the code it cannot change', async () => {
    const { calls } = render();
    await screen.findByText('Learn insurance basics');
    const sheet = await openItem('Learn insurance basics');
    expect(within(sheet).getByLabelText('Code')).toHaveValue('INSURANCE_BASICS');
    expect(within(sheet).getByLabelText('Code')).toHaveAttribute('readonly');
    await userEvent.clear(within(sheet).getByLabelText('Item'));
    await userEvent.type(within(sheet).getByLabelText('Item'), 'Insurance basics');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(sent(calls, 'PUT').aspects[0].items[0]).toMatchObject({ code: 'INSURANCE_BASICS', label: 'Insurance basics' });
  });

  it('renames an aspect from its ⋯', async () => {
    const { calls } = render();
    await screen.findByText('Learn insurance basics');
    await choose('1. Introduction', 'Rename');
    const sheet = await screen.findByRole('dialog', { name: 'Rename' });
    await userEvent.clear(within(sheet).getByLabelText('Name'));
    await userEvent.type(within(sheet).getByLabelText('Name'), 'Getting started');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(card('1. Getting started')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(sent(calls, 'PUT').aspects[0]).toMatchObject({ code: 'INTRODUCTION', label: 'Getting started' });
  });

  it('adds an item from the card’s foot, its code filled in from what was typed', async () => {
    const { calls } = render();
    await screen.findByText('Learn insurance basics');
    await userEvent.click(screen.getByRole('button', { name: 'Add item to 2. Initial Setup' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add item' });
    await userEvent.type(within(sheet).getByLabelText('Item'), 'Join the WhatsApp group');
    expect(within(sheet).getByLabelText('Code')).toHaveValue('JOIN_THE_WHATSAPP_GROUP');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(sent(calls, 'PUT').aspects[1].items.map((i: { code: string }) => i.code)).toEqual(['GOAL_SETTING', 'JOIN_THE_WHATSAPP_GROUP']);
  });

  it('adds an aspect with its first item, because an empty aspect is a heading over nothing', async () => {
    const { calls } = render();
    await screen.findByText('Learn insurance basics');
    await userEvent.click(screen.getByRole('button', { name: 'Add aspect' }));
    await userEvent.type(screen.getByLabelText('Aspect'), 'First sales');
    await userEvent.type(screen.getByLabelText('Its first item'), 'Polis pertama');
    await userEvent.click(screen.getByRole('button', { name: 'Add the aspect' }));
    expect(card('3. First sales')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(sent(calls, 'PUT').aspects[2]).toMatchObject({ code: 'FIRST_SALES', label: 'First sales' });
  });

  it('will not remove the last item of an aspect, and says to remove the aspect instead', async () => {
    render();
    await screen.findByText('Learn insurance basics');
    const sheet = await openItem('Goal setting: APE & activity targets');
    const remove = within(sheet).getByRole('button', { name: 'Remove' });
    expect(remove).toBeDisabled();
    expect(remove).toHaveAttribute('title', 'An aspect needs at least one item — remove the aspect instead.');
  });

  it('takes an edit back without touching what the office has saved', async () => {
    const { calls } = render();
    await screen.findByText('Learn insurance basics');
    const sheet = await openItem('Learn insurance basics');
    await userEvent.selectOptions(within(sheet).getByLabelText('Completes from'), 'feature:leads');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    await userEvent.click(screen.getByRole('button', { name: 'Undo my edits' }));
    expect(within(rowOf('Learn insurance basics')).getByText('Completes automatically from: ticked by hand')).toBeInTheDocument();
    expect(document.querySelector('[data-draft-bar]')).toBeNull();
    expect(calls.some((c) => c.init.method === 'PUT')).toBe(false);
  });

  it('shows what the server refused, and keeps the edit', async () => {
    const { calls } = render(OWNER, CHECKLIST, {
      status: 400,
      body: { error: { code: 'VALIDATION_FAILED', message: 'PROSPECT_LIST is a draft, so no agent is offered it.', requestId: 'r-1' } },
    });
    await screen.findByText('Learn insurance basics');
    const sheet = await openItem('Learn insurance basics');
    await userEvent.selectOptions(within(sheet).getByLabelText('Completes from'), 'training:PROSPECT_LIST');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText(/no agent is offered it/)).toBeInTheDocument();
    expect(within(rowOf('Learn insurance basics'))
      .getByText('Completes automatically from: Training › Building Your Prospect List')).toBeInTheDocument();
    expect(calls.some((c) => c.init.method === 'PUT')).toBe(true);
  });

  it('opens an office that has no checklist yet on the standard one, ready to save', async () => {
    const starting = {
      published: null,
      draft: { ...PUBLISHED, id: '', version: 1, status: 'draft', publishedAt: null },
      windowDays: 90,
    };
    render(OWNER, starting);
    expect(await screen.findByText(/standard checklist/)).toBeInTheDocument();
    expect(screen.getByText('Learn insurance basics')).toBeInTheDocument();
    const bar = document.querySelector<HTMLElement>('[data-draft-bar]')!;
    expect(bar).toHaveTextContent('Draft. Nothing is published yet.');
    expect(within(bar).getByRole('button', { name: 'Save draft' })).toBeEnabled();
    expect(within(bar).getByRole('button', { name: 'Publish to agents' })).toBeDisabled();
  });

  it('says so plainly when the office has no checklist at all', async () => {
    render(OWNER, { published: null, draft: null, windowDays: 90 });
    expect(await screen.findByText('This office has no activation checklist yet.')).toBeInTheDocument();
    expect(screen.queryByText(/standard checklist/)).not.toBeInTheDocument();
  });

  it('P13.2-T6 AC-8: an office started Empty authors its first aspect from nothing, and saves it', async () => {
    const saved = {
      published: null, windowDays: 90,
      draft: { id: 'd-1', version: 1, status: 'draft', publishedAt: null, aspects: [] },
    };
    const { calls } = render(OWNER, { published: null, draft: null, windowDays: 90 }, { body: saved });
    expect(await screen.findByText(/Add its first aspect/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Add aspect' }));
    await userEvent.type(screen.getByLabelText('Aspect'), 'First steps');
    await userEvent.type(screen.getByLabelText('Its first item'), 'Meet your leader');
    await userEvent.click(screen.getByRole('button', { name: 'Add the aspect' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(sent(calls, 'PUT').aspects).toEqual([expect.objectContaining({
      code: 'FIRST_STEPS', label: 'First steps', items: [expect.objectContaining({ label: 'Meet your leader' })],
    })]);
  });

  it('P18.2-T3 refuses a field member, who holds tenant_config:read but not activation_settings:read, and asks for nothing', async () => {
    const { calls } = render(FIELD_MEMBER);
    expect(await screen.findByRole('alert')).toHaveAttribute('data-permission', 'activation_settings:read');
    expect(calls.filter((c) => c.url.includes('/kpm/settings/'))).toEqual([]);
  });

  it('gives a reader without write permission the checklist and none of the controls; an item’s sheet reads only', async () => {
    render(READER);
    await screen.findByText('Learn insurance basics');
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add aspect' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Actions for/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Add item to/ })).not.toBeInTheDocument();
    expect(screen.queryByText('⠿')).not.toBeInTheDocument();
    const sheet = await openItem('Learn insurance basics');
    expect(within(sheet).getByLabelText('Completes from')).toBeDisabled();
    expect(within(sheet).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });
});

describe('the badge says whether a link works, never when (Phase 13 exit review; P18.8-T7 G2)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const trainingItem = item({
    code: 'MANDATORY_TRAINING', label: 'Mandatory training', displayOrder: 1,
    autoLink: 'training:PROSPECT_LIST', link: PROSPECT_LINK,
  });
  const FIRST_SALE = {
    kind: 'sales:first', label: 'Sales data', route: null, live: true, form: 'closing',
    completesWhen: 'the hire has a first sale since joining: a sales lead paid and issued, or a policy in the production file',
  };
  const WITH_LINKS = {
    ...CHECKLIST,
    published: {
      ...PUBLISHED,
      aspects: [
        ...PUBLISHED.aspects,
        { code: 'TRAINING', label: '3. Training', displayOrder: 3, items: [trainingItem] },
        {
          code: 'FIRST_SALE', label: '4. First Sale', displayOrder: 4,
          items: [item({ code: 'FIRST_CASE_CLOSED', label: 'Close first case independently', link: FIRST_SALE })],
        },
      ],
    },
  };

  it('a link that does not work says Ticked by hand beside its line, never Auto', async () => {
    render(OWNER, WITH_LINKS);
    await screen.findByText('Mandatory training');
    const row = rowOf('Mandatory training');
    expect(within(row).getByText('Completes automatically from: Training › Building Your Prospect List')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: /^Ticked by hand — / })).toBeInTheDocument();
    // A working link claims nothing more than its line on the card; its sheet says Auto, with the registry's sentence.
    expect(within(rowOf('Goal setting: APE & activity targets')).queryByRole('button', { name: /^(Auto|Ticked by hand) — / })).toBeNull();
    const sheet = await openItem('Goal setting: APE & activity targets');
    expect(within(sheet).getByRole('button', { name: /^Auto — completes when the hire has saved any goal since joining/ })).toBeInTheDocument();
  });

  it('P18.8-T7 G2 a data-backed item names the data on its line, the select holds it alone, and it saves back with no link', async () => {
    const { calls } = render(OWNER, WITH_LINKS);
    await screen.findByText('Close first case independently');
    expect(within(rowOf('Close first case independently'))
      .getByText('Completes automatically from: Sales data')).toBeInTheDocument();
    const sheet = await openItem('Close first case independently');
    const select = within(sheet).getByLabelText('Completes from');
    expect(select).toBeDisabled();
    expect([...select.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['From Sales data']);
    await userEvent.clear(within(sheet).getByLabelText('Item'));
    await userEvent.type(within(sheet).getByLabelText('Item'), 'First case closed');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(sent(calls, 'PUT').aspects[3].items[0]).toEqual({ code: 'FIRST_CASE_CLOSED', label: 'First case closed', autoLink: null });
  });
});

describe('P19.2-T3 AC-4 the checklist’s targets (UI-142)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([375, 768])('P19.2-T3 AC-4 at %ipx finds no target under 44px, with an edit waiting', async (px) => {
    atWidth(px);
    stubFetch({ '/kpm/settings/activation-checklist': { body: CHECKLIST }, '/kpm/settings/training': { body: TRAINING } });
    const { container } = renderWithSession(<div data-surface="v1"><ActivationChecklistPage /></div>, { me: OWNER });
    await screen.findByText('Learn insurance basics');
    await userEvent.click(screen.getByRole('button', { name: 'Actions for 1. Introduction' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Move 1. Introduction down' }));
    expect(smallTargets(container, px)).toEqual([]);
  });

  it('P18.9-T7 AC-6 at 375px moves an aspect with ↑ ↓ beside its ⠿', async () => {
    atWidth(375);
    render();
    await screen.findByText('Learn insurance basics');
    await userEvent.click(screen.getByRole('button', { name: 'Move 2. Initial Setup up' }));
    expect(card('1. Initial Setup')).toBeInTheDocument();
  });
});
