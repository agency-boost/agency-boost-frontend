import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { Toast, TOAST_MS, useToast } from './toast';

function Harness() {
  const { toast, show } = useToast();
  return (
    <>
      <button type="button" onClick={() => show('Session started.')}>first</button>
      <button type="button" onClick={() => show('Goal updated — reflected across both tabs.')}>second</button>
      <Toast toast={toast} />
    </>
  );
}

/**
 * The design system's toast (`components-and-patterns.md`, *Toast*; parity D-07), built for the
 * coaching session (P11-T8 AC-11): bottom centre, a status dot and the words, gone after 2600 ms.
 */
describe('Toast (P11-T8 AC-11)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps its polite live region in the page while it is empty, so the words are announced when they arrive', () => {
    render(<Harness />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
    expect(region).toBeEmptyDOMElement();
  });

  it('says what it is given, with the amber dot hidden from assistive technology, and goes after 2600 ms', () => {
    render(<Harness />);
    act(() => screen.getByRole('button', { name: 'first' }).click());

    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('Session started.');
    expect(region.querySelector('[aria-hidden="true"]')).toHaveClass('bg-amber');
    act(() => { vi.advanceTimersByTime(TOAST_MS - 1); });
    expect(region).toHaveTextContent('Session started.');
    act(() => { vi.advanceTimersByTime(1); });
    expect(region).toBeEmptyDOMElement();
  });

  it('replaces an earlier toast with a later one, which keeps its full time', () => {
    render(<Harness />);
    act(() => screen.getByRole('button', { name: 'first' }).click());
    act(() => { vi.advanceTimersByTime(2000); });
    act(() => screen.getByRole('button', { name: 'second' }).click());

    expect(screen.getByRole('status')).toHaveTextContent('Goal updated — reflected across both tabs.');
    expect(screen.queryByText('Session started.')).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByRole('status')).toHaveTextContent('Goal updated — reflected across both tabs.');
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('stops its clock when the screen goes', () => {
    const { unmount } = render(<Harness />);
    act(() => screen.getByRole('button', { name: 'first' }).click());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('passes axe while it shows', async () => {
    vi.useRealTimers();
    render(<Harness />);
    act(() => screen.getByRole('button', { name: 'first' }).click());
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
