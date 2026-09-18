'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * A settings screen's tab, held in the address bar.
 *
 * **So a tab can be linked to.** Three of the settings screens kept their tab in `useState`
 * alone, which means `/kpm/settings/products#approvals` lands on Products and the link somebody
 * pasted into a message goes nowhere useful. Training already did this by hand; this is that,
 * once, for the screens that did not.
 *
 * **Replaced, not pushed**: the tab is a view of one screen, so Back should leave the screen
 * rather than walk back through the tabs somebody clicked on the way.
 *
 * @param tabs   the screen's tabs, each `href` a hash — `'#approvals'`
 * @param onPick run when the tab changes, for a screen that closes its open panels
 */
export function useHashTab(
  tabs: { href: string }[],
  onPick?: () => void,
): [string, (href: string) => void] {
  const [tab, setTab] = useState(tabs[0].href);

  // On mount only: a hash the reader arrived with. Unknown hashes leave the first tab showing,
  // because a stale link is not a reason to render an empty screen.
  useEffect(() => {
    const fromUrl = window.location.hash;
    if (tabs.some((t) => t.href === fromUrl)) setTab(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = useCallback((href: string) => {
    if (!tabs.some((t) => t.href === href)) return;
    setTab(href);
    onPick?.();
    window.history.replaceState(window.history.state, '', href);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPick]);

  return [tab, select];
}
