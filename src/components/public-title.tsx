'use client';

import type { ReactNode } from 'react';
import { LanguageSwitch } from '@/components/language-switch';
import { useLanguageChoice } from '@/i18n/language-provider';

/**
 * **A public page's title, with the *ID | EN* switch at its right** (P18.98-T2 AC-3): the six pages somebody meets
 * before they are anybody — sign-in, registration, the two password pages and email verification here, `/join`'s card
 * in `RoleShell` — where there is no shell and no bar, so the switch sits on the page's own column, on the title's
 * line. Its 44px targets are centred on that line (`-my-[5px]`), so the title stays where it stood (`AUTH_PAGE`) and
 * nothing under it moves.
 *
 * `children` is the page's own `<h1>`, untouched. **Until the switch is live** (`LANGUAGE_LIVE`) it is all this
 * renders, so the page is exactly as it was.
 */
export function PublicTitle({ children }: { children: ReactNode }) {
  const { live } = useLanguageChoice();
  if (!live) return <>{children}</>;
  return (
    <div className="flex items-start justify-between gap-3">
      {children}
      <LanguageSwitch tone="page" className="-my-[5px]" />
    </div>
  );
}

/**
 * **The switch on a public page with no title of its own** — `/join`'s invite card, signed out (`RoleShell`): at the
 * top right of the card's column, above it. Drawn while the switch is live — since 2026-10-29; nothing before it went
 * live.
 */
export function PublicLanguageRow() {
  const { live } = useLanguageChoice();
  if (!live) return null;
  return (
    <div className="mb-3 flex justify-end">
      <LanguageSwitch tone="page" />
    </div>
  );
}
