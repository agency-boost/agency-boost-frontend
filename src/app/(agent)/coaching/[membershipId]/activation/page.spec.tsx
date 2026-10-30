import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { atWidth, renderInLayout, stubFetch, type StubReply } from '@test/harness';
import { leaderView, notFound, readOnlySession, SARI, SARI_ME, SHELL_STUBS } from '@test/activation-fixtures';
import CoacheeActivationTab from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/coaching/mem-rina/activation',
}));

// The tab's content alone (T6): the agent header and the tab row above it are the coaching page's (T8).
vi.mock('@/components/coaching-person', () => ({
  useCoachee: () => ({ membershipId: 'mem-rina', name: 'Rina Wijaya' }),
}));

const STANDING = {
  status: 'activated', activation3M: 'activated', joinDate: '2026-08-06', day: 59, firstSaleDate: '2026-09-04',
  firstSaleDay: 30, firstSaleSource: 'sales', leader: { ...SARI, role: 'aab' }, phone: null,
} as const;

const show = (routes: Record<string, StubReply | StubReply[]> = {}, me = SARI_ME) => {
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /new-hires/mem-rina': { body: { ...leaderView(), newHire: STANDING } }, ...routes });
  const view = renderInLayout(AgentLayout, <CoacheeActivationTab />, { me });
  return { ...stub, ...view };
};

describe('/coaching/[membershipId]/activation — their new-hire detail (UI-029, T6)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('UI-029 at 375px: the strip, the tiles and the checklist under the coaching page’s one header — never the name twice, no way back', async () => {
    atWidth(375);
    const { calls } = show();
    expect(await screen.findByTestId('first-sale-strip')).toHaveTextContent(/^Activated · first sale on day 30/);
    expect(screen.getByText('Activation checklist')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Introduction/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Back to New Hires' })).toBeNull();
    expect(calls.map((c) => c.url).filter((u) => u.includes('/new-hires'))).toEqual(['http://api.test/api/v1/new-hires/mem-rina']);
  });

  it('UI-029 from 768px: today’s detail layout, its header and way back left to the coaching page', async () => {
    atWidth(1280);
    show();
    expect(await screen.findByRole('heading', { level: 2, name: 'Activation progress' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Back to New Hires' })).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('T9 AC-3 somebody with no activation opens on the tab’s own line', async () => {
    atWidth(375);
    show({ 'GET /new-hires/mem-rina': notFound });
    expect(await screen.findByText(/Rina Wijaya/)).toBeInTheDocument();
    expect(screen.queryByText('This person isn’t one of your new hires.')).toBeNull();
  });

  it('a read-only support session reads it as the coach does, and writes nothing', async () => {
    atWidth(375);
    show({}, readOnlySession(SARI_ME));
    await screen.findByTestId('first-sale-strip');
    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save note' })).toBeNull();
  });
});
