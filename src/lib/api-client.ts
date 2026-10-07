'use client';

import { ApiConfigError, apiUrl } from './api';

/**
 * The API client.
 *
 * The access token is held in memory only — never localStorage, where any XSS could
 * read it. The refresh token is an httpOnly cookie the browser sends automatically and
 * JavaScript cannot touch, so a reload silently re-authenticates through /auth/refresh
 * without the token ever being reachable from script.
 */

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId: string;
}

/**
 * The one way a screen turns a thrown value into something to show.
 *
 * Three outcomes, kept apart because they send the reader to three different places:
 * the server said no, the app is misconfigured, the request never arrived, or the screen
 * itself broke. Collapsing any two of them sends the reader somewhere useless: collapsing
 * configuration into network — as every screen did while this was an inline ternary — points
 * whoever hits a missing environment variable at a backend that is running perfectly, and
 * collapsing **a bug in the screen** into network tells them to check their connection.
 *
 * That last one was not hypothetical. The activation checklist dereferenced a version an office
 * did not have, threw a `TypeError`, and this function reported it as *"Could not reach the
 * server"* — which is what the office's Owner saw, and what they went looking for.
 */
export function toDisplayError(err: unknown): ApiError {
  if (err instanceof ApiRequestError) return err.error;
  if (err instanceof ApiConfigError) {
    return { code: 'CONFIG', message: err.message, requestId: 'unknown' };
  }

  /*
   * A request that never arrived is a `TypeError` from `fetch` itself, and the browsers word it
   * differently: *Failed to fetch* (Chrome), *NetworkError when attempting to fetch* (Firefox),
   * *Load failed* (Safari), *fetch failed* (undici, which is what the tests run on).
   */
  const failedToFetch = err instanceof TypeError
    && /fetch|network|load failed/i.test(err.message);

  // Written for the person most likely to see it — an agent on a phone with poor signal, not a
  // developer. A developer hitting a misconfiguration gets the CONFIG branch above.
  if (failedToFetch) {
    return {
      code: 'NETWORK',
      message: 'Could not reach the server. Check your connection and try again.',
      requestId: 'unknown',
    };
  }

  /*
   * Anything else is this application failing, not the network. The reader is told what to do —
   * reloading is the only useful move — and the original goes to the console, because the person
   * who can fix it needs the stack and the reader needs neither.
   */
  // eslint-disable-next-line no-console
  console.error('Unexpected error on this screen:', err);
  return {
    code: 'UNEXPECTED',
    message: 'Something went wrong on this screen. Reload the page — if it keeps happening, tell '
      + 'your administrator, and quote this screen’s address.',
    requestId: 'unknown',
  };
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly error: ApiError,
  ) {
    super(error.message);
    this.name = 'ApiRequestError';
  }
}

let accessToken: string | null = null;
let impersonating = false;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Impersonation issues a short-lived access token and **no** refresh token, so the
 * refresh cookie still belongs to the real Super Admin.
 *
 * That makes the transparent 401 retry actively wrong here: when the impersonation
 * token expires mid-session, refreshing would hand back the Super Admin's token and
 * silently re-send the request as themselves — attributing to the wrong person exactly
 * the actions impersonation exists to attribute correctly. So while impersonating, a
 * 401 surfaces instead of being papered over.
 */
export function setImpersonating(value: boolean): void {
  impersonating = value;
}

export function isImpersonating(): boolean {
  return impersonating;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /**
   * JSON, or a `FormData` sent as it is — for a file the server has to read as bytes (P9-T3). A
   * form sets no `Content-Type`: the browser writes `multipart/form-data` with its boundary, and a
   * header set here would have no boundary in it.
   */
  body?: unknown;
  /** Set on the refresh call itself, so a failed refresh cannot recurse. */
  skipRefresh?: boolean;
}

