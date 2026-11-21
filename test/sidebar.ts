import { fireEvent, screen } from '@testing-library/react';

/**
 * **Open every group of the sidebar** (P19.13-T2 AC-5): a click on each folded heading, as a reader would. Since P19.17-T3
 * (AC-5; ADR-0269 §5) every group starts open, so it opens only what a spec folded first. Returns the nav.
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
