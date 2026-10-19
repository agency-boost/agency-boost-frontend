import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

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
});
