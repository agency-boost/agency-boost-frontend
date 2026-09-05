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
 * the server said no, the app is misconfigured, or the request never arrived. Collapsing
 * the last two — as every screen did while this was an inline ternary — points whoever
 * hits a missing environment variable at a backend that is running perfectly.
 */
export function toDisplayError(err: unknown): ApiError {
  if (err instanceof ApiRequestError) return err.error;
  if (err instanceof ApiConfigError) {
    return { code: 'CONFIG', message: err.message, requestId: 'unknown' };
  }
  // Written for the person most likely to see it — an agent on a phone with poor
  // signal, not a developer. A developer hitting a misconfiguration gets the CONFIG
  // branch above, which names the variable.
  return {
    code: 'NETWORK',
    message: 'Could not reach the server. Check your connection and try again.',
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
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Set on the refresh call itself, so a failed refresh cannot recurse. */
  skipRefresh?: boolean;
}

async function raw(path: string, options: RequestOptions = {}): Promise<Response> {
  return fetch(apiUrl(path), {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    // Sends and receives the httpOnly refresh cookie.
    credentials: 'include',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await raw(path, options);

  // One transparent retry: the access token lives 15 minutes, so an open tab will hit
  // this routinely and the user should never see it.
  if (response.status === 401 && !options.skipRefresh && !impersonating) {
    const refreshed = await tryRefresh();
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
    throw new ApiRequestError(response.status, error);
  }
  return payload as T;
}

export async function tryRefresh(): Promise<boolean> {
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
