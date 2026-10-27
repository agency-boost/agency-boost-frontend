import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CHIP_GRID_PHONE, CHIP_PHONE } from '@/components/ui/phone';
import { MultiChoiceGroup } from './multi-choice-group';

const DRIVERS = [
  { value: 'side-income', label: 'Extra income on the side' },
  { value: 'full-career', label: 'Full career change' },
  { value: 'flexibility', label: 'Flexibility / time freedom' },
  { value: 'leadership', label: 'Building a team / leadership' },
];

function Harness({ initial = [] as string[], onChange }: { initial?: string[]; onChange?: (v: string[]) => void }) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <MultiChoiceGroup
      label="What's driving them"
      options={DRIVERS}
      value={value}
      onChange={(next) => { onChange?.(next); setValue(next); }}
    />
  );
}

const group = () => screen.getByRole('group', { name: 'What\'s driving them' });
const chip = (name: string) => within(group()).getByRole('button', { name });

/** **The multiple-choice chip group** (D-components; P17-T3 AC-3, AC-8): its user is the Recruitment Attack Plan. */
describe('MultiChoiceGroup', () => {
  it('P17-T3 AC-8 is a group named by its question, of toggle buttons that say which are chosen', () => {
    render(<Harness />);
    expect(within(group()).getAllByRole('button').map((c) => [c.textContent, c.getAttribute('aria-pressed')])).toEqual([
      ['Extra income on the side', 'false'], ['Full career change', 'false'],
      ['Flexibility / time freedom', 'false'], ['Building a team / leadership', 'false'],
    ]);
  });

  it('P17-T3 AC-3 chooses any number: a chip toggles itself and leaves the others as they are', async () => {
    render(<Harness />);
    await userEvent.click(chip('Full career change'));
    await userEvent.click(chip('Building a team / leadership'));
    expect(chip('Full career change')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Building a team / leadership')).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(chip('Full career change'));
    expect(chip('Full career change')).toHaveAttribute('aria-pressed', 'false');
    expect(chip('Building a team / leadership')).toHaveAttribute('aria-pressed', 'true');
  });

  it('D-vocabulary hands back the answer in the chips’ order, not the order clicked (`:521`)', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(chip('Building a team / leadership'));
    await userEvent.click(chip('Extra income on the side'));
    await userEvent.click(chip('Flexibility / time freedom'));
    expect(onChange).toHaveBeenLastCalledWith(['side-income', 'flexibility', 'leadership']);
  });

  it('shows what it is given as chosen, and ignores a value no chip has', () => {
    render(<Harness initial={['flexibility', 'nobody-has-this']} />);
    expect(chip('Flexibility / time freedom')).toHaveAttribute('aria-pressed', 'true');
    expect(within(group()).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
  });

  it('a chosen chip is navy with white text, an open one navy on the warm ground — the words the same', () => {
    render(<Harness initial={['leadership']} />);
    expect(chip('Building a team / leadership')).toHaveClass('bg-navy', 'text-white');
    expect(chip('Full career change')).toHaveClass('bg-base', 'text-navy');
  });

  it('P17-T3 AC-8 wraps its chips, so a phone never scrolls sideways', () => {
    render(<Harness />);
    expect(chip('Full career change').parentElement).toHaveClass('flex-wrap');
  });

  it('P18.95-T6 AC-1 grid/sticky classes scoped to max-md: two chips to a row below 768px, as ChoiceGroup’s', () => {
    render(<Harness />);
    expect(chip('Full career change').parentElement).toHaveClass('flex', 'flex-wrap', ...CHIP_GRID_PHONE.split(' '));
    for (const each of within(group()).getAllByRole('button')) expect(each).toHaveClass(...CHIP_PHONE.split(' '));
  });

  it('renders a label as text', () => {
    render(<MultiChoiceGroup label="Q" options={[{ value: 'a', label: '<b>x</b>' }]} value={[]} onChange={() => undefined} />);
    expect(screen.getByRole('button', { name: '<b>x</b>' })).toBeInTheDocument();
    expect(document.querySelector('b')).toBeNull();
  });
});
