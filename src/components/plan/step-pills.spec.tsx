import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StepPills } from './step-pills';

/** **The step pills** (D-components; P14-T8 AC-3, AC-11; its second user is P17-T3). */
describe('StepPills', () => {
  it('is a named list of steps, the current one marked', () => {
    render(<StepPills label="Steps" steps={['Customer brief', 'Attack plan']} current={0} />);
    const list = screen.getByRole('list', { name: 'Steps' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((i) => i.textContent)).toEqual(['11 Customer brief', '22 Attack plan']);
    expect(items[0]).toHaveAttribute('aria-current', 'step');
    expect(items[1]).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('P14-T8 AC-11 a step behind the current one is a button, where the prototype’s is a clickable div', async () => {
    const onStep = vi.fn();
    render(<StepPills label="Steps" steps={['Customer brief', 'Attack plan']} current={1} onStep={onStep} />);
    const back = screen.getByRole('button', { name: '1 Customer brief' });
    await userEvent.click(back);
    expect(onStep).toHaveBeenCalledWith(0);
    back.focus();
    await userEvent.keyboard('{Enter}');
    expect(onStep).toHaveBeenCalledTimes(2);
    // The current step is no button: there is nowhere to go.
    expect(screen.queryByRole('button', { name: '2 Attack plan' })).not.toBeInTheDocument();
  });

  it('puts navy on the current step’s amber, where the prototype’s white is 2.2:1', () => {
    const { container } = render(<StepPills label="Steps" steps={['A', 'B']} current={0} />);
    expect(container.querySelector('[aria-current="step"] [aria-hidden="true"]')).toHaveClass('bg-amber', 'text-navy');
  });
});
