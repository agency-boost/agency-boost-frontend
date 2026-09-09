'use client';

import { createContext, useContext } from 'react';

export type HierarchyRole = 'ab' | 'aab' | 'agent';

export interface Me {
  user: {
    id: string;
    email: string;
    fullName: string;
    preferredName: string | null;
    pronoun: 'she' | 'he' | 'they';
    initials: string;
    platformRole: 'super_admin' | 'none';
  };
  membership: {
    membershipId: string;
    kpmId: string;
    hierarchyRole: HierarchyRole;
    status: 'active' | 'pending' | 'removed';
    isKpmOwner: boolean;
    isKpmAdmin: boolean;
    /** Active direct reports. Leadership is this, not the role (OD-23). */
    directCount: number;
  } | null;
  isImpersonating: boolean;
  impersonatedBy: string | null;
  /**
   * They are on a password somebody else generated (P3.6-T4).
   *
   * `RequireSession` sends them to `/choose-a-password`, because every other route on the
   * API answers `403` until it is replaced — a screen that rendered anyway would be a
   * shell around a page of failed requests.
   */
  mustChangePassword: boolean;
  /** What this person may do *right now* — resolved server-side on every request. */
  permissions: string[];
}

export interface SessionValue {
  me: Me | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
}

export const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>.');
  return value;
}

/**
 * Permission checks in the UI decide what to *show*. They are never the control — the
 * API refuses the call regardless, and a permission enforced only here is a blocking
 * defect (docs/00-product/roles-and-permissions.md).
 */
export function useCan(permission: string): boolean {
  const { me } = useSession();
  return me?.permissions.includes(permission) ?? false;
}
