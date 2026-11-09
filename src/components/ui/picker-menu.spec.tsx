import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, wears } from '@test/harness';
import { HEADER_BUTTON, HEADER_CONTROL } from './header-control';
import { PickerMenu, pickerOptions, type PickerItem } from './picker-menu';

const VIEWS: PickerItem[] = [
  { value: 'agenda', label: 'Agenda' },
  { value: '3day', label: '3 Hari' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

/** The ratio card's filter (MOB UI-184): *Unit*, *Group*, then *PER ORANG* and every person of the Group. */
const RATIO: PickerItem[] = [
  { value: 'unit', label: 'Unit' },
  { value: 'group', label: 'Group' },
  {
    group: 'PER ORANG',
    options: [
      { value: 'm-1', label: 'Agus Prasetyo' },
      { value: 'm-2', label: 'Indah Permatasari' },
      { value: 'm-3', label: 'Lukman Hakim' },
    ],
  },
];

function Picker({ items = VIEWS, start = 'agenda', onChange = () => {}, ...rest }: {
  items?: PickerItem[];
  start?: string;
  onChange?: (v: string) => void;
} & Partial<React.ComponentProps<typeof PickerMenu>>) {
  const [value, setValue] = useState(start);
  return (
    <div>
      <button type="button">Before</button>
      <PickerMenu
        label="Tampilan"
        value={value}
        options={items}
        onChange={(v) => { setValue(v); onChange(v); }}
        {...rest}
      />
      <button type="button">After</button>
    </div>
  );
}

const button = (name: RegExp | string = 'Tampilan Agenda') => screen.getByRole('button', { name });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PickerMenu (P19.8-T1 AC-2; ADR-0227 §2, MOB UI-171)', () => {
  it('P19.8-T1 AC-2 MOB UI-171 is a header-control button — 13px, 600, 44px — with its value and a ⌄, at 375 and 1280', () => {
    for (const px of [375, 1280]) {
      atWidth(px);
      const { unmount } = render(<Picker />);
      const el = button();
      expect(el).toHaveTextContent('Agenda');
      expect(el.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      // The same three at both widths: no screen variant in the shared style.
      for (const cls of HEADER_CONTROL.split(' ')) expect(wears(el, px).split(' ')).toContain(cls);
      // The shared white pill, its words and ⌄ at the two ends rather than centred.
      expect(el).toHaveClass(...HEADER_BUTTON.split(' ').filter((cls) => cls !== 'justify-center'), 'justify-between');
      unmount();
    }
  });

  it('P19.8-T1 AC-2 MOB UI-171 is never a native select, and never a sheet or dialog', async () => {
    render(<Picker />);
    expect(document.querySelector('select')).toBeNull();
    await userEvent.click(button());
    expect(document.querySelector('select')).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: 'Tampilan' })).toBeInTheDocument();
  });

  it('P19.8-T1 AC-2 a screen reader hears a button that opens a list, named by the picker and its value', async () => {
    render(<Picker />);
    const el = button();
    expect(el).toHaveAttribute('aria-haspopup', 'listbox');
    expect(el).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await userEvent.click(el);
    const list = screen.getByRole('listbox', { name: 'Tampilan' });
    expect(el).toHaveAttribute('aria-expanded', 'true');
    expect(el).toHaveAttribute('aria-controls', list.id);
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual(['Agenda', '3 Hari', 'Week', 'Month']);
  });

  it('P19.8-T1 AC-2 the chosen option is announced as selected, marked with a ✓, and has the focus on open', async () => {
    render(<Picker start="week" />);
    await userEvent.click(button('Tampilan Week'));
    const week = screen.getByRole('option', { name: 'Week', selected: true });
    expect(week).toHaveFocus();
    expect(week.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Agenda', selected: false }).querySelector('svg')).toBeNull();
    expect(screen.getAllByRole('option', { selected: true })).toHaveLength(1);
  });

  it('P19.8-T1 AC-2 rows are 44px, 13px / 600 — at every size', async () => {
    render(<Picker />);
    await userEvent.click(button());
    for (const option of screen.getAllByRole('option')) expect(option).toHaveClass('min-h-11', 'text-base', 'font-semibold');
  });

  it('P19.8-T1 AC-2 a tap on an option chooses it, closes the menu and puts the focus back on the button', async () => {
    const onChange = vi.fn();
    render(<Picker onChange={onChange} />);
    await userEvent.click(button());
    await userEvent.click(screen.getByRole('option', { name: '3 Hari' }));
    expect(onChange).toHaveBeenCalledWith('3day');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(button('Tampilan 3 Hari')).toHaveFocus();
    expect(button('Tampilan 3 Hari')).toHaveAttribute('aria-expanded', 'false');
  });

  it('P19.8-T1 AC-2 choosing the option already chosen closes the menu and tells nobody', async () => {
    const onChange = vi.fn();
    render(<Picker onChange={onChange} />);
    await userEvent.click(button());
    await userEvent.click(screen.getByRole('option', { name: 'Agenda' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('P19.8-T1 AC-2 opens from the keyboard: ↓, Enter and Space on the chosen option', async () => {
    render(<Picker start="week" />);
    const el = button('Tampilan Week');
    el.focus();
    for (const key of ['{ArrowDown}', '{Enter}', ' ']) {
      await userEvent.keyboard(key);
      expect(screen.getByRole('option', { name: 'Week' })).toHaveFocus();
      await userEvent.keyboard('{Escape}');
      expect(el).toHaveFocus();
    }
  });

  it('P19.8-T1 AC-2 ↑ opens on the chosen option, or the last when none is chosen', async () => {
    const { unmount } = render(<Picker start="week" />);
    button('Tampilan Week').focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('option', { name: 'Week' })).toHaveFocus();
    unmount();
    render(<Picker start="none" buttonLabel="Pilih" />);
    button('Tampilan Pilih').focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('option', { name: 'Month' })).toHaveFocus();
  });

  it('P19.8-T1 AC-2 ↑ ↓ Home End move, stopping at the ends; Enter and Space choose', async () => {
    const onChange = vi.fn();
    render(<Picker onChange={onChange} />);
    await userEvent.click(button());
    const option = (name: string) => screen.getByRole('option', { name });
    await userEvent.keyboard('{ArrowDown}');
    expect(option('3 Hari')).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(option('Month')).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(option('Month')).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(option('Agenda')).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(option('Agenda')).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('week');
    expect(button('Tampilan Week')).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown} ');
    expect(onChange).toHaveBeenLastCalledWith('month');
  });

  it('P19.8-T1 AC-2 a letter jumps to the next choice starting with it', async () => {
    render(<Picker items={RATIO} start="unit" label="Rasio" />);
    await userEvent.click(screen.getByRole('button', { name: 'Rasio Unit' }));
    let now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    await userEvent.keyboard('i');
    expect(screen.getByRole('option', { name: 'Indah Permatasari' })).toHaveFocus();
    // Two letters inside half a second are one word: *in* stays on Indah.
    now += 100;
    await userEvent.keyboard('n');
    expect(screen.getByRole('option', { name: 'Indah Permatasari' })).toHaveFocus();
    // A pause, and a new word.
    now += 600;
    await userEvent.keyboard('g');
    expect(screen.getByRole('option', { name: 'Group' })).toHaveFocus();
  });

  it('P19.8-T1 AC-2 Escape closes it, focus back on the button, and a dialog around it stays open', async () => {
    const outer = vi.fn();
    render(
      // A dialog's own Escape (Modal's `trap`) listens on its box; the picker's Escape is the picker's.
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions
      <div onKeyDown={(e) => { if (e.key === 'Escape') outer(); }}>
        <Picker />
      </div>,
    );
    await userEvent.click(button());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(button()).toHaveFocus();
    expect(outer).not.toHaveBeenCalled();
  });

  it('P19.8-T1 AC-2 a tap outside — on the shade — closes it, focus back on the button, and nothing under it is pressed', async () => {
    const after = vi.fn();
    render(
      <div>
        <PickerMenu label="Tampilan" value="agenda" options={VIEWS} onChange={() => {}} />
        <button type="button" onClick={after}>Under</button>
      </div>,
    );
    await userEvent.click(button());
    const shade = document.querySelector('[data-picker-shade]') as HTMLElement;
    await userEvent.click(shade);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(button()).toHaveFocus();
    expect(after).not.toHaveBeenCalled();
  });

  it('P19.8-T1 AC-2 a press on something drawn over the shade closes it too, and leaves the focus where it went', async () => {
    render(<Picker />);
    await userEvent.click(button());
    fireEvent.pointerDown(screen.getByRole('button', { name: 'After' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('P19.8-T1 AC-2 Tab closes it from the button and moves on', async () => {
    render(<Picker />);
    await userEvent.click(button());
    await userEvent.tab();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });

  it('P19.8-T1 AC-2 the button closes what it opened', async () => {
    render(<Picker />);
    await userEvent.click(button());
    await userEvent.click(button());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('P19.8-T1 AC-2 MOB UI-184 group labels: PER ORANG names its group and is never a choice', async () => {
    render(<Picker items={RATIO} start="m-2" label="Rasio" />);
    await userEvent.click(screen.getByRole('button', { name: 'Rasio Indah Permatasari' }));
    const list = screen.getByRole('listbox', { name: 'Rasio' });
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Unit', 'Group', 'Agus Prasetyo', 'Indah Permatasari', 'Lukman Hakim',
    ]);
    const group = within(list).getByRole('group', { name: 'PER ORANG' });
    expect(within(group).getAllByRole('option')).toHaveLength(3);
    expect(screen.queryByRole('option', { name: 'PER ORANG' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Indah Permatasari', selected: true })).toHaveFocus();
    // ↑ from the group's first person reaches *Group*, across the label.
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(screen.getByRole('option', { name: 'Group' })).toHaveFocus();
    expect(pickerOptions(RATIO).map((o) => o.value)).toEqual(['unit', 'group', 'm-1', 'm-2', 'm-3']);
  });

  it('P19.8-T1 AC-2 a long list scrolls inside the card, which never grows past 300px', async () => {
    render(<Picker />);
    await userEvent.click(button());
    const list = screen.getByRole('listbox');
    expect(list).toHaveClass('overflow-y-auto', 'overscroll-contain', 'fixed');
    expect(list.style.maxHeight).not.toBe('');
  });

  it('P19.8-T1 AC-2 the on-secondary tone: the white pill with no line, on the ratio card', () => {
    render(<Picker tone="on-secondary" />);
    expect(button()).toHaveClass('border-transparent', 'bg-card', 'text-navy');
  });

  it('P19.8-T1 AC-2 the shade lies over the page on a phone only, and is clear from 768px', async () => {
    render(<Picker />);
    await userEvent.click(button());
    const shade = document.querySelector('[data-picker-shade]') as HTMLElement;
    expect(wears(shade, 375)).toContain('bg-ink/[0.12]');
    expect(wears(shade, 1280)).not.toContain('bg-ink');
  });

  it('P19.8-T1 AC-2 a disabled picker opens nothing', async () => {
    render(<Picker disabled />);
    expect(button()).toBeDisabled();
    await userEvent.click(button());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('P19.8-T1 AC-2 has no axe violations, closed and open, with a group', async () => {
    const { container } = render(<Picker items={RATIO} start="unit" label="Rasio" />);
    // jsdom paints nothing, so axe cannot measure contrast here; the tokens' pairs are `tokens.md`'s.
    const rules = { 'color-contrast': { enabled: false } };
    expect((await axe(container, { rules })).violations ?? []).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Rasio Unit' }));
    expect((await axe(container, { rules })).violations ?? []).toHaveLength(0);
  });
});

/*
 * **Where the menu lands** (AC-2: *right under it, above when the screen has no room below, inside the 16px gutters at
 * 360px*). jsdom lays nothing out, so the button's box and the window's are given, and the menu's own size.
 */
describe('PickerMenu placement (P19.8-T1 AC-2)', () => {
  type Box = { left: number; top: number; width: number; height: number };
  const rectOf = (b: Box) => ({ ...b, right: b.left + b.width, bottom: b.top + b.height, x: b.left, y: b.top, toJSON: () => ({}) }) as DOMRect;

  function laidOut({ width, height, button: at, menu, bar }: {
    width: number;
    height: number;
    button: Box;
    menu: { width: number; height: number };
    /** The tab bar's box, where one is drawn. */
    bar?: Box;
  }) {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(width);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(height);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect(this: HTMLElement) {
      if (this.hasAttribute('data-picker-button')) return rectOf(at);
      if (bar && this.hasAttribute('data-tab-bar')) return rectOf(bar);
      return rectOf({ left: 0, top: 0, width: 0, height: 0 });
    });
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function h(this: HTMLElement) {
      return this.getAttribute('role') === 'listbox' ? menu.height : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function w(this: HTMLElement) {
      return this.getAttribute('role') === 'listbox' ? menu.width : 0;
    });
  }

  it('P19.8-T1 AC-2 at 375px, right under the button, its left edge on the button’s', async () => {
    laidOut({ width: 375, height: 812, button: { left: 120, top: 100, width: 110, height: 44 }, menu: { width: 170, height: 188 } });
    render(<Picker />);
    await userEvent.click(button());
    const list = screen.getByRole('listbox');
    expect(list.style.top).toBe('150px');
    expect(list.style.left).toBe('120px');
    expect(list.style.minWidth).toBe('110px');
    expect(list.style.maxHeight).toBe('188px');
  });

  it('P19.8-T1 AC-2 at 360px, kept inside the 16px gutter on the right', async () => {
    laidOut({ width: 360, height: 740, button: { left: 250, top: 100, width: 94, height: 44 }, menu: { width: 190, height: 188 } });
    render(<Picker />);
    await userEvent.click(button());
    // 360 − 16 − 190.
    expect(screen.getByRole('listbox').style.left).toBe('154px');
  });

  it('P19.8-T1 AC-2 align="end": its right edge on the button’s, and never past the left gutter', async () => {
    laidOut({ width: 360, height: 740, button: { left: 40, top: 100, width: 80, height: 44 }, menu: { width: 190, height: 188 } });
    render(<Picker align="end" />);
    await userEvent.click(button());
    // 120 − 190 is past the gutter: 16.
    expect(screen.getByRole('listbox').style.left).toBe('16px');
  });

  it('P19.8-T1 AC-2 above the button when the screen has no room below', async () => {
    laidOut({ width: 375, height: 812, button: { left: 16, top: 700, width: 110, height: 44 }, menu: { width: 170, height: 188 } });
    render(<Picker />);
    await userEvent.click(button());
    // 700 − 6 − 188.
    expect(screen.getByRole('listbox').style.top).toBe('506px');
  });

  it('P19.8-T1 AC-2 never under the tab bar: its top is the floor', async () => {
    laidOut({
      width: 375, height: 812, button: { left: 16, top: 560, width: 110, height: 44 }, menu: { width: 170, height: 188 },
      bar: { left: 12, top: 724, width: 351, height: 64 },
    });
    const bar = document.createElement('nav');
    bar.setAttribute('data-tab-bar', '');
    document.body.appendChild(bar);
    render(<Picker />);
    await userEvent.click(button());
    // Below: 724 − 604 − 6 − 8 = 106px of room, less than 188; above: 546. So above: 560 − 6 − 188.
    expect(screen.getByRole('listbox').style.top).toBe('366px');
    bar.remove();
  });

  it('P19.8-T1 AC-2 a list taller than 300px is held at 300 and scrolls', async () => {
    laidOut({ width: 375, height: 812, button: { left: 16, top: 100, width: 110, height: 44 }, menu: { width: 190, height: 520 } });
    render(<Picker />);
    await userEvent.click(button());
    expect(screen.getByRole('listbox').style.maxHeight).toBe('300px');
  });
});
