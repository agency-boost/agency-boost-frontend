'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { LineIcon, type LineIconName } from '@/components/ui/line-icon';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import type { MessagesOf } from '@/i18n/catalogue';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatNumber, formatPercent } from '@/lib/format';
import {
  barWidth, complianceTone, groupParam, readOverviewCompliance, type ComplianceCard, type ComplianceCategory,
  type ComplianceView, type KpmOverviewView, type OverviewGroupRef,
} from '@/lib/kpm-overview';
import { TONE_CLASS } from './people-tree';
import { SectionHeading } from './usage-section';

/** A card's list, loaded when a card is first opened (the bundle: the page's first paint draws none). */
const ComplianceDialog = dynamic(() => import('./compliance-dialog').then((m) => m.ComplianceDialog), { ssr: false });

/** The module's words, as a type. */
type Words = MessagesOf<(typeof kpmOverviewMessages)['en']>;

/** Each card's icon, in the orange square (Tabler's outline set as the app draws it). */
const ICON: Record<ComplianceCategory, LineIconName> = {
  training: 'graduation', goals: 'target', activity: 'checklist', leads: 'clipboard',
  activation: 'bolt', events: 'calendar', campaigns: 'trophy',
};

/** The bar under a card, in the pill's tone. */
const BAR: Record<'red' | 'amber' | 'green' | 'grey', string> = {
  red: 'bg-pill-red-ink', amber: 'bg-pill-amber-ink', green: 'bg-pill-green-ink', grey: 'bg-pill-grey-ink',
};

/** The people a card counts over: *anggota*, *agent baru* for Activation, *yang diundang* for Events. */
function unitOf(category: ComplianceCategory, t: Words): string {
  if (category === 'activation') return t.unitNewAgents;
  if (category === 'events') return t.unitInvited;
  return t.unitMembers;
}

/**
 * **4 · Compliance** (P19.19-T3 AC-2, AC-3; the brief's §6, moved from KPM Analytics): seven cards, **two to a row,
 * lowest % first** — a white card, a thin border, the orange icon square, the name with its % pill, *"x dari y
 * anggota"* (*agent baru* for Activation, *yang diundang* for Events) and a thin bar in the pill's colour: **red below
 * 34%, yellow below 67%, green from 67%**, the server's splits. **Tapping a card opens its list** — a centred card
 * *"<item> · x dari y selesai"* with *Belum selesai* (first) and *Sudah selesai*, and the Overview's tree with each
 * person's tile and WhatsApp. Training is per module (*Modul: … ⌄*, grouped as the Training page); Events and
 * Campaigns open on every item at once — the card's own figure — with a picker for one. No per-AB line.
 */
export function ComplianceSection({
  view, group: chosen, version,
}: { view: KpmOverviewView; group: OverviewGroupRef | null; version: number }) {
  const t = useMessages(kpmOverviewMessages);
  const [cards, setCards] = useState<ComplianceView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState<ComplianceCategory | null>(null);
  const group = groupParam(chosen);

  useEffect(() => {
    let live = true;
    setError(null);
    readOverviewCompliance({ group })
      .then((next) => { if (live) setCards(next); })
      .catch((err: unknown) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [group, version, attempt]);

  return (
    <section aria-labelledby="overview-compliance" data-section="compliance">
      <SectionHeading id="overview-compliance" aside={<span className="text-sm font-semibold text-muted">{t.lowestFirst}</span>}>
        {t.complianceTitle}
      </SectionHeading>
      {error ? (
        <div className="rounded-lg bg-card p-3.5">
          <ErrorBanner {...error} />
          <Button variant="secondary" className="mt-2" onClick={() => setAttempt((n) => n + 1)}>{t.tryAgain}</Button>
        </div>
      ) : !cards ? (
        <Skeleton label={t.loading}>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-card p-2">
            {Array.from({ length: 6 }, (_, i) => <SkeletonBar key={i} className="h-16 w-full" />)}
          </div>
        </Skeleton>
      ) : (
        <ul className="grid grid-cols-1 gap-2 rounded-lg bg-card p-2 min-[400px]:grid-cols-2">
          {cards.cards.map((card) => (
            <li key={card.category}>
              <ComplianceCardButton card={card} view={cards} onOpen={() => setOpen(card.category)} />
            </li>
          ))}
        </ul>
      )}
      {open && cards && (
        <ComplianceDialog category={open} view={view} group={chosen} catalog={cards} onClose={() => setOpen(null)} />
      )}
    </section>
  );
}

/** One card (exported for `long-words.browser.spec.ts`, which measures it at 1024px in a real browser). */
export function ComplianceCardButton({ card, view, onOpen }: {
  card: ComplianceCard; view: Pick<ComplianceView, 'thresholds'>; onOpen: () => void;
}) {
  const t = useMessages(kpmOverviewMessages);
  const figures = useFigureLanguage();
  const tone = complianceTone(card.pct, view.thresholds);
  const name = t.category[card.category];
  const pct = card.pct === null ? '–' : formatPercent(card.pct, {}, figures);
  const count = formatNumber(card.count, {}, figures);
  const of = formatNumber(card.of, {}, figures);
  const unit = unitOf(card.category, t);
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      data-card={card.category}
      data-tone={tone}
      aria-label={t.cardName({ name, pct, count, of, unit })}
      onClick={onOpen}
      className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-card p-2.5 text-left hover:bg-hover-row"
    >
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/[0.12] text-primary-ink">
        <LineIcon name={ICON[card.category]} className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        {/*
          * The name whole, as the mockup draws it (found 2026-11-20: *Campai…* at 1024, where the cards are narrowest): the
          * line wraps — the pill drops under a name that cannot share its line, and *Goal Setting* breaks at its space.
          */}
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="min-w-0 break-words text-md font-bold text-ink">{name}</span>
          <span className={cn('shrink-0 rounded-pill px-1.5 text-xs font-bold leading-5', TONE_CLASS[tone])}>{pct}</span>
        </span>
        <span className="block truncate text-sm text-muted"><b className="text-ink">{count}</b> {t.cardOf({ count: '', of, unit }).trim()}</span>
        <span aria-hidden="true" className="mt-1 block h-1 overflow-hidden rounded bg-divider">
          <span className={cn('block h-full rounded', BAR[tone])} style={{ width: `${barWidth(card.count, card.of)}%` }} />
        </span>
      </span>
      <LineIcon name="chevronRight" className="h-4 w-4 shrink-0 text-muted" />
    </button>
  );
}

