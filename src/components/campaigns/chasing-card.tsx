'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { Toast, useToast } from '@/components/ui/toast';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { campaignChasingMessages } from '@/i18n/messages/campaign-chasing';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  chaseToast, readChasing, rowSubline, type ChasedCampaign,
} from '@/lib/campaigns';

/**
 * A campaign's dialog, downloaded when a row is first opened (P18.99-T16, the bundle): it and the campaigns list it
 * borrows from were about 10 kB of every Summary's first load, for a dialog drawn only after a tap.
 */
const CampaignDialog = dynamic(() => import('./campaign-dialog').then((m) => m.CampaignDialog), { ssr: false });

/**
 * **The chases a person is making, inside the Summary's card** (P18.5-T7 AC-6, P18.5-T9 AC-1). The card
 * itself — its heading in the page's voice, the bolt, the tag — is the Summary's; this is what it holds.
 *
 * **One read for both pages** (`GET /campaigns/chasing`, `?for=` on a coachee's): the same chases, so the
 * coach's chips and the member's own rows cannot disagree (exit test 3). It waits and fails on its own,
 * the rest of the Summary drawn already.
 *
 * - **The reader's own** (`:6221-6253`): a row per campaign — its emoji, its title and the months it runs, *Runs
 *   Jan – Des* (P18.95-T7 AC-1, the client's grey text; the prototype's *"{kindLabel} · {duration}"*) — and *View →*
 *   opening the campaign's dialog **in place**, as the prototype does; a chase
 *   made there reads the card again. None: the prototype's sentence (`:6229`).
 * - **A coachee's** (`:4121-4130`): 🚀 chips sorted by title, no link (the prototype's are not); none: the Unit
 *   Dashboard detail's words (`:7283`), a Fill — the prototype's coachee card has no empty state.
 *
 * D-lists: an ended campaign is never on either list.
 */
export function ChasingCampaigns({ forMembershipId }: { forMembershipId?: string }) {
  const [list, setList] = useState<ChasedCampaign[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const { toast, show } = useToast();
  const t = useMessages(campaignChasingMessages);
  const language = useLanguage();

  const load = useCallback(() => {
    let live = true;
    readChasing(forMembershipId)
      .then((next) => { if (live) { setList(next.campaigns); setError(null); } })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [forMembershipId]);

  useEffect(() => load(), [load, attempt]);

  if (error) {
    return (
      <div>
        <ErrorBanner {...error} />
        <Button variant="secondary" className="mt-3 print:hidden" onClick={() => setAttempt((n) => n + 1)}>{t.tryAgain}</Button>
      </div>
    );
  }
  if (!list) {
    return (
      <Skeleton label={t.loading}>
        {[0, 1].map((i) => <SkeletonBar key={i} className="mb-3 h-8 w-full" />)}
      </Skeleton>
    );
  }

  if (forMembershipId) {
    return list.length === 0 ? (
      <p className="text-[0.78125rem] text-muted">{t.notChasingAny}</p>
    ) : (
      <ChaseChips campaigns={list} />
    );
  }

  return (
    <>
      {list.length === 0 ? (
        <p className="text-[0.78125rem] text-muted">{t.noneChased}</p>
      ) : (
        <ul>
          {list.map((c) => (
            <li key={c.code} className="border-b border-hairline last:border-b-0">
              {/* `.chased-campaign-row` (`:990-1001`): the row opens the dialog, its cue *View →*. */}
              <button
                type="button"
                data-campaign-card={c.code}
                onClick={() => setOpen(c.code)}
                className="flex w-full items-center gap-3 py-3 text-left hover:bg-navy/[0.02]"
              >
                {/* UI V1, UI-057: the one line-icon set's trophy, never the poster's emoji (P18.99-T7). */}
                <LineIcon name="trophy" className="h-[18px] w-[18px] text-amber-ink" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.84375rem] font-semibold text-navy">{c.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{rowSubline(c)}</span>
                </span>
                {/* Amber-ink, where the prototype's amber-dark cue is 2.99:1 on white (row 44). */}
                <span data-open-campaign className="shrink-0 whitespace-nowrap text-sm font-semibold text-amber-ink print:hidden">
                  {t.view}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <CampaignDialog
          code={open}
          onClose={() => setOpen(null)}
          onChased={(card) => {
            show(chaseToast(card, language));
            load();
          }}
        />
      )}
      <Toast toast={toast} />
    </>
  );
}

/**
 * Chips, by title (`.campaign-chip`, `:1761-1762`; `campaignsTileHtml`, `:7278-7285`) — the same glyph on every chip,
 * as drawn (`:7282`). The coachee's card and the Unit Dashboard's detail both draw them. *Changed 2026-10-30 (UI V1,
 * UI-057, UI-102: no emoji as icons):* the glyph is the one line-icon set's trophy, as the reader's own rows, where the
 * prototype drew 🚀.
 */
export function ChaseChips({ campaigns }: { campaigns: readonly { code: string; title: string }[] }) {
  // By title (P18.5-T9 AC-1): the read answers D-lists' order, which suits the Summary's rows, not the chips.
  const byTitle = [...campaigns].sort((a, b) => a.title.localeCompare(b.title) || a.code.localeCompare(b.code));
  return (
    <ul className="flex flex-wrap gap-1.5">
      {byTitle.map((c) => (
        <li key={c.code} className="inline-flex items-center gap-1 whitespace-nowrap rounded-pill border border-hairline bg-base px-2.5 py-1 text-xs font-semibold text-navy">
          <LineIcon name="trophy" className="h-3.5 w-3.5 text-amber-ink" />{c.title}
        </li>
      ))}
    </ul>
  );
}
