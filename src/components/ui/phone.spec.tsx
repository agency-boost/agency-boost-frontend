import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as PHONE from './phone';
import { SEGMENT_PHONE, SEGMENTS_PHONE, TAB_PHONE, TAB_ROW_PHONE, TAP_AREA, TAP_TARGET, UNDERLINED_ROW_PHONE } from './phone';
import { fadeOf, reveal, useTabRow } from './use-tab-row';
import { RouteTabs } from './route-tabs';
import { Segmented } from './segmented';
import { Button, buttonClass, Select, Textarea, TextInput } from './field';
import { Stepper } from './stepper';
import { TippedGlyph } from './tipped-glyph';
import { ActionMenu } from './action-menu';
import { TrainingSubtabs } from '@/components/training/training-catalog';
import { CoachingTabBar } from '@/components/coaching-person';
import { SettingsTabs } from '@/components/settings-tabs';

let pathname = '/user-management/leader';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * **A phone's sizes** (P18.95-T1 AC-8 to AC-10, AC-12; ADR-0167; the client's UI review of 2026-10-26:
 * UI-013, UI-014, UI-029).
 *
 * jsdom applies no stylesheet and lays nothing out, so what can be pinned here is what each component
 * *asks for* below 768px, that it asks for nothing at 768px and wider, and what the tab row does with the
 * widths a browser would give it. The stylesheet's half — the type scale's properties and the fade — is
 * `theme.spec.ts`'s.
 */

const tokens = (className: string) => className.split(/\s+/).filter(Boolean);
/** What an element wears at 768px and wider: every class but the phone's. */
const wider = (el: Element) => tokens(el.getAttribute('class') ?? '').filter((c) => !c.startsWith('max-md:')).join(' ');
const phone = (el: Element) => tokens(el.getAttribute('class') ?? '').filter((c) => c.startsWith('max-md:'));

/** A row a browser has laid out: `width` of tabs in a `visible`-wide box, each tab `step` along. */
function layOut(row: HTMLElement, { content, visible, step = 100, width = 90 }: { content: number; visible: number; step?: number; width?: number }) {
  let left = 0;
  Object.defineProperty(row, 'scrollWidth', { configurable: true, get: () => content });
  Object.defineProperty(row, 'clientWidth', { configurable: true, get: () => visible });
  Object.defineProperty(row, 'scrollLeft', {
    configurable: true,
    get: () => left,
    set: (v: number) => { left = Math.max(0, Math.min(content - visible, v)); },
  });
  row.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: visible, height: 44 });
  Array.from(row.children).forEach((tab, i) => {
    (tab as HTMLElement).getBoundingClientRect = () => DOMRect.fromRect({ x: i * step - left, y: 0, width, height: 44 });
  });
  return { get left() { return left; } };
}

describe('phone.ts: nothing it holds reaches 768px and wider', () => {
  it.each(Object.entries(PHONE))('%s is `max-md:` from end to end', (_name, value) => {
    // A class without the prefix would change a tablet or a desktop the client has not reviewed (OD-207).
    expect(typeof value).toBe('string');
    const classes = tokens(value as string);
    expect(classes.length).toBeGreaterThan(0);
    expect(classes.filter((c) => !c.startsWith('max-md:'))).toEqual([]);
  });
});

