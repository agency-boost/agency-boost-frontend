import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AlternativesRow } from './alternatives-row';

const ITEMS = [{ key: 'A', label: 'PRUSehat' }, { key: 'B', label: 'PRUWell Medical' }];

/** **The alternatives row** (D-components; P14-T8 AC-3, AC-5; second user P17-T3). */
describe('AlternativesRow', () => {
  it('says what the chips are, draws them as given, and the more line', async () => {
    const onPick = vi.fn();
    render(<AlternativesRow label="Also matches this need — click to switch the plan above:" items={ITEMS} onPick={onPick} more="3 more also match." />);
    expect(screen.getByText('Also matches this need — click to switch the plan above:')).toBeInTheDocument();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['PRUSehat', 'PRUWell Medical']);
    expect(screen.getByText('3 more also match.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'PRUWell Medical' }));
    expect(onPick).toHaveBeenCalledWith('B');
  });

  it('draws no more line without one, and nothing at all without alternatives', () => {
    const { container, rerender } = render(<AlternativesRow label="L" items={ITEMS} onPick={() => {}} />);
    expect(container.querySelectorAll('p')).toHaveLength(1);
    rerender(<AlternativesRow label="L" items={[]} onPick={() => {}} more="x" />);
    expect(container).toBeEmptyDOMElement();
  });
});
