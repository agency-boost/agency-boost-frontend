/**
 * **Where `/login` and `/register` put their title** (P18.7-T7 AC-3; the client's UI review of 2026-10-26, UI-030).
 *
 * Both centred their column in the window, so sign-in's short form put *AgencyBoost* a third of the way down a phone
 * and registration's long one put *Create your account* hard against the top: one kind of page, two places for its
 * title. **Below 768px both columns start at the same height**, 16% of the window down — where sign-in's title stood
 * on a 375 × 812 phone with the development accounts under its form — so the two titles are placed alike whatever
 * the form below them holds. At 768px and wider the column is centred, as it was (§12, OD-207).
 */
export const AUTH_PAGE = 'mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10 '
  + 'max-md:justify-start max-md:pt-[16svh]';

/**
 * **The `(auth)` pages' frame: below the clock** (the product owner's staging review, 2026-10-31: the top of every screen
 * looked blurred on an iPhone). `viewport-fit=cover` (UI-103) draws the page from the very top of the screen, under the
 * status bar, where iOS frosts whatever passes beneath it — sign-in's welcome began 24px down, inside that band. The frame
 * starts its page below the top inset, and makes the page's full-height column (`min-h-screen`) the screen less it, so
 * nothing scrolls for it. 0px wherever there is no inset: Safari with its own bars, Android, a desktop.
 */
export const AUTH_FRAME = 'pt-[env(safe-area-inset-top)] [&>main]:min-h-[calc(100vh-env(safe-area-inset-top))]';
