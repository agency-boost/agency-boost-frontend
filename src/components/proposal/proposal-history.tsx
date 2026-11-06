'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu';
import { Dialog } from '@/components/ui/dialog';
import { Button, ErrorBanner } from '@/components/ui/field';
import { FLOATING_BAR_BUTTON, FLOATING_BAR_ROOM, FloatingBar } from '@/components/ui/floating-bar';
import { LineIcon } from '@/components/ui/line-icon';
import { PlanIcon } from '@/components/plan/plan-icons';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { proposalMessages } from '@/i18n/messages/proposal';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatCalendarDay } from '@/lib/format';
import {
  deleteProposal, duplicateProposal, listProposals, newProposalHref, proposalHref, proposalPdf, type ProposalRow,
} from '@/lib/proposals';
import { saveFile } from '@/lib/save-file';
import { useCan, useSession } from '@/lib/session';
import { useDebounced } from '@/lib/use-debounced';
import { ProposalStatusPill } from './proposal-frame';

/** How many lines one read brings; *Tampilkan lagi* asks for the next. The server caps a page at 50. */
const PAGE_SIZE = 20;

/**
 * ***Proposal → Riwayat*** (`/proposal`; AC-1, AC-10; ADR-0221 §5, §8): the reader's own proposals, the last changed
 * first, each with its client, its date, its products with their plan and its status — *Draf* grey, *Selesai* green —
 * and a search box over the client's name and the products'.
 *
 * - **A line opens the proposal**: a draft on its products, a finished one on its PDF.
 * - **⋮ downloads a *Selesai* one again** (*Unduh lagi*, P19.7-T3; ADR-0222 §2): the file built now, with the KPM's
 *   branding as it shows today, saved under the proposal's file name — not offered in a view-only session, which the
 *   server refuses the file. **It duplicates it** (a new draft for the same lead, the products no longer offered left
 *   out) **or deletes it** — a soft delete, asked first, that takes it off the lead's pill and section too. A proposal
 *   whose lead was deleted stays here under the client's name, and cannot be duplicated.
 * - **With nothing saved**, one large button, *Buat proposal pertama*, and never an error (D-37).
 */
