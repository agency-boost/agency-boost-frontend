/**
 * **Where `/login` and `/register` put their title** (P18.95-T7 AC-3; the client's UI review of 2026-10-26, UI-030).
 *
 * Both centred their column in the window, so sign-in's short form put *AgencyBoost* a third of the way down a phone
 * and registration's long one put *Create your account* hard against the top: one kind of page, two places for its
 * title. **Below 768px both columns start at the same height**, 16% of the window down — where sign-in's title stood
 * on a 375 × 812 phone with the development accounts under its form — so the two titles are placed alike whatever
 * the form below them holds. At 768px and wider the column is centred, as it was (§12, OD-207).
 */
export const AUTH_PAGE = 'mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10 '
  + 'max-md:justify-start max-md:pt-[16svh]';
