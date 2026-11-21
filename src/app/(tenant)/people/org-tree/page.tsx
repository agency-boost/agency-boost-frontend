'use client';

import { useCallback, useEffect, useState } from 'react';
import { TreeSearch } from '@/components/org-tree/group-tree';
import { KpmTree, useKpmTreeSummary } from '@/components/org-tree/kpm-tree';
import { Page } from '@/components/page';
import { MemberSheet } from '@/components/people/member-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/field';
import { SkeletonTree } from '@/components/ui/skeleton';
import { kept } from '@/i18n/kept';
import { useMessages } from '@/i18n/language-provider';
import { orgTreeMessages } from '@/i18n/messages/org-tree';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readOrgTree, type OrgTree } from '@/lib/org';

/**
 * **Org tree** (P19.20-T3; ADR-0273 §4, superseding ADR-0178 §5–§6; the People mockup's frames 22–25) — the whole KPM in
 * the Group Tree design (D-05), **at every size**: *Cari agen*, *Buka semua*, one summary line *"30 orang · 5 AB · 4 AAB ·
 * 21 Agent · akun tes tidak dihitung"*, then the indented rows (`KpmTree`). A tap on a row opens the member sheet; ⌄ only
 * opens or closes a team. A core leader sees the whole KPM — `GET /members/tree?view=kpm` — with the rows outside their
 * downline muted and not openable, their own row the navy one. The Owner and the Admins have no Group Tree in the menu;
 * this is their one tree (ADR-0269).
 *
 * The sideways *Lapisan* canvas (`org-tree.tsx`, ADR-0178 §6) is gone: nothing else drew it.
 */
export default function OrgTreePage() {
  const t = useMessages(orgTreeMessages);
  const [tree, setTree] = useState<OrgTree | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [query, setQuery] = useState('');
  const [openAll, setOpenAll] = useState(0);
  const [sheet, setSheet] = useState<string | null>(null);
  const summary = useKpmTreeSummary(tree);

  const load = useCallback(async () => {
    try {
      setTree(await readOrgTree(undefined, 'kpm'));
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const populated = tree !== null && tree.nodes.length > 0;

  return (
    <Page title={kept('Org tree')} permission="org_tree:read">
      {error && <ErrorBanner {...error} />}
      {tree === null && !error && <SkeletonTree label={t.loading} />}
      {tree && tree.nodes.length === 0 && (
        <div className="rounded-lg bg-card"><EmptyState title={t.empty} /></div>
      )}
      {populated && (
        <>
          <div data-org-tree-tools="" className="mb-2 flex flex-wrap items-center gap-2">
            <TreeSearch value={query} onChange={setQuery} className="min-w-0 flex-1 max-md:h-11 md:max-w-[22rem]" />
            <button
              type="button"
              onClick={() => setOpenAll((n) => n + 1)}
              className="ml-auto inline-flex min-h-11 items-center rounded-pill border border-hairline bg-card px-4 text-md font-semibold text-navy hover:bg-hover-row"
            >
              {t.openAll}
            </button>
          </div>
          <p className="mb-3 text-sm text-muted">{summary}</p>
          <KpmTree tree={tree} query={query} openAll={openAll} onOpen={setSheet} />
        </>
      )}
      {sheet && <MemberSheet membershipId={sheet} onClose={() => setSheet(null)} onChanged={() => void load()} />}
    </Page>
  );
}