export function ProposalHistory() {
  const t = useMessages(proposalMessages);
  const language = useFigureLanguage();
  const router = useRouter();
  const { show } = useToast();
  const { me } = useSession();
  const readOnly = !!me?.impersonationReadOnly;
  const canCreate = useCan('proposal:create') && !readOnly;
  const canDelete = useCan('proposal:delete') && !readOnly;
  const canDownload = useCan('proposal:download') && !readOnly;
  const [term, setTerm] = useState('');
  const search = useDebounced(term.trim());
  const [rows, setRows] = useState<ProposalRow[] | null>(null);
  const [total, setTotal] = useState(0);
  /** The search and the page asked for, together: a new search starts from the first page in the same read. */
  const [query, setQuery] = useState({ search: '', page: 1 });
  const [error, setError] = useState<ApiError | null>(null);
  const [deleting, setDeleting] = useState<ProposalRow | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => { setQuery((q) => (q.search === search ? q : { search, page: 1 })); }, [search]);

  useEffect(() => {
    let live = true;
    setError(null);
    listProposals({ search: query.search || undefined, page: query.page, pageSize: PAGE_SIZE })
      .then((answer) => {
        if (!live) return;
        setRows((held) => (query.page === 1 ? answer.rows : [...(held ?? []), ...answer.rows]));
        setTotal(answer.total);
      })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [query, generation]);

  const again = () => { setQuery((q) => ({ ...q, page: 1 })); setGeneration((g) => g + 1); };

  const duplicate = async (row: ProposalRow) => {
    try {
      const copy = await duplicateProposal(row.id);
      show(copy.droppedProductIds.length > 0 ? t.history.dropped({ n: copy.droppedProductIds.length }) : t.history.duplicated);
      router.push(proposalHref(copy.id, 2));
    } catch (err) {
      setError(toDisplayError(err));
    }
  };

  /** *Unduh lagi*: the file built now — rebuilt from the data, today's branding — and saved under its name. */
  const download = async (row: ProposalRow) => {
    try {
      saveFile(await proposalPdf(row.id), row.fileName);
      show(t.history.downloaded);
    } catch (err) {
      setError(toDisplayError(err));
    }
  };

  const remove = async (row: ProposalRow) => {
    setDeleting(null);
    try {
      await deleteProposal(row.id, row.version);
      setRows((held) => held?.filter((r) => r.id !== row.id) ?? null);
      setTotal((n) => Math.max(0, n - 1));
      show(t.history.deleted);
    } catch (err) {
      setError(toDisplayError(err));
      again();
    }
  };

  const empty = rows !== null && rows.length === 0 && !query.search;
  return (
    <div data-proposal-history="" className={cn(!empty && canCreate && FLOATING_BAR_ROOM)}>
      {error && <div className="mb-3"><ErrorBanner {...error} /></div>}

      {rows === null && !error && (
        <Skeleton label={t.history.loading}>
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg bg-card p-4"><SkeletonBar className="w-1/3" /><SkeletonBar className="mt-2 w-2/3" /></div>
            ))}
          </div>
        </Skeleton>
      )}

      {empty && (
        <div data-proposal-empty="" className="flex flex-col items-center gap-4 rounded-lg bg-card px-5 py-10 text-center">
          <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/[0.06] text-navy">
            <PlanIcon name="file" className="h-7 w-7" />
          </span>
          {canCreate ? (
            <Link
              href={newProposalHref()}
              className="flex min-h-14 w-full max-w-sm items-center justify-center rounded-pill bg-primary px-6 text-lg font-bold text-primary-contrast hover:bg-primary-hover"
            >
              {t.history.firstProposal}
            </Link>
          ) : (
            <p className="text-md text-muted">{t.history.firstProposal}</p>
          )}
        </div>
      )}

      {rows !== null && !empty && (
        <>
          <h2 className="sr-only">{t.history.heading}</h2>
          <div className="relative mb-3">
            <LineIcon name="search" className="pointer-events-none absolute left-4 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-signal-grey" />
            <input
              type="search"
              aria-label={t.history.searchName}
              placeholder={t.history.searchPlaceholder}
              maxLength={120}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="h-12 w-full rounded-pill border-0 bg-card pl-11 pr-4 text-md text-ink md:max-w-md"
            />
          </div>
          {rows.length === 0 && (
            <p className="px-1 py-6 text-center text-md text-muted">{t.history.noMatch({ term: query.search })}</p>
          )}
          {rows.length > 0 && (
            <ul aria-label={t.history.heading} className="flex flex-col gap-2">
              {rows.map((row) => {
                const items: ActionMenuItem[] = [
                  { label: t.history.open, onSelect: () => router.push(proposalHref(row.id, row.status === 'done' ? 3 : 2)) },
                  ...(canDownload && row.status === 'done' ? [{ label: t.history.download, onSelect: () => { void download(row); } }] : []),
                  ...(canCreate && !row.leadDeleted ? [{ label: t.history.duplicate, onSelect: () => { void duplicate(row); } }] : []),
                  ...(canDelete ? [{ label: t.history.delete, tone: 'alert' as const, glyph: '🗑', onSelect: () => setDeleting(row) }] : []),
                ];
                return (
                  <li key={row.id} data-proposal-row={row.id} className="relative flex items-center gap-2 rounded-lg bg-card py-2 pl-4 pr-2">
                    <Link
                      href={proposalHref(row.id, row.status === 'done' ? 3 : 2)}
                      className="min-w-0 flex-1 py-1 after:absolute after:inset-0 after:content-['']"
                    >
                      <span className="flex items-center gap-2">
                        <span className="truncate text-md font-bold text-ink">{row.client.name}</span>
                        <ProposalStatusPill status={row.status} />
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-muted">
                        {row.products.length > 0
                          ? row.products.map((p) => (p.plan ? `${p.name} · ${p.plan}` : p.name)).join(', ')
                          : t.history.productsNone}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted">{formatCalendarDay(row.date, language)}</span>
                    </Link>
                    <div className="relative z-[1]">
                      <ActionMenu label={t.history.actions({ client: row.client.name })} items={items} triggerClassName="h-12 w-12" />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {rows.length < total && (
            <div className="mt-3 flex justify-center">
              <Button variant="secondary" className="min-h-12 rounded-pill px-5" onClick={() => setQuery((q) => ({ ...q, page: q.page + 1 }))}>
                {t.history.loadMore}
              </Button>
            </div>
          )}
          {canCreate && (
            <FloatingBar wide="pill" pillClassName="justify-end">
              <Link href={newProposalHref()} className={cn(FLOATING_BAR_BUTTON, 'flex min-h-12 flex-1 items-center justify-center gap-1.5')}>
                <LineIcon name="plus" className="h-4 w-4" />
                {t.history.newProposal}
              </Link>
            </FloatingBar>
          )}
        </>
      )}

      <Dialog
        open={deleting !== null}
        tone="danger"
        message={deleting ? t.history.deleteAsk({ client: deleting.client.name }) : ''}
        confirmLabel={t.history.deleteConfirm}
        cancelLabel={t.history.cancel}
        onConfirm={() => { if (deleting) void remove(deleting); }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
