import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StatusPill, statusFor, STATUS_LABEL } from './status-pill';
import { Stepper } from './stepper';
import { ProgressBar } from './progress-bar';
import { EmptyState } from './empty-state';
import { RoleBadge, RUNG_SHORT_CODE_MAX_LENGTH, rungLabel, rungShort, SEEDED_LADDER, shortOfRung } from './role-badge';
import { ConfigBadge } from './config-badge';
import { NumberBadge } from './number-badge';
import { KpiTile } from './kpi-tile';
import { SaveStatus } from './save-status';
import { Segmented } from './segmented';
import { CascadeRow } from './cascade-row';
import { AutoGrowTextarea } from './auto-grow-textarea';
import { Dialog } from './dialog';
import { DataTable, Row, Cell } from './data-table';
import { RouteTabs } from './route-tabs';
import { SectionCard } from './section-card';
import {
  Button, buttonClass, ButtonLink, Card, CodeField, ColorInput, Field, FieldRow, ReadOnlyField, Switch, TextInput,
} from './field';

vi.mock('next/navigation', () => ({ usePathname: () => '/activity/log' }));

describe('RouteTabs', () => {
  const TABS = [
    { href: '/activity/log', label: 'Log Activity' },
    { href: '/activity/dashboard', label: 'Activity Dashboard' },
  ];

  it('is a named navigation of links, not a tablist', () => {
    // A `role="tab"` promises a panel in this document that `aria-controls` can name, and a route
    // change has none. `Segmented` is the tablist.
    render(<RouteTabs label="Activity management" tabs={TABS} />);
    expect(screen.getByRole('navigation', { name: 'Activity management' })).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('says which one you are on, rather than only looking different', () => {
    render(<RouteTabs label="Activity management" tabs={TABS} />);
    expect(screen.getByRole('link', { name: 'Log Activity' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Activity Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('marks the current tab with the rule, not with extra weight', () => {
    // Inactive tabs are the same weight; they differ by colour and the amber rule, or the strip
    // jumps as you move along it (`Overall.html:81-89`).
    render(<RouteTabs label="Activity management" tabs={TABS} />);
    const [on, off] = screen.getAllByRole('link');
    expect(on.className).toContain('border-amber');
    expect(off.className).toContain('border-transparent');
    expect(on.className).toContain('font-semibold');
    expect(off.className).toContain('font-semibold');
  });

  it('keeps a locked rung visible and says why', () => {
    // A rung vanishing from a chain reads as a step you already missed.
    render(
      <RouteTabs
        label="User Management"
        tabs={[{ href: '/x', label: 'Find Your Leader', locked: true, hint: 'Register an office first' }]}
      />,
    );
    expect(screen.queryByRole('link', { name: 'Find Your Leader' })).not.toBeInTheDocument();
    const locked = screen.getByText('Find Your Leader');
    expect(locked).toHaveAttribute('aria-disabled');
    expect(locked).toHaveAttribute('title', 'Register an office first');
  });

  it('carries a badge beside a label', () => {
    render(
      <RouteTabs label="User Management" tabs={[{ href: '/x', label: 'Pending Requests', badge: <span>3</span> }]} />,
    );
    expect(screen.getByRole('link', { name: 'Pending Requests 3' })).toBeInTheDocument();
  });

  it('P18.8-T12 a nested tab is current beneath its own address too, and a prefix is not a parent', () => {
    // The mocked address is `/activity/log`: beneath `/activity`, not beneath `/activity/lo`.
    render(
      <RouteTabs
        label="Nested"
        tabs={[
          { href: '/activity', label: 'Beneath', nested: true },
          { href: '/activity/lo', label: 'A prefix', nested: true },
        ]}
      />,
    );
    render(<RouteTabs label="Exact" tabs={[{ href: '/activity', label: 'Exact only' }]} />);
    expect(screen.getByRole('link', { name: 'Beneath' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'A prefix' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Exact only' })).not.toHaveAttribute('aria-current');
  });
});

describe('Card', () => {
  it('has one padding utility, whichever density is asked for', () => {
    // Not `p-6` plus a `px`/`py` override: twMerge keeps all three, because they do not fully
    // overlap, and which one wins then depends on the order Tailwind emits them in.
    const { container, rerender } = render(<Card>x</Card>);
    expect(container.firstElementChild!.className).toContain('p-6');

    rerender(<Card density="compact">x</Card>);
    expect(container.firstElementChild!.className).toContain('px-5');
    expect(container.firstElementChild!.className).not.toContain('p-6');
  });
});

describe('SectionCard', () => {
  it('is a list: a header band, then rows divided by rules', () => {
    const { container } = render(
      <SectionCard title="Leads" meta={<span>2 items</span>}>
        <SectionCard.Row control={<button>+</button>}>Menghubungi prospek</SectionCard.Row>
        <SectionCard.Row control={<button>+</button>}>Submission polis</SectionCard.Row>
      </SectionCard>,
    );
    expect(screen.getByRole('heading', { name: 'Leads' })).toBeInTheDocument();
    expect(screen.getByText('2 items')).toBeInTheDocument();
    expect(container.querySelector('header')!.className).toContain('border-b');
    // `overflow-hidden`, so the rules meet the rounded corners instead of crossing them.
    expect(container.firstElementChild!.className).toContain('overflow-hidden');
  });

  it('P18.8-T8 AC-1 centres the row, with a sub-note and without, at the client’s request', () => {
    // ADR-0161 §3: a registered divergence from the prototype's `flex-start` (`Overall.html:118`).
    const { container } = render(
      <SectionCard title="Leads">
        <SectionCard.Row control={<button>+</button>}>Set Appointment</SectionCard.Row>
        <SectionCard.Row control={<button>+</button>}>
          <span>Set Appointment</span>
          <span>telepon, WhatsApp, tatap muka, dll</span>
        </SectionCard.Row>
      </SectionCard>,
    );
    const rows = [...container.querySelectorAll('section > div')];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.className).toContain('items-center');
      expect(row.className).not.toContain('items-start');
      expect(row.className).toContain('justify-between');
      // The number and the words beside it share the middle too.
      expect(row.firstElementChild!.className).toContain('items-center');
    }
  });
});

describe('StatusPill', () => {
  it('renders three distinct states, each with its own words', () => {
    render(
      <>
        <StatusPill status="success" />
        <StatusPill status="alert" />
        <StatusPill status="neutral" />
      </>,
    );
    expect(screen.getByText('On track')).toBeInTheDocument();
    expect(screen.getByText('Below benchmark')).toBeInTheDocument();
    expect(screen.getByText('Not enough data')).toBeInTheDocument();
    expect(new Set(Object.values(STATUS_LABEL)).size).toBe(3);
  });

  it('P11-T6 AC-4 paints Watch closely in its own tone, with the words its caller gives it', () => {
    // A fourth paint, not a fourth state: `statusFor` never answers it, and it has no words of its own.
    render(<StatusPill status="watch" label="Watch closely" />);
    const pill = screen.getByText('Watch closely');
    expect(pill.className).toContain('bg-amber/15');
    expect(pill.className).toContain('text-navy');
    expect(Object.keys(STATUS_LABEL)).not.toContain('watch');
  });

  it('never renders colour alone — the label is always present', () => {
    const { container } = render(<StatusPill status="alert" />);
    expect(container.textContent?.trim().length).toBeGreaterThan(0);
  });

  describe('statusFor', () => {
    it('treats a null value as not-enough-data, never as failure', () => {
      expect(statusFor(null, 0.15)).toBe('neutral');
      expect(statusFor(undefined, 0.15)).toBe('neutral');
      expect(statusFor(NaN, 0.15)).toBe('neutral');
    });
    it('counts a value exactly at benchmark as on track', () => {
      expect(statusFor(0.15, 0.15)).toBe('success');
    });
    it('flags a value below benchmark', () => {
      expect(statusFor(0.14, 0.15)).toBe('alert');
    });
    it('distinguishes zero from no data', () => {
      expect(statusFor(0, 0.15)).toBe('alert');
      expect(statusFor(null, 0.15)).toBe('neutral');
    });
  });
});

describe('Stepper', () => {
  it('labels the control by the activity name, not its number', () => {
    render(<Stepper value={0} onChange={() => {}} label="Submission polis" />);
    expect(screen.getByLabelText('Count for Submission polis')).toBeInTheDocument();
    expect(screen.getByLabelText('Increase Submission polis')).toBeInTheDocument();
  });

  it('increments and decrements', async () => {
    const onChange = vi.fn();
    render(<Stepper value={3} onChange={onChange} label="Leads" />);
    await userEvent.click(screen.getByLabelText('Increase Leads'));
    expect(onChange).toHaveBeenCalledWith(4);
    await userEvent.click(screen.getByLabelText('Decrease Leads'));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('clamps at both bounds by disabling, so the value cannot leave 0..999', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Stepper value={0} onChange={onChange} label="Leads" />);
    expect(screen.getByLabelText('Decrease Leads')).toBeDisabled();

    rerender(<Stepper value={999} onChange={onChange} label="Leads" />);
    expect(screen.getByLabelText('Increase Leads')).toBeDisabled();
  });

  it('coerces non-numeric typing to 0 rather than producing NaN', async () => {
    const onChange = vi.fn();
    render(<Stepper value={5} onChange={onChange} label="Leads" />);
    const input = screen.getByLabelText('Count for Leads');
    await userEvent.clear(input);
    expect(onChange).toHaveBeenCalledWith(0);
    expect(onChange).not.toHaveBeenCalledWith(NaN);
  });

  it('is the prototype’s compact pill for a mouse, and 44px for a finger', () => {
    // WCAG 2.5.5 (44px) is AAA; 2.5.8, the AA criterion, asks 24px — which 28×34 clears. So the
    // phone keeps the bigger target on a coarse pointer and nothing is traded for the shape.
    render(<Stepper value={1} onChange={() => {}} label="Leads" />);
    const plus = screen.getByLabelText('Increase Leads');
    expect(plus.className).toContain('h-[34px]');
    expect(plus.className).toContain('[@media(pointer:coarse)]:h-11');
  });

  it('is one welded group, not three boxes with gaps', () => {
    const { container } = render(<Stepper value={1} onChange={() => {}} label="Leads" />);
    const group = container.firstElementChild!;
    // One border around the group, hairlines between the parts (`Overall.html:129-143`).
    expect(group.className).toContain('border-hairline');
    expect(group.className).toContain('overflow-hidden');
    expect(group.className).not.toContain('gap-');
    expect(screen.getByLabelText('Count for Leads').className).toContain('border-x');
  });

  it('greys a bound at the same strength as every other disabled control', () => {
    // A day arrives with every count at 0, so every `–` is disabled at once. At 30% — what an icon
    // button uses — a dozen of them read as blank space.
    render(<Stepper value={0} onChange={() => {}} label="Leads" />);
    const minus = screen.getByLabelText('Decrease Leads');
    expect(minus).toBeDisabled();
    expect(minus.className).toContain('opacity-40');
    expect(minus.className).not.toContain('opacity-30');
  });

  it('drops focus on a wheel rather than counting it', () => {
    // Twelve rows of these on a day: a scroll over a focused count is an increment nobody made.
    const onChange = vi.fn();
    render(<Stepper value={3} onChange={onChange} label="Leads" />);
    const input = screen.getByLabelText('Count for Leads');
    input.focus();
    fireEvent.wheel(input, { deltaY: 100 });
    expect(input).not.toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('states its own colours rather than inheriting them', () => {
    // It relied on inheriting body's navy, and the number came out near-white against a card on the
    // first screen that rendered it — after two phases of passing its own tests in isolation.
    render(<Stepper value={7} onChange={() => {}} label="Leads" />);
    expect(screen.getByLabelText('Count for Leads').className).toContain('text-navy');
    expect(screen.getByLabelText('Decrease Leads').className).toContain('text-navy');
    expect(screen.getByLabelText('Increase Leads').className).toContain('text-amber-deep');
  });
});

describe('NumberBadge', () => {
  it('is outlined rather than filled — a quiet ordinal, not a badge announcing something', () => {
    const { container } = render(<NumberBadge n={3} />);
    const el = container.firstElementChild!;
    expect(el.className).toContain('border-navy');
    expect(el.className).toContain('text-navy');
    expect(el.className).not.toContain('bg-navy');
  });

  it('hides the number from screen readers, because the label beside it is the name', () => {
    // "3 Menghubungi prospek" would make a reorderable display position sound like part of
    // the activity's name.
    const { container } = render(<NumberBadge n={3} />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('is 22px on a row and 24px on a step head', () => {
    const { container, rerender } = render(<NumberBadge n={1} />);
    expect(container.firstElementChild!.className).toContain('h-[22px]');
    rerender(<NumberBadge n={1} size="md" />);
    expect(container.firstElementChild!.className).toContain('h-6');
  });
});

describe('KpiTile', () => {
  it('puts the label above the value, as the prototype does', () => {
    const { container } = render(<KpiTile label="Already produced" value="Rp 120.000.000" />);
    const [first, second] = Array.from(container.firstElementChild!.children);
    expect(first).toHaveTextContent('Already produced');
    expect(second).toHaveTextContent('Rp 120.000.000');
  });

  it('renders the unit smaller and lighter inside the value', () => {
    render(<KpiTile label="Per month" value="6" unit="policies" />);
    const unit = screen.getByText('policies');
    expect(unit.className).toContain('font-normal');
    expect(unit.className).toContain('text-muted');
  });

  it('uses the body face for the value — Manrope is display only', () => {
    render(<KpiTile label="Per month" value="6" />);
    expect(screen.getByText('6').className).toContain('font-body');
    expect(screen.getByText('6').className).not.toContain('font-display');
  });

  it('P13-T5 AC-5 marks the overdue variant red, on the prototype’s alert wash (`Overall.html:1550`, `:1847`)', () => {
    const { container } = render(<KpiTile label="Day" value="90+" unit="/90" variant="overdue" />);
    const tile = container.firstElementChild!;
    expect(tile).toHaveAttribute('data-variant', 'overdue');
    expect(tile.className).toContain('bg-alert/[0.08]');
    expect(screen.getByText('90+').className).toContain('text-alert');
  });

  it('marks the insight variant with amber-deep, never amber-dark', () => {
    // amber-dark on this very tint is 2.82:1 and clears no floor — see a11y.spec.tsx.
    render(<KpiTile label="This month" value="Rp 42.000.000" variant="insight" />);
    const value = screen.getByText('Rp 42.000.000');
    expect(value.className).toContain('text-amber-deep');
    expect(value.className).not.toContain('text-amber-dark');
  });

  it('distinguishes the three variants by fill as well as by text colour', () => {
    const { container, rerender } = render(<KpiTile label="a" value="1" />);
    expect(container.firstElementChild!.className).toContain('bg-base');
    rerender(<KpiTile label="a" value="1" variant="insight" />);
    expect(container.firstElementChild!.className).toContain('bg-amber/[0.08]');
    rerender(<KpiTile label="a" value="1" variant="complete" />);
    expect(container.firstElementChild!.className).toContain('bg-success/[0.08]');
  });
});

describe('SaveStatus', () => {
  it('is the screen\'s live region', () => {
    render(<SaveStatus state="unsaved">Not yet saved</SaveStatus>);
    expect(screen.getByRole('status')).toHaveTextContent('Not yet saved');
  });

  it('turns green only once something is saved, and the words say so too', () => {
    const { rerender } = render(<SaveStatus state="unsaved">Not yet saved</SaveStatus>);
    expect(screen.getByRole('status').className).toContain('text-muted');
    rerender(<SaveStatus state="saved">Saved · 14 touches</SaveStatus>);
    expect(screen.getByRole('status').className).toContain('text-success');
    expect(screen.getByRole('status')).toHaveTextContent('Saved · 14 touches');
  });

  it('hides the dot from screen readers — it only repeats the words', () => {
    const { container } = render(<SaveStatus state="saved">Saved</SaveStatus>);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});

describe('ConfigBadge', () => {
  it('gives each tone a fill of its own', () => {
    const { container, rerender } = render(<ConfigBadge tone="won">Published</ConfigBadge>);
    expect(container.firstElementChild!.className).toContain('bg-success/10');
    rerender(<ConfigBadge tone="open">Empty</ConfigBadge>);
    expect(container.firstElementChild!.className).toContain('bg-base');
    rerender(<ConfigBadge tone="navy">Activity #3</ConfigBadge>);
    expect(container.firstElementChild!.className).toContain('bg-navy/[0.06]');
  });

  it('lets a chip carrying a phrase drop the uppercase, without a second prop', () => {
    // twMerge resolves the conflict in favour of the call site, which is why `navy` needs
    // no `case` knob: "Activity #3" is a phrase, "PUBLISHED" is a state.
    const { container } = render(
      <ConfigBadge tone="navy" className="normal-case tracking-normal">Activity #3</ConfigBadge>,
    );
    expect(container.firstElementChild!.className).toContain('normal-case');
    expect(container.firstElementChild!.className).not.toContain('uppercase');
  });
});

describe('Segmented', () => {
  function Host({ onSelect }: { onSelect?: (id: string) => void } = {}) {
    const [mode, setMode] = useState('direct');
    return (
      <Segmented
        label="How you want to set it"
        tabs={[
          { id: 'direct', label: 'Set APE target directly' },
          { id: 'from_savings', label: 'Calculate from savings target' },
        ]}
        active={mode}
        onSelect={(id) => {
          setMode(id);
          onSelect?.(id);
        }}
      >
        {(id) => <span>{id === 'direct' ? 'Annual APE target' : 'Annual savings target'}</span>}
      </Segmented>
    );
  }

  it('shows both options at once — which is the reason it is not a dropdown', () => {
    render(<Host />);
    expect(screen.getByRole('tab', { name: 'Set APE target directly' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Calculate from savings target' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('marks one tab selected and swaps the panel', async () => {
    render(<Host />);
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Set APE target directly');
    expect(screen.getByText('Annual APE target')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Calculate from savings target' }));
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Calculate from savings');
    expect(screen.getByText('Annual savings target')).toBeInTheDocument();
  });

  it('is one tab stop, and the arrow keys move within it', async () => {
    render(<Host />);
    const [first, second] = screen.getAllByRole('tab');
    expect(first).toHaveAttribute('tabindex', '0');
    expect(second).toHaveAttribute('tabindex', '-1');

    first.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{ArrowRight}');
    expect(first).toHaveFocus(); // wraps forwards
    await userEvent.keyboard('{ArrowLeft}');
    expect(second).toHaveFocus(); // and backwards
    await userEvent.keyboard('{ArrowLeft}');
    expect(first).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(second).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(first).toHaveFocus();
  });

  it('leaves other keys to the browser', async () => {
    const onSelect = vi.fn();
    render(<Host onSelect={onSelect} />);
    screen.getAllByRole('tab')[0].focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('points aria-controls only at the panel that exists', () => {
    // An aria-controls naming an absent element is an axe violation, and it arrives as an
    // unattributed screen-level failure rather than as a component one.
    render(<Host />);
    const [selected, other] = screen.getAllByRole('tab');
    const panel = screen.getByRole('tabpanel');
    expect(selected).toHaveAttribute('aria-controls', panel.id);
    expect(other).not.toHaveAttribute('aria-controls');
    expect(panel).toHaveAttribute('aria-labelledby', selected.id);
  });

  it('paints the selected option navy, never the action amber — navy is what is chosen (ADR-0137)', async () => {
    render(<Host />);
    const [first, second] = screen.getAllByRole('tab');
    expect(first).toHaveClass('bg-navy');
    expect(first).not.toHaveClass('bg-amber');
    expect(second).not.toHaveClass('bg-navy');

    await userEvent.click(second);
    expect(second).toHaveClass('bg-navy');
    expect(first).not.toHaveClass('bg-navy');
  });
});

describe('CascadeRow', () => {
  // The goal calculator's three, in the client's words (ADR-0160 §4).
  const COLUMNS = [
    { label: 'Set appointment', chip: 'Activity #3', icon: 'clipboard' as const, month: '40/month', week: '≈ 10/week' },
    { label: 'Sales meeting', chip: 'Activity #4', icon: 'calendar' as const, month: '20/month', week: '≈ 5/week' },
    { label: 'Submission polis', chip: 'Activity #6', icon: 'target' as const, month: '6/month', week: '≈ 1.4/week', hero: true },
  ];

  it('renders every column with its chip, monthly figure and weekly sub-line', () => {
    render(<CascadeRow columns={COLUMNS} links={['30%', '30%']} />);
    for (const col of COLUMNS) {
      expect(screen.getByText(col.label)).toBeInTheDocument();
      expect(screen.getByText(col.chip)).toBeInTheDocument();
      expect(screen.getByText(col.month)).toBeInTheDocument();
    }
  });

  it('emphasises the hero column in fill as well as in value', () => {
    const { container } = render(<CascadeRow columns={COLUMNS} links={['30%', '30%']} />);
    const hero = container.querySelector('[data-hero="true"]')!;
    expect(hero).toHaveTextContent('Submission polis');
    expect(hero.className).toContain('bg-amber/[0.14]');
  });

  it('uses amber-deep for the figures, because amber-dark on this tint clears no floor', () => {
    render(<CascadeRow columns={COLUMNS} links={['30%', '30%']} />);
    expect(screen.getByText('40/month').className).toContain('text-amber-deep');
  });

  it('P13.1-T5 AC-5 draws the weekly line larger and blue, in a blue that passes AA at its size', () => {
    render(<CascadeRow columns={COLUMNS} links={['30%', '30%']} />);
    const week = screen.getByText('≈ 10/week');
    // 14px semibold navy-soft: 8.8:1 on the hero tint. Not the prototype's 11px grey caption (`:724`), and
    // not `--color-info`, which passes only as large text (tokens.md, *Status*).
    expect(week.className.split(' ')).toEqual(expect.arrayContaining(['text-md', 'font-semibold', 'text-navy-soft']));
    expect(week.className).not.toMatch(/text-(muted|info|xs)\b/);
  });

  it('spells the conversion out for a screen reader, since the arrow is decorative', () => {
    render(<CascadeRow columns={COLUMNS} links={['50%', '30%']} />);
    // *From … to …*, as the field it repeats reads: *Appointment to Sales meeting* (ADR-0160 §4).
    expect(
      screen.getByText('50% from set appointment to sales meeting'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('30% from sales meeting to submission polis'),
    ).toBeInTheDocument();
  });

  it('renders a column with no chip and no weekly line', () => {
    // The chip and the sub-line are optional: a cascade the office has not mapped, or a figure with
    // no useful weekly equivalent, still draws its column.
    render(
      <CascadeRow
        columns={[{ label: 'Set appointment', icon: 'clipboard', month: '40/month' }]}
        links={[]}
      />,
    );
    expect(screen.getByText('40/month')).toBeInTheDocument();
    expect(screen.queryByText(/week/)).not.toBeInTheDocument();
  });

  it('draws one fewer arrow than it has columns', () => {
    render(<CascadeRow columns={COLUMNS} links={['30%', '30%']} />);
    expect(screen.getAllByText('→')).toHaveLength(2);
  });
});

describe('TextInput affixes', () => {
  it('puts the unit inside the box, and leaves it out of the accessible name', () => {
    render(
      <Field label="Annual APE target" htmlFor="ape">
        <TextInput id="ape" prefix="Rp" value="500000000" onChange={() => {}} />
      </Field>,
    );
    // The label is the question and stays the whole name — not "Annual APE target (Rp)", which is
    // what appending the unit to the label produced and what a screen reader then read back.
    expect(screen.getByLabelText('Annual APE target')).toBeInTheDocument();
    // Visible, and hidden from the accessibility tree: the label already implies the unit.
    expect(screen.getByText('Rp')).toHaveAttribute('aria-hidden', 'true');
  });

  it('grows no spinner on a number, and lets a wheel scroll the page', async () => {
    // A focused `type="number"` treats a scroll as an increment, so reading down a form changes a
    // field that is already off screen. The arrows are a 12px target nobody aims for on purpose.
    const onChange = vi.fn();
    render(<TextInput type="number" value="3" onChange={onChange} aria-label="Months" />);
    const input = screen.getByLabelText('Months');

    expect(input.className).toContain('[appearance:textfield]');
    expect(input.className).toContain('[&::-webkit-inner-spin-button]:appearance-none');

    input.focus();
    expect(input).toHaveFocus();
    fireEvent.wheel(input, { deltaY: 100 });
    // Focus is dropped rather than the value changed: the reader has moved on from the field.
    expect(input).not.toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves a text field’s wheel alone', () => {
    const onChange = vi.fn();
    render(<TextInput value="Pak Budi" onChange={onChange} aria-label="Name" />);
    const input = screen.getByLabelText('Name');
    input.focus();
    fireEvent.wheel(input, { deltaY: 100 });
    expect(input).toHaveFocus();
  });

  it('renders a bare input when there is no affix — the wrapper is conditional on purpose', () => {
    // An unconditional wrapper breaks the FieldRow walk in this very file, one level up.
    const { container } = render(<TextInput value="" onChange={() => {}} />);
    expect(container.firstElementChild!.tagName).toBe('INPUT');
  });

  it('draws one focus ring, on the group rather than on both halves', () => {
    // `globals.css` outlines every `:focus-visible`, and the group rings on `focus-within` — so an
    // affixed field drew two, one around the number and one around the number and its unit. It read
    // as two fields stacked on each other, because that is what it looked like.
    const { container } = render(<TextInput suffix="months" value="3.2" onChange={() => {}} />);
    const group = container.firstElementChild!;
    const input = container.querySelector('input')!;

    expect(group.className).toContain('focus-within:ring-2');
    expect(group.className).toContain('focus-within:ring-amber');
    expect(input.className).toContain('focus-visible:outline-none');
    expect(input.className).toContain('focus:ring-0');
  });

  it('pads the side that has no affix, and not the side that does', () => {
    // `30 %` had the number hard against the left border — the affix supplies the gap on its own
    // side only, and a suffix-only field has nothing on the side the text starts from.
    const { container, rerender } = render(<TextInput suffix="%" value="30" onChange={() => {}} />);
    let input = container.querySelector('input')!;
    expect(input.className).toContain('pl-3');
    expect(input.className).not.toContain('pr-3');

    rerender(<TextInput prefix="Rp" value="0" onChange={() => {}} />);
    input = container.querySelector('input')!;
    expect(input.className).toContain('pr-3');
    expect(input.className).not.toContain('pl-3');
  });

  it('wraps only when an affix is present', () => {
    const { container } = render(<TextInput suffix="months" value="" onChange={() => {}} />);
    expect(container.firstElementChild!.tagName).toBe('SPAN');
    expect(container.querySelector('input')).toBeInTheDocument();
  });
});

describe('cell density', () => {
  it('is transparent at rest and reveals itself on hover and focus', () => {
    const { container } = render(<TextInput density="cell" value="" onChange={() => {}} />);
    const cls = container.firstElementChild!.className;
    expect(cls).toContain('border-transparent');
    expect(cls).toContain('bg-transparent');
    expect(cls).toContain('hover:border-hairline');
    expect(cls).toContain('focus:border-amber');
  });

  it('keeps the border present and only recolours it, so nothing reflows on hover', () => {
    const { container } = render(<TextInput density="cell" value="" onChange={() => {}} />);
    expect(container.firstElementChild!.className).toMatch(/\bborder\b/);
  });

  it('still shows an invalid cell as invalid', () => {
    const { container } = render(<TextInput density="cell" invalid value="" onChange={() => {}} />);
    expect(container.firstElementChild!.className).toContain('border-alert');
    expect(container.firstElementChild).toHaveAttribute('aria-invalid', 'true');
  });

  it('leaves the default density a visible 40px box', () => {
    const { container } = render(<TextInput value="" onChange={() => {}} />);
    expect(container.firstElementChild!.className).toContain('h-10');
    expect(container.firstElementChild!.className).toContain('border-hairline');
  });
});

describe('Button variant="icon"', () => {
  it('is grey at rest and carries its meaning in the hover', () => {
    render(
      <Button variant="icon" tone="success" aria-label="Mark successful">
        ✓
      </Button>,
    );
    const el = screen.getByRole('button', { name: 'Mark successful' });
    expect(el.className).toContain('text-muted');
    expect(el.className).toContain('hover:text-success');
  });

  it('is a tap target rather than the prototype\'s 19px', () => {
    render(<Button variant="icon" aria-label="Delete">🗑</Button>);
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('h-7');
  });

  it('recedes further than other buttons when disabled', () => {
    render(
      <>
        <Button variant="icon" disabled aria-label="Delete">🗑</Button>
        <Button disabled>Save</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('opacity-30');
    expect(screen.getByRole('button', { name: 'Save' }).className).toContain('opacity-40');
  });
});

describe('AutoGrowTextarea', () => {
  it('starts at one row so an empty cell costs one line', () => {
    render(<AutoGrowTextarea value="" onChange={() => {}} aria-label="Remarks" />);
    expect(screen.getByLabelText('Remarks')).toHaveAttribute('rows', '1');
  });

  it('is a cell, not a form box — no resize handle and no scrollbar', () => {
    render(<AutoGrowTextarea value="" onChange={() => {}} aria-label="Remarks" />);
    const cls = screen.getByLabelText('Remarks').className;
    expect(cls).toContain('resize-none');
    expect(cls).toContain('overflow-hidden');
  });

  it('measures on every value change, not only while typing', () => {
    // A row reloading after a refused save changes the value programmatically.
    const { rerender } = render(<AutoGrowTextarea value="one" onChange={() => {}} aria-label="Remarks" />);
    const el = screen.getByLabelText('Remarks') as HTMLTextAreaElement;
    expect(el.style.height).not.toBe('');
    rerender(<AutoGrowTextarea value={'one\ntwo\nthree'} onChange={() => {}} aria-label="Remarks" />);
    expect(el.style.height).not.toBe('');
  });
});

describe('Dialog', () => {
  function Host({ onConfirm = () => {}, onCancel = () => {} }) {
    return (
      <>
        <button type="button">the row&apos;s delete</button>
        <Dialog
          open
          message="Delete Rina Wijaya?"
          confirmLabel="Delete lead"
          tone="danger"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      </>
    );
  }

  it('renders nothing when closed', () => {
    render(
      <Dialog open={false} message="x" confirmLabel="Do it" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is a modal dialog named by its question', () => {
    render(<Host />);
    expect(screen.getByRole('dialog', { name: 'Delete Rina Wijaya?' })).toHaveAttribute(
      'aria-modal',
      'true',
    );
  });

  it('names what will happen, never OK', () => {
    render(<Host />);
    expect(screen.getByRole('button', { name: 'Delete lead' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'OK' })).not.toBeInTheDocument();
  });

  it('takes focus on open and hands it back to whatever opened it', async () => {
    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Delete</button>
          <Dialog
            open={open}
            message="Delete Rina Wijaya?"
            confirmLabel="Delete lead"
            onConfirm={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </>
      );
    }
    render(<Controlled />);
    const trigger = screen.getByRole('button', { name: 'Delete' });
    await userEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Delete lead' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    // A refused delete leaves you back on the row's own button, not at the top of the page.
    expect(trigger).toHaveFocus();
  });

  it('cancels on Escape', async () => {
    const onCancel = vi.fn();
    render(<Host onCancel={onCancel} />);
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });

  it('cancels on the backdrop but not on the box', async () => {
    const onCancel = vi.fn();
    render(<Host onCancel={onCancel} />);
    await userEvent.click(screen.getByText('Delete Rina Wijaya?'));
    expect(onCancel).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('keeps Tab between its own two buttons, in both directions', async () => {
    render(<Host />);
    const confirm = screen.getByRole('button', { name: 'Delete lead' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(confirm).toHaveFocus();

    await userEvent.tab();
    expect(cancel).toHaveFocus();
    // Shift-Tab off the first control wraps back rather than escaping into the page behind.
    await userEvent.tab({ shift: true });
    expect(confirm).toHaveFocus();
  });

  it('ignores keys that are not Escape or Tab', async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<Host onCancel={onCancel} onConfirm={onConfirm} />);
    await userEvent.keyboard('{ArrowDown}x');
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('DataTable density and widths', () => {
  const table = (props: Record<string, unknown>) =>
    render(
      <DataTable caption="Your leads" columns={['Name', 'Stage']} {...props}>
        <Row>
          <Cell>Rina</Cell>
          <Cell>Paid</Cell>
        </Row>
      </DataTable>,
    );

  it('leaves the default density alone — eleven other screens use it', () => {
    const { container } = table({});
    const el = container.querySelector('table')!;
    expect(el.className).not.toContain('table-fixed');
    expect(container.querySelector('colgroup')).not.toBeInTheDocument();
  });

  it('compacts rows, tints the header band and hovers a row', () => {
    const { container } = table({ density: 'compact' });
    const cls = container.querySelector('table')!.className;
    expect(cls).toContain('table-fixed');
    expect(cls).toContain('[&_thead]:bg-base');
    expect(cls).toContain('[&_td]:py-[3px]');
    // The hovered row, over its own colour — `data-table.spec.tsx` compiles it to prove the selector.
    expect(cls).toContain('[&_tbody_tr:hover]:[background-image:linear-gradient(var(--row-hover),var(--row-hover))]');
    expect(cls).not.toContain('[&_tbody_tr]:hover:');
  });

  it('sizes the body by inheritance, never through a `[&_td]` variant', () => {
    /*
     * The regression guard. Scoping the size to every cell was a trap two ways over: the size name
     * was also a colour name, near-white, and the arbitrary variant gave it specificity `0,1,1` —
     * enough to beat a cell's own `.text-muted` at `0,1,0`, so the row number and the registered
     * date disappeared.
     *
     * On the table it is inherited instead, and **an inherited value loses to any declaration on the
     * element**, whatever its specificity. A cell that states its colour keeps it.
     */
    const { container } = table({ density: 'compact' });
    const cls = container.querySelector('table')!.className;
    expect(cls).toContain('text-base');
    // No per-cell size variant: built from parts so the scanner does not emit the class from here.
    expect(cls).not.toContain(`[&_td]${':'}text-`);
    expect(cls).not.toContain('text-md');
  });

  it('renders one col per declared width', () => {
    const { container } = table({ density: 'compact', widths: ['6.5rem', '12.5rem'] });
    const cols = container.querySelectorAll('colgroup col');
    expect(cols).toHaveLength(2);
    expect(cols[0]).toHaveStyle({ width: '6.5rem' });
  });
});

describe('ProgressBar', () => {
  it('caps the bar at 100% while the label may exceed it', () => {
    render(<ProgressBar value={200} target={100} />);
    expect(screen.getByText('200,0%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '100%' });
  });

  it('renders no-target rather than NaN% when the target is zero', () => {
    render(<ProgressBar value={5} target={0} />);
    expect(screen.getByText('No target set')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('does not render a negative width for a negative value', () => {
    render(<ProgressBar value={-10} target={100} />);
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '0%' });
  });

  it('can hide its label', () => {
    render(<ProgressBar value={50} target={100} showLabel={false} />);
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('distinguishes empty from filtered-empty', () => {
    const { container: a } = render(<EmptyState title="No leads yet — add your first one above." />);
    expect(a.querySelector('[data-variant="empty"]')).toBeTruthy();

    const { container: b } = render(<EmptyState title="No leads match." variant="filtered" />);
    expect(b.querySelector('[data-variant="filtered"]')).toBeTruthy();
  });

  it('can offer the action that resolves it', () => {
    render(<EmptyState title="No leads yet." action={<button>Add lead</button>} />);
    expect(screen.getByRole('button', { name: 'Add lead' })).toBeInTheDocument();
  });
});

describe('RoleBadge', () => {
  it('draws its words from the ladder, not from a map here (P4-T9)', () => {
    /*
     * Five hard-coded maps keyed on a three-value enum were a second definition of a
     * company's own vocabulary, in a product where the ladder is company configuration
     * (ADR-0012). A second insurer publishing a fourth rung would have had members whose
     * badge said nothing at all.
     *
     * Outside a provider the badge falls back to the seeded ladder — which is what v1
     * ships, and what keeps every existing screen looking exactly as it did. **Its labels are the
     * seed's** (P18.95-T9 AC-1): the backend's `DEFAULT_ORG_LADDER` labels the rungs *AB* and *AAB*,
     * and this copy said *Agency Builder* and *Associate Agency Builder*.
     */
    expect(SEEDED_LADDER.map((l) => [l.code, l.label])).toEqual([
      ['AGENT', 'Agent'],
      ['AAB', 'AAB'],
      ['AB', 'AB'],
    ]);
  });

  it('takes a ladder code or the v1 enum, because seven services still pass the enum', () => {
    render(<RoleBadge role="AAB" />);
    expect(screen.getByText('AAB')).toBeInTheDocument();
  });

  it('shortens an acronym and spells out a longer code', () => {
    // `AGENT` shouted would be a change nobody asked for; the label is used instead.
    render(<><RoleBadge role="ab" /><RoleBadge role="agent" /></>);
    expect(screen.getByText('AB')).toBeInTheDocument();
    expect(screen.getByText('Agent')).toBeInTheDocument();
  });

  it('always carries a text label, with the ladder’s label available on hover', () => {
    render(<RoleBadge role="aab" />);
    const badge = screen.getByText('AAB');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('title', 'AAB');
  });

  it('can render the long form: the ladder’s own label, where the ladder writes one', () => {
    const ladder = [...SEEDED_LADDER, { ...SEEDED_LADDER[2], orgLevelId: 'x', code: 'SM', label: 'Senior Manager', displayOrder: 4 }];
    expect(rungLabel('sm', ladder)).toBe('Senior Manager');
    render(<RoleBadge role="ab" short={false} />);
    expect(screen.getByText('AB')).toBeInTheDocument();
  });

  it('P18.95-T9 AC-1 the short-code limit is the backend’s, read from its constants (invariant §7)', () => {
    const backend = readFileSync(join(__dirname, '..', '..', '..', '..', 'backend', 'src', 'domain', 'constants', 'leader-tier.ts'), 'utf8');
    expect(Number(/export const RUNG_SHORT_CODE_MAX_LENGTH = (\d+);/.exec(backend)?.[1])).toBe(RUNG_SHORT_CODE_MAX_LENGTH);
    expect(shortOfRung({ code: 'ABCD', label: 'Four' })).toBe('ABCD');
    expect(shortOfRung({ code: 'ABCDE', label: 'Five' })).toBe('Five');
  });

  it('P18.95-T8 AC-3 rungShort says, without a hook, what the badge prints — AB, AAB, Agent — from the ladder it is given', () => {
    expect(['ab', 'AAB', 'agent'].map((code) => rungShort(code))).toEqual(['AB', 'AAB', 'Agent']);
    const another = [...SEEDED_LADDER, { ...SEEDED_LADDER[0], orgLevelId: 'x', code: 'SENIOR', label: 'Senior Partner', displayOrder: 4 }];
    expect(rungShort('senior', another)).toBe('Senior Partner');
    // A code the ladder does not hold reads as itself, as the badge's does.
    expect(rungShort('zz')).toBe('ZZ');
    render(<RoleBadge role="aab" />);
    expect(screen.getByText(rungShort('aab'))).toHaveAttribute('title', 'AAB');
  });

  it('P18.95-T9 AC-1 names a rung the caller holds as the badge does, whatever the ladder’s label says', () => {
    // The one rule, for a `{ code, label }` the API sends as for a code found in the ladder.
    expect(shortOfRung({ code: 'AAB', label: 'Associate Agency Builder' })).toBe('AAB');
    expect(shortOfRung({ code: 'AGENT', label: 'Agent' })).toBe('Agent');
    expect(shortOfRung({ code: 'REGIONAL', label: 'Regional Director' })).toBe('Regional Director');
    expect(rungShort({ code: 'SM', label: 'Senior Manager' })).toBe('SM');
    // And the same name from a code, through the ladder: one name per rung, the badge's.
    const ladder = [...SEEDED_LADDER, { ...SEEDED_LADDER[2], orgLevelId: 'x', code: 'SM', label: 'Senior Manager', displayOrder: 4 }];
    expect(rungShort('sm', ladder)).toBe('SM');
  });
});

describe('Button', () => {
  /*
   * HTML defaults a button inside a form to `submit`, so every Cancel on this project's
   * inline panels was submitting the form it was cancelling. The member-removal Cancel
   * removed the person; the add-a-ratio Cancel created the ratio.
   */
  it('does not submit the form it sits in', async () => {
    const submitted = vi.fn();
    render(
      <form onSubmit={submitted}>
        <Button variant="secondary">Cancel</Button>
      </form>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(submitted).not.toHaveBeenCalled();
  });

  it('still submits when a caller asks it to', () => {
    // The default is the harmless one; it is not a prohibition.
    render(<Button type="submit">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit');
  });

  it('runs its own onClick either way', async () => {
    const clicked = vi.fn();
    const submitted = vi.fn();
    render(
      <form onSubmit={submitted}>
        <Button onClick={clicked}>Cancel</Button>
      </form>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(clicked).toHaveBeenCalledOnce();
    expect(submitted).not.toHaveBeenCalled();
  });
});

describe('Button', () => {
  it('paints the primary amber with navy text, darkening on hover — an action is orange (ADR-0137)', () => {
    /*
     * The client's request of 2026-10-10: Save, Create and the like are the orange button; tabs and
     * filters stay navy. **Navy text, not the prototype's white** (`.btn-primary`, `Overall.html:2244`):
     * white on amber is 2.23:1 and fails AA, navy on amber 6.31:1 — `a11y.spec.tsx` pins both.
     */
    render(<Button>Publish</Button>);

    const className = screen.getByRole('button').className.split(/\s+/);
    expect(className).toEqual(expect.arrayContaining(['bg-amber', 'text-navy', 'hover:bg-amber-dark']));
    expect(className).not.toContain('bg-navy');
    expect(className).not.toContain('text-white');
    // Disabled is as it was: dimmed, not recoloured.
    expect(className).toContain('disabled:opacity-40');
  });

  it('gives every surface of the primary the same amber — buttonClass, ButtonLink and the confirm dialog', () => {
    expect(buttonClass('primary').split(/\s+/)).toEqual(expect.arrayContaining(['bg-amber', 'text-navy', 'hover:bg-amber-dark']));
    render(
      <>
        <ButtonLink href="/coaching/me">My Coaching Notes</ButtonLink>
        <Dialog open message="Publish to agents?" confirmLabel="Publish" onConfirm={() => {}} onCancel={() => {}} />
      </>,
    );
    expect(screen.getByRole('link', { name: 'My Coaching Notes' })).toHaveClass('bg-amber', 'text-navy');
    expect(screen.getByRole('button', { name: 'Publish' })).toHaveClass('bg-amber', 'text-navy');
    // Its Cancel is the secondary: backing out is not the action the dialog is asking about.
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toHaveClass('bg-amber');
  });

  it('leaves secondary and danger as they were — only the primary moved to amber', () => {
    render(<><Button variant="secondary">Cancel</Button><Button variant="danger">Delete</Button></>);
    const [cancel, remove] = screen.getAllByRole('button');
    expect(cancel).toHaveClass('bg-card', 'text-navy');
    expect(remove).toHaveClass('border-alert', 'text-alert');
    for (const button of [cancel, remove]) expect(button).not.toHaveClass('bg-amber');
  });

  it('gives a row action text rather than a box', () => {
    // `.cfg-actions a` (`KPM_Owner.html:289-292`): a bare link, grey, hovering to navy. Still a
    // real `<button>` — only the paint changes, so the focus ring and the role stay.
    render(<><Button variant="inline">Edit</Button><Button variant="inlineDanger">Archive</Button></>);

    const [edit, archive] = screen.getAllByRole('button');
    expect(edit.className).not.toContain('h-10');
    expect(edit.className).not.toContain('border');
    expect(edit.className).toContain('hover:text-navy');
    // Grey at rest, red only on hover: a row of permanently red links reads as a list of warnings.
    expect(archive.className).toContain('text-muted');
    expect(archive.className).toContain('hover:text-alert');
  });
});

describe('Field', () => {
  it('links its hint to the control, rather than printing it beside one', () => {
    /*
     * It rendered as a loose `<p>`, so a screen reader announced the label and stopped —
     * every "Permanent once saved" was invisible to the readers most likely to need it.
     */
    render(
      <Field label="Code" htmlFor="c" hint="Permanent once saved.">
        <TextInput id="c" />
      </Field>,
    );
    expect(screen.getByRole('textbox', { name: 'Code', description: 'Permanent once saved.' }))
      .toBeInTheDocument();
  });

  it('links an error the same way, alongside the hint', () => {
    render(
      <Field label="Code" htmlFor="c" hint="Permanent." error="Already taken.">
        <TextInput id="c" />
      </Field>,
    );
    expect(screen.getByRole('textbox', { description: 'Permanent. Already taken.' }))
      .toBeInTheDocument();
  });

  it('leaves a field with neither undescribed rather than pointing at nothing', () => {
    render(<Field label="Code" htmlFor="c"><TextInput id="c" /></Field>);
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-describedby');
  });

  it('puts the hint below the control, so two fields side by side line up', () => {
    /*
     * The client's report: a hinted field beside an unhinted one put their inputs on different
     * lines, because the hint sat between the label and the control and pushed it down. Nothing
     * held them apart but guidance that reads better after the thing it describes anyway.
     *
     * Asserted as **document order**, because that is the whole of the change — the
     * `aria-describedby` wiring above is id-based and was never affected.
     */
    render(
      <Field label="Code" htmlFor="c" hint="Permanent once saved." error="Already taken.">
        <TextInput id="c" />
      </Field>,
    );

    const label = screen.getByText('Code');
    const control = screen.getByRole('textbox');
    const hint = screen.getByText('Permanent once saved.');
    const error = screen.getByRole('alert');

    const follows = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(label, control)).toBe(true);
    expect(follows(control, hint)).toBe(true);
    // Hint before error, matching the order `aria-describedby` announces them in.
    expect(follows(hint, error)).toBe(true);
  });
});

describe('ReadOnlyField', () => {
  it('is a box of its own by default, the label inside it', () => {
    render(<ReadOnlyField label="Time zone" value="Asia/Jakarta" reason="Every office is on WIB in v1." />);
    const dl = screen.getByText('Time zone').closest('dl')!;
    expect(dl).toHaveClass('rounded-md', 'border', 'p-3');
    expect(screen.getByText('Asia/Jakarta')).not.toHaveClass('h-10');
  });

  it('lines up with a FieldRow’s inputs as a field: a Field’s label, the figure in an input-height box (P10.1-T8)', () => {
    render(<ReadOnlyField layout="field" label="APE already produced this year" value="Rp 216.000.000" />);
    const dl = screen.getByText('APE already produced this year').closest('dl')!;
    // No box around the pair: the label stands on the row's label line, as a Field's does.
    expect(dl).not.toHaveClass('border');
    expect(dl).toHaveClass('flex', 'flex-col', 'gap-1');
    expect(screen.getByText('APE already produced this year')).toHaveClass('text-sm', 'font-semibold', 'text-navy');
    // The affixed input's height and border; the page's ground, not an input's white.
    expect(screen.getByText('Rp 216.000.000')).toHaveClass('h-10', 'border-[1.5px]', 'border-hairline', 'bg-base', 'items-center');
  });
});

describe('FieldRow', () => {
  it('lines the inputs up whether or not a field carries a hint', () => {
    /*
     * The row was `items-end`, which lined the inputs up only by accident — the hint used to sit
     * between label and input, so every field was the same height. Moving the hint below the
     * control took the accident away and a hinted field started riding up.
     *
     * Top-aligned makes it structural: every field starts with a label, so the labels line up
     * and the inputs line up, whatever hangs underneath.
     */
    render(
      <FieldRow>
        <Field label="Code" htmlFor="c" hint="Permanent once published."><TextInput id="c" /></Field>
        <Field label="Name" htmlFor="n"><TextInput id="n" /></Field>
      </FieldRow>,
    );

    const row = screen.getByLabelText('Code').closest('.flex')!.parentElement!;
    expect(row.className).toContain('items-start');
    expect(row.className).not.toContain('items-end');
  });

  it('gives its buttons a label-shaped spacer, so they sit on the input row', () => {
    // A button has no label; top-aligning alone would put it level with the labels. The spacer
    // carries the label's own classes, so it is a label tall by construction rather than by a
    // measured offset that a change to the type scale would silently break.
    render(
      <FieldRow>
        <Field label="Name" htmlFor="n"><TextInput id="n" /></Field>
        <FieldRow.Actions><Button>Add</Button></FieldRow.Actions>
      </FieldRow>,
    );

    const actions = screen.getByRole('button', { name: 'Add' }).closest('.flex-col')!;
    const spacer = actions.firstElementChild!;
    expect(spacer).toHaveAttribute('aria-hidden', 'true');
    expect(spacer.className).toBe(screen.getByText('Name').className);
  });
});

describe('Switch', () => {
  it('announces as a switch, and keeps its name in both states', async () => {
    // A name that flipped to *Draft* when it turned off would announce as a different control
    // appearing. The state is the state; the name is the control.
    function Harness() {
      const [on, setOn] = useState(false);
      return <Switch id="s" label="Published" checked={on} onChange={setOn} />;
    }
    render(<Harness />);

    const control = screen.getByRole('switch', { name: 'Published' });
    expect(control).not.toBeChecked();
    await userEvent.click(control);
    expect(screen.getByRole('switch', { name: 'Published' })).toBeChecked();
  });

  it('is a real checkbox, so a disabled one still states which way it is set', () => {
    render(<Switch id="s" label="Published" checked disabled onChange={() => {}} />);

    const control = screen.getByRole('switch', { name: 'Published' });
    expect(control).toBeChecked();
    expect(control).toBeDisabled();
  });
});

describe('CodeField', () => {
  it('shows the code read-only rather than disabled, so it can be read and copied', () => {
    /*
     * `disabled` leaves the tab order and is skipped by most screen readers — the reader who
     * most needs to be told *"this is the identity and you cannot change it"* would be told
     * nothing, and nobody could select it to quote in a support ticket.
     */
    render(<CodeField id="c" value="SELL_SUBMISSION" reason="Every activity log points at it." />);

    const code = screen.getByLabelText('Code');
    expect(code).toHaveValue('SELL_SUBMISSION');
    expect(code).toHaveAttribute('readonly');
    expect(code).not.toBeDisabled();
    expect(code).toHaveAccessibleDescription('Every activity log points at it.');
  });
});

describe('ColorInput', () => {
  it('offers a picker and a hex box, and keeps them in step', async () => {
    // The field asked for "a hash and six hex digits", and not everybody thinks in hex. The
    // text half stays: the picker is an OS dialog a screen reader cannot drive, and pasting a
    // colour somebody was handed is the other half of the job.
    function Harness() {
      const [value, setValue] = useState('#2D9CDB');
      return (
        <Field label="Color" htmlFor="c" hint="Optional.">
          <ColorInput id="c" value={value} onChange={setValue} />
        </Field>
      );
    }
    render(<Harness />);

    const text = screen.getByLabelText('Color');
    expect(text).toHaveValue('#2D9CDB');
    // The description reaches the **text** input, not the wrapper `<div>` around both.
    expect(text).toHaveAccessibleDescription('Optional.');

    await userEvent.clear(text);
    await userEvent.type(text, '#27AE60');
    expect(screen.getByLabelText('Color')).toHaveValue('#27AE60');
  });

  it('shows a blank surface rather than claiming black when nothing is set', () => {
    // `<input type="color">` has no empty state — it falls back to black, which would read as
    // a colour somebody chose.
    render(
      <Field label="Color" htmlFor="c">
        <ColorInput id="c" value="" onChange={() => {}} />
      </Field>,
    );
    expect(screen.getByLabelText('Color')).toHaveValue('');
  });
});

describe('buttonClass — the look of a button, for an element that cannot be one', () => {
  it.each(['primary', 'secondary', 'danger', 'inline', 'inlineDanger'] as const)(
    'is what ButtonLink renders with, for %s',
    (variant) => {
      render(<ButtonLink href="/x" variant={variant}>Go</ButtonLink>);
      expect(screen.getByRole('link', { name: 'Go' }).className).toBe(buttonClass(variant));
    },
  );

  it('is a 40px box for a boxed variant, and text for an inline one', () => {
    expect(buttonClass('secondary')).toContain('h-10');
    expect(buttonClass('secondary')).toContain('border-hairline');
    expect(buttonClass('inline')).not.toContain('h-10');
  });

  it('lets the caller add to it', () => {
    expect(buttonClass('secondary', 'w-full')).toContain('w-full');
  });
});
