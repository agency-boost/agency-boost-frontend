import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { AppShell, type NavSection } from './app-shell';
import { StatusPill } from './ui/status-pill';
import { RoleBadge } from './ui/role-badge';
import { Stepper } from './ui/stepper';
import { ProgressBar } from './ui/progress-bar';
import { EmptyState } from './ui/empty-state';
import { KpiTile } from './ui/kpi-tile';
import { SaveStatus } from './ui/save-status';
import { NumberBadge } from './ui/number-badge';
import { ConfigBadge } from './ui/config-badge';
import { Segmented } from './ui/segmented';
import { CascadeRow } from './ui/cascade-row';
import { Dialog } from './ui/dialog';
import { Field, TextInput } from './ui/field';

/**
 * WCAG 2.1 AA, checked by axe on every primitive and on the shell.
 *
 * Automated checks catch perhaps 40% of real issues, so this is a floor rather than a
 * verdict — keyboard-only and screen-reader passes happen at phase exit. What it does
 * catch reliably is the regressions: a dropped label, a control that stops being
 * reachable, a heading order that breaks.
 */

const SECTIONS: readonly NavSection[] = [
  {
    label: 'Personal tools',
    items: [
      { label: 'Activity management', href: '/activity', icon: 'activity', active: true },
      { label: 'Leads management', href: '/leads', icon: 'funnel' },
    ],
  },
  {
    label: 'Reporting',
    items: [{ label: 'Advanced analytics', href: '#', icon: 'chartUp', upcoming: true }],
  },
];

async function expectNoViolations(ui: React.ReactElement) {
  const { container } = render(ui);
  const results = await axe(container, {
    rules: {
      // jsdom has no canvas, so axe cannot sample rendered pixels and its
      // colour-contrast rule cannot run here — leaving it enabled produces noise and,
      // worse, the false impression that contrast is covered. It is verified instead
      // by the ratio test below, which computes from the token values directly, and by
      // a real-browser axe pass once Playwright lands.
      'color-contrast': { enabled: false },
    },
  });
  const violations = results.violations ?? [];
  if (violations.length) {
    const detail = violations
      .map((v) => `${v.id}: ${v.help} (${v.nodes.length} node(s))`)
      .join('\n  ');
    throw new Error(`axe found ${violations.length} violation(s):\n  ${detail}`);
  }
  expect(violations).toHaveLength(0);
}

