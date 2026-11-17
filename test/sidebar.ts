import { fireEvent, screen } from '@testing-library/react';

/**
 * **Open every group of the sidebar** (P19.13-T2 AC-5; UI-196, ADR-0252 §4): since the floating sidebar only the current
 * page's group is open, so a spec that walks the whole nav opens the others first — a click on each closed heading, as
 * a reader would. Returns the nav.
 */
export function openEveryGroup(nav: HTMLElement = screen.getByRole('navigation', { name: 'Main' })): HTMLElement {
  for (const heading of Array.from(nav.querySelectorAll<HTMLElement>('[aria-controls^="nav-group"][aria-expanded="false"]'))) {
    fireEvent.click(heading);
  }
  return nav;
}

/** Every link of the sidebar's nav, every group opened first (`openEveryGroup`). */
export function everyNavLink(nav?: HTMLElement): HTMLAnchorElement[] {
  return Array.from(openEveryGroup(nav).querySelectorAll('a'));
}
