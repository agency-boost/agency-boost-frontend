import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { ActionMenu, type ActionMenuItem } from './action-menu';

function setup(over: Partial<React.ComponentProps<typeof ActionMenu>> = {}) {
  const details = vi.fn();
  const won = vi.fn();
  const lost = vi.fn();
  const remove = vi.fn();
  const items: ActionMenuItem[] = [
    { label: 'Lead details', glyph: '☎', onSelect: details },
    { label: 'Mark successful', glyph: '✓', tone: 'success', disabled: true, reason: 'Available once status reaches the final stage', onSelect: won },
    { label: 'Mark not successful', glyph: '✕', tone: 'alert', onSelect: lost },
    { label: 'Delete', glyph: '🗑', onSelect: remove },
  ];
  const result = render(
    <div>
      <button type="button">Before</button>
      <ActionMenu label="Actions for Pak Budi" items={items} {...over} />
      <button type="button">After</button>
    </div>,
  );
  const trigger = screen.getByRole('button', { name: 'Actions for Pak Budi' });
  return { ...result, trigger, details, won, lost, remove };
}

const item = (name: string) => screen.getByRole('menuitem', { name });

/**
 * The ⋮ menu (P13.1-T4 AC-3): the ARIA menu-button pattern, whole — a menu that claims the role and
 * skips its keys leaves a screen reader pressing keys that do nothing.
 */
describe('ActionMenu (P13.1-T4 AC-3)', () => {
  it('P13.1-T4 AC-3 is a named button that says it opens a menu, and shows nothing until asked', () => {
    const { trigger } = setup();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger.querySelector('[aria-hidden="true"]')).toHaveTextContent('⋮');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('P13.1-T4 AC-3 opens on a click onto the first item, labelled by its button', async () => {
    const { trigger } = setup();
    await userEvent.click(trigger);

    const menu = screen.getByRole('menu', { name: 'Actions for Pak Budi' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', menu.id);
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual([
      '☎Lead details',
      '✓Mark successfulAvailable once status reaches the final stage',
      '✕Mark not successful',
      '🗑Delete',
    ]);
    expect(item('Lead details')).toHaveFocus();
  });

  it('P13.1-T4 AC-3 opens from the keyboard: Enter on the first item, ↓ on the first, ↑ on the last', async () => {
    const { trigger } = setup();
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    expect(item('Lead details')).toHaveFocus();
    await userEvent.keyboard('{Escape}');

    await userEvent.keyboard('{ArrowUp}');
    expect(item('Delete')).toHaveFocus();
    await userEvent.keyboard('{Escape}');

    await userEvent.keyboard('{ArrowDown}');
    expect(item('Lead details')).toHaveFocus();
  });

  it('P13.1-T4 AC-3 moves with the arrows, round the ends, and to the ends with Home and End', async () => {
    const { trigger } = setup();
    await userEvent.click(trigger);

    await userEvent.keyboard('{ArrowDown}');
    // An unavailable item is still met, so its reason is heard.
    expect(item('Mark successful')).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(item('Delete')).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(item('Lead details')).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(item('Delete')).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(item('Lead details')).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(item('Delete')).toHaveFocus();
  });

  it('P13.1-T4 AC-3 closes on Escape and gives the focus back to ⋮', async () => {
    const { trigger, details } = setup();
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
    expect(details).not.toHaveBeenCalled();
  });

  it('P13.1-T4 AC-3 closes on Tab and moves on from ⋮, not from the top of the page', async () => {
    const { trigger } = setup();
    await userEvent.click(trigger);
    await userEvent.tab();

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });

  it('P13.1-T4 AC-3 closes on a click or a tap outside, and leaves the focus where it went', async () => {
    const { trigger } = setup();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: 'Before' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();

    await userEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('P13.1-T4 AC-3 stays open on a click inside it, and closes on a second press of ⋮', async () => {
    const { trigger } = setup();
    await userEvent.click(trigger);
    fireEvent.mouseDown(screen.getByRole('menu'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await userEvent.click(trigger);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('P13.1-T4 AC-3 does what is chosen, by click or by Enter, with the focus back on ⋮ first', async () => {
    const { trigger, details, lost } = setup();
    const focusAtSelect: Element[] = [];
    details.mockImplementation(() => focusAtSelect.push(document.activeElement!));

    await userEvent.click(trigger);
    await userEvent.click(item('Lead details'));
    expect(details).toHaveBeenCalledTimes(1);
    // A dialog the item opens records this, and returns the reader to it when it closes.
    expect(focusAtSelect).toEqual([trigger]);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    trigger.focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');
    expect(lost).toHaveBeenCalledTimes(1);
  });

  it('P13.1-T4 AC-3 says why an item is not available, and choosing it does nothing', async () => {
    const { trigger, won } = setup();
    await userEvent.click(trigger);

    const held = item('Mark successful');
    expect(held).toHaveAttribute('aria-disabled', 'true');
    expect(held).toHaveAccessibleDescription('Available once status reaches the final stage');
    // Not `disabled`: the arrows still reach it.
    expect(held).not.toBeDisabled();
    await userEvent.click(held);
    expect(won).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(item('Lead details')).not.toHaveAttribute('aria-describedby');
  });

  it('P13.1-T4 AC-3 opens nothing on a row that is not yet anything to act on', async () => {
    const { trigger, details } = setup({ inert: true });
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(trigger);
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(details).not.toHaveBeenCalled();
  });

  it('P13.1-T4 AC-3 opens upward when the window has no room below its button', async () => {
    const { trigger } = setup();
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      top: 700, bottom: 728, left: 872, right: 900, width: 28, height: 28, x: 872, y: 700, toJSON: () => ({}),
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(160);
    // A 1024 × 768 window with a classic 15px scrollbar: 1009px of viewport across, 768 down.
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1009);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768);
    await userEvent.click(trigger);

    const menu = screen.getByRole('menu');
    // 768px tall: 40px below the button is no room for 160px, so it goes above, 4px clear of it.
    expect(menu.style.top).toBe(`${700 - 160 - 4}px`);
    // Measured from the viewport's edge, not the window's: the scrollbar is not counted (finding 3).
    expect(menu.style.right).toBe(`${1009 - 900}px`);
    vi.restoreAllMocks();
  });

  it('P13.1-T4 AC-3 has no axe violations, open', async () => {
    const { trigger, container } = setup();
    await userEvent.click(trigger);
    // Contrast needs a stylesheet jsdom does not apply; `a11y.spec.tsx` checks the tokens themselves.
    expect((await axe(container, { rules: { 'color-contrast': { enabled: false } } })).violations ?? []).toHaveLength(0);
  });
});
