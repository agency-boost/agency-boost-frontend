import { render, screen } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth } from '@test/harness';
import { MEDIA_RANGES, useMediaQuery, type MediaRange } from './use-media-query';
import { PHONE_QUERY, usePhone } from './use-phone';

/** What the hook says, drawn, so a spec can read it. */
function Probe({ ranges, beforePaint, log }: { ranges: MediaRange | MediaRange[]; beforePaint?: boolean; log?: boolean[] }) {
  const matches = useMediaQuery(ranges, { beforePaint });
  log?.push(matches);
  return <output aria-label={[ranges].flat().join(' or ')}>{String(matches)}</output>;
}
const said = (name: string) => screen.getByRole('status', { name }).textContent;

/**
 * Mounted outside `act`, as a browser mounts a screen: what a microtask queued from the mounting commit reads. That
 * microtask runs before the browser could paint, so it reads what the first painted frame shows.
 */
async function firstPaint(ui: React.ReactNode) {
  const seen: (string | null)[] = [];
  function BeforePaint({ children }: { children: React.ReactNode }) {
    useLayoutEffect(() => {
      queueMicrotask(() => seen.push(document.querySelector('output')?.textContent ?? null));
    }, []);
    return children;
  }
  const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const wasAct = env.IS_REACT_ACT_ENVIRONMENT;
  env.IS_REACT_ACT_ENVIRONMENT = false;
  const host = document.body.appendChild(document.createElement('div'));
  const root = createRoot(host);
  try {
    root.render(<BeforePaint>{ui}</BeforePaint>);
    await vi.waitFor(() => expect(seen).toHaveLength(1));
    return seen[0];
  } finally {
    root.unmount();
    host.remove();
    env.IS_REACT_ACT_ENVIRONMENT = wasAct;
  }
}

/**
 * **One hook names the three sizes** (P18.97-T6 AC-2, ADR-0178; the client's scope tags of 2026-10-27): a phone below
 * 768px, a tablet from 768 to 1023px, a desktop from 1024px. It generalises `usePhone`, which is now its phone, and
 * keeps `usePhone`'s rules: false on the server and the first render, false with no `matchMedia`, the answer in an
 * effect — or before the first paint, for the shell's sidebar, which asks for that.
 */
