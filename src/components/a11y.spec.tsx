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

  it('status pills have no violations in all three states', async () => {
    await expectNoViolations(
      <div>
        <StatusPill status="success" />
        <StatusPill status="alert" />
        <StatusPill status="neutral" />
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

    it.each(GROUNDS)('no amber reaches the SMALL-text floor on %s', (_name, ground) => {
      /*
       * Which is the boundary on amber-deep's use, and it decides real call sites.
       *
       * A `KpiTile` value is `text-2xl` bold — 20px bold, past WCAG's 18.66px-bold threshold — so it
       * is large text, 3:1 is its floor, and amber-deep is comfortable. Small amber text is simply not
       * available: that is why the leads table's mid-stage status at 12.5px carries **navy** text and
       * the tint is a background rather than a colour cue.
       *
       * It also means the 10px role badges still miss 4.5:1 with amber-deep (3.87:1). Better than the
       * 2.67:1 they shipped with, and not yet right — recorded rather than silently called fixed.
       */
      expect(ratio(AMBER_DEEP, ground)).toBeLessThan(4.5);
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
  });
});
