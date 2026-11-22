import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, makeMe, renderWithSession, stubFetch, wears } from '@test/harness';
import type { Roster, RosterRow } from '@/lib/coaching';
import CoachingRosterPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/coaching',
}));

/**
 * **`/coaching` at every size** (P19.18-T5; ADR-0271 §9; the brief's part C: *the same pages as phone and laptop — same
 * blocks, same order, same names*). The phone's mockup (`coaching-owner-mobile`) is the design; a tablet held sideways and
 * a laptop draw the same unit lines, team lines and rows, in one column across the frame: no column header, no column
 * cells, nothing cut. *Changed 2026-11-20: from P19.1-T5 a tablet drew the phone's rows and a laptop columns
 * (UI-115), pinned to the byte by digests the redesign retires.*
 */

const LEADER = makeMe({
  membership: {
    membershipId: 'mem-agus', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 3,
  },
  permissions: ['coaching_session:read', 'member:update_phone'],
});

const row = (membershipId: string, name: string, over: Partial<RosterRow> = {}): RosterRow => ({
  membershipId, name, photoUrl: null, rung: { code: 'AGENT', label: 'Agent' }, depth: 1, lastOneOnOne: null,
  status: 'no_goal_set', coaching: { status: 'never', days: null, coach: null }, phone: '+6281211002200',
  isReader: false, opens: true, ...over,
});

/** An AB's roster (OD-394: the same design for every reader): *Unit Anda*, then an AAB's unit with a team inside. */
const ROSTER: Roster = {
  today: '2026-11-20',
  overdueAfterDays: 7,
  scope: 'direct',
  scopes: { offered: ['unit', 'direct'], default: 'direct' },
  total: 6,
  sections: [
    {
      key: 'own', kind: 'own', leader: { membershipId: 'mem-agus', name: 'Agus Prasetyo', photoUrl: null }, count: 3,
      rows: [
        row('mem-agus', 'Agus Prasetyo', { rung: { code: 'AB', label: 'AB' }, depth: 0, isReader: true, phone: null }),
        row('mem-dewi', 'Dewi Lestari', { rung: { code: 'AAB', label: 'AAB' } }),
        row('mem-hilmy', 'Hilmy Fathurrahman Wicaksono', {
          coaching: { status: 'recent', days: 3, coach: { membershipId: 'mem-agus', name: 'Agus Prasetyo' } },
        }),
      ],
      teams: [],
    },
    {
      key: 'mem-sari', kind: 'unit', leader: { membershipId: 'mem-sari', name: 'Sari Puspita', photoUrl: null }, count: 3,
      rows: [row('mem-sari', 'Sari Puspita', { rung: { code: 'AAB', label: 'AAB' } }), row('mem-budi', 'Budi Santoso', { depth: 2 })],
      teams: [{
        key: 'mem-nina', leader: { membershipId: 'mem-nina', name: 'Nina Lestari', photoUrl: null }, count: 1,
        rows: [row('mem-nina', 'Nina Lestari', { rung: { code: 'AAB', label: 'AAB' }, depth: 2 })],
      }],
    },
  ],
};

const NAMES = ['You (Agus)', 'Dewi Lestari', 'Hilmy Fathurrahman Wicaksono', 'Sari Puspita', 'Budi Santoso', 'Nina Lestari'];

async function open(px: number) {
  atWidth(px);
  stubFetch({ '/coaching/coachees': { body: ROSTER } });
  renderWithSession(<CoachingRosterPage />, { me: LEADER });
  await screen.findByRole('link', { name: 'Dewi Lestari' });
  return document.querySelector('[data-roster]') as HTMLElement;
}

const linkOf = (name: string) => screen.getByRole('link', { name });
const rowOf = (name: string) => linkOf(name).closest('[data-person-row]') as HTMLElement;

afterEach(() => vi.unstubAllGlobals());

describe('P19.18-T5 /coaching at 390, 1024 and 1280: the same rows, the same order', () => {
  it.each([390, 1024, 1280])('P19.18-T5 AC-2 at %ipx: every person in the same order, no column header, each row its tile and WhatsApp', async (px) => {
    const roster = await open(px);
    expect(roster.querySelector('[aria-hidden="true"].max-md\\:hidden')).toBeNull();
    expect(screen.getAllByRole('link').filter((a) => a.hasAttribute('data-row-main')).map((a) => a.textContent)).toEqual(NAMES);
    for (const name of NAMES.slice(1)) {
      expect(rowOf(name).querySelector('[data-coaching-status]')).not.toBeNull();
      expect(rowOf(name).querySelector('[data-roster-whatsapp]')).not.toBeNull();
      expect(rowOf(name)).toHaveClass('min-h-[3.75rem]');
    }
  });

  it.each([1024, 1280])('P19.18-T5 AC-2 at %ipx: a long name in full on its line, the unit lines across the frame', async (px) => {
    const roster = await open(px);
    expect(linkOf('Hilmy Fathurrahman Wicaksono')).toHaveTextContent('Hilmy Fathurrahman Wicaksono');
    // The card is the frame's whole width from 1024px (P19.13-T1 AC-2), its lines full rows.
    expect(wears(roster.parentElement!, px).split(' ')).toContain('max-w-none');
    expect(roster.querySelectorAll('[data-roster-section] > h3 button')).toHaveLength(2);
  });

  it('P19.18-T5 AC-2 an AB’s roster: Unit Anda first with the reader’s own row, then the AAB’s unit with its team line', async () => {
    const roster = await open(1024);
    expect([...roster.querySelectorAll('[data-unit-label]')].map((l) => l.textContent)).toEqual(['Your Unit', 'SARI PUSPITA’s unit']);
    expect(roster.querySelector('[data-roster-team="mem-nina"] h4')).toHaveTextContent('NINA LESTARI’s unit1 person');
    expect(linkOf('You (Agus)')).toHaveAttribute('href', '/coaching/me');
  });

  it.each([390, 1024])('P19.18-T5 passes axe at %ipx', async (px) => {
    await open(px);
    const rules = { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } };
    expect((await axe(document.body, rules)).violations).toEqual([]);
  });
});
