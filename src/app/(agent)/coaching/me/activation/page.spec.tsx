import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { renderInLayout, stubFetch, type StubReply } from '@test/harness';
import { activationView, completeView, notFound, RINA, RINA_ME, SARI_ME, SHELL_STUBS } from '@test/activation-fixtures';
import MyCoachingActivationPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/coaching/me/activation',
}));

const show = (routes: Record<string, StubReply | StubReply[]> = {}, me = RINA_ME) => {
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /activation/me': { body: activationView() }, ...routes });
  const view = renderInLayout(AgentLayout, <MyCoachingActivationPage />, { me });
  return { ...stub, ...view };
};

const card = () => screen.findByRole('region', { name: '90-Day Activation' });

describe('/coaching/me/activation, the reader’s own Activation tab (P13-T9 AC-4, D-coaching-me)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P13-T9 AC-4 is /coaching/me’s head with Activation current, and the reader’s own checklist from their own read', async () => {
    const { calls } = show();
    await card();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Coaching Session$/);
    expect(screen.getByRole('heading', { level: 2, name: 'Rina Wijaya' })).toBeInTheDocument();
    expect(screen.getByText('Agent · Your own coaching')).toBeInTheDocument();
    const tabs = within(screen.getByRole('navigation', { name: 'Coaching' }));
    expect(tabs.getByRole('link', { name: 'Activation' })).toHaveAttribute('aria-current', 'page');
    expect(tabs.getByRole('link', { name: 'Coaching Session' })).toHaveAttribute('href', '/coaching/me');
    expect(tabs.getByRole('link', { name: 'Coaching Session' })).not.toHaveAttribute('aria-current');
    expect(calls.filter((c) => c.url.includes('/activation/me')).map((c) => c.url)).toEqual(['http://api.test/api/v1/activation/me']);
    // Nobody else's read.
    expect(calls.some((c) => c.url.includes('/new-hires'))).toBe(false);
  });

  it('P13-T9 AC-4 draws the coaching renderer: the card, the percentage and the five cards, read-only', async () => {
    show();
    const record = await card();
    expect(within(record).getByText('31% complete')).toBeInTheDocument();
    expect(screen.getAllByText('✓ Done · New Active Agent')).toHaveLength(1);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('P13-T9 AC-4 keeps the checklist once it is graduated, when /activation is no longer offered', async () => {
    show({ 'GET /activation/me': { body: completeView({ state: 'graduated', graduatedAt: '2026-09-29T03:00:00.000Z', graduatedBy: RINA }) } });
    const record = await card();
    expect(within(record).getByText('100% complete')).toBeInTheDocument();
  });

  it('P13-T9 AC-4 a reader with no activation opens on an empty state', async () => {
    show({ 'GET /activation/me': notFound }, { ...SARI_ME, activation: null });
    expect(await screen.findByText('You have no 90-day activation.')).toBeInTheDocument();
    // A leader has the way back to the roster.
    expect(screen.getByRole('link', { name: '← Back to Coaching Session' })).toHaveAttribute('href', '/coaching');
  });

  it('is refused, with no read, to a reader without coaching_session:read', async () => {
    const { calls } = show({}, { ...RINA_ME, permissions: ['activation:read'] });
    expect(await screen.findByRole('alert')).toHaveAttribute('data-permission', 'coaching_session:read');
    expect(calls.some((c) => c.url.includes('/activation/me'))).toBe(false);
  });
});
