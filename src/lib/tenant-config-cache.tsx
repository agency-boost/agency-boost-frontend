'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api-client';
import { SessionContext } from './session';
import type {
  ActivityCategoryRow, LeadPipelineRow, RatioRow, TrainingCategoryRow,
} from './tenant-config';

/** One rung of the company's ladder, as the office reads it (P4-T9, ADR-0012). */
export interface OrgLevel {
  orgLevelId: string;
  companyId: string;
  code: string;
  label: string;
  displayOrder: number;
  status: 'active' | 'archived';
}

/** An event type as the snapshot carries it: no live count, and active rows only (P5-T9). */
export interface SnapshotEventType {
  id: string;
  code: string;
  label: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  displayOrder: number;
  version: number;
}

export interface TenantConfig {
  activity: ActivityCategoryRow[];
  ratios: RatioRow[];
  leadPipelines: LeadPipelineRow[];
  /** What agents are offered: published modules only (P5-T1). No agent screen reads it before Phase 12. */
  training: TrainingCategoryRow[];
  /**
   * The 90-day checklist a new hire is given (P5-T3), published version only. `null` before an
   * office has published one.
   */
  activationChecklist: {
    id: string;
    version: number;
    aspects: { code: string; label: string; items: { code: string; label: string }[] }[];
  } | null;
  /** What an event may be filed under (P5-T6), active rows only. */
  eventTypes: SnapshotEventType[];
  /**
   * The capability catalog a leader assesses against (P5-T8): **the whole catalog, archived rows
   * included, each with its `status`** — the server filters nothing here, unlike `eventTypes` above.
   * The type names only the codes and labels; the Leader Notes tab reads the catalog with its profile
   * instead (`GET /coaching/coachees/:membershipId/profile`, P11-T9 AC-3), where the status is typed.
   */
  capability: {
    version: number;
    stages: { code: string; label: string }[];
    milestones: { code: string; label: string }[];
    grids: { code: string; label: string }[];
  } | null;
  /**
   * What is deliberately **not** here (ADR-0039): products and carrier rules, which are the
   * company's and read live, and events and campaigns, which are live records whose audience
   * differs per member. If two members of one office would receive different bytes, it is not
   * in this document.
   */
  version: number;
}

interface Cached {
  config: TenantConfig | null;
  /** The company's ladder, junior first. Empty outside an office. */
  ladder: OrgLevel[];
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
  const [ladder, setLadder] = useState<OrgLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    try {
      /*
       * Both in one place, for one reason (P4-T9): the ladder is what every role badge on
       * every screen is drawn from, so fetching it per screen would be the thing this
       * provider exists to prevent. It changes about once a year.
       */
      const [next, rungs] = await Promise.all([
        api<TenantConfig>('/kpm/config'),
        api<OrgLevel[]>('/kpm/org-levels'),
      ]);
      setConfig(next);
      setLadder(rungs);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  /*
   * **Not before the session is** (P11-T6). The provider sits in the group layouts, outside the
   * session gate, and a child's effect runs before its parent's: on a hard load this read went out
   * before `SessionProvider` had refreshed, carried no token, and drew a 401 for each of its two
   * requests — every hard load, on every screen. It now waits until the session has settled with
   * somebody in it. A session that settles with nobody signed in has nothing to read here, so the
   * provider stops waiting rather than leave a screen on its skeleton.
   *
   * Outside a `SessionProvider` there is no session to wait for, and it reads at once, as it always
   * has: that is how the settings screens' specs mount it.
   */
  const session = useContext(SessionContext);
  const settled = session === null || !session.loading;
  const signedIn = session === null || session.me !== null;
  const ready = settled && signedIn;

  useEffect(() => {
    if (ready) void refresh();
    else if (settled) setLoading(false);
  }, [ready, settled, refresh]);

  const value = useMemo(
    () => ({ config, ladder, loading, error, refresh }),
    [config, ladder, loading, error, refresh],
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
    ladder: [],
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
