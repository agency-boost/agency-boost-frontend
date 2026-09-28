import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import PersonalSummaryPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/summary',
}));

const AGENT = makeMe({ permissions: ['personal_summary:read'] });
const M = 1_000_000 * 100;

const figures = (over: Record<string, unknown> = {}) => ({
  targetMinor: 75 * M, actualMinor: 30 * M, attainmentPct: 40, gapMinor: 45 * M, overMinor: 0,
  policiesNeeded: 3, targetMet: false, ...over,
});
const summary = (over: Record<string, unknown> = {}) => ({
  year: '2026', month: '2026-09', today: '2026-09-14',
  goal: { set: true, savedAt: '2026-09-01T02:00:00.000Z' }, caseSizeMinor: 18 * M,
  monthly: { ...figures(), source: { provenance: 'imported', month: '2026-09' } },
  yearly: {
    ...figures({ targetMinor: 500 * M, actualMinor: 230 * M, attainmentPct: 46, gapMinor: 270 * M, policiesNeeded: 15 }),
    source: { provenance: 'imported', month: '2026-09' },
  },
  pace: {
    closingTarget: 5, closingsLogged: 2, dayOfMonth: 14, daysInMonth: 30, projected: 4, weeksLeft: 3,
    neededPerWeek: 1, targetMet: false,
  },
  ...over,
});

const show = (body: unknown) => {
  stubFetch({ '/summary': { body } });
  renderWithSession(<PersonalSummaryPage />, { me: AGENT });
};
const card = (name: string) => screen.findByRole('region', { name });

