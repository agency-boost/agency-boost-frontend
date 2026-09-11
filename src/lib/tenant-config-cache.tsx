'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api-client';
import type { ActivityCategoryRow, LeadPipelineRow, RatioRow } from './tenant-config';

export interface TenantConfig {
  activity: ActivityCategoryRow[];
  ratios: RatioRow[];
  leadPipelines: LeadPipelineRow[];
  version: number;
}

interface Cached {
  config: TenantConfig | null;
  /** True until the first read settles, so a screen can show a skeleton rather than empty. */
  loading: boolean;
  error: unknown;
  /** Re-read after a settings screen changed something. */
  refresh: () => Promise<void>;
}

const TenantConfigContext = createContext<Cached | null>(null);

/**
 * The office's configuration, read once per session and shared (P4-T7).
 *
 * **One read, not one per screen.** Log Activity needs the taxonomy, the ratio strip needs
 * the definitions, the Leads screen needs the pipelines — and an agent moves between them
 * constantly. Each fetching its own copy is three requests to render one screen, and the
 * budget `frontend/CLAUDE.md` sets is a mid-range Android over 4G.
 *
 * **The server's `ETag` does the rest.** A `refresh()` re-requests, the browser attaches
 * `If-None-Match` on its own, and an unchanged configuration comes back `304` with no body.
 * Nothing here re-implements caching; it holds one copy and asks again when asked to.
 *
 * Deliberately **not** `localStorage`: a taxonomy is small, it is per office, and a stale
 * copy surviving a sign-out into somebody else's session is a worse failure than a fetch.
 */
export function TenantConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    try {
      setConfig(await api<TenantConfig>('/kpm/config'));
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo(
    () => ({ config, loading, error, refresh }),
    [config, loading, error, refresh],
  );

  return (
    <TenantConfigContext.Provider value={value}>{children}</TenantConfigContext.Provider>
  );
}

/**
 * The office's configuration.
 *
 * Outside a provider it answers `loading: false` with `config: null` rather than throwing:
 * a screen that renders in both applications should degrade to "nothing configured yet",
 * not crash a shell.
 */
export function useTenantConfig(): Cached {
  return useContext(TenantConfigContext) ?? {
    config: null,
    loading: false,
    error: null,
    refresh: async () => {},
  };
}

/** One activity type by code, or `null`. What a screen rendering a stored code needs. */
export function useActivityType(code: string | null | undefined) {
  const { config } = useTenantConfig();
  if (!code || !config) return null;
  return config.activity.flatMap((c) => c.types).find((t) => t.code === code) ?? null;
}