describe('AC-8 one tab row on a phone', () => {
  let scrollIntoView: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    pathname = '/user-management/leader';
    scrollIntoView = vi.fn();
    // jsdom has none; a stub, so that calling it would show up rather than throw.
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
  });
  afterEach(() => {
    delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  const UM = [
    { href: '/user-management/leader', label: 'Find Your Leader' },
    { href: '/user-management/add', label: 'Add Members' },
    { href: '/user-management/pending', label: 'Pending Requests' },
    { href: '/user-management/roster', label: 'Your Roster' },
  ];

  describe('RouteTabs', () => {
    it('scrolls sideways below 768px, and wraps as before at 768px and wider', () => {
      render(<RouteTabs label="User Management" tabs={UM} />);
      const nav = screen.getByRole('navigation', { name: 'User Management' });
      expect(wider(nav)).toBe('mb-6 flex flex-wrap gap-6 border-b border-hairline');
      expect(phone(nav)).toEqual(expect.arrayContaining([...tokens(TAB_ROW_PHONE), ...tokens(UNDERLINED_ROW_PHONE)]));
      expect(phone(nav)).toContain('max-md:flex-nowrap');
      expect(phone(nav)).toContain('max-md:overflow-x-auto');
    });

    it('keeps each tab on one line, unsqueezed, its ring inside its edge — and the tab itself unchanged wider', () => {
      render(<RouteTabs label="User Management" tabs={UM} />);
      const [on, off] = screen.getAllByRole('link');
      expect(wider(on)).toBe('-mb-px border-b-2 px-0.5 pb-3 text-md font-semibold border-amber text-navy');
      expect(wider(off)).toBe('-mb-px border-b-2 px-0.5 pb-3 text-md font-semibold border-transparent text-muted');
      for (const tab of [on, off]) expect(phone(tab)).toEqual(tokens(TAB_PHONE));
    });

    it('is still a named navigation of links with the current one marked — no tablist, nothing renamed', () => {
      render(<RouteTabs label="User Management" tabs={UM} />);
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
      expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual(UM.map((t) => t.label));
      expect(screen.getByRole('link', { name: 'Find Your Leader' })).toHaveAttribute('aria-current', 'page');
    });

    it('says nothing about a fade while everything fits — as it always does at 768px and wider, and in jsdom', () => {
      render(<RouteTabs label="User Management" tabs={UM} />);
      expect(screen.getByRole('navigation')).not.toHaveAttribute('data-fade');
    });

    it('fades the side that has more, and follows the reader scrolling', () => {
      render(<RouteTabs label="User Management" tabs={UM} />);
      const nav = screen.getByRole('navigation');
      const row = layOut(nav, { content: 400, visible: 343 });

      fireEvent.scroll(nav);
      expect(nav).toHaveAttribute('data-fade', 'end');

      nav.scrollLeft = 30;
      fireEvent.scroll(nav);
      expect(row.left).toBe(30);
      expect(nav).toHaveAttribute('data-fade', 'both');

      nav.scrollLeft = 57;
      fireEvent.scroll(nav);
      expect(nav).toHaveAttribute('data-fade', 'start');
    });

    it('brings the current tab into view by scrolling the row alone — never the page', () => {
      const { rerender } = render(<RouteTabs label="User Management" tabs={UM} />);
      const nav = screen.getByRole('navigation');
      const row = layOut(nav, { content: 400, visible: 250 });
      const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

      pathname = '/user-management/roster';
      rerender(<RouteTabs label="User Management" tabs={UM} />);

      // The fourth tab, 300–390, is brought clear of the 24px fade at the row's right edge, 250.
      expect(row.left).toBe(150);
      expect(nav).toHaveAttribute('data-fade', 'start');
      expect(scrollIntoView).not.toHaveBeenCalled();
      expect(scrollTo).not.toHaveBeenCalled();
      scrollTo.mockRestore();
    });
  });

  describe('Segmented', () => {
    const SIX = ['Week', 'Month', 'Quarter', 'Half', 'Year', 'All time'].map((label) => ({ id: label.toLowerCase(), label }));
    function Host() {
      const [active, setActive] = useState('week');
      return (
        <Segmented label="Period" tabs={SIX} active={active} onSelect={setActive}>
          {(id) => <span>{id}</span>}
        </Segmented>
      );
    }

    it('lets its track scroll and each segment keep its words, below 768px only', () => {
      render(<Host />);
      const list = screen.getByRole('tablist', { name: 'Period' });
      expect(wider(list)).toBe('flex w-full rounded-lg border border-hairline bg-base p-[3px]');
      expect(phone(list)).toEqual(tokens(SEGMENTS_PHONE));
      const [on] = screen.getAllByRole('tab');
      expect(wider(on)).toBe('flex-1 rounded-md px-2.5 py-2 text-base font-semibold transition-colors bg-navy text-card');
      expect(phone(on)).toEqual(tokens(SEGMENT_PHONE));
    });

    it('P18.95-T5 AC-7: with phoneLayout="wrap", two options keep equal halves and wrap their words — below 768px only', () => {
      const TWO = [{ id: 'direct', label: 'Set APE target directly' }, { id: 'savings', label: 'Calculate from savings target' }];
      render(
        <Segmented label="How" tabs={TWO} active="direct" onSelect={() => {}} phoneLayout="wrap">
          {(id) => <span>{id}</span>}
        </Segmented>,
      );
      const list = screen.getByRole('tablist', { name: 'How' });
      expect(wider(list)).toBe('flex w-full rounded-lg border border-hairline bg-base p-[3px]');
      expect(phone(list)).toEqual([]);
      for (const tab of screen.getAllByRole('tab')) {
        expect(wider(tab)).toMatch(/^flex-1 rounded-md px-2\.5 py-2 text-base font-semibold transition-colors /);
        expect(phone(tab)).toEqual(tokens(PHONE.SEGMENT_WRAP_PHONE));
      }
    });

    it('keeps one tab stop and the arrow keys while it scrolls, and brings the chosen one into view', async () => {
      render(<Host />);
      const list = screen.getByRole('tablist');
      const row = layOut(list, { content: 600, visible: 343 });
      const user = userEvent.setup();

      const [week] = screen.getAllByRole('tab');
      expect(week).toHaveAttribute('tabindex', '0');
      expect(screen.getAllByRole('tab').filter((t) => t.getAttribute('tabindex') === '0')).toHaveLength(1);

      week.focus();
      await user.keyboard('{End}');
      const all = screen.getByRole('tab', { name: 'All time' });
      expect(all).toHaveFocus();
      expect(all).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel')).toHaveTextContent('all time');
      // The sixth segment, 500–590, clear of the fade at 343: the track scrolled, the page did not.
      expect(row.left).toBe(257);
      expect(list).toHaveAttribute('data-fade', 'start');
      expect(scrollIntoView).not.toHaveBeenCalled();

      await user.keyboard('{Home}');
      expect(screen.getByRole('tab', { name: 'Week' })).toHaveFocus();
      expect(row.left).toBe(0);
      expect(list).toHaveAttribute('data-fade', 'end');
    });
  });

  describe('the other strips on the reviewed screens', () => {
    it('/training/*: the categories', () => {
      render(
        <TrainingSubtabs
          current="SALES"
          categories={[{ code: 'SALES', label: 'Sales' }, { code: 'RECRUIT', label: 'Recruitment' }, { code: 'LEAD', label: 'Leadership' }]}
        />,
      );
      const nav = screen.getByRole('navigation');
      expect(wider(nav)).toBe('mb-6 flex flex-wrap gap-x-6 gap-y-2 border-b border-hairline');
      expect(phone(nav)).toEqual(expect.arrayContaining(tokens(TAB_ROW_PHONE)));
      for (const tab of screen.getAllByRole('link')) expect(phone(tab)).toEqual(tokens(TAB_PHONE));
      expect(screen.getByRole('link', { name: 'Sales' })).toHaveAttribute('aria-current', 'page');
    });

    it('notices categories that arrive after the row mounts, which change no box’s size', async () => {
      const one = [{ code: 'SALES', label: 'Sales' }];
      const { rerender } = render(<TrainingSubtabs current="SALES" categories={one} />);
      const nav = screen.getByRole('navigation');
      let content = 343;
      Object.defineProperty(nav, 'scrollWidth', { configurable: true, get: () => content });
      Object.defineProperty(nav, 'clientWidth', { configurable: true, get: () => 343 });
      expect(nav).not.toHaveAttribute('data-fade');

      content = 520;
      rerender(<TrainingSubtabs current="SALES" categories={[...one, { code: 'RECRUIT', label: 'Recruitment' }, { code: 'LEAD', label: 'Leadership' }]} />);
      await waitFor(() => expect(nav).toHaveAttribute('data-fade', 'end'));
    });

    it('a coaching session: its seven tabs, the one not yet followable among them', () => {
      render(
        <CoachingTabBar
          items={[
            { key: 'session', label: 'Coaching Session', href: '/coaching/m1/session', current: true },
            { key: 'summary', label: 'Summary', href: '/coaching/m1/summary' },
            { key: 'activity', label: 'Activity', href: '/coaching/m1/activity' },
            { key: 'goals', label: 'Goals', href: '/coaching/m1/goals' },
            { key: 'leads', label: 'Leads', href: '/coaching/m1/leads' },
            { key: 'training', label: 'Training', href: null },
            { key: 'notes', label: 'Leader Notes', href: '/coaching/m1/notes', locked: true },
          ]}
        />,
      );
      const nav = screen.getByRole('navigation', { name: 'Coaching' });
      expect(wider(nav)).toBe('mb-6 flex flex-wrap gap-x-6 gap-y-2 border-b border-hairline');
      expect(phone(nav)).toEqual(expect.arrayContaining([...tokens(TAB_ROW_PHONE), ...tokens(UNDERLINED_ROW_PHONE)]));
      expect(screen.getAllByRole('link')).toHaveLength(7);
      for (const tab of screen.getAllByRole('link')) expect(phone(tab)).toEqual(expect.arrayContaining(tokens(TAB_PHONE)));
      expect(screen.getByRole('link', { name: 'Training, upcoming' })).toHaveAttribute('aria-disabled', 'true');
    });

    it('the settings rows, both of them', () => {
      pathname = '/kpm/settings/activity-types';
      const tabs = [{ label: 'Activity types', href: '/kpm/settings/activity-types' }, { label: 'Ratio benchmarks', href: '/kpm/settings/ratio-benchmarks' }];
      const { unmount } = render(<SettingsTabs tabs={tabs} />);
      expect(wider(screen.getByRole('navigation'))).toBe('mb-4 flex flex-wrap gap-1 border-b border-hairline');
      expect(phone(screen.getByRole('navigation'))).toEqual(expect.arrayContaining(tokens(UNDERLINED_ROW_PHONE)));
      unmount();
      render(<SettingsTabs tabs={tabs} variant="subtabs" label="Halves" />);
      const nav = screen.getByRole('navigation', { name: 'Halves' });
      expect(wider(nav)).toBe('mb-4 flex flex-wrap gap-1');
      // Pills have no hairline to repaint.
      expect(phone(nav)).toEqual(tokens(TAB_ROW_PHONE));
      for (const tab of screen.getAllByRole('link')) expect(phone(tab)).toEqual(tokens(TAB_PHONE));
    });

    it('P18.95-T6 AC-4 the scrollable filter row: a row of toggle buttons brings the pressed one into view', () => {
      // The catalog's category pills (`product-catalog.tsx`): buttons with `aria-pressed`, not links or tabs.
      const PILLS = ['All products', 'Life', 'Health', 'Critical illness', 'Education', 'Investment-linked'];
      function Pills({ on }: { on: string }) {
        const row = useTabRow<HTMLDivElement>(on);
        return (
          <div ref={row.ref} role="group" aria-label="Category" data-fade={row.fade} className={TAB_ROW_PHONE}>
            {PILLS.map((p) => <button key={p} type="button" aria-pressed={p === on} className={TAB_PHONE}>{p}</button>)}
          </div>
        );
      }
      const { rerender } = render(<Pills on="All products" />);
      const group = screen.getByRole('group', { name: 'Category' });
      const box = layOut(group, { content: 600, visible: 343 });

      rerender(<Pills on="Investment-linked" />);

      // The sixth pill, 500–590, brought into view: the row scrolls to its end, 600 − 343.
      expect(box.left).toBe(257);
      expect(group).toHaveAttribute('data-fade', 'start');
      expect(scrollIntoView).not.toHaveBeenCalled();
    });
  });
});