describe('useMediaQuery (P18.97-T6 AC-2)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P18.97-T6 AC-2 names the three ranges once, on Tailwind’s md and lg lines', () => {
    expect(MEDIA_RANGES).toEqual({
      phone: '(max-width: 767.98px)',
      tablet: '(min-width: 768px) and (max-width: 1023.98px)',
      desktop: '(min-width: 1024px)',
    });
    // The phone's string is the one every phone-only stub in the suite answers.
    expect(PHONE_QUERY).toBe('(max-width: 767.98px)');
    expect(PHONE_QUERY).toBe(MEDIA_RANGES.phone);
  });

  it.each([
    [767, { phone: 'true', tablet: 'false', desktop: 'false' }],
    [768, { phone: 'false', tablet: 'true', desktop: 'false' }],
    [1023, { phone: 'false', tablet: 'true', desktop: 'false' }],
    [1024, { phone: 'false', tablet: 'false', desktop: 'true' }],
  ])('P18.97-T6 AC-2 at %ipx answers each range for that width alone', (px, expected) => {
    atWidth(px);
    render(<><Probe ranges="phone" /><Probe ranges="tablet" /><Probe ranges="desktop" /></>);
    expect({ phone: said('phone'), tablet: said('tablet'), desktop: said('desktop') }).toEqual(expected);
  });

  it.each([[767, 'true'], [768, 'true'], [1023, 'true'], [1024, 'false']])(
    'P18.97-T6 AC-2 at %ipx, below 1024px — a phone or a tablet — reads %s',
    (px, expected) => {
      atWidth(px);
      render(<Probe ranges={['phone', 'tablet']} />);
      expect(said('phone or tablet')).toBe(expected);
    },
  );

  it('P18.97-T6 AC-2 usePhone is its phone: true at 767px, false at 768px', () => {
    function Phone() { return <output aria-label="usePhone">{String(usePhone())}</output>; }
    const width = atWidth(767);
    render(<Phone />);
    expect(said('usePhone')).toBe('true');
    width.resize(768);
    expect(said('usePhone')).toBe('false');
  });

  it('P18.97-T6 AC-2 is false on the server, and on the first client render', () => {
    atWidth(800);
    // No effect runs on the server, so the media query is never asked there.
    expect(renderToString(<Probe ranges="tablet" />)).toContain('false');
    expect(renderToString(<Probe ranges="tablet" beforePaint />)).toContain('false');

    for (const beforePaint of [false, true]) {
      const log: boolean[] = [];
      const { unmount } = render(<Probe ranges="tablet" beforePaint={beforePaint} log={log} />);
      expect(log[0]).toBe(false);
      expect(log.at(-1)).toBe(true);
      unmount();
    }
  });

  it('P18.97-T6 AC-2 is false for every range where there is no matchMedia — jsdom, and every spec of the desktop', () => {
    expect(typeof window.matchMedia).not.toBe('function');
    render(<><Probe ranges="phone" /><Probe ranges="tablet" /><Probe ranges="desktop" /><Probe ranges={['phone', 'tablet']} /></>);
    for (const name of ['phone', 'tablet', 'desktop', 'phone or tablet']) expect(said(name)).toBe('false');
  });

  it('P18.97-T6 AC-2 follows the width across each line, both ways', () => {
    const width = atWidth(1280);
    render(<><Probe ranges="tablet" /><Probe ranges={['phone', 'tablet']} /></>);
    expect([said('tablet'), said('phone or tablet')]).toEqual(['false', 'false']);
    width.resize(1023);
    expect([said('tablet'), said('phone or tablet')]).toEqual(['true', 'true']);
    width.resize(767);
    expect([said('tablet'), said('phone or tablet')]).toEqual(['false', 'true']);
    width.resize(1024);
    expect([said('tablet'), said('phone or tablet')]).toEqual(['false', 'false']);
  });

  it('P18.97-T6 AC-2 asks once per range, however often it renders, and stops listening when it goes', () => {
    const added = vi.fn();
    const removed = vi.fn();
    const matchMedia = vi.fn((query: string) => ({
      media: query, matches: false, addEventListener: added, removeEventListener: removed,
    }));
    vi.stubGlobal('matchMedia', matchMedia);
    const { rerender, unmount } = render(<Probe ranges={['phone', 'tablet']} />);
    // A fresh array each render, as a caller writes it: the same two ranges, so the same subscription.
    rerender(<Probe ranges={['phone', 'tablet']} />);
    rerender(<Probe ranges={['phone', 'tablet']} />);
    expect(matchMedia.mock.calls.map(([query]) => query)).toEqual([MEDIA_RANGES.phone, MEDIA_RANGES.tablet]);
    expect(added).toHaveBeenCalledTimes(2);
    unmount();
    expect(removed).toHaveBeenCalledTimes(2);
    expect(removed.mock.calls.map(([, fn]) => fn)).toEqual(added.mock.calls.map(([, fn]) => fn));
  });

  /*
   * **When it answers** (AC-1's *no flash of the wrong state*). `beforePaint` answers inside the commit that mounts
   * it, so the first frame a browser paints is the width's; the default answers in an effect — a later task, after a
   * paint — as `usePhone` always has, and a screen asks it before its read so that frame is a skeleton.
   */
  it('P18.97-T6 AC-2 with beforePaint, answers before the browser can paint the first frame', async () => {
    atWidth(800);
    expect(await firstPaint(<Probe ranges="tablet" beforePaint />)).toBe('true');
  });

  it('P18.97-T6 AC-2 by default answers in an effect, after the first paint — usePhone’s timing, unchanged', async () => {
    atWidth(800);
    expect(await firstPaint(<Probe ranges="tablet" />)).toBe('false');
    atWidth(375);
    function Phone() { return <output>{String(usePhone())}</output>; }
    expect(await firstPaint(<Phone />)).toBe('false');
  });
});