async function raw(path: string, options: RequestOptions = {}): Promise<Response> {
  const form = typeof FormData !== 'undefined' && options.body instanceof FormData;
  return fetch(apiUrl(path), {
    method: options.method ?? 'GET',
    headers: {
      ...(form ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    // Sends and receives the httpOnly refresh cookie.
    credentials: 'include',
    body: options.body === undefined ? undefined : form ? (options.body as FormData) : JSON.stringify(options.body),
  });
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const sentWith = accessToken;
  let response = await raw(path, options);

  // One transparent retry: the access token lives 15 minutes, so an open tab will hit
  // this routinely and the user should never see it.
  if (response.status === 401 && !options.skipRefresh && !impersonating) {
    // A refresh that finished while this request was out has already replaced the token it
    // carried: replay with that one, rather than spend the cookie it was issued with again.
    const replaced = accessToken !== null && accessToken !== sentWith;
    const refreshed = replaced || (await tryRefresh());
    if (refreshed) response = await raw(path, options);
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as
    | { error?: ApiError }
    | T
    | null;

  if (!response.ok) {
    const error = (payload as { error?: ApiError } | null)?.error ?? {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
      requestId: 'unknown',
    };
    // The office cannot be used at all (ADR-0112 §4): the app is replaced, whichever request met it.
    if (response.status === 403 && isOfficeUnavailable(error)) officeUnavailableListener?.(error);
    throw new ApiRequestError(response.status, error);
  }
  return payload as T;
}

/**
 * **The three refusals that mean the reader's office cannot be used at all** (ADR-0112 §4, P13.2-T3
 * AC-9): its subscription ended, it is suspended, or it is archived. `ContextResolver` answers every
 * request of a member of such an office with one of them — `/auth/me` first, or any request after it
 * when the office changes under an open tab.
 *
 * Nothing a screen can do helps, and every link would meet the same refusal, so the whole app is
 * replaced with a page saying which office and what happened (`OfficeUnavailable`). It used to be
 * swallowed: `/auth/me`'s 403 left no session, and the reader was sent to sign in again, and again.
 *
 * The listener is told of every such refusal; **the session decides who sees the page** (P13.2 exit
 * review): a member, or a Super Admin inside a support session — never a Super Admin in their console.
 */
export const OFFICE_UNAVAILABLE_CODES = [
  'TENANT_SUBSCRIPTION_ENDED', 'TENANT_SUSPENDED', 'TENANT_ARCHIVED',
] as const;
export type OfficeUnavailableCode = (typeof OFFICE_UNAVAILABLE_CODES)[number];

export function isOfficeUnavailable(error: { code: string } | null | undefined): boolean {
  return (OFFICE_UNAVAILABLE_CODES as readonly string[]).includes(error?.code ?? '');
}

let officeUnavailableListener: ((error: ApiError) => void) | null = null;

/**
 * Be told when any request meets one of those refusals. One listener, the session's; the returned
 * function removes it. Told before the request's own caller is, so the page replaces the app before a
 * screen draws an error banner of its own.
 */
export function onOfficeUnavailable(listener: (error: ApiError) => void): () => void {
  officeUnavailableListener = listener;
  return () => {
    if (officeUnavailableListener === listener) officeUnavailableListener = null;
  };
}

/**
 * The refresh in flight, shared by everybody who asks while it is (P11-T6).
 *
 * **One refresh, however many 401s.** A hard load used to send two reads before the session had a
 * token, and each 401 posted its own `/auth/refresh` beside the session's own — three posts of one
 * cookie. The server rotates the refresh token on every use and treats a used one presented again as
 * theft, revoking the whole family (`auth.service.ts`, *refresh token reuse*), so a race between them
 * could sign the reader out. Concurrent callers now wait on the same request, and each replays once
 * it has settled.
 */
let refreshing: Promise<boolean> | null = null;

export function tryRefresh(): Promise<boolean> {
  refreshing ??= refreshOnce().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function refreshOnce(): Promise<boolean> {
  try {
    const response = await raw('/auth/refresh', { method: 'POST', skipRefresh: true });
    if (!response.ok) return false;
    const { accessToken: token } = (await response.json()) as { accessToken: string };
    setAccessToken(token);
    return true;
  } catch (err) {
    // "Not refreshed" is the right answer to a network failure or a rejected cookie.
    // It is the wrong answer to a misconfigured origin: the app would show a signed-out
    // shell and never say why, on every screen at once.
    if (err instanceof ApiConfigError) throw err;
    return false;
  }
}