describe('the tab row’s arithmetic', () => {
  it.each([
    [{ scrollWidth: 343, clientWidth: 343, scrollLeft: 0 }, undefined],
    // A pixel of rounding is not "more".
    [{ scrollWidth: 344, clientWidth: 343, scrollLeft: 0 }, undefined],
    [{ scrollWidth: 600, clientWidth: 343, scrollLeft: 0 }, 'end'],
    [{ scrollWidth: 600, clientWidth: 343, scrollLeft: 100 }, 'both'],
    [{ scrollWidth: 600, clientWidth: 343, scrollLeft: 257 }, 'start'],
    [{ scrollWidth: 600, clientWidth: 343, scrollLeft: 256.5 }, 'start'],
  ])('%o fades %s', (box, fade) => {
    expect(fadeOf(box)).toBe(fade);
  });

  it('leaves a row alone whose current tab is already clear of both fades', () => {
    const row = document.createElement('div');
    const tab = document.createElement('a');
    row.append(tab);
    const box = layOut(row, { content: 600, visible: 343 });
    row.scrollLeft = 0;
    tab.getBoundingClientRect = () => DOMRect.fromRect({ x: 100, y: 0, width: 90, height: 44 });
    reveal(row, tab);
    expect(box.left).toBe(0);
  });

  it('brings a tab left of the view back past the start fade', () => {
    const row = document.createElement('div');
    const tab = document.createElement('a');
    row.append(tab);
    const box = layOut(row, { content: 600, visible: 343 });
    row.scrollLeft = 200;
    tab.getBoundingClientRect = () => DOMRect.fromRect({ x: -50, y: 0, width: 90, height: 44 });
    reveal(row, tab);
    // -50 to 24: 74 back.
    expect(box.left).toBe(126);
  });
});

