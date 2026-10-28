import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import ActivationPage from '@/app/(agent)/activation/page';
import NewHireDetailPage from '@/app/(agent)/new-hires/[membershipId]/page';
import NewHiresPage from '@/app/(agent)/new-hires/page';
import { renderInLayout, routeParams, stubFetch } from '@test/harness';
import {
  activationView, leaderView, RINA_ME, ROSTER, SARI, SARI_ME, SHELL_STUBS,
} from '@test/activation-fixtures';
import { invite, JOINING_PERMISSIONS, requestedTransfer, TODAY } from '@test/joining-fixtures';
import { formatOfficeDay, formatShortDay } from '@/lib/format';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/new-hires',
}));

/**
 * **P18.96-T7 AC-3 (UI-009): every date on `/new-hires`, a hire's detail and `/activation` is the shared formatter's**
 * (`lib/format.ts`; ADR-0167 §1, OD-196): *22 Jul 2026*, its months the formatter's own Indonesian abbreviations —
 * the one language OD-196 allows beside English words until Phase 18.98 — and never the browser's *07/22/2026*, nor an
 * English month beside an Indonesian one.
 */

const SRC = join(__dirname, '..');
/** Every module that draws one of the three screens — the pages, their components, and the copy they print. */
const SCREENS = [
  'app/(agent)/new-hires/page.tsx',
  'app/(agent)/new-hires/[membershipId]/page.tsx',
  'app/(agent)/activation/page.tsx',
  'components/new-hires.tsx',
  'components/new-hires-joining.tsx',
  'components/waiting-to-join.tsx',
  'components/invite-share.tsx',
  'components/request-inbox.tsx',
  'components/add-agent-form.tsx',
  'components/my-activation.tsx',
  'components/activation-parts.tsx',
  'components/activation-data-item.tsx',
  'lib/activation.ts',
  'lib/invites.ts',
];

/** A date written by hand: the browser's locale, a month read off a `Date`, or a month's name spelled out. */
const BY_HAND = [
  /\.toLocale(Date|Time)?String\(/,
  /Intl\.DateTimeFormat/,
  /\.get(UTC)?(Month|FullYear|Date)\(\)/,
  /['"`](Jan|Feb|Mar|Apr|May|Mei|Jun|Jul|Aug|Agu|Sep|Oct|Okt|Nov|Dec|Des)['"`]/,
  /\b(January|February|March|April|June|July|August|September|October|November|December|Januari|Februari|Maret|Juni|Juli|Agustus|Oktober|Desember)\b/,
];

/** The formatter's months (`lib/format.ts`): every month a date on these screens may carry. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAY_MONTH_YEAR = /(?<!\d)(\d{1,2}) ([A-Z][a-z]{2,}) (\d{4})(?!\d)/g;

/** Every date the page shows, and what is wrong with any of them. */
function datesOnPage(): { dates: string[]; wrong: string[] } {
  // Node by node: a page's whole text runs its cells together (*30 Agu 202659 /90*).
  const texts: string[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) texts.push(node.textContent ?? '');
  const dates = texts.flatMap((text) => [...text.matchAll(DAY_MONTH_YEAR)].map((m) => m[0]));
  const wrong = [
    ...dates.filter((d) => !MONTHS.includes(d.split(' ')[1])),
    ...texts.flatMap((text) => [...text.matchAll(/(?<!\d)\d{1,2}\/\d{1,2}\/\d{2,4}(?!\d)/g)].map((m) => m[0])),
  ];
  // Each `<time>` says what its own value is, through the formatter: a day as its day, an instant as its office day.
  for (const time of Array.from(document.querySelectorAll('time'))) {
    const value = time.getAttribute('dateTime') ?? '';
    const expected = value.length === 10 ? formatShortDay(value, { year: true }) : formatOfficeDay(value);
    if (time.textContent !== expected) wrong.push(`<time ${value}> ${time.textContent}`);
  }
  return { dates, wrong };
}

describe('P18.96-T7 AC-3 (UI-009): one date formatter on the three screens', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P18.96-T7 AC-3 no module drawing them writes a date by hand', () => {
    const offenders = SCREENS.flatMap((file) => {
      const source = readFileSync(join(SRC, file), 'utf8');
      return BY_HAND.filter((pattern) => pattern.test(source)).map((pattern) => `${file}: ${pattern}`);
    });
    expect(offenders).toEqual([]);
  });

  it('P18.96-T7 AC-3 /new-hires: the roster’s join dates, first sales and leaving days, and Waiting to join, all the formatter’s', async () => {
    stubFetch({
      ...SHELL_STUBS,
      '/new-hires': { body: ROSTER },
      '/new-hires/invites': { body: { today: TODAY, invites: [invite()] } },
      '/new-hires/transfers': { body: [requestedTransfer()] },
      '/join/requests': { body: [] },
    });
    renderInLayout(AgentLayout, <NewHiresPage />, { me: { ...SARI_ME, permissions: [...SARI_ME.permissions, ...JOINING_PERMISSIONS] } });
    await screen.findByRole('region', { name: 'Waiting to join' });
    await screen.findByRole('region', { name: 'Not activated' });
    const { dates, wrong } = datesOnPage();
    expect(wrong).toEqual([]);
    // The roster's (*30 Agu 2026*, *21 Okt 2026*) and the invite's join date (*27 Okt 2026*), one shape.
    expect(dates).toEqual(expect.arrayContaining(['30 Agu 2026', '23 Agu 2026', '21 Okt 2026', '27 Okt 2026']));
  });

  it('P18.96-T7 AC-3 a hire’s detail: the join date, who ticked what and when, and the coaching note, all the formatter’s', async () => {
    stubFetch({
      ...SHELL_STUBS,
      'GET /new-hires/mem-rina': {
        body: leaderView({ startCorrected: { by: SARI, at: '2026-08-07T02:00:00.000Z' } }),
      },
    });
    renderInLayout(AgentLayout, <NewHireDetailPage params={routeParams({ membershipId: 'mem-rina' })} />, { me: SARI_ME });
    await screen.findByRole('heading', { level: 2, name: 'Activation progress' });
    const { dates, wrong } = datesOnPage();
    expect(wrong).toEqual([]);
    // The ⓘ's words (*Ticked by Sari Puspita · 12 Agu 2026*), the source line, the note's line.
    expect(dates).toEqual(expect.arrayContaining(['12 Agu 2026', '20 Sep 2026', '30 Sep 2026']));
  });

  it('P18.96-T7 AC-3 /activation: the join date, the ticks and the leader’s note, all the formatter’s', async () => {
    stubFetch({ ...SHELL_STUBS, 'GET /activation/me': { body: activationView() } });
    renderInLayout(AgentLayout, <ActivationPage />, { me: RINA_ME });
    await screen.findByRole('heading', { level: 2, name: 'Your activation progress' });
    const { dates, wrong } = datesOnPage();
    expect(wrong).toEqual([]);
    expect(dates).toEqual(expect.arrayContaining(['6 Agu 2026', '10 Agu 2026', '30 Sep 2026']));
  });
});
