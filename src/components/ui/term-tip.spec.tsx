import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TERMS } from '@/lib/terms';
import { TermText, TermTip } from './term-tip';

describe('P18.95-T9 AC-3 TermTip', () => {
  it('is an ⓘ named What is {term}?, its bubble the term’s one line', async () => {
    render(<p>Annual APE <TermTip term="APE" /> target</p>);
    const tip = screen.getByRole('button', { name: 'What is APE?' });
    expect(tip).toHaveTextContent('ⓘ');
    expect(tip).toHaveAccessibleDescription(TERMS.APE.definition);
    // Hidden until asked for: on a tap, a focus or a hover, as every ⓘ (`TippedGlyph`).
    expect(screen.getByRole('tooltip', { hidden: true })).not.toBeVisible();
    await userEvent.click(tip);
    expect(screen.getByRole('tooltip')).toHaveTextContent(TERMS.APE.definition);
  });
});

describe('P18.95-T9 AC-3 TermText', () => {
  it('puts the ⓘ after the first time a listed term appears, and the words stay whole around it', () => {
    const { container } = render(<p><TermText text="Affordable whole-life, with optional CI premium waiver." terms={['CI_PREMIUM_WAIVER']} /></p>);
    const tip = screen.getByRole('button', { name: 'What is a CI premium waiver?' });
    expect(container.textContent!.startsWith('Affordable whole-life, with optional CI premium waiver ')).toBe(true);
    expect(container.textContent!.endsWith('.')).toBe(true);
    expect(tip).toHaveAccessibleDescription(TERMS.CI_PREMIUM_WAIVER.definition);
  });

  it('marks two terms in one sentence each once, in the order they stand', () => {
    render(<p><TermText text="JFW then NPA, then NPA again" terms={['NPA', 'JFW']} /></p>);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['ⓘWhat is JFW?', 'ⓘWhat is NPA?']);
  });

  it('draws the text alone where the screen has marked the term already, or the text does not hold it', () => {
    const { container, rerender } = render(<p><TermText text="Proses NPA" terms={[]} /></p>);
    expect(container.textContent).toBe('Proses NPA');
    rerender(<p><TermText text="Proses pendaftaran" terms={['NPA']} /></p>);
    expect(container.textContent).toBe('Proses pendaftaran');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
