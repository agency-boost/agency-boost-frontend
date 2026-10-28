import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import ActivationPage from '@/app/(agent)/activation/page';
import NewHireDetailPage from '@/app/(agent)/new-hires/[membershipId]/page';
import { renderInLayout, routeParams, stubFetch } from '@test/harness';
import {
  activationView, RINA, RINA_ME, rinaItems, SARI_ME, SHELL_STUBS,
} from '@test/activation-fixtures';
import type { ActivationItemLink, ActivationItemProgress } from '@/lib/activation';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/activation',
}));

/**
 * **The training link on the activation screens** (P18.5-T3 AC-5, D-orphan): the server serves an item
 * bound to `training:<code>` with its route to the module's page and the module's title as its label
 * (`contract-training.md`, *T3*), so the hire's *Go to {module} →* opens the module, and the badge and
 * the box follow `live` as for any link — nothing here knows a training link from a feature link.
 */

const TRAINING_LINK: ActivationItemLink = {
  kind: 'training:CLOSING_TECHNIQUES',
  label: 'Closing Techniques That Work',
  route: '/training/SALES/CLOSING_TECHNIQUES',
  completesWhen: 'the hire has completed that training module',
  live: true,
  form: null,
};

/** Rina's checklist with item 9 bound to *Closing Techniques That Work*, as 0555's is (D-seed-link). */
function boundTo(over: Partial<ActivationItemProgress> = {}) {
  const items = rinaItems();
  items[2][0] = { ...items[2][0], link: TRAINING_LINK, ...over };
  return items;
}

const row = () => document.querySelector('[data-code="MANDATORY_TRAINING"]') as HTMLElement;