describe('AC-10 a finger’s target on a phone', () => {
  it('an icon button is a 44px box below 768px, the 28px one wider', () => {
    render(<Button variant="icon" aria-label="Remove">✕</Button>);
    const el = screen.getByRole('button', { name: 'Remove' });
    expect(wider(el)).toContain('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-sm leading-none');
    expect(phone(el)).toEqual(tokens(TAP_TARGET));
  });

  it('a text button is 44px too, its words centred, and on the row’s baseline wider', () => {
    render(<Button variant="inline">Edit</Button>);
    const el = screen.getByRole('button', { name: 'Edit' });
    expect(wider(el)).toContain('inline-flex items-center rounded-sm text-sm font-semibold');
    expect(phone(el)).toEqual([...tokens(TAP_TARGET), 'max-md:justify-center']);
    expect(tokens(buttonClass('inline'))).toEqual(expect.arrayContaining([...tokens(TAP_TARGET), 'max-md:justify-center']));
    expect(tokens(buttonClass('primary'))).not.toContain('max-md:min-h-11');
  });

  it('the ⋮ is one of those icon buttons', () => {
    render(<ActionMenu label="Actions for Pak Budi" items={[{ label: 'Delete', glyph: '🗑', onSelect: () => {} }]} />);
    expect(phone(screen.getByRole('button', { name: 'Actions for Pak Budi' }))).toEqual(expect.arrayContaining(tokens(TAP_TARGET)));
  });

  it('the ⓘ keeps its 28px box in its line and takes the tap on a 44px square around it', () => {
    render(<p>Rp 12 jt <TippedGlyph glyph="ⓘ" name="Not uploaded yet" tip="Not uploaded yet" align="fit" /></p>);
    const glyph = screen.getByRole('button', { name: 'Not uploaded yet' });
    expect(wider(glyph)).toContain('h-7 w-7');
    // Its grown box would push the figure beside it; the square hangs from the wrapper instead.
    expect(phone(glyph)).toEqual(expect.arrayContaining(['max-md:min-h-0', 'max-md:min-w-0', ...tokens(TAP_AREA)]));
    expect(phone(glyph)).not.toContain('max-md:min-h-11');
    expect(glyph.parentElement).toHaveClass('relative');
    expect(TAP_AREA).toContain('max-md:after:h-[max(100%,2.75rem)]');
    expect(TAP_AREA).toContain('max-md:after:w-[max(100%,2.75rem)]');
  });

  it('a face keeps its own paint and gets the square as well', () => {
    render(<TippedGlyph glyph="Auto" name="Auto" tip="Completes on its own." face="h-auto w-auto rounded-pill px-[7px]" />);
    const chip = screen.getByRole('button', { name: 'Auto' });
    expect(wider(chip)).toContain('h-auto w-auto rounded-pill');
    expect(phone(chip)).toEqual(expect.arrayContaining(tokens(TAP_AREA)));
  });

  it('opens the tooltip on a tap exactly as before', async () => {
    render(<TippedGlyph glyph="ⓘ" name="What counts" tip="What counts" />);
    await act(async () => { await userEvent.setup().click(screen.getByRole('button', { name: 'What counts' })); });
    expect(screen.getByText('What counts', { selector: '[role="tooltip"]' })).toBeVisible();
  });
});

