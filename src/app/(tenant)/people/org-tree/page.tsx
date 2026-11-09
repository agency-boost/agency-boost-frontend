'use client';

import { useEffect, useMemo, useState } from 'react';
import { TreeSearch } from '@/components/org-tree/group-tree';
import { OrgTree } from '@/components/org-tree/org-tree';
import { Page } from '@/components/page';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, ErrorBanner } from '@/components/ui/field';
import { SkeletonTree } from '@/components/ui/skeleton';
import { kept } from '@/i18n/kept';
import { useMessages } from '@/i18n/language-provider';
import { orgTreeMessages } from '@/i18n/messages/org-tree';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { orgTreeHref } from '@/lib/kpm-analytics';
import { readOrgTree, type OrgTree as OrgTreeData } from '@/lib/org';
import { useMediaQuery } from '@/lib/use-media-query';

/**
 * Org tree (`KPM_Owner.html`) — the whole office.
 *
 * The same component and the same endpoint as the leader's Group tree; only the shell,
 * the copy and the drill-through differ. What comes back is wider because the requester
 * is a tenant admin, and that decision is the server's.
 *
 * **It is a forest.** The office root is one tree; anybody orphaned by a removal
 * (P3-T7) or not yet placed under a leader is another. Drawing only the office root's
 * descendants would hide exactly the people who most need finding.
 *
 * **Where a card goes** (D-drill, P18-T2 AC-7): somebody with a direct report to their Unit Dashboard, in
 * this tab — their unit and every unit nested under it, as the prototype's alert promises (`:2224-2241`);
 * anybody else to the person page, as built (parity I-34). Not coaching's *Personal Summary*, which answers
 * by who coaches whom and would refuse the Owner and the Admin outside their own downline.
 *
 * **On a phone the tree is the indented list that opens and closes** (`asList`; P18.9-T7 AC-4, ADR-0178 §5; the
 * client's KPM Owner review of 2026-10-27, UI-036: only Wilson Tanoto, layer 1, in view, the connectors running off to
 * the right), as `/group-tree` has drawn it since P18.7-T8 — opened on the reader's own line one level down, the same
 * links and the same people. At 768px and wider it is the canvas it always was (the client's *Don't change* for a
 * desktop). The width is read here, where the page mounts and before the tree has answered, so a phone never draws
 * the canvas first.
 *
 * *Changed 2026-11-05 (P19.2-T3 AC-4; UI-142: *Org tree names 17px*, *tablet = mobile rows*):* **a tablet draws the list
 * too**, below 1024px, where each line is a 44px target and its + or − one of 44 × 44px; the canvas's 17px names and
 * 24px controls are a pointer's. From 1024px the canvas, as ADR-0178 §6 keeps it on a laptop.
 *
 * *Changed 2026-11-05 (P19.3-T4; OWN UI-026, ADR-0205):* **a search pill and *Buka semua***, the Group Tree pattern
 * (D-05): Group Tree's own *Cari agen* pill — on the title row below 1024px, over the tree from 1024px — finds by name or
 * agent code in the tree the page already holds, opens the path down to each person found and highlights them (OWN case
 * 8, *"Lukman"*); nobody is hidden. *Buka semua* opens every unit, on the canvas and in the list.
 */
export default function OrgTreePage() {
  const t = useMessages(orgTreeMessages);
  const [tree, setTree] = useState<OrgTreeData | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const below = useMediaQuery(['phone', 'tablet']);
  const [query, setQuery] = useState('');
  // Each press opens every unit (OWN UI-026); the tree closes them again one at a time.
  const [openAll, setOpenAll] = useState(0);
  // Each card's drill, worked out once per read rather than looked up per card.
  const drills = useMemo(() => new Map(tree?.nodes.map((n) => [n.membershipId, orgTreeHref(n)]) ?? []), [tree]);

  const populated = tree !== null && tree.nodes.length > 0;

  useEffect(() => {
    void readOrgTree()
      .then(setTree)
      .catch((err) => setError(toDisplayError(err)));
  }, []);

  return (
    <Page
      title={kept('Org Tree')}
      subtitle={t.subtitle}
      // A 44px pill on a phone too (UI-142: no target under 44px on `/people/*`), where Group Tree's is 40px (UI-059).
      control={populated ? <TreeSearch value={query} onChange={setQuery} className="w-[140px] max-md:h-11 md:max-lg:w-[300px]" /> : null}
      permission="org_tree:read"
    >
      {error && <ErrorBanner {...error} />}

      <Card>
        {tree === null && !error && (
          <SkeletonTree label={t.loading} />
        )}

        {tree && tree.nodes.length === 0 && (
          <EmptyState title={t.empty} />
        )}

        {tree && tree.nodes.length > 0 && (
          <>
            <div data-org-tree-tools="" className="mb-3 flex flex-wrap items-center gap-3">
              {/* From 1024px the pill sits over the tree; below, on the title row (Group Tree's places, D-05). The width the
                  page already reads for the list decides, so only one pill is in the page at a time. */}
              {!below && <TreeSearch value={query} onChange={setQuery} className="w-[320px] shrink-0" />}
              <Button variant="secondary" className="max-lg:min-h-11" onClick={() => setOpenAll((n) => n + 1)}>
                {t.openAll}
              </Button>
            </div>
            {tree.rootIds.length > 1 && (
              <p className="mb-3 text-md text-navy">{t.roots({ n: tree.rootIds.length })}</p>
            )}
            <OrgTree tree={tree} personHref={(id) => drills.get(id)} asList={below} query={query} openAll={openAll} />
          </>
        )}
      </Card>
    </Page>
  );
}