describe('the Personal Summary — goal versus actual, and the gap (P10-T4)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1: opens on this month — the produced figure, the target, the attainment and its bar', async () => {
    show(summary());
    const goal = await card('Goal vs. actual (APE)');

    expect(goal).toHaveTextContent('Rp 30.000.000of Rp 75.000.000 target40%');
    expect(within(goal).getByText('This month')).toBeInTheDocument();
    expect(within(goal).getByRole('progressbar', { name: 'This month’s target' })).toHaveAttribute('aria-valuenow', '40');
    expect(goal).toHaveTextContent('From the carrier’s file, September 2026.');
    expect(screen.getByText('September 2026')).toBeInTheDocument();
  });

  it('AC-1: switches to the year — the annual target against the year to date', async () => {
    show(summary());
    await card('Goal vs. actual (APE)');

    await userEvent.click(screen.getByRole('tab', { name: 'Yearly' }));

    const goal = await card('Goal vs. actual (APE)');
    expect(goal).toHaveTextContent('Rp 230.000.000of Rp 500.000.000 target46%');
    expect(within(goal).getByText('This year')).toBeInTheDocument();
    expect(await card('The gap')).toHaveTextContent('Remaining this yearRp 270.000.000');
  });

  it('AC-1: says this month is not uploaded yet — no zero, no attainment, no gap made up', async () => {
    show(summary({
      monthly: { ...figures({ actualMinor: null, attainmentPct: null, gapMinor: null, policiesNeeded: null }), source: null },
    }));
    const goal = await card('Goal vs. actual (APE)');

    expect(goal).toHaveTextContent('Not uploaded yetof Rp 75.000.000 target');
    expect(goal).not.toHaveTextContent('%');
    // No bar: an empty track under *Not uploaded yet* reads as zero.
    expect(within(goal).queryByRole('progressbar')).not.toBeInTheDocument();
    expect(goal).toHaveTextContent('This month’s figure arrives with your office’s upload, after September 2026 ends.');
    const gap = await card('The gap');
    expect(gap).toHaveTextContent('Remaining this month—');
    expect(gap).not.toHaveTextContent('Rp 0');
  });

  it('AC-2: edits nothing — the figure is shown, and Goal Settings is where yours is changed', async () => {
    show(summary({ yearly: { ...figures({ actualMinor: 120 * M }), source: { provenance: 'self_reported', month: null } } }));
    await card('Goal vs. actual (APE)');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Yearly' }));
    const goal = await card('Goal vs. actual (APE)');
    expect(goal).toHaveTextContent('Your own figure, from Goal Settings. Goal Settings is where you change it.');
    expect(within(goal).getByRole('link', { name: 'Goal Settings' })).toHaveAttribute('href', '/goals');
  });

  it('AC-3: the gap in rupiah and in policies, one of which is singular', async () => {
    show(summary({ monthly: { ...figures({ policiesNeeded: 1 }), source: null } }));
    expect(await card('The gap')).toHaveTextContent('Remaining this monthRp 45.000.000≈ Policies still needed1 policy');
  });

  it('AC-3: a target reached says so, and asks for nothing (ADR-0047)', async () => {
    show(summary({
      monthly: { ...figures({ actualMinor: 95 * M, attainmentPct: 127, gapMinor: 0, overMinor: 20 * M, policiesNeeded: 0, targetMet: true }), source: null },
      pace: { closingTarget: 5, closingsLogged: 6, dayOfMonth: 20, daysInMonth: 30, projected: 9, weeksLeft: 2, neededPerWeek: 0, targetMet: true },
    }));
    const gap = await card('The gap');
    expect(gap).toHaveTextContent('Reached — Rp 20.000.000 over');
    expect(gap).toHaveTextContent('≈ Policies still neededNone');
    expect(gap).toHaveTextContent('You’ve already reached this month’s target — nice work. Keep the pace to stay ahead.');
  });

  it('AC-4: a projection, and what each week left needs to catch up', async () => {
    show(summary({ pace: { closingTarget: 6, closingsLogged: 2, dayOfMonth: 14, daysInMonth: 30, projected: 4, weeksLeft: 3, neededPerWeek: 2, targetMet: false } }));
    expect(await card('The gap')).toHaveTextContent(
      'At your current pace, you’re tracking to close 4 policies this month against a target of 6. With 3 weeks left, you’d need to close roughly 2 policies/week to catch up.',
    );
  });

  it('AC-4: before the 7th it only counts, and on pace it says so without a warning', async () => {
    show(summary({ pace: { closingTarget: 6, closingsLogged: 1, dayOfMonth: 3, daysInMonth: 30, projected: null, weeksLeft: 4, neededPerWeek: 2, targetMet: false } }));
    const gap = await card('The gap');
    expect(gap).toHaveTextContent('You’ve closed 1 policy of 6 this month.');
    expect(gap).not.toHaveTextContent('current pace');
  });

  it('AC-4: the pace is this month’s, so the year shows none', async () => {
    show(summary());
    await card('The gap');
    await userEvent.click(screen.getByRole('tab', { name: 'Yearly' }));
    expect(await card('The gap')).not.toHaveTextContent('current pace');
  });

  it('AC-3: a year made before this month began leaves the month met and says so (ADR-0047)', async () => {
    show(summary({
      monthly: { targetMinor: 0, actualMinor: 30 * M, attainmentPct: null, gapMinor: 0, overMinor: 30 * M, policiesNeeded: 0, targetMet: true, source: { provenance: 'imported', month: '2026-09' } },
      pace: { closingTarget: 0, closingsLogged: 2, dayOfMonth: 14, daysInMonth: 30, projected: 4, weeksLeft: 3, neededPerWeek: 0, targetMet: true },
    }));
    const goal = await card('Goal vs. actual (APE)');
    expect(goal).toHaveTextContent('Your year’s target was made before this month began — this month needs nothing more.');
    expect(goal).not.toHaveTextContent('of Rp 0 target');
    expect(await card('The gap')).toHaveTextContent('Reached — Rp 30.000.000 over');
  });

  it('AC-5: a saved goal with no APE target says so, rather than measuring against nothing', async () => {
    show(summary({
      monthly: { ...figures({ targetMinor: null, attainmentPct: null, gapMinor: null, policiesNeeded: null }), source: null },
      yearly: { ...figures({ targetMinor: null, attainmentPct: null, gapMinor: null, policiesNeeded: null }), source: { provenance: 'self_reported', month: null } },
      pace: null,
    }));
    expect(await screen.findByText('Your goal for 2026 has no APE target to measure against yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Goal Settings' })).toHaveAttribute('href', '/goals');
  });

  it('AC-5: no goal saved is no goal — nothing measured, and a way to set one', async () => {
    show(summary({ goal: { set: false, savedAt: null }, pace: null }));
    expect(await screen.findByText(/You haven’t set a goal for 2026 yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set your goal' })).toHaveAttribute('href', '/goals');
    expect(screen.queryByRole('region', { name: 'Goal vs. actual (APE)' })).not.toBeInTheDocument();
  });

  it('waits in the shape of cards, and says so when it fails', async () => {
    stubFetch({ '/summary': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } } } });
    renderWithSession(<PersonalSummaryPage />, { me: AGENT });
    expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
  });
});