describe('accessibility', () => {
  it('the app shell has no violations', async () => {
    await expectNoViolations(
      <AppShell
        sections={SECTIONS}
        user={{ name: 'Rina Wijaya', role: 'Agent · KPM 0417', initials: 'RW' }}
        title="Log Activity"
        subtitle="Enter today's activities in 1 minute."
      >
        <p>content</p>
      </AppShell>,
    );
  });

  it('the stepper has no violations — the control agents use most', async () => {
    await expectNoViolations(
      <Stepper value={3} onChange={() => {}} label="Submission polis" />,
    );
  });

  it('status pills have no violations in all three states, and in the roster’s Watch closely', async () => {
    await expectNoViolations(
      <div>
        <StatusPill status="success" />
        <StatusPill status="alert" />
        <StatusPill status="neutral" />
        <StatusPill status="watch" label="Watch closely" />
      </div>,
    );
  });

  it('role badges have no violations', async () => {
    await expectNoViolations(
      <div>
        <RoleBadge role="ab" />
        <RoleBadge role="aab" />
        <RoleBadge role="agent" />
      </div>,
    );
  });

  it('the progress bar has no violations, including with no target', async () => {
    await expectNoViolations(
      <div>
        <ProgressBar value={45} target={100} />
        <ProgressBar value={5} target={0} />
      </div>,
    );
  });

  it('the empty state has no violations', async () => {
    await expectNoViolations(
      <EmptyState title="No leads yet — add your first one above." action={<button>Add lead</button>} />,
    );
  });

  it('KPI tiles have no violations in all three variants', async () => {
    await expectNoViolations(
      <div>
        <KpiTile label="Already produced" value="Rp 120.000.000" />
        <KpiTile label="This month's APE target" value="Rp 42.000.000" variant="insight" />
        <KpiTile label="Days done" value="90" unit="/90" variant="complete" />
      </div>,
    );
  });

  it('the save status has no violations, and is a live region in both states', async () => {
    await expectNoViolations(
      <div>
        <SaveStatus state="unsaved">Not yet saved</SaveStatus>
      </div>,
    );
    await expectNoViolations(
      <div>
        <SaveStatus state="saved">Saved · 14 touches</SaveStatus>
      </div>,
    );
  });

  it('a numbered row has no violations — the badge is hidden and the label carries the name', async () => {
    await expectNoViolations(
      <div>
        <NumberBadge n={3} />
        <span>Menghubungi prospek</span>
        <ConfigBadge tone="navy" className="normal-case tracking-normal">Activity #3</ConfigBadge>
      </div>,
    );
  });

  it('the segmented control has no violations — tablist, tab and the panel it names', async () => {
    // A `role="tab"` whose `aria-controls` points at nothing trips `aria-valid-attr-value`, and a
    // `tablist` with no `tab` children trips `aria-required-children`. Both arrive at screen level in
    // a 1,600-line file if they are not caught here.
    await expectNoViolations(
      <Segmented
        label="How you want to set it"
        tabs={[
          { id: 'direct', label: 'Set APE target directly' },
          { id: 'from_savings', label: 'Calculate from savings target' },
        ]}
        active="direct"
        onSelect={() => {}}
      >
        {() => <p>Annual APE target</p>}
      </Segmented>,
    );
  });

  it('the cascade row has no violations, and its arrows are not the only carrier', async () => {
    await expectNoViolations(
      <CascadeRow
        columns={[
          { label: 'Leads contacted', chip: 'Activity #3', icon: 'clipboard', month: '67', week: '≈ 16/week' },
          { label: 'Appointments', chip: 'Activity #4', icon: 'calendar', month: '20', week: '≈ 5/week' },
          { label: 'Closings', chip: 'Activity #6', icon: 'target', month: '6', week: '≈ 1/week', hero: true },
        ]}
        links={['30%', '30%']}
      />,
    );
  });

  it('an affixed field has no violations, and the affix is not a second unnamed control', async () => {
    await expectNoViolations(
      <Field label="Annual APE target" htmlFor="ape">
        <TextInput id="ape" prefix="Rp" suffix="per year" value="500000000" onChange={() => {}} />
      </Field>,
    );
  });

  it('the confirm dialog has no violations while open', async () => {
    await expectNoViolations(
      <Dialog
        open
        message="Delete Rina Wijaya? Nothing is erased — the record stops appearing here."
        confirmLabel="Delete lead"
        tone="danger"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
  });

  describe('colour contrast, computed from the tokens themselves', () => {
    /** WCAG relative luminance. */
    function luminance(hex: string): number {
      const v = hex.replace('#', '');
      const [r, g, b] = [0, 2, 4].map((i) => {
        const c = parseInt(v.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    function ratio(a: string, b: string): number {
      const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
      return (x + 0.05) / (y + 0.05);
    }
    /**
     * Composite a translucent wash over an opaque surface, and return the hex you actually see.
     *
     * A tint is not a colour anybody can look up — `bg-amber/8` on a white card is a *third* value,
     * and it is the value the text has to clear. Computing it here rather than hardcoding `#FEF7F1`
     * means changing the wash or the surface moves the assertion with it.
     */
    function over(fg: string, alpha: number, bg: string): string {
      const part = (hex: string, i: number) => parseInt(hex.replace('#', '').slice(i, i + 2), 16);
      const mix = [0, 2, 4]
        .map((i) => Math.round(part(fg, i) * alpha + part(bg, i) * (1 - alpha)))
        .map((c) => c.toString(16).padStart(2, '0'))
        .join('');
      return `#${mix}`;
    }

    const NAVY = '#1B2B4B';
    const AMBER = '#F2994A';
    const AMBER_DARK = '#D97F30';
    const AMBER_DEEP = '#B5651D';
    const AMBER_INK = '#A85E1B';
    const NAVY_SOFT = '#2E4370';
    const BASE = '#FAF9F7';
    const CARD = '#FFFFFF';
    const MUTED = '#5F5E5A';
    const SUCCESS = '#3B6D11';
    const ALERT = '#A32D2D';
    const SIDEBAR_TEXT = '#EDEFF5';

    it('body text clears 4.5:1 on both surfaces', () => {
      expect(ratio(NAVY, BASE)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(NAVY, CARD)).toBeGreaterThanOrEqual(4.5);
    });

    it('muted text clears 4.5:1 on the card surface', () => {
      expect(ratio(MUTED, CARD)).toBeGreaterThanOrEqual(4.5);
    });

    it('the Upcoming pill clears 4.5:1: muted words on its 6% navy wash, over the card and the page (P10.1-T2)', () => {
      // `coming-in-phase.tsx`: 10px bold, so the small-text floor. The card holds a page's sign; the
      // page's own ground holds a section sign's heading.
      expect(ratio(MUTED, over(NAVY, 0.06, CARD))).toBeGreaterThanOrEqual(4.5);
      expect(ratio(MUTED, over(NAVY, 0.06, BASE))).toBeGreaterThanOrEqual(4.5);
    });

    it('status colours clear 4.5:1 on the card surface', () => {
      expect(ratio(SUCCESS, CARD)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(ALERT, CARD)).toBeGreaterThanOrEqual(4.5);
    });

    it('the danger button clears 4.5:1 on both surfaces it appears on', () => {
      // It is alert-red text on a transparent ground, so whichever surface is behind it
      // is the one that has to clear. The removal panel sits on base, the row it came
      // from on card, and only card was pinned before P3-T7.
      expect(ratio(ALERT, BASE)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(ALERT, CARD)).toBeGreaterThanOrEqual(4.5);
    });

    it('sidebar text clears 4.5:1 on navy', () => {
      expect(ratio(SIDEBAR_TEXT, NAVY)).toBeGreaterThanOrEqual(4.5);
    });

    it('navy on an amber button clears 4.5:1 — which is why buttons are not amber-on-white', () => {
      expect(ratio(NAVY, AMBER)).toBeGreaterThanOrEqual(4.5);
    });

    /**
     * Every ground an amber numeral or pill actually sits on.
     *
     * A tint is a third value nobody can look up: `bg-amber/15` on a white card is neither amber nor
     * white, and it is what the text has to clear. Composited here so that changing a wash moves the
     * assertion with it. 8% is `.kpi-tile.insight` / `.result-tile` / `.cascade-col`
     * (`Overall.html:688`, `:695`, `:707`); 15% is the AB role badge; 20% is the two hand-rolled
     * copies of it on the profile and members screens.
     */
    const GROUNDS = [
      ['white card', CARD],
      ['base', BASE],
      ['the 8% amber tint', over(AMBER, 0.08, CARD)],
      ['the 15% amber tint', over(AMBER, 0.15, CARD)],
      ['the 20% amber tint', over(AMBER, 0.2, CARD)],
    ] as const;

    it('plain amber fails as text on every ground', () => {
      for (const [, ground] of GROUNDS) expect(ratio(AMBER, ground)).toBeLessThan(3);
    });

    it.each(GROUNDS)('amber-dark clears no floor at all on %s', (_name, ground) => {
      /*
       * **This is a correction, pinned so it cannot come undone.**
       *
       * `tokens.md` told everybody to use amber-dark for amber text on a light surface, and six call
       * sites followed it. It is 2.99:1 on white at best and below that everywhere else — under the
       * 3:1 *large-text* floor, never mind 4.5:1.
       *
       * The test that was here asserted only `ratio(amber-dark, card) > ratio(amber, card)`, which
       * anything beats. A relationship is not a floor, and that is why this went unnoticed.
       */
      expect(ratio(AMBER_DARK, ground)).toBeLessThan(3);
    });

    it.each(GROUNDS)('amber-deep clears the large-text floor on %s', (_name, ground) => {
      expect(ratio(AMBER_DEEP, ground)).toBeGreaterThanOrEqual(3);
      expect(ratio(AMBER_DEEP, ground)).toBeGreaterThan(ratio(AMBER_DARK, ground));
    });

    it.each(GROUNDS)('amber-deep does not reach the small-text floor on %s', (_name, ground) => {
      /*
       * Which is the boundary on amber-deep's use, and it decides real call sites.
       *
       * A `KpiTile` value is `text-2xl` bold — 20px bold, past WCAG's 18.66px-bold threshold — so it
       * is large text, 3:1 is its floor, and amber-deep is comfortable. As small text it is not: the
       * leads Type word, 13px semibold, uses **amber-ink** (pinned below), and the leads table's
       * mid-stage Status keeps **navy** text on a tint, because no amber clears 4.5:1 on that tint.
       *
       * It also means the 10px role badges still miss 4.5:1 with amber-deep (3.87:1). Better than the
       * 2.67:1 they shipped with, and not yet right — recorded rather than silently called fixed.
       */
      expect(ratio(AMBER_DEEP, ground)).toBeLessThan(4.5);
    });

    /**
     * The grounds a leads-table word sits on with no tint of its own: the card the table is drawn on,
     * the page's base, and the row hover — the prototype's 1.5% navy wash (`Overall.html:424`,
     * `--row-hover` in globals.css) — over each.
     */
    const ROW_GROUNDS = [
      ['white card', CARD],
      ['base', BASE],
      ['the row hover on card', over(NAVY, 0.015, CARD)],
      ['the row hover on base', over(NAVY, 0.015, BASE)],
    ] as const;

    it.each(ROW_GROUNDS)('the leads Type word clears the small-text floor on %s', (_name, ground) => {
      /*
       * `.type-badge-select` colours the word itself (`Overall.html:476-477`) at the table's 13px
       * semibold — small text, so 4.5:1. The prototype's amber-dark is 2.99:1 at best; amber-ink is
       * the one amber that clears, and the reason it exists. Recruitment's navy-soft and the
       * unchosen placeholder's muted grey are the prototype's own and clear with room.
       */
      expect(ratio(AMBER_INK, ground)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(NAVY_SOFT, ground)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(MUTED, ground)).toBeGreaterThanOrEqual(4.5);
    });

    it('Watch closely puts navy words on its 15% amber tint, on every ground the roster sets it on (P11-T6)', () => {
      /*
       * The prototype's pill is a darker yellow on a yellow wash (`Overall.html:1445`), in no token.
       * The roster sets it on a plain row, the row hover and a unit head's 4.5% navy-soft tint, and
       * no amber clears 4.5:1 as small text on an amber tint on any of them (below) — so the words are
       * navy, as the leads table's mid-stage status is (F-71), and the tint carries the colour.
       */
      const grounds = [CARD, over(NAVY, 0.015, CARD), over(NAVY_SOFT, 0.045, CARD), over(NAVY, 0.015, over(NAVY_SOFT, 0.045, CARD))];
      for (const ground of grounds) {
        expect(ratio(NAVY, over(AMBER, 0.15, ground))).toBeGreaterThanOrEqual(4.5);
        expect(ratio(AMBER_INK, over(AMBER, 0.15, ground))).toBeLessThan(4.5);
      }
    });

    it('the capability ladder’s current stage puts navy on its amber, where the prototype’s white and amber-dark miss (P11-T9)', () => {
      /*
       * `.cap-stage.current` (`Overall.html:1354-1361`): an 8% amber card, its number white on
       * amber-dark in a 22px disc, and *Current stage* in amber-dark on a 15% wash — 11px and 10px
       * bold, small text. Neither clears 4.5:1, so both are navy, and the amber stays the ground. The
       * milestones beside them are muted on the same 8% tint.
       */
      const current = over(AMBER, 0.08, CARD);
      expect(ratio('#FFFFFF', AMBER_DARK)).toBeLessThan(4.5);
      expect(ratio(AMBER_DARK, over(AMBER, 0.15, current))).toBeLessThan(4.5);
      expect(ratio(NAVY, AMBER)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(NAVY, over(AMBER, 0.15, current))).toBeGreaterThanOrEqual(4.5);
      expect(ratio(MUTED, current)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(MUTED, BASE)).toBeGreaterThanOrEqual(4.5);
    });

    it('amber-ink is a word on a plain ground — it misses 4.5:1 on the mid-rung’s amber tint', () => {
      // Which is why the Status column beside it still carries navy text on its tint (F-71).
      expect(ratio(AMBER_INK, over(AMBER, 0.13, CARD))).toBeLessThan(4.5);
    });

    describe('the calendar (H-19, P12-T2 AC-12, P12-T3 AC-6)', () => {
      /*
       * Every pair the calendar draws, on the grounds it draws it on: the card, today's 8% amber column
       * and the weekend's 1.5% navy one. The prototype's own teal, its amber-dark day number and its
       * Coaching badge each miss 4.5:1, and are pinned missing, so the fix cannot quietly come undone.
       */
      const TEAL = '#2C7A73';
      const TEAL_INK = '#24665F';
      const INFO = '#2F80ED';
      const today = over(AMBER, 0.08, CARD);
      const weekend = over(NAVY, 0.015, CARD);

      it('white on teal clears 4.5:1 — the chosen Travel type', () => {
        expect(ratio('#FFFFFF', TEAL)).toBeGreaterThanOrEqual(4.5);
      });

      it('a trip’s words are teal-ink on its 14% tint, where the prototype’s teal misses', () => {
        for (const ground of [CARD, today, weekend]) {
          expect(ratio(TEAL_INK, over(TEAL, 0.14, ground))).toBeGreaterThanOrEqual(4.5);
          expect(ratio(TEAL, over(TEAL, 0.14, ground))).toBeLessThan(4.5);
        }
      });

      it('today’s number is amber-ink on today’s tint, where amber-dark misses', () => {
        expect(ratio(AMBER_INK, today)).toBeGreaterThanOrEqual(4.5);
        expect(ratio(AMBER_DARK, today)).toBeLessThan(3);
      });

      it('the Coaching badge’s words are navy on its 18% tint, where amber-dark and amber-ink miss', () => {
        const coaching = over(AMBER, 0.18, CARD);
        expect(ratio(NAVY, coaching)).toBeGreaterThanOrEqual(4.5);
        expect(ratio(AMBER_DARK, coaching)).toBeLessThan(3);
        expect(ratio(AMBER_INK, coaching)).toBeLessThan(4.5);
      });

      it('an entry’s navy words clear 4.5:1 on every type’s tint, on every column', () => {
        const tints = [[NAVY_SOFT, 0.12], [AMBER, 0.18], [ALERT, 0.1], [SUCCESS, 0.1], [TEAL, 0.12]] as const;
        for (const ground of [CARD, today, weekend]) {
          for (const [colour, alpha] of tints) expect(ratio(NAVY, over(colour, alpha, ground))).toBeGreaterThanOrEqual(4.5);
          // A compared member's busy block: navy words on a 6% navy wash.
          expect(ratio(NAVY, over(NAVY, 0.06, ground))).toBeGreaterThanOrEqual(4.5);
        }
      });

      it('the other badges and the pill keep the prototype’s colours, which pass', () => {
        expect(ratio(NAVY_SOFT, over(NAVY_SOFT, 0.14, CARD))).toBeGreaterThanOrEqual(4.5);
        expect(ratio(ALERT, over(ALERT, 0.12, CARD))).toBeGreaterThanOrEqual(4.5);
        expect(ratio(SUCCESS, over(SUCCESS, 0.12, CARD))).toBeGreaterThanOrEqual(4.5);
        expect(ratio(SUCCESS, over(SUCCESS, 0.1, BASE))).toBeGreaterThanOrEqual(4.5);
      });

      it('a month line’s time is navy-soft on its 10% wash, and an adjacent month’s number is muted, not 32% navy', () => {
        expect(ratio(NAVY_SOFT, over(NAVY_SOFT, 0.1, CARD))).toBeGreaterThanOrEqual(4.5);
        expect(ratio(NAVY, over(NAVY_SOFT, 0.1, today))).toBeGreaterThanOrEqual(4.5);
        expect(ratio(MUTED, CARD)).toBeGreaterThanOrEqual(4.5);
        expect(ratio(over(NAVY, 0.32, CARD), CARD)).toBeLessThan(3);
      });

      it('the drag selection is the palette’s info, not the prototype’s raw #2680EB', () => {
        // A fill under nothing to read: it needs to be seen against the column, 3:1 for a graphic.
        expect(ratio(INFO, CARD)).toBeGreaterThanOrEqual(3);
        expect(ratio(INFO, today)).toBeGreaterThanOrEqual(3);
      });
    });

    it('the Active (MAA) marks put a navy glyph on the tint — the prototype’s coloured ones miss (ADR-0054)', () => {
      /*
       * `KPM_Owner.html:830-831`: a blue ✓ on a 12% blue wash, an amber-dark ✕ on a 16% amber one, at
       * 13px bold — small text. Neither clears 4.5:1, and the ✕ misses even 3:1. So the glyph is navy
       * and the wash carries the colour, which is the leads table's mid-stage status settled again.
       */
      const INFO = '#2F80ED';
      const activeWash = over(INFO, 0.12, CARD);
      const inactiveWash = over(AMBER, 0.16, CARD);

      expect(ratio(INFO, activeWash)).toBeLessThan(4.5);
      expect(ratio(AMBER_DARK, inactiveWash)).toBeLessThan(3);
      expect(ratio(NAVY, activeWash)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(NAVY, inactiveWash)).toBeGreaterThanOrEqual(4.5);
    });

    describe('the 90-day activation’s marks (P13-T4 AC-8, P13-T5)', () => {
      it('the aspect pills clear 4.5:1 on their own row’s tint; In progress puts navy where the prototype’s amber-dark misses', () => {
        // `.aspect-progress-table tr.status-*` (`Overall.html:1516-1517`) under `.status-pill.status-*` (`:281-284`, `:1521`).
        const doneRow = over(SUCCESS, 0.07, CARD);
        const partialRow = over(AMBER, 0.07, CARD);
        expect(ratio(SUCCESS, over(SUCCESS, 0.1, doneRow))).toBeGreaterThanOrEqual(4.5);
        expect(ratio(ALERT, over(ALERT, 0.1, CARD))).toBeGreaterThanOrEqual(4.5);
        expect(ratio(AMBER_DARK, over(AMBER, 0.14, partialRow))).toBeLessThan(4.5);
        expect(ratio(NAVY, over(AMBER, 0.15, partialRow))).toBeGreaterThanOrEqual(4.5);
      });

      it('the Auto chip’s muted words clear 4.5:1 on its 6% navy wash (`:662-667`)', () => {
        expect(ratio(MUTED, over(NAVY, 0.06, CARD))).toBeGreaterThanOrEqual(4.5);
      });

      it('the overdue Day — the tile’s 20px bold value and the roster’s bold cell — clears its floor', () => {
        // `.kpi-tile.kpi-tile-overdue` (`:1550`, `:1847`): large text on an 8% alert wash, so 3:1.
        expect(ratio(ALERT, over(ALERT, 0.08, CARD))).toBeGreaterThanOrEqual(3);
        // `.newhire-day-overdue` (`:1549`): 14px bold — small text — on the card and under the row hover.
        expect(ratio(ALERT, over(NAVY, 0.03, CARD))).toBeGreaterThanOrEqual(4.5);
      });

      it('the roster’s “—” is muted, where the prototype’s hairline-coloured dash is all but invisible', () => {
        // `.oneone.na{color:var(--hairline)}` (`:1718`): 12% navy on white.
        expect(ratio(over(NAVY, 0.12, CARD), CARD)).toBeLessThan(3);
        expect(ratio(MUTED, CARD)).toBeGreaterThanOrEqual(4.5);
      });

      it('the graphics clear 3:1: the Active Agent ✓ on its wash, and the nav’s amber check on navy and on the current row', () => {
        expect(ratio(SUCCESS, over(SUCCESS, 0.12, CARD))).toBeGreaterThanOrEqual(3);
        expect(ratio(AMBER, NAVY)).toBeGreaterThanOrEqual(3);
        expect(ratio(AMBER, over(AMBER, 0.15, NAVY))).toBeGreaterThanOrEqual(3);
      });
    });
  });
});
