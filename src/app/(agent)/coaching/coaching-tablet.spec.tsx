import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, digestAt, makeMe, renderWithSession, stubFetch, wears } from '@test/harness';
import type { RosterRow, RosterStatus } from '@/lib/coaching';
import CoachingRosterPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/coaching',
}));

/**
 * **`/coaching` on a tablet** (P19.1-T5 AC-1; UI-115: *names truncated or wrapped in tablet tables*, the
 * `coaching-newhires-tablet` mockup's screen 1). At 768px the columns cut *ARIEF HIDA…* while *Terakhir di-coaching oleh*
 * was mostly *—*; a tablet now draws the phone's rows, slightly larger: the full name on one line, one meta line, the
 * status pill, ›, and no table. Only *… · terlambat* is red, not the *oleh* part. A phone and a desktop draw what they
 * drew, to the byte.
 */

const LEADER = makeMe({
  membership: {
    membershipId: 'mem-jordan', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 5,
  },
  permissions: ['coaching_session:read'],
});

const AGENT_RUNG = { code: 'AGENT', label: 'Agent' };
const AAB_RUNG = { code: 'AAB', label: 'Associate Agency Builder' };

function person(
  membershipId: string, name: string, days: number | null, status: RosterStatus,
  over: Partial<RosterRow> & { overdue?: boolean; coach?: string | null } = {},
): RosterRow {
  const { overdue = false, coach = 'Jordan Pratama', ...rest } = over;
  return {
    membershipId, name, rung: AGENT_RUNG, depth: 1,
    lastOneOnOne: days === null ? null : {
      days, date: '2026-09-20', overdue, coach: coach === null ? null : { membershipId: `coach-${coach}`, name: coach },
    },
    status,
    ...rest,
  };
}

/** `coaching/page.spec.tsx`'s roster, the same people: the digests below were taken from it before the change. */
const ROSTER = {
  today: '2026-10-02',
  overdueAfterDays: 7,
  directAgents: [
    person('mem-rina', 'Rina Wijaya', 5, 'watch_closely'),
    person('mem-fajar', 'Fajar Hidayat', 12, 'needs_attention', { overdue: true }),
    person('mem-melati', 'Melati Putri', null, 'no_goal_set'),
  ],
  units: [
    {
      head: person('mem-dimas', 'Dimas Aditya', 3, 'watch_closely', { rung: AAB_RUNG }),
      members: [
        person('mem-yuni', 'Yuni Sartika', 20, 'on_track', { depth: 2, overdue: true, coach: 'Dimas Aditya' }),
        person('mem-bayu', 'Bayu Kurniawan', null, 'needs_attention', { depth: 2 }),
      ],
    },
    {
      head: person('mem-sri', 'Sri Lestari', 0, 'on_track', { rung: AAB_RUNG }),
      members: [
        person('mem-agus', 'Agus Santoso', 1, 'watch_closely', { depth: 2, coach: 'Sri Lestari' }),
        person('mem-wulan', 'Wulan Sari', 9, 'on_track', { depth: 2, rung: AAB_RUNG, overdue: true, coach: null }),
        person('mem-tono', 'Tono Saputra', 2, 'no_goal_set', { depth: 3, coach: 'Wulan Sari' }),
      ],
    },
  ],
};

const EVERYONE = [
  'Rina Wijaya', 'Fajar Hidayat', 'Melati Putri', 'Dimas Aditya', 'Yuni Sartika', 'Bayu Kurniawan',
  'Sri Lestari', 'Agus Santoso', 'Wulan Sari', 'Tono Saputra',
];

/**
 * **The roster's markup on the build before P19.1-T5**, at the sizes UI-115 does not list (*Mobile and desktop
 * unchanged*), from this fixture, 2026-11-05 (`digestAt`, P18.9-T7's technique).
 */
const BEFORE_T5: Record<375 | 1024 | 1280, string> = {
  375: 'bf4943c1ced4214aea035e8cee805aeca75875b1c00d1a118388c9f04cb39f72',
  1024: '1cda8d8058ddd9b24e52a1e680b5cd6178bf0845c69943694785db4277d044a6',
  1280: '1cda8d8058ddd9b24e52a1e680b5cd6178bf0845c69943694785db4277d044a6',
};

async function open(px: number) {
  atWidth(px);
  stubFetch({ '/coaching/coachees': { body: ROSTER } });
  renderWithSession(<CoachingRosterPage />, { me: LEADER });
  await screen.findByRole('link', { name: 'Rina Wijaya' });
  return document.querySelector('[data-roster]') as HTMLElement;
}

const linkOf = (name: string) => screen.getByRole('link', { name });
const rowOf = (name: string) => linkOf(name).closest('[data-person-row]') as HTMLElement;
const lineOf = (name: string) => rowOf(name).querySelector('[data-roster-line]') as HTMLElement;

afterEach(() => vi.unstubAllGlobals());

