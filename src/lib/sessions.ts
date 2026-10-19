import { api } from './api-client';

/**
 * Where this account is signed in (P4-T13).
 *
 * A **session**, not a token: a refresh rotates on every use, so a fortnight-old session
 * has a few hundred rows behind it and a person wants to know about their phone and their
 * laptop.
 */
export interface Session {
  sessionId: string;
  userAgent: string | null;
  ip: string | null;
  lastUsedAt: string | null;
  startedAt: string | null;
  expiresAt: string;
  /** The one this browser is reading from. Revoking it signs the reader out here. */
  current: boolean;
}

export const listSessions = () => api<Session[]>('/auth/sessions');

/** Ends one session everywhere — the whole token family, not its newest token. */
export const revokeSession = (sessionId: string) =>
  api<void>(`/auth/sessions/${sessionId}`, { method: 'DELETE' });

/** Signs out everywhere, this browser included. What you do when a device is lost. */
export const logoutEverywhere = () => api<void>('/auth/logout-all', { method: 'POST' });

/** Always accepted, whether or not the address exists. Anything else names accounts. */
export const resendVerification = (email: string) =>
  api<{ status: string }>('/auth/resend-verification', { method: 'POST', body: { email } });
