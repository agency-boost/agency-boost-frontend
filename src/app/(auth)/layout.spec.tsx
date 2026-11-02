import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AUTH_FRAME } from '@/components/auth-page';
import AuthLayout from './layout';
import Loading from './loading';

/**
 * **The `(auth)` pages start below the clock** (the product owner's staging review, 2026-10-31: the top of every screen
 * looked blurred on an iPhone). `viewport-fit=cover` (UI-103) draws a page under the status bar; the group's frame pads
 * the top inset and shortens each page's full-height column by the same, so nothing scrolls for it. jsdom computes no
 * `env()`, so what is pinned is what the frame asks for, and that each page's `<main>` is the child the rule reaches.
 */
describe('the (auth) frame: below the top inset (staging review, 2026-10-31)', () => {
  it('pads the top inset, and makes a page’s full-height column the screen less it', () => {
    render(<AuthLayout><main className="min-h-screen">Sign in</main></AuthLayout>);
    const frame = document.querySelector('[data-auth-frame]') as HTMLElement;
    expect(frame).toHaveClass('pt-[env(safe-area-inset-top)]', '[&>main]:min-h-[calc(100vh-env(safe-area-inset-top))]');
    expect(frame.className).toBe(AUTH_FRAME);
    // The page's `<main>` is the frame's own child, so the column rule reaches it.
    expect(screen.getByRole('main').parentElement).toBe(frame);
  });

  it('frames the group’s wait the same way: its `<main>` is the frame’s child too', () => {
    render(<AuthLayout><Loading /></AuthLayout>);
    const frame = document.querySelector('[data-auth-frame]') as HTMLElement;
    expect(frame.firstElementChild?.tagName).toBe('MAIN');
    expect(frame.firstElementChild).toHaveClass('min-h-screen');
  });

  it('adds no colour, no width and no bottom room of its own: 0px wherever there is no inset', () => {
    render(<AuthLayout><main>x</main></AuthLayout>);
    const classes = (document.querySelector('[data-auth-frame]') as HTMLElement).className.split(/\s+/);
    expect(classes.filter((c) => /^(bg-|w-|max-w-|pb-|py-|p-)/.test(c))).toEqual([]);
  });
});