describe('AC-9 a field’s text on a phone', () => {
  /*
   * The 16px is the stylesheet's: below 768px a field's own `--text-*` read 1rem (`theme.spec.ts`). What a
   * component owes it is to size its text by one of those five steps — an arbitrary `text-[13px]` would slip
   * past the rule and zoom an iPhone again.
   */
  const STEPS = ['text-2xs', 'text-xs', 'text-sm', 'text-base', 'text-md'];
  const sizedByStep = (el: Element) => tokens(el.getAttribute('class') ?? '').some((c) => STEPS.includes(c));

  it.each([
    ['a text field', () => <TextInput aria-label="Name" />],
    ['a cell', () => <TextInput aria-label="Name" density="cell" />],
    ['a date', () => <TextInput aria-label="Date" type="date" />],
    ['a number', () => <TextInput aria-label="Count" type="number" />],
    ['a select', () => <Select aria-label="Status"><option>New</option></Select>],
    ['a textarea', () => <Textarea aria-label="Remarks" />],
    ['a cell textarea', () => <Textarea aria-label="Remarks" density="cell" />],
  ])('%s is sized by a step the phone raises', (_what, field) => {
    render(field());
    expect(sizedByStep(screen.getByLabelText(/./))).toBe(true);
  });

  it('a caller’s smaller step is still one of them — the leads’ `text-xs` select reads 16px too', () => {
    render(<Select aria-label="Status" className="text-xs"><option>New</option></Select>);
    expect(screen.getByLabelText('Status')).toHaveClass('text-xs');
  });

  it('the stepper’s count, which the review asked to keep at 44 × 44, is sized by a step as well', () => {
    render(<Stepper label="Set appointment" value={2} onChange={() => {}} />);
    expect(sizedByStep(screen.getByLabelText('Count for Set appointment'))).toBe(true);
  });

  it('an affix is the size of the number beside it on a phone, and 13px wider', () => {
    render(<TextInput aria-label="Target" prefix="Rp" suffix="%" />);
    const [rp, pct] = Array.from(document.querySelectorAll('span[aria-hidden="true"]'));
    for (const affix of [rp, pct]) {
      expect(wider(affix)).toContain('text-base');
      expect(phone(affix)).toEqual(['max-md:text-lg']);
    }
  });
});
