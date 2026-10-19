import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TippedGlyph } from './tipped-glyph';

/**
 * The glyph whose words show on hover, focus and tap (ADR-0062 §2, form 2), on its own. The leads
 * table's AC-9 tests walk it inside a row; these pin what every caller relies on.
 */
describe('TippedGlyph', () => {
  afterEach(() => vi.restoreAllMocks());

  const bubble = (text: string) => screen.getByText(text, { selector: '[role="tooltip"]' });

  it('P13-T4 AC-4 takes a face of its own: the Auto chip, its word drawn, its sentence its description', () => {
    render(
      <TippedGlyph
        glyph="Auto"
        name="Auto — completes when the hire has added at least one prospect"
        tip="Completes when the hire has added at least one prospect."
        face="h-auto w-auto rounded-pill px-[7px]"
      />,
    );
    const chip = screen.getByRole('button', { name: 'Auto — completes when the hire has added at least one prospect' });
    expect(chip.className).toContain('rounded-pill');
    expect(chip.className).toContain('w-auto');
    expect(chip.className).not.toContain('w-7');
    expect(chip).toHaveAccessibleDescription('Completes when the hire has added at least one prospect.');
  });

  it('is a button named by its words, with the glyph hidden from a screen reader', () => {
    render(<TippedGlyph glyph="✎" name="Last changed by Ibu Sari" tip="Last changed by Ibu Sari" />);
    const glyph = screen.getByRole('button', { name: 'Last changed by Ibu Sari' });
    expect(glyph.querySelector('[aria-hidden="true"]')).toHaveTextContent('✎');
    expect(bubble('Last changed by Ibu Sari')).not.toBeVisible();
  });

  it('shows the words on focus, and Escape and blur put them away', async () => {
    render(<TippedGlyph glyph="✎" name="Last changed by Ibu Sari" tip="Last changed by Ibu Sari" />);
    const glyph = screen.getByRole('button');
    const tip = bubble('Last changed by Ibu Sari');

    act(() => glyph.focus());
    expect(tip).toBeVisible();
    await userEvent.keyboard('{Escape}');
    expect(tip).not.toBeVisible();

    fireEvent.click(glyph);
    expect(tip).toBeVisible();
    act(() => glyph.blur());
    expect(tip).not.toBeVisible();
  });

  it('puts the words away on a press anywhere else, with no blur to do it — a tap on an iPhone', () => {
    render(
      <>
        <TippedGlyph glyph="ⓘ" name="From your office’s upload" tip="From your office’s upload" align="fit" />
        <p>Elsewhere on the card</p>
      </>,
    );
    const tip = bubble('From your office’s upload');

    // Safari on iOS shows it on the tap and never focuses the button.
    fireEvent.click(screen.getByRole('button'));
    expect(tip).toBeVisible();
    expect(screen.getByRole('button')).not.toHaveFocus();
    // A press on the glyph itself is not elsewhere.
    fireEvent.pointerDown(screen.getByRole('button'));
    expect(tip).toBeVisible();

    fireEvent.pointerDown(screen.getByText('Elsewhere on the card'));
    expect(tip).not.toBeVisible();
  });

  it('keeps the words up while the pointer is on them, and a press on them puts them away', async () => {
    render(<TippedGlyph glyph="✎" name="Last changed by Ibu Sari" tip="Last changed by Ibu Sari" />);
    const tip = bubble('Last changed by Ibu Sari');

    await userEvent.hover(screen.getByRole('button'));
    await userEvent.hover(tip);
    expect(tip).toBeVisible();
    fireEvent.pointerDown(tip);
    expect(tip).not.toBeVisible();
  });

  it('is read once when the words repeat the name, and is the description when they add to it', () => {
    render(
      <>
        <TippedGlyph glyph="✎" name="Last changed by Ibu Sari" tip="Last changed by Ibu Sari" />
        <TippedGlyph glyph="🗑" name="Delete lead" tip="Only the person who owns this lead can delete it." unavailable />
      </>,
    );
    expect(bubble('Last changed by Ibu Sari')).toHaveAttribute('aria-hidden', 'true');

    const held = screen.getByRole('button', { name: 'Delete lead' });
    expect(held).toHaveAccessibleDescription('Only the person who owns this lead can delete it.');
    // Held, not disabled: a reason nobody can focus is a reason nobody is given.
    expect(held).toHaveAttribute('aria-disabled', 'true');
    expect(held).not.toBeDisabled();
    expect(held.className).toContain('opacity-30');
  });

  it('opens right-aligned on one line by default — the leads table’s', () => {
    render(<TippedGlyph glyph="✎" name="Words" tip="Words" />);
    const tip = bubble('Words');
    expect(tip.className).toContain('bottom-full');
    expect(tip.className).toContain('right-0');
    expect(tip.className).toContain('whitespace-nowrap');
  });

  describe('align="fit" — a glyph that can sit anywhere across a card', () => {
    const at = (left: number, right: number) => vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ left, right, width: right - left, top: 0, bottom: 28, height: 28, x: left, y: 0, toJSON: () => ({}) });

    it('opens toward the right from a glyph on the left half, and wraps short of the window’s edge', () => {
      vi.stubGlobal('innerWidth', 375);
      at(100, 128);
      render(<TippedGlyph glyph="ⓘ" name="From your office’s upload, September 2026" tip="From your office’s upload, September 2026" align="fit" />);
      fireEvent.click(screen.getByRole('button'));

      const tip = bubble('From your office’s upload, September 2026');
      expect(tip).toBeVisible();
      expect(tip.className).toContain('left-0');
      expect(tip.className).toContain('whitespace-normal');
      expect(tip.style.maxWidth).toBe(`${375 - 100 - 16}px`);
      vi.unstubAllGlobals();
    });

    it('opens toward the left from a glyph on the right half', () => {
      vi.stubGlobal('innerWidth', 375);
      at(300, 328);
      render(<TippedGlyph glyph="ⓘ" name="Your own figure" tip="Your own figure" align="fit" />);
      fireEvent.focus(screen.getByRole('button'));

      const tip = bubble('Your own figure');
      expect(tip.className).toContain('right-0');
      expect(tip.className).not.toContain('left-0');
      expect(tip.style.maxWidth).toBe(`${328 - 16}px`);
      vi.unstubAllGlobals();
    });
  });
});
