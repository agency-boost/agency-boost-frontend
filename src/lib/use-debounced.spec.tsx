import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SEARCH_DEBOUNCE_MS, useDebounced } from './use-debounced';

function Probe({ value }: { value: string }) {
  return <span data-testid="settled">{useDebounced(value)}</span>;
}

describe('useDebounced', () => {
  afterEach(() => vi.useRealTimers());

  it('holds the value until the typing stops', () => {
    vi.useFakeTimers();
    const { rerender } = render(<Probe value="R" />);
    expect(screen.getByTestId('settled')).toHaveTextContent('R');

    rerender(<Probe value="Ri" />);
    rerender(<Probe value="Rin" />);
    act(() => void vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
    // Still the first value: each keystroke restarted the clock, which is the point —
    // otherwise the server answers "Ri" while the reader is looking at "Rin".
    expect(screen.getByTestId('settled')).toHaveTextContent('R');

    act(() => void vi.advanceTimersByTime(1));
    expect(screen.getByTestId('settled')).toHaveTextContent('Rin');
  });

  it('settles on the last value, not the first of the burst', () => {
    vi.useFakeTimers();
    const { rerender } = render(<Probe value="a" />);
    for (const v of ['ab', 'abc', 'abcd']) rerender(<Probe value={v} />);
    act(() => void vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(screen.getByTestId('settled')).toHaveTextContent('abcd');
  });
});
