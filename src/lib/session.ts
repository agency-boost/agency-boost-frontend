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
    isKpmOwner: boolean;
    isKpmAdmin: boolean;
  } | null;
  isImpersonating: boolean;
  impersonatedBy: string | null;
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
