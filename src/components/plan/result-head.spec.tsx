import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FitPill, ResultHead } from './result-head';

/** **The result's head and its pill** (D-components; P14-T8 AC-3, AC-11; second user P17-T3). */
describe('ResultHead and FitPill', () => {
  it('draws the tag, the title as the result’s heading, the tagline and the pill', () => {
    render(<ResultHead tag="Retirement income · Conventional" title="PRUMapan" tagline="A line." pill={{ label: 'Good fit', tone: 'success' }} />);
    expect(screen.getByText('Retirement income · Conventional')).toHaveClass('text-amber-ink');
    expect(screen.getByRole('heading', { level: 2, name: 'PRUMapan' })).toBeInTheDocument();
    expect(screen.getByText('A line.')).toBeInTheDocument();
    expect(screen.getByText('Good fit')).toHaveAttribute('data-tone', 'success');
  });

  it('P14-T8 AC-11 the heading can take the focus by script, and is no tab stop', () => {
    const ref = createRef<HTMLHeadingElement>();
    render(<ResultHead tag="t" title="PRUMapan" tagline="x" pill={{ label: 'Check fit', tone: 'alert' }} headingRef={ref} />);
    ref.current!.focus();
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'PRUMapan' }));
    expect(ref.current).toHaveAttribute('tabindex', '-1');
  });

  it.each([
    ['Good fit', 'success', 'text-success'], ['Check fit', 'alert', 'text-alert'], ['From catalog', 'neutral', 'text-muted'],
  ] as const)('P14-T8 AC-11 the verdict is the word: %s, the tint only repeats it', (label, tone, text) => {
    render(<FitPill label={label} tone={tone} />);
    const pill = screen.getByText(label);
    expect(pill).toHaveClass(text);
    expect(pill.textContent).toBe(label);
  });
});