describe('P19.1-T5 AC-1 /coaching on a tablet: the phone’s rows, no table (UI-115)', () => {
  it.each([768, 1023])('P19.1-T5 AC-1 at %ipx: no columns header and no column cells — every row the phone’s', async (px) => {
    const roster = await open(px);
    expect(within(roster).queryByText('Last Coached By')).not.toBeInTheDocument();
    expect(within(roster).queryByText('Last 1:1')).not.toBeInTheDocument();
    for (const name of EVERYONE) {
      const row = rowOf(name);
      // One meta line under the name, then the status pill and the ›, and nothing between them.
      expect(lineOf(name)).not.toBeNull();
      expect(wears(lineOf(name), px).split(' ')).not.toContain('hidden');
      expect(row.querySelector(':scope > div:nth-of-type(2) [data-tone]')).not.toBeNull();
      expect(row.querySelector(':scope > svg')).not.toBeNull();
      expect(row).toHaveClass('min-h-[3.75rem]');
    }
    expect(screen.getAllByRole('link').filter((a) => a.hasAttribute('data-row-main')).map((a) => a.textContent)).toEqual(EVERYONE);
  });

  it('P19.1-T5 AC-1 at 768px: every name in full on one line — never cut with …', async () => {
    await open(768);
    for (const name of EVERYONE) {
      const worn = wears(linkOf(name), 768).split(' ');
      expect(worn).not.toContain('truncate');
      expect(worn).toContain('text-clip');
      expect(linkOf(name)).toHaveTextContent(name);
    }
  });

  it('P19.1-T5 AC-1 at 768px: the meta line — the last 1:1, who held it in full; only … · terlambat red, not the oleh part', async () => {
    await open(768);
    expect(lineOf('Rina Wijaya')).toHaveTextContent(/^5 days ago · by Jordan Pratama$/);
    expect(lineOf('Rina Wijaya')).toHaveClass('text-signal-grey');
    expect(lineOf('Rina Wijaya').querySelector('.text-signal-red')).toBeNull();
    const late = lineOf('Fajar Hidayat');
    expect(late).toHaveTextContent(/^12 days ago · overdue · by Jordan Pratama$/);
    expect(late).not.toHaveClass('text-signal-red');
    const red = late.querySelector('.text-signal-red') as HTMLElement;
    expect(red).toHaveTextContent(/^12 days ago · overdue$/);
    // Nobody held it: the line is the date alone, red when late.
    expect(lineOf('Wulan Sari')).toHaveTextContent(/^9 days ago · overdue$/);
    expect(lineOf('Melati Putri')).toHaveTextContent(/^No 1:1 yet$/);
    expect(lineOf('Melati Putri').querySelector('.text-signal-red')).toBeNull();
  });

  it('P19.1-T5 AC-1 at 768px: slightly larger than the phone — a 40px avatar and a 13px line; the status still a tinted pill', async () => {
    await open(768);
    const avatar = rowOf('Rina Wijaya').querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(avatar.style.width).toBe('40px');
    expect(lineOf('Rina Wijaya')).toHaveClass('text-base');
    expect(within(rowOf('Fajar Hidayat')).getByText('Needs attention')).toHaveAttribute('data-tone', 'red');
    // A unit head keeps the grey rung pill beside the name (D-27: words, never a dot).
    expect(within(rowOf('Dimas Aditya')).getByText('AAB')).toHaveAttribute('data-tone', 'grey');
  });

  it('P19.1-T5 AC-1 at 768px: the AAB units still a tree, the line under the 40px avatar', async () => {
    await open(768);
    const team = screen.getByRole('list', { name: 'Sri Lestari’s unit' });
    expect(team).toHaveClass('ml-[31px]');
    expect(screen.getByRole('list', { name: 'Wulan Sari’s unit' })).toHaveClass('ml-[19px]');
  });

  /*
   * *Amended 2026-11-07 (P19.8-T1 AC-5; R6, MOB UI-165, MOB UI-178):* on a phone a person's name is never cut —
   * `PersonRow` adds `max-md:whitespace-normal max-md:break-words` to every name. The digest is taken with those two put
   * back as they were, and still matches the baseline: nothing else moved, and from 768px nothing did.
   */
  it.each([375, 1024, 1280] as const)('P19.1-T5 AC-1 at %ipx the roster is drawn as before, to the byte', async (px) => {
    const roster = await open(px);
    const before = roster.cloneNode(true) as HTMLElement;
    const added = new Set(['max-md:whitespace-normal', 'max-md:break-words']);
    for (const name of before.querySelectorAll('[data-person-row] [data-row-main], [data-person-row] span.uppercase')) {
      name.setAttribute('class', (name.getAttribute('class') ?? '').split(' ').filter((c) => !added.has(c)).join(' '));
    }
    expect(digestAt(before, px)).toBe(BEFORE_T5[px]);
  });

  it('P19.1-T5 AC-1 passes axe at 768px', async () => {
    await open(768);
    const rules = { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } };
    expect((await axe(document.body, rules)).violations).toEqual([]);
  });
});
