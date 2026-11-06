import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { renderInIndonesian } from '@test/harness';
import { FLOATING_BAR_BUTTON, FLOATING_BAR_PILL, FLOATING_BAR_ROOM, FloatingBar } from './floating-bar';
import { FLOATING_SAVE_ROOM, FloatingSavePill } from './save-state';

/**
 * **The floating bar** (the product owner's staging review, 2026-10-31: *"semua floating tambahan itu bisa buat modelan
 * kayak goal setting gini, karena yang lain jelek, kotak gitu, sizenya juga aneh"*). One form for every bar held over a
 * phone's page: Goal Setting's pill. jsdom lays nothing out, so what is pinned is what each element asks for.
 */
const bar = () => document.querySelector('[data-floating-bar]') as HTMLElement;
const pill = () => document.querySelector('[data-floating-bar-pill]') as HTMLElement;
const BOTTOM = 'bottom-[max(calc(var(--tab-bar-space)+0.75rem),calc(env(safe-area-inset-bottom)+0.75rem))]';

describe('FloatingBar (staging review, 2026-10-31)', () => {
  it('stands 12px from the sides and 12px above the tab bar — or the home indicator — counting the inset once', () => {
    render(<FloatingBar><span>Draf · 2 tindakan</span></FloatingBar>);
    expect(bar()).toHaveClass('fixed', 'inset-x-3', BOTTOM, 'z-[9]');
    // The full-width strip's marks are gone: no edge-to-edge width, no rule above it, and no second inset under it
    // (`--tab-bar-space` already holds the home indicator, and the strip added it again as white space).
    expect(bar().className).not.toMatch(/inset-x-0|border-t|pb-\[calc/);
    expect(pill().className).not.toMatch(/border-t|safe-area/);
  });

  it('draws one pill: white, round-ended, the modal’s shadow, 16px before its words and 6px round its button', () => {
    render(<FloatingBar><span>words</span></FloatingBar>);
    expect(pill()).toHaveClass('flex', 'items-center', 'rounded-pill', 'bg-card', 'shadow-modal', 'pl-4', 'pr-1.5', 'py-1.5');
    expect(pill().className).toBe(FLOATING_BAR_PILL);
    expect(bar()).toContainElement(screen.getByText('words'));
  });

  it('goes from 1024px by default, and stands in the page as a card when asked', () => {
    const { unmount } = render(<FloatingBar><span>a</span></FloatingBar>);
    expect(bar()).toHaveClass('lg:hidden');
    unmount();
    render(<FloatingBar wide="card"><span>b</span></FloatingBar>);
    expect(bar()).not.toHaveClass('lg:hidden');
    expect(bar()).toHaveClass('lg:static', 'lg:z-auto', 'lg:rounded-lg', 'lg:border', 'lg:p-3.5');
    expect(pill()).toHaveClass('lg:rounded-none', 'lg:bg-transparent', 'lg:p-0', 'lg:shadow-none');
  });

  it('says what it has to say in a card above the pill, and draws none when there is nothing', () => {
    const { rerender } = render(<FloatingBar note={null}><span>row</span></FloatingBar>);
    expect(document.querySelector('[data-floating-bar-note]')).toBeNull();
    rerender(<FloatingBar note={<p role="alert">Every action item needs a date.</p>}><span>row</span></FloatingBar>);
    const note = document.querySelector('[data-floating-bar-note]') as HTMLElement;
    expect(note).toHaveClass('rounded-lg', 'bg-card', 'shadow-modal');
    expect(note.nextElementSibling).toBe(pill());
    expect(within(note).getByRole('alert')).toHaveTextContent('Every action item needs a date.');
  });

  it('keeps the pill’s button, and the focus on it, when a note appears above it', async () => {
    function Bar({ note }: { note: string | null }) {
      return <FloatingBar note={note}><button type="button" className={FLOATING_BAR_BUTTON}>Finalkan</button></FloatingBar>;
    }
    const { rerender } = render(<Bar note={null} />);
    const button = screen.getByRole('button', { name: 'Finalkan' });
    await userEvent.click(button);
    expect(button).toHaveFocus();
    rerender(<Bar note="Every action item needs a date." />);
    expect(screen.getByRole('button', { name: 'Finalkan' })).toBe(button);
    expect(button).toHaveFocus();
  });

  it('lands the page’s own attributes on the bar, and leaves the marker that lifts the toast', () => {
    render(<FloatingBar data-finalize-bar="draft" className="extra"><span>x</span></FloatingBar>);
    expect(bar()).toHaveAttribute('data-finalize-bar', 'draft');
    expect(bar()).toHaveClass('extra');
  });

  it('gives the accent button its 44px pill, navy and bold on the accent (I-542)', () => {
    expect(FLOATING_BAR_BUTTON.split(' ')).toEqual(expect.arrayContaining([
      'min-h-11', 'rounded-pill', 'bg-primary', 'text-primary-contrast', 'font-bold', 'px-5', 'shrink-0',
    ]));
  });

  it('has one room class, which the save pill’s name still reads', () => {
    expect(FLOATING_BAR_ROOM).toBe('max-lg:pb-24');
    expect(FLOATING_SAVE_ROOM).toBe(FLOATING_BAR_ROOM);
  });

  it('passes axe with a note', async () => {
    // In a page's `<main>`, as every bar is drawn.
    render(
      <main>
        <FloatingBar note={<p role="alert">Refused.</p>}>
          <span className="min-w-0 flex-1">Draf · 2 tindakan</span>
          <button type="button" className={FLOATING_BAR_BUTTON}>Finalkan sesi ini</button>
        </FloatingBar>
      </main>,
    );
    // jsdom computes no colour, so contrast is the tokens' own test (`theme.spec.ts`), as in every axe check here.
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});

describe('FloatingSavePill wears the floating bar (staging review, 2026-10-31)', () => {
  it('keeps its own marker and its public shape, on the floating bar', async () => {
    const onSave = vi.fn();
    renderInIndonesian(<FloatingSavePill state="unsaved" label="Simpan goal" onSave={onSave} className="mine" />);
    const save = document.querySelector('[data-floating-save]') as HTMLElement;
    expect(save).toBe(bar());
    expect(save).toHaveClass('fixed', 'inset-x-3', BOTTOM, 'lg:hidden', 'mine');
    expect(within(pill()).getByRole('status')).toHaveTextContent('Belum disimpan');
    const button = screen.getByRole('button', { name: 'Simpan goal' });
    expect(button.className).toBe(FLOATING_BAR_BUTTON);
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onSave).toHaveBeenCalled();
  });

  it('submits a form when given one, and holds while saving', () => {
    renderInIndonesian(<FloatingSavePill state="saving" label="Simpan" form="profile" />);
    const button = screen.getByRole('button', { name: 'Simpan' });
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveAttribute('form', 'profile');
    expect(button).toBeDisabled();
  });
});
