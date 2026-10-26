import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DecimalInput } from './decimal-input';

/** P18.95-T1 AC-3 (ADR-0167 §1): a decimal typed with a comma or a point. */
describe('DecimalInput', () => {
  function Harness({ initial = null as number | null, onValue = (_: number | null) => {} }) {
    const [value, setValue] = useState<number | null>(initial);
    return (
      <>
        <label htmlFor="d">Closing rate</label>
        <DecimalInput id="d" value={value} onValueChange={(v) => { setValue(v); onValue(v); }} suffix="%" />
        <output>{value === null ? 'empty' : String(value)}</output>
        <button type="button" onClick={() => setValue(42.5)}>Reset</button>
      </>
    );
  }

  it('is text with the decimal keypad, so a comma can be typed at all', () => {
    render(<Harness initial={30} />);
    const field = screen.getByLabelText('Closing rate');
    expect(field).toHaveAttribute('type', 'text');
    expect(field).toHaveAttribute('inputmode', 'decimal');
    expect(field).toHaveValue('30');
  });

  it('reads a comma or a point as the decimal, and keeps what was typed while it is typed', async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const field = screen.getByLabelText('Closing rate');
    await userEvent.type(field, '27,5');
    expect(field).toHaveValue('27,5');
    expect(screen.getByRole('status')).toHaveTextContent('27.5');
    // *27,* on its way to *27,5* was read as 27 and stayed on screen as typed.
    expect(onValue).toHaveBeenCalledWith(27);
    await userEvent.clear(field);
    await userEvent.type(field, '33.5');
    expect(screen.getByRole('status')).toHaveTextContent('33.5');
  });

  it('reports an emptied box as null, and keeps no character a decimal cannot hold', async () => {
    render(<Harness initial={30} />);
    const field = screen.getByLabelText('Closing rate');
    await userEvent.clear(field);
    expect(screen.getByRole('status')).toHaveTextContent('empty');
    await userEvent.type(field, '1a2');
    expect(field).toHaveValue('12');
  });

  it('leaves the value alone while the text is not a number yet', async () => {
    const onValue = vi.fn();
    render(<Harness initial={5} onValue={onValue} />);
    const field = screen.getByLabelText('Closing rate');
    await userEvent.type(field, ',2,');
    expect(field).toHaveValue('5,2,');
    expect(onValue).not.toHaveBeenCalledWith(Number.NaN);
    expect(screen.getByRole('status')).toHaveTextContent('5.2');
  });

  it('writes a value set from outside with a comma', async () => {
    render(<Harness initial={3.1} />);
    expect(screen.getByLabelText('Closing rate')).toHaveValue('3,1');
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByLabelText('Closing rate')).toHaveValue('42,5');
  });
});
