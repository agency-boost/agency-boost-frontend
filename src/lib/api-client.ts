'use client';

import { LANGUAGE_UNCHOSEN, type Language } from '@/i18n/language';
import { uiMessages } from '@/i18n/messages/ui';
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
 *
 * **The browser's own sentences are the catalogue's English** (`uiMessages.errors`, P18.98-T4): composed here, outside
 * React and with no language to hand, and written in the reader's language where `ErrorBanner` shows them
 * (`ErrorWords`), so no caller changes. A server's sentence arrives in the reader's language already (P18.98-T5).
 */
export function toDisplayError(err: unknown): ApiError {
  const BROWSER_SAID = uiMessages.en.errors;
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
      message: BROWSER_SAID.network,
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
    message: BROWSER_SAID.unexpected,
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

/**
 * **The language the screen is written in, told to the API on every request** (ADR-0179 §7; P18.98-T2 AC-6):
 * `Accept-Language: id` or `en`. Held here, beside the token, and set by `LanguageProvider` whenever the screen's
 * language changes — before the request that follows a choice, so the choice's own save carries it. From P18.98-T5 the
 * API writes its refusals, notices and validation messages in it; until then it reads nothing from it.
 *
 * Starts as the language the pages are prerendered in (`LANGUAGE_UNCHOSEN`): what a request made before the provider
 * has run — none is, today — would be written in.
 */
let requestLanguage: Language = LANGUAGE_UNCHOSEN;

export function setRequestLanguage(language: Language): void {
  requestLanguage = language;
}

export function getRequestLanguage(): Language {
  return requestLanguage;
}

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
      // The screen's language (AC-6). CORS-safelisted for these two values: the API's allowed headers need not name it.
      'Accept-Language': requestLanguage,
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
    const outcome: RefreshOutcome = replaced ? 'refreshed' : await refreshSession();
    if (outcome === 'refreshed') response = await raw(path, options);
    // The server refused the refresh — the cookie gone, or presented and dead: whatever session this tab had is
    // over, and the session decides what that means for the screen (ADR-0168 §1). A refresh that never arrived is
    // not an ended session.
    else if (outcome === 'ended' || outcome === 'none') sessionLostListener?.();
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as
    | { error?: ApiError }
    | T
    | null;

  if (!response.ok) {
    const error = (payload as { error?: ApiError } | null)?.error ?? {
      code: 'INTERNAL_ERROR',
      // The catalogue's English, written in the reader's language where it is shown (`ErrorWords`, P18.98-T4).
      message: uiMessages.en.errors.noAnswer,
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
let refreshing: Promise<RefreshOutcome> | null = null;

/**
 * How a refresh ended (ADR-0168 §1):
 *
 * - **`refreshed`** — a new access token;
 * - **`ended`** — `401 AUTH_SESSION_ENDED`: a refresh cookie was presented and no longer works (expired, revoked,
 *   already spent, unknown). This browser had a session, and it ended;
 * - **`none`** — any other `401`, `AUTH_TOKEN_INVALID` for no cookie at all: there was no session to refresh — never
 *   signed in here, or the cookie a sign-out cleared;
 * - **`unreachable`** — anything else: the request never arrived, or was answered with something that is not about
 *   the session (a rate limit, a refused origin, a server error).
 */
export type RefreshOutcome = 'refreshed' | 'ended' | 'none' | 'unreachable';

/** The code `/auth/refresh` answers a presented refresh token that no longer works with (ADR-0168 §1). */
export const SESSION_ENDED_CODE = 'AUTH_SESSION_ENDED';

/**
 * Refresh, and say how it went — for the session's first read, which tells a reader whose session ended from one
 * who never had one. One request however many ask, as `tryRefresh`.
 */
export function refreshSession(): Promise<RefreshOutcome> {
  refreshing ??= refreshOnce().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function tryRefresh(): Promise<boolean> {
  return (await refreshSession()) === 'refreshed';
}

async function refreshOnce(): Promise<RefreshOutcome> {
  try {
    const response = await raw('/auth/refresh', { method: 'POST', skipRefresh: true });
    if (response.status === 401) {
      const body = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
      return body?.error?.code === SESSION_ENDED_CODE ? 'ended' : 'none';
    }
    if (!response.ok) return 'unreachable';
    const { accessToken: token } = (await response.json()) as { accessToken: string };
    setAccessToken(token);
    return 'refreshed';
  } catch (err) {
    // "Not refreshed" is the right answer to a network failure or a rejected cookie.
    // It is the wrong answer to a misconfigured origin: the app would show a signed-out
    // shell and never say why, on every screen at once.
    if (err instanceof ApiConfigError) throw err;
    return 'unreachable';
  }
}

let sessionLostListener: (() => void) | null = null;

/**
 * **Be told when a request finds the session gone** (ADR-0168 §1): it was answered `401`, and the refresh it
 * tried was refused by the server (`ended` or `none`). One listener, the session's, which decides whether that ends a session this
 * tab had — the reader is sent to sign in with `reason=expired` — or whether there was none to end (a request
 * made signed out, a wrong password at sign-in). Not told while impersonating: a support session never refreshes,
 * because the cookie is the Super Admin's own. The returned function removes it.
 */
export function onSessionLost(listener: () => void): () => void {
  sessionLostListener = listener;
  return () => {
    if (sessionLostListener === listener) sessionLostListener = null;
  };
}
