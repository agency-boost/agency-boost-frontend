import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { SliderWithValue } from './slider-with-value';

/**
 * **An exact amount past the track's end** (P18.99-T5, UI-016's *exact amounts can still be typed*): Goal Setting's
 * annual target track reaches Rp 1 M, and a bigger target is still typed. The track's own behaviour is
 * `ui-v1-shared.spec.tsx`'s.
 */
describe('SliderWithValue — exactMin and exactMax (P18.99-T5)', () => {
  function Slider({ exactMin, exactMax }: { exactMin?: number; exactMax?: number }) {
    const [v, setV] = useState(500);
    return (
      <SliderWithValue
        label="Annual APE target"
        value={v}
        onChange={setV}
        min={100}
        max={1000}
        step={10}
        exactMin={exactMin}
        exactMax={exactMax}
        format={(n) => `Rp ${n} jt`}
      />
    );
  }

  const typeExact = async (typed: string) => {
    await userEvent.click(screen.getByRole('button', { name: /Type an exact amount/ }));
    const field = screen.getByRole('textbox', { name: /Type an exact amount/ });
    await userEvent.clear(field);
    await userEvent.type(field, `${typed}{Enter}`);
  };

  it('P18.99-T5 UI-016 takes a typed amount past the track’s end, and the thumb stands at the end it passed', async () => {
    render(<Slider exactMin={0} exactMax={100_000} />);

    await typeExact('2500');
    expect(screen.getByRole('button', { name: /Type an exact amount/ })).toHaveTextContent('Rp 2500 jt');
    expect(screen.getByRole('slider', { name: 'Annual APE target' })).toHaveValue('1000');

    await typeExact('40');
    expect(screen.getByRole('button', { name: /Type an exact amount/ })).toHaveTextContent('Rp 40 jt');
    expect(screen.getByRole('slider', { name: 'Annual APE target' })).toHaveValue('100');
  });

  it('P18.99-T5 UI-016 still holds a typed amount to its own bounds, and to the track’s without them', async () => {
    render(<Slider exactMin={0} exactMax={3000} />);
    await typeExact('9999');
    expect(screen.getByRole('button', { name: /Type an exact amount/ })).toHaveTextContent('Rp 3000 jt');
  });

  it('P18.99-T5 UI-016 without them, a typed amount is clamped to the track, as before', async () => {
    render(<Slider />);
    await typeExact('9999');
    expect(screen.getByRole('button', { name: /Type an exact amount/ })).toHaveTextContent('Rp 1000 jt');
  });
});
