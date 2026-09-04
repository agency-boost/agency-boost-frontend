import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { AppShell, type NavSection } from './app-shell';
import { StatusPill } from './ui/status-pill';
import { RoleBadge } from './ui/role-badge';
import { Stepper } from './ui/stepper';
import { ProgressBar } from './ui/progress-bar';
import { EmptyState } from './ui/empty-state';

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
      { label: 'Activity management', href: '/activity', active: true },
      { label: 'Leads management', href: '/leads' },
    ],
  },
  { label: 'Reporting', items: [{ label: 'Advanced analytics', href: '#', upcoming: true }] },
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

    const NAVY = '#1B2B4B';
    const AMBER = '#F2994A';
    const AMBER_DARK = '#D97F30';
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

    it('sidebar text clears 4.5:1 on navy', () => {
      expect(ratio(SIDEBAR_TEXT, NAVY)).toBeGreaterThanOrEqual(4.5);
    });

    it('navy on an amber button clears 4.5:1 — which is why buttons are not amber-on-white', () => {
      expect(ratio(NAVY, AMBER)).toBeGreaterThanOrEqual(4.5);
    });

    it('documents that plain amber fails as text, which is why amber-dark exists', () => {
      // tokens.md states this explicitly. The test pins it so nobody "fixes" the
      // design by using --color-amber for text.
      expect(ratio(AMBER, CARD)).toBeLessThan(4.5);
      expect(ratio(AMBER_DARK, CARD)).toBeGreaterThan(ratio(AMBER, CARD));
    });
  });
});
