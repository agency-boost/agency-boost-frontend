import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { wears } from '@test/harness';
import { BelowDesktopTip } from './below-desktop-tip';
import { SHOWN_FROM_DESKTOP } from './tablet';

const TEXT = 'New versions apply to new hires only.';
const drawn = (el: Element, px: number) => !wears(el, px).split(' ').includes('hidden');

/**
 * **A grey sentence's verdicts per size** (P18.97-T4 AC-6, ADR-0176 §6; the grey-text table of 2026-10-27): the
 * sentence from 1024px (`SHOWN_FROM_DESKTOP`), its ⓘ below it — and, where the row's *Mobile* verdict is *Remove*,
 * nothing below 768px.
 */
describe('P18.97-T4 AC-6 BelowDesktopTip', () => {
  it.each([[767, true], [768, true], [1023, true], [1024, false]])(
    'P18.97-T4 AC-6 at %ipx draws the ⓘ: %s', (px, shown) => {
      render(<BelowDesktopTip text={TEXT} />);
      expect(drawn(screen.getByRole('button', { name: TEXT }).parentElement!, px)).toBe(shown);
    },
  );

  it.each([[767, false], [768, true], [1023, true], [1024, false]])(
    'P18.97-T4 AC-6 a row the client removes on a phone, at %ipx: %s', (px, shown) => {
      render(<BelowDesktopTip text={TEXT} onPhone="remove" />);
      expect(drawn(screen.getByRole('button', { name: TEXT }).parentElement!, px)).toBe(shown);
    },
  );

  it.each([[767, false], [768, false], [1023, false], [1024, true]])(
    'P18.97-T4 AC-6 the sentence it stands for, at %ipx: %s', (px, shown) => {
      render(<p className={SHOWN_FROM_DESKTOP}>{TEXT}</p>);
      expect(drawn(screen.getByText(TEXT), px)).toBe(shown);
    },
  );

  it('P18.97-T4 AC-6 says the sentence on a tap, named by it or by a shorter name', async () => {
    render(<BelowDesktopTip text={TEXT} name="About new versions" className="ml-1" />);
    const glyph = screen.getByRole('button', { name: 'About new versions' });
    expect(glyph).toHaveTextContent('ⓘ');
    expect(glyph).toHaveAccessibleDescription(TEXT);
    expect(glyph.parentElement).toHaveClass('ml-1', 'lg:hidden');
    await userEvent.click(glyph);
    expect(screen.getByRole('tooltip')).toHaveTextContent(TEXT);
  });
});
