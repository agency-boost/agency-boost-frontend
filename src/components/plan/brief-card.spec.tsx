import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { BriefCard, ChoiceGroup, PLAN_CHIP_PHONE, PLAN_CHIPS_PHONE, PLAN_QUESTION_PHONE } from './brief-card';

const AGES = [{ value: 1, label: '< 25' }, { value: 2, label: '25–34' }, { value: 3, label: '35–49' }];

function Harness() {
  const [age, setAge] = useState<number | null>(null);
  return (
    <BriefCard title="Who are we talking to?" hint="Three questions.">
      <ChoiceGroup label="Age band" options={AGES} value={age} onChange={setAge} />
    </BriefCard>
  );
}

/** **The brief card and its single-choice chip groups** (D-components; P14-T8 AC-2, AC-11; second user P17-T3). */
describe('BriefCard and ChoiceGroup', () => {
  it('heads the card with its title and hint', () => {
    render(<Harness />);
    expect(screen.getByRole('heading', { level: 2, name: 'Who are we talking to?' })).toBeInTheDocument();
    expect(screen.getByText('Three questions.')).toBeInTheDocument();
  });

  it('P14-T8 AC-11 is a group named by its question, of toggle buttons that say which is chosen', async () => {
    render(<Harness />);
    const group = screen.getByRole('group', { name: 'Age band' });
    const chips = within(group).getAllByRole('button');
    expect(chips.map((c) => [c.textContent, c.getAttribute('aria-pressed')])).toEqual([
      ['< 25', 'false'], ['25–34', 'false'], ['35–49', 'false'],
    ]);

    await userEvent.click(within(group).getByRole('button', { name: '25–34' }));
    expect(within(group).getByRole('button', { name: '25–34' })).toHaveAttribute('aria-pressed', 'true');

    // Single choice: choosing another releases the first.
    await userEvent.click(within(group).getByRole('button', { name: '35–49' }));
    expect(within(group).getByRole('button', { name: '25–34' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(group).getByRole('button', { name: '35–49' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('wraps its chips, so a phone never scrolls sideways', () => {
    render(<Harness />);
    expect(within(screen.getByRole('group', { name: 'Age band' })).getAllByRole('button')[0].parentElement).toHaveClass('flex-wrap');
  });

  it('UI-107 on a phone: wrapping pill chips 38px tall with a 44px reach, the label in sentence case; wider as before', () => {
    render(<Harness />);
    const group = screen.getByRole('group', { name: 'Age band' });
    const chips = within(group).getAllByRole('button');
    const box = chips[0].parentElement!;
    const wider = (el: Element) => [...el.classList].filter((c) => !c.startsWith('max-md:'));
    expect(box).toHaveClass(...PLAN_CHIPS_PHONE.split(' '));
    expect(box).not.toHaveClass('max-md:grid');
    expect(wider(box)).toEqual(['flex', 'flex-wrap', 'gap-2']);
    for (const chip of chips) {
      expect(chip).toHaveClass(...PLAN_CHIP_PHONE.split(' '));
      expect(chip).toHaveClass('max-md:h-[2.375rem]', 'max-md:rounded-pill', 'max-md:after:-inset-y-[3px]');
      // At 768px and wider the chip is drawn exactly as before.
      expect(wider(chip)).toEqual(expect.arrayContaining(['rounded-md', 'border', 'px-[15px]', 'py-[9px]']));
    }
    expect(screen.getByText('Age band')).toHaveClass('uppercase', ...PLAN_QUESTION_PHONE.split(' '));
    // The question says whether it is answered, for the plan's always-active button (UI-107).
    expect(group).toHaveAttribute('data-answered', 'false');
  });
});