describe('the activation screens’ training link (P18.5-T3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P18.5-T3 AC-5 the hire’s item: Auto, its box disabled, and “Go to {module} →” to the module’s page', async () => {
    stubFetch({ ...SHELL_STUBS, 'GET /activation/me': { body: activationView({}, boundTo()) } });
    renderInLayout(AgentLayout, <ActivationPage />, { me: RINA_ME });
    await screen.findByRole('heading', { level: 2, name: 'Your activation progress' });

    const item = row();
    expect(within(item).getByRole('checkbox')).toBeDisabled();
    expect(within(item).getByRole('button', { name: 'Auto — completes when the hire has completed that training module' })).toBeInTheDocument();
    expect(within(item).getByRole('link', { name: 'Go to Closing Techniques That Work →' }))
      .toHaveAttribute('href', '/training/SALES/CLOSING_TECHNIQUES');
  });

  it('P18.5-T3 AC-2 says a done item was completed from the module, by the hire', async () => {
    const done = boundTo({ done: true, doneAt: '2026-10-05T03:00:00.000Z', source: 'link', doneBy: RINA });
    stubFetch({ ...SHELL_STUBS, 'GET /activation/me': { body: activationView({}, done) } });
    renderInLayout(AgentLayout, <ActivationPage />, { me: RINA_ME });
    await screen.findByRole('heading', { level: 2, name: 'Your activation progress' });

    expect(within(row()).getByRole('checkbox')).toBeChecked();
    expect(within(row()).getByRole('button', { name: /^Completed from Closing Techniques That Work by you · / })).toBeInTheDocument();
  });

  it('P18.5-T3 AC-4, D-orphan: while the module is not offered the hire ticks it by hand, under the Ticked by hand badge', async () => {
    stubFetch({ ...SHELL_STUBS, 'GET /activation/me': { body: activationView({}, boundTo({ link: { ...TRAINING_LINK, live: false } })) } });
    renderInLayout(AgentLayout, <ActivationPage />, { me: RINA_ME });
    await screen.findByRole('heading', { level: 2, name: 'Your activation progress' });

    expect(within(row()).getByRole('checkbox')).toBeEnabled();
    expect(within(row()).getByRole('button', { name: /^Ticked by hand — this link does not complete the item on its own/ }))
      .toHaveTextContent('Ticked by hand');
    expect(within(row()).queryByRole('link', { name: /^Go to/ })).not.toBeInTheDocument();
    expect(within(row()).queryByRole('button', { name: /^Auto/ })).not.toBeInTheDocument();
  });

  it('P18.5-T3 AC-4, D-orphan: an item its link completed before the module was withdrawn keeps Auto and its attribution, no control, no Go to', async () => {
    const done = boundTo({ link: { ...TRAINING_LINK, live: false }, done: true, doneAt: '2026-09-05T03:00:00.000Z', source: 'link', doneBy: RINA });
    stubFetch({ ...SHELL_STUBS, 'GET /activation/me': { body: activationView({}, done) } });
    renderInLayout(AgentLayout, <ActivationPage />, { me: RINA_ME });
    await screen.findByRole('heading', { level: 2, name: 'Your activation progress' });

    expect(within(row()).getByRole('checkbox')).toBeDisabled();
    expect(within(row()).getByRole('checkbox')).toBeChecked();
    expect(within(row()).getByRole('button', { name: /^Auto — completes when/ })).toBeInTheDocument();
    expect(within(row()).getByRole('button', { name: /^Completed from Closing Techniques That Work by you · / })).toBeInTheDocument();
    expect(within(row()).queryByRole('button', { name: /^Ticked by hand/ })).not.toBeInTheDocument();
    expect(within(row()).queryByRole('link', { name: /^Go to/ })).not.toBeInTheDocument();
    expect(within(row()).queryByRole('button', { name: 'Show note and date' })).not.toBeInTheDocument();
  });

  it('P18.5-T3 AC-4, D-orphan: the leader’s detail ticks it by hand too, under the same badge', async () => {
    const items = boundTo({ link: { ...TRAINING_LINK, live: false } }).map((list) => list.map((it) => ({ ...it, note: null, date: null })));
    stubFetch({ ...SHELL_STUBS, 'GET /new-hires/mem-rina': { body: activationView({}, items) } });
    renderInLayout(AgentLayout, <NewHireDetailPage params={routeParams({ membershipId: 'mem-rina' })} />, { me: SARI_ME });
    await screen.findByRole('heading', { level: 2, name: 'Activation progress' });

    expect(within(row()).getByRole('checkbox')).toBeEnabled();
    expect(within(row()).getByRole('button', { name: /^Ticked by hand/ })).toBeInTheDocument();
    expect(within(row()).queryByRole('button', { name: /^Auto/ })).not.toBeInTheDocument();
  });

  it('P18.5-T3 AC-4, D-orphan: the leader cannot tick an item its link already completed', async () => {
    const items = boundTo({ link: { ...TRAINING_LINK, live: false }, done: true, doneAt: '2026-09-05T03:00:00.000Z', source: 'link', doneBy: RINA })
      .map((list) => list.map((it) => ({ ...it, note: null, date: null })));
    stubFetch({ ...SHELL_STUBS, 'GET /new-hires/mem-rina': { body: activationView({}, items) } });
    renderInLayout(AgentLayout, <NewHireDetailPage params={routeParams({ membershipId: 'mem-rina' })} />, { me: SARI_ME });
    await screen.findByRole('heading', { level: 2, name: 'Activation progress' });

    expect(within(row()).getByRole('checkbox')).toBeDisabled();
    expect(within(row()).getByRole('button', { name: /^Auto — completes when/ })).toBeInTheDocument();
    expect(within(row()).queryByRole('button', { name: /^Ticked by hand/ })).not.toBeInTheDocument();
  });

  it('P18.5-T3 AC-3 the leader’s detail: Auto, and nothing for the leader to tick', async () => {
    const items = boundTo().map((list) => list.map((it) => ({ ...it, note: null, date: null })));
    stubFetch({ ...SHELL_STUBS, 'GET /new-hires/mem-rina': { body: activationView({}, items) } });
    renderInLayout(AgentLayout, <NewHireDetailPage params={routeParams({ membershipId: 'mem-rina' })} />, { me: SARI_ME });
    await screen.findByRole('heading', { level: 2, name: 'Activation progress' });

    expect(within(row()).getByRole('checkbox')).toBeDisabled();
    expect(within(row()).getByRole('button', { name: /^Auto — completes when the hire has completed that training module/ })).toBeInTheDocument();
  });
});
