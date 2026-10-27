'use client';

import { useContext, type ReactNode } from 'react';
import { PageHeader } from '@/components/app-shell';
import { RequireSession, TitledPageContext } from '@/components/require-session';

/**
 * A page inside a group layout.
 *
 * Deliberately the **same shape as a shell** — `title`, `subtitle`, `actions`,
 * `permission`, `children` — so moving a page under a layout is a rename and nothing
 * else. Every prop a page already passed still means what it meant; what changes is that
 * the sidebar comes from the layout above rather than from the page itself.
 *
 * `permission` is the **route's** own gate, nested inside the group's. The layout answers
 * *"may you be in this application at all"*; this answers *"may you be on this screen"*,
 * and they are different questions — `/people/admins` needs `kpm_admin:grant`, which no
 * office-wide gate implies.
 */
export function Page({
  title,
  subtitle,
  subtitleOnPhone,
  actions,
  permission,
  children,
}: {
  title?: string;
  /** A sentence; a node where a term in it carries its ⓘ (P18.95-T9 AC-3). */
  subtitle?: ReactNode;
  /** `false`: the sub-line is not drawn below 768px (the client's *Remove*, P18.95-T7 AC-1; `PageHeader`). */
  subtitleOnPhone?: boolean;
  actions?: ReactNode;
  permission?: string;
  children: ReactNode;
}) {
  const titledAbove = useContext(TitledPageContext);
  const body = (
    <>
      {title !== undefined && <PageHeader title={title} subtitle={subtitle} subtitleOnPhone={subtitleOnPhone} actions={actions} />}
      {/* What is inside is under a title now: a nested page's refusal is a section of this one. */}
      <TitledPageContext.Provider value={titledAbove || title !== undefined}>{children}</TitledPageContext.Provider>
    </>
  );

  // No permission means the layout's gate is the only one, which is the common case: most
  // screens need nothing beyond being in the application they sit in.
  return permission ? <RequireSession permission={permission}>{body}</RequireSession> : body;
}
