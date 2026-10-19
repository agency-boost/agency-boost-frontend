import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { useState } from 'react';
import { Toast, TOAST_MS, ToastHost, useHostToast, useToast } from './toast';

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

/**
 * The shell's toast (P13-T7 AC-3): raised by a page that is leaving, shown by the shell that stays.
 */
describe('ToastHost (P13-T7 AC-3)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function Leaving() {
    const raise = useHostToast();
    const [gone, setGone] = useState(false);
    if (gone) return <p>Somewhere else</p>;
    return (
      <button type="button" onClick={() => { raise?.('Marked as tenured agent — 90-Day Activation removed from menu.'); setGone(true); }}>
        leave
      </button>
    );
  }

  it('draws no live region until the first toast, so a screen keeps its own one status region', () => {
    render(<ToastHost><p>page</p></ToastHost>);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a toast raised by a page that has gone, and puts it away after its time', () => {
    render(<ToastHost><Leaving /></ToastHost>);
    act(() => screen.getByRole('button', { name: 'leave' }).click());
    expect(screen.getByText('Somewhere else')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Marked as tenured agent — 90-Day Activation removed from menu.');
    act(() => { vi.advanceTimersByTime(TOAST_MS); });
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('is null outside a host, so a page can fall back to its own', () => {
    let seen: unknown = 'unset';
    function Reader() {
      seen = useHostToast();
      return null;
    }
    render(<Reader />);
    expect(seen).toBeNull();
  });
});
