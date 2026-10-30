import { api } from '@/lib/api-client';
import type { HierarchyRole } from '@/components/ui/role-badge';

/** One person the search found: what the picker draws — the NAME and the agent code — and where it goes. */
export interface AgentHit {
  membershipId: string;
  fullName: string;
  preferredName: string | null;
  agentCode: string | null;
  role: HierarchyRole;
  orgLevelCode: string;
}

/** What `GET /members/search` answers. */
export interface AgentSearchResult {
  members: AgentHit[];
}

/** `?a=b`: kept out of the path's literal, as `lib/activity.ts`'s `query` is. */
const queryOf = (params: URLSearchParams) => `?${params.toString()}`;

/** How many the picker asks for: the server's default (`MEMBER_SEARCH_DEFAULT`); it allows 1 to 20. */
export const AGENT_SEARCH_LIMIT = 10;

/**
 * **Search agent** (UI V1, UI-012; D-14) — `GET /members/search`: the people the reader may see (the roster's reach,
 * `member:read_profile`), active, **never the reader**, whose name, preferred name or agent code holds `q`, A–Z. An
 * empty `q` lists the first of them. An Agent finds nobody; another office is never searched.
 *
 * The query is concatenated, never interpolated, so the API-consumer gate reads the route's literal (`lib/activity.ts`).
 */
export function searchAgents(q: string, limit = AGENT_SEARCH_LIMIT) {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  params.set('limit', String(limit));
  return api<AgentSearchResult>('/members/search' + queryOf(params));
}

/** Where picking somebody goes (D-14): their agent dashboard, on its Personal Summary tab. */
export const agentHref = (membershipId: string) => `/coaching/${encodeURIComponent(membershipId)}/summary`;

/**
 * **The same match, on a list already loaded** (UI-059: the Group Tree's *Cari agen* filters its own tree, and opens the
 * units that hold a match). Name, preferred name or agent code, a case-insensitive part of it — the server's rule for
 * `GET /members/search`, so the two pickers find the same people.
 */
export function matchesAgent(
  q: string,
  person: { fullName: string; preferredName?: string | null; agentCode?: string | null },
): boolean {
  const term = q.trim().toLocaleLowerCase('id');
  if (!term) return true;
  return [person.fullName, person.preferredName, person.agentCode]
    .some((value) => typeof value === 'string' && value.toLocaleLowerCase('id').includes(term));
}
