/**
 * API base URLs.
 *
 * The environment supplies the **origin**; this module supplies the **version**.
 *
 * That split matters when v2 arrives. `docs/02-specs/api/conventions.md` says a
 * breaking change means "v2 alongside v1", so during a migration some calls target v1
 * and some v2 — from the same build, against the same host. A version baked into
 * `NEXT_PUBLIC_API_BASE_URL` cannot express that without a second variable, and two
 * variables can drift to two different hosts.
 *
 * It is also the honest split: a deployment knows the host, and the code knows which
 * contract shape it was written against.
 */

export const API_VERSIONS = ['v1'] as const;
export type ApiVersion = (typeof API_VERSIONS)[number];

/** The version this client is written against. Migrating is a reviewed code change. */
export const DEFAULT_API_VERSION: ApiVersion = 'v1';

export function apiOrigin(): string {
  const origin = process.env.NEXT_PUBLIC_API_ORIGIN;
  if (!origin) {
    throw new Error(
      'NEXT_PUBLIC_API_ORIGIN is not set. It is the API origin only — no path and no ' +
        'version. See .env.example.',
    );
  }
  if (/\/api(\/v\d+)?\/?$/.test(origin)) {
    throw new Error(
      `NEXT_PUBLIC_API_ORIGIN must not include the API path or version, received "${origin}". ` +
        'Set the origin alone, e.g. http://localhost:3001 — the version lives in src/lib/api.ts.',
    );
  }
  return origin.replace(/\/+$/, '');
}

/**
 * Build an absolute API URL.
 *
 * ```ts
 * apiUrl('/leads')            // http://localhost:3001/api/v1/leads
 * apiUrl('/leads', 'v1')      // same, explicit
 * ```
 *
 * When v2 exists, a call site that has migrated passes `'v2'` and the rest keep
 * working — one build, both versions.
 */
export function apiUrl(path: string, version: ApiVersion = DEFAULT_API_VERSION): string {
  const normalised = path.startsWith('/') ? path : `/${path}`;
  return `${apiOrigin()}/api/${version}${normalised}`;
}

/**
 * Health is version-neutral on the server: a probe should not have to track the
 * contract version.
 */
export function healthUrl(): string {
  return `${apiOrigin()}/api/health`;
}
