'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { GroupTree, GroupTreeUplineLabel, TreeSearch } from '@/components/org-tree/group-tree';
import { Page } from '@/components/page';
import { rungShort, useLadder } from '@/components/ui/role-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, ErrorBanner } from '@/components/ui/field';
import { TEXT_TAP } from '@/components/ui/phone';
import { SkeletonTree } from '@/components/ui/skeleton';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { groupTreeMessages } from '@/i18n/messages/group-tree';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { firstName } from '@/lib/kpm-analytics';
import { readOrgTree, type OrgTree } from '@/lib/org';
import { useSession } from '@/lib/session';

/**
 * **A leader's Group Tree, read-only, as that leader sees it** (P19.3-T3 AC-3; UI-152 and its Appendix D row, the KPM
 * Overview flow report's case 12), `/group-tree/[membershipId]`: opened from KPM Analytics' leader sheet (*Group
 * Tree ›*), in the same tab.
 *
 * - **One read**: `GET /members/tree?for={membershipId}` (`org_tree:read`) — the leader as layer 1, everybody below
 *   them on today's edges, and their own leader as the card above. The Owner and an Admin may name any leader of the
 *   office; an AB or an AAB, a Core Leader from the analytics included, somebody in their own downline. Outside that,
 *   gone or another office's: **not found**; an Agent: refused.
 * - **Nothing here writes**: no *Undang agen*, no invite. *Cari agen* filters the tree on the screen, as on `/group-tree`.
 * - **A row opens what the reader may open**: somebody who leads, their Unit Dashboard (read-only for the Owner and an
 *   Admin); anybody else, the member page for the Owner and an Admin, their *Personal Summary* for a leader above them.
 * - **No row says *Anda***: the reader is not in this tree. The leader's own leader reads *Leader {first name}*.
 */
export default function LeaderGroupTreePage({ params }: { params: Promise<{ membershipId: string }> }) {
  const { membershipId } = use(params);
  return <LeaderGroupTree key={membershipId} membershipId={membershipId} />;
}

function LeaderGroupTree({ membershipId }: { membershipId: string }) {
  const t = useMessages(groupTreeMessages);
  const { me } = useSession();
  const [tree, setTree] = useState<OrgTree | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [missing, setMissing] = useState(false);
  const [query, setQuery] = useState('');
  const office = Boolean(me?.membership?.isKpmOwner || me?.membership?.isKpmAdmin);

  useEffect(() => {
    let live = true;
    readOrgTree(membershipId)
      .then((read) => { if (live) setTree(read); })
      .catch((err) => {
        if (!live) return;
        if (err instanceof ApiRequestError && err.status === 404) setMissing(true);
        else setError(toDisplayError(err));
      });
    return () => { live = false; };
  }, [membershipId]);

  // The reader is not in this tree: nobody's row is theirs (no *Anda*), the leader's is layer 1 as in their own read.
  const shown = useMemo(() => (tree ? { ...tree, nodes: tree.nodes.map((n) => ({ ...n, isSelf: false })) } : null), [tree]);
  const leader = tree?.nodes.find((n) => n.membershipId === tree.selfId) ?? null;
  const personHref = useMemo(() => (tree ? drillFor(tree, office) : undefined), [tree, office]);
  const populated = shown !== null && shown.nodes.length > 1;

  if (missing) return <NotFound />;

  return (
    <Page
      title={leader ? t.titleOf({ name: leader.fullName }) : t.title}
      subtitleOnPhone={false}
      subtitleOnTablet={false}
      control={populated ? <TreeSearch value={query} onChange={setQuery} className="w-[140px] md:max-lg:w-[300px]" /> : null}
      permission="org_tree:read"
    >
      {error && <ErrorBanner {...error} />}
      {tree === null && !error && (
        <Card>
          <SkeletonTree label={t.loading} />
        </Card>
      )}
      {shown && !populated && (
        <Card>
          <EmptyState title={t.emptyOf} />
        </Card>
      )}
      {shown && populated && (
        <GroupTreeUplineLabel.Provider value={leader ? t.leaderOf({ name: firstName(leader.fullName) }) : null}>
          <Summary tree={shown} search={<TreeSearch value={query} onChange={setQuery} className="w-[320px] shrink-0" />} />
          <GroupTree tree={shown} personHref={personHref} query={query} />
        </GroupTreeUplineLabel.Provider>
      )}
    </Page>
  );
}

/** *10 below them · 1 AAB · 3 Agent*: the tree's counts, the leader's own read's, under the title row. */
function Summary({ tree, search }: { tree: OrgTree; search: React.ReactNode }) {
  const t = useMessages(groupTreeMessages);
  const ladder = useLadder();
  const figures = useFigureLanguage();
  const parts = (['ab', 'aab', 'agent'] as const)
    .filter((role) => tree.counts[role] > 0)
    .map((role) => `${formatNumber(tree.counts[role], {}, figures)} ${rungShort(role.toUpperCase(), ladder)}`)
    .join(' · ');
  const summary = t.belowThem({ total: tree.counts.total, parts });
  return (
    <>
      <p className="mb-2.5 text-base font-medium text-muted md:max-lg:mb-3 md:max-lg:text-md lg:hidden">{summary}</p>
      <div className="mb-3 flex items-center gap-4 max-lg:hidden">
        {search}
        <span className="text-md font-medium text-muted">{summary}</span>
      </div>
    </>
  );
}

/**
 * Where a row of this tree goes (D-drill), or `undefined` for one that opens nothing: somebody who leads, their Unit
 * Dashboard; anybody else, the member page for the Owner and an Admin, and their *Personal Summary* for a leader above
 * them, who coaches everybody in this tree (ADR-0074). The leader's own leader is not a row of it.
 */
function drillFor(tree: OrgTree, office: boolean): (membershipId: string) => string | undefined {
  const byId = new Map(tree.nodes.map((node) => [node.membershipId, node]));
  return (membershipId) => {
    const node = byId.get(membershipId);
    if (!node) return undefined;
    const id = encodeURIComponent(membershipId);
    if (node.isLeader) return `/unit/dashboard/${id}`;
    return office ? `/people/members/${id}` : `/coaching/${id}/summary`;
  };
}

/** The leader is outside the reader's reach, gone, or another office's: said plainly, with the way back. */
function NotFound() {
  const t = useMessages(groupTreeMessages);
  return (
    <Page title={t.title} permission="org_tree:read">
      <Card>
        <h2 className="font-display text-lg font-bold text-navy">{t.notFoundTitle}</h2>
        <p className="mt-1 text-md text-muted">{t.notFoundLine}</p>
        <p className="mt-3">
          <Link href="/kpm/analytics" className={cn('text-md font-semibold text-navy underline-offset-2 hover:underline', TEXT_TAP)}>
            {t.back}
          </Link>
        </p>
      </Card>
    </Page>
  );
}
