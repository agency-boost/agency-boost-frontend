'use client';

import { createContext, useContext } from 'react';
import type { Language } from '@/i18n/language';
import type { Gender, WorkStatus } from './personal';

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
    /*
     * What a person records (ADR-0158, P18.8-T4): `null` is *Not recorded*. The API always sends them;
     * optional here so a fixture that is about something else need not. `workStatus` is the reader's
     * membership's, or what they registered with until an office has them.
     */
    dateOfBirth?: string | null;
    gender?: Gender | null;
    companyJoinMonth?: string | null;
    workStatus?: WorkStatus | null;
    /*
     * **The account's language** (ADR-0179 §2, P18.98-T2): `locale` is the one in force — the account's choice, or
     * `id` for one that has made none — and `localeChosen` says which. At sign-in a chosen one wins over the browser's
     * cookie and rewrites it; an account with none keeps the browser's language and saves nothing (`LanguageProvider`,
     * `follow`). The API always sends both; optional so a fixture that is about something else need not.
     */
    locale?: Language;
    localeChosen?: boolean;
    /**
     * **Their photo** (`users.avatarUrl`; UI V1, UI-004, UI-111): the field shell's title-row avatar and the *Lainnya*
     * sheet's account row draw it, and the initials where it is absent or `null`. Optional: `GET /auth/me` sends it
     * once *Profil saya*'s photo upload is built (UI-111).
     */
    avatarUrl?: string | null;
    /**
     * **Their WhatsApp number** (`users.phone`; UI V1, UI-081, UI-101, D-22): `+62…` once saved through *Isi nomor
     * WhatsApp* or their profile, as typed when an invite carried it, `null` when there is none. Optional so a fixture
     * that is about something else need not.
     */
    phone?: string | null;
  };
  membership: {
    membershipId: string;
    kpmId: string;
    /** The rung of the company's ladder this person stands on (P4-T9). */
    orgLevelCode: string;
    /** The v1 enum. Still read where a screen sorts or groups; not what a badge is drawn from. */
    hierarchyRole: HierarchyRole;
    status: 'active' | 'pending' | 'removed';
    isKpmOwner: boolean;
    isKpmAdmin: boolean;
    /** Active direct reports. Leadership is this, not the role (OD-23). */
    directCount: number;
    /**
     * **A Core Leader now** (ADR-0159 §4): tagged *Core Leader* and on a leader rung, resolved on every request. The
     * field shell's *Core leader* menu and the profile line read it; the forum and KPM analytics refuse regardless.
     * The API always sends it; optional so a fixture that is about something else need not.
     */
    isCoreLeader?: boolean;
    /** The live groups they are tagged with, A to Z — the profile line's (ADR-0159 §5). */
    groups?: string[];
    /** Their office as the profile line names it: *0417 · Cempaka Putih* (ADR-0159 §5). */
    office?: { code: string; branch: string } | null;
  } | null;
  isImpersonating: boolean;
  /** A support session that may look and not touch (§3.13). True in a setup session too. */
  impersonationReadOnly: boolean;
  /**
   * Why the session was started (ADR-0162): `support` to look, `setup` to configure the office as its Owner
   * or Admin would; `null` outside one. The API always sends both; optional so a fixture about something else
   * need not.
   */
  impersonationPurpose?: 'support' | 'setup' | null;
  /** What a setup session may write besides reading — already reflected in `permissions`. */
  impersonationWriteScope?: string[];
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
  /**
   * The reader's own 90-day activation, for the *New agent* section (P13-T7 AC-5): `null` when they
   * have none, `open` false once it is graduated or expired (OD-28, OD-120), `complete` at 100% — the
   * nav's amber check. Served with the session, so no page reads it again.
   */
  activation: MeActivation | null;
  /** Whether the reader reaches at least one open activation: *New hires* in the nav (OD-122). */
  newHires: boolean;
}

export interface MeActivation {
  open: boolean;
  complete: boolean;
}

export interface SessionValue {
  me: Me | null;
  loading: boolean;
  /**
   * **The reader ended the session themselves** (the product owner's report, 2026-10-11): set by
   * `signOut`, cleared when somebody signs in or a reload finds a session. A page that loses its session
   * sends the reader to plain `/login` while this is set, and to `/login?next=<the page>` otherwise — an
   * expired session or a link opened signed out is on its way back to that page (P18.1-T3 AC-2); somebody
   * who pressed *Sign out* is not, and the next person to sign in on the device was being sent there.
   */
  signedOut: boolean;
  /**
   * **The session this tab had ended under the reader** (ADR-0168 §1): a request was answered `401` and the
   * server refused the refresh. Set only when somebody was signed in, cleared when somebody signs in or signs out.
   * A page that loses its session then sends the reader to `/login?next=<the page>&reason=expired`, and the
   * sign-in page reads *Your session ended. Sign in again.* A reader who arrives signed out, with no session to
   * end, is not marked.
   */
  expired: boolean;
  /**
   * Signs in and reads the session, resolving to who is now signed in — `null` when the session could
   * not be read — so the login page can ask whether *that* person can open the page it came from.
   */
  signIn: (email: string, password: string) => Promise<Me | null>;
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
