import { configure, getConfig } from '@testing-library/react';
import { afterAll, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { LANGUAGE_COOKIE, LANGUAGE_PENDING } from '@/i18n/language';

/*
 * **`findBy…` and `waitFor` get CI's room too**, as `vitest.config.mts` gives each test: on GitHub's runner a
 * validation message took longer than Testing Library's 1s to appear on a screen that had rendered (2026-10-27).
 * Locally the default stands.
 */
configure({ asyncUtilTimeout: process.env.CI ? 5_000 : 1_000 });

/*
 * **What a test waited for, it reads settled** (2026-11-06). A `findBy…` or `waitFor` resolves the moment the DOM it
 * looks for is committed; the effects React runs after that commit — a screen asking its width, choosing the first
 * card, setting the office's colours — are a task later, on the scheduler's `setImmediate`. Testing Library drains one
 * `setTimeout(0)`, and on a loaded runner that came first: CI read the frame between, a different spec each run
 * (the coaching roster's columns, the leads split's first card, a link's colours). So after the condition holds, the
 * wrapper gives the scheduler a few turns before the test goes on, as a browser would before its next frame. The real
 * timers are taken here, before any spec fakes them, as React's scheduler took them when it loaded.
 */
const realImmediate = globalThis.setImmediate;
const realTimeout = globalThis.setTimeout;
const turn = async () => {
  await new Promise<void>((resolve) => { realImmediate(() => resolve()); });
  await new Promise<void>((resolve) => { realTimeout(() => resolve(), 0); });
};
const settleAfter = getConfig().asyncWrapper;
configure({
  asyncWrapper: (cb) => settleAfter(async () => {
    const result = await cb();
    for (let i = 0; i < 3; i += 1) await turn();
    return result;
  }),
});

// The API origin is required, not optional — `apiOrigin()` throws without it, which is
// deliberate: a build that silently calls a relative URL is worse than one that fails.
process.env.NEXT_PUBLIC_API_ORIGIN ??= 'http://api.test';

// The suite renders the seeded-accounts panel, and the list is gated at *import* time on
// this variable (src/lib/demo-accounts.ts). Unset, it compiles to `[]` and every test that
// expects the panel fails on an empty DOM rather than on the behaviour it is asserting.
// Specs still flip the value at runtime to test the operational gate; this only decides
// what the module had to offer in the first place.
process.env.NEXT_PUBLIC_APP_ENV ??= 'development';

/**
 * The address bar is shared by every test in a file; the tab hash is not.
 *
 * A settings screen writes its tab to the URL with `replaceState` so the tab can be linked to
 * (`src/lib/use-hash-tab.ts`). jsdom keeps one `window` per spec file, so without this the
 * first test to click *Event types* leaves `#types` behind and every test after it starts on
 * the wrong tab — a failure that reads as "the button is missing" and has nothing to do with
 * the test that fails.
 */
afterEach(() => {
  if (window.location.hash) {
    window.history.replaceState(window.history.state, '', window.location.pathname);
  }
  /*
   * **The language a test chose stays with it** (P18.10-T2): the switch writes the `ab_lang` cookie and `<html lang>`,
   * and jsdom keeps one `document` per spec file, so the next test would start in it — and a pre-paint read would take
   * it up. Cleared after each, as the hash is.
   */
  document.cookie = `${LANGUAGE_COOKIE}=; Max-Age=0; Path=/`;
  document.documentElement.lang = '';
  document.documentElement.removeAttribute(LANGUAGE_PENDING);
  /*
   * **The calendar's last view stays with the test that chose it** (P19.1-T3 AC-9, UI-119): the page remembers it in
   * `localStorage`, which jsdom keeps per spec file, so a test that pressed *Month* would open the next one on Month.
   */
  try {
    window.localStorage.removeItem('ab.calendar.view');
  } catch {
    // No storage, nothing kept.
  }
  /*
   * **The tab's view stays with the test that chose it** (P19.2-T1; ADR-0198 §5): opening an office page as an Owner
   * remembers the office view in `sessionStorage`, which jsdom keeps per spec file, so the next test would start in it.
   */
  try {
    window.sessionStorage.removeItem('ab.view');
  } catch {
    // No storage, nothing kept.
  }
});

/**
 * **Answers still in flight land before the environment goes.** A spec can end while a screen's stubbed read is
 * still resolving; once vitest tears jsdom down there is no `window`, and the late `setState` throws an unhandled
 * error that fails a run whose every test passed (CI, 2026-10-24 and 2026-10-27). A few turns of the event loop
 * after the file's last test let those settle while `window` exists. Screens guard their own reads too
 * (`TenantConfigProvider`, `/people/admins`); this is the net under the ones that do not yet.
 */
afterAll(async () => {
  for (let turn = 0; turn < 5; turn += 1) await new Promise((resolve) => { setTimeout(resolve, 0); });
});
