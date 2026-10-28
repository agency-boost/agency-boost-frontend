'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { TermText, TermTip } from '@/components/ui/term-tip';
import { Toast, useToast } from '@/components/ui/toast';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { CONTENT_TERM_KEYS, firstMentions, type TermKey } from '@/lib/terms';
import {
  campaignHref, chasedToast, chaseCampaign, OWN_COPY, PROTOTYPE_COPY, ratioUnitsOf, readCampaigns, requirementsLine,
  SEASONAL_FILTERS, seasonalSections, showsChase, structuralSections, unchaseCampaign, unchasedToast,
  type CampaignCard, type CampaignList as CampaignListView, type CampaignSection, type RatioUnits, type SeasonalFilter,
} from '@/lib/campaigns';
import { useTenantConfig } from '@/lib/tenant-config-cache';
import { ChaseButton, Poster, PromotionLabel } from './campaign-parts';

/** What the dialog beneath the list needs from it: how to close, and how to tell it a chase changed. */
export interface CampaignDialogHost {
  close: () => void;
  /** A chase made in the dialog: the list takes the answer, and the toast is said once. */
  chased: (card: CampaignCard) => void;
}

const DialogHost = createContext<CampaignDialogHost | null>(null);

/** The routed dialog's host: the list's, or — outside the list, as in a spec — the list's own address. */
export function useCampaignDialogHost(): CampaignDialogHost {
  const host = useContext(DialogHost);
  const router = useRouter();
  return host ?? { close: () => router.push('/campaigns'), chased: () => undefined };
}

/** Chase, or stop: the server's answer is the campaign as the list has it. */
export const toggleChase = (card: Pick<CampaignCard, 'code' | 'chasing'>) =>
  (card.chasing ? unchaseCampaign(card.code) : chaseCampaign(card.code));

/** The toast a chase answer says (`:8144`), from what the server answered, not from what was asked. */
export const chaseToast = (card: Pick<CampaignCard, 'title' | 'chasing'>) =>
  (card.chasing ? chasedToast(card.title) : unchasedToast(card.title));

type CampaignType = 'seasonal' | 'structural';
const TYPES: readonly { id: CampaignType; label: string }[] = [
  { id: 'seasonal', label: PROTOTYPE_COPY.seasonal },
  { id: 'structural', label: PROTOTYPE_COPY.structural },
];

/**
 * **Campaigns** (`/campaigns`, and its dialog at `/campaigns/[campaignCode]`; `Overall.html:3664-3702`, CSS
 * `:1857-1975`, logic `:7920-8243`; P18.5-T7).
 *
 * **It lives in the route's layout**, so it stays mounted while a campaign's dialog opens and closes at its
 * own address (P14's D-urls): Back closes the dialog and the list is where it was, its tab, its filter and
 * its scroll with it. The tab and the filter are this page's own state, as the prototype keeps them.
 *
 * - ***Seasonal* · *Structural*** are a tab list, the chosen one navy over the amber rule (`.type-tabs`,
 *   `:1859-1868`; ADR-0137 §3 keeps an underline tab's amber rule).
 * - ***All* · *Running* · *Upcoming* · *Ended*** show or hide whole sections (`:8083-8089`), each saying
 *   which is on with `aria-pressed`, the chosen one navy (ADR-0137 §2).
 * - **The five sections and their five empty lines, verbatim** (`:8091-8111`), in the server's order (D-lists).
 * - **The card** (`campaignCardHtml`, `:8040-8074`) is an `<article>`: *View details* is its control, where
 *   the prototype made the whole card a clickable `div` (row 45, WCAG 2.1.1).
 *
 * The states the prototype lacks are Fills: a skeleton while the list loads, an error with a retry. A
 * read-only support session reads what its member reads and draws no chase (roles §3.13; the server's `can`).
 */
export function CampaignList({ children }: { children?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [list, setList] = useState<CampaignListView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [type, setType] = useState<CampaignType>('seasonal');
  const [filter, setFilter] = useState<SeasonalFilter>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [chaseError, setChaseError] = useState<{ code: string; error: ApiError } | null>(null);
  const { toast, show } = useToast();
  /** Whether this list pushed the dialog's address — so closing it can go back rather than forward. */
  const openedHere = useRef(false);
  /**
   * **A ratio requirement in the office's unit for it** (P18.97-T7; ADR-0174 §2): *Recruitment success rate 30%*, as the
   * settings write it since P18.97-T4 AC-8, where the card read *0,30*. From the office's published configuration.
   */
  const { config } = useTenantConfig();
  const ratioUnits = useMemo(() => ratioUnitsOf(config?.ratios), [config]);

  const load = useCallback(() => {
    let live = true;
    readCampaigns()
      .then((next) => { if (live) { setList(next); setError(null); } })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, []);

  useEffect(() => load(), [load, attempt]);

  /** One campaign's new answer, in its place: the order is the server's and a chase does not move it. */
  const replace = useCallback((card: CampaignCard) => {
    setList((current) => current && {
      ...current,
      campaigns: current.campaigns.map((c) => (c.code === card.code ? card : c)),
    });
  }, []);

  const chase = async (card: CampaignCard) => {
    setBusy(card.code);
    setChaseError(null);
    try {
      const next = await toggleChase(card);
      replace(next);
      show(chaseToast(next));
    } catch (err) {
      setChaseError({ code: card.code, error: toDisplayError(err) });
      // Ended or closed to the rung since it was read: read the list again, so the card says so.
      if (err instanceof ApiRequestError && (err.status === 409 || err.status === 403)) load();
    } finally {
      setBusy(null);
    }
  };

  const open = (code: string) => {
    openedHere.current = true;
    router.push(campaignHref(code), { scroll: false });
  };

  const close = useCallback(() => {
    if (openedHere.current) {
      openedHere.current = false;
      router.back();
    } else {
      router.replace('/campaigns', { scroll: false });
    }
  }, [router]);

  const host = useMemo<CampaignDialogHost>(() => ({
    close,
    chased: (card) => {
      replace(card);
      show(chaseToast(card));
    },
  }), [close, replace, show]);

  const dialogOpen = pathname !== '/campaigns';
  const sections = list
    ? (type === 'seasonal' ? seasonalSections(list.campaigns, filter) : structuralSections(list.campaigns))
    : [];
  const terms = cardTerms(sections, ratioUnits);

  return (
    <DialogHost.Provider value={host}>
      {/* Behind the open dialog the list takes no focus and no click: the dialog is modal. */}
      <div className="min-w-0" inert={dialogOpen || undefined}>
        <TypeTabs active={type} onSelect={setType}>
          {error && (
            <div>
              <ErrorBanner {...error} />
              <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{OWN_COPY.tryAgain}</Button>
            </div>
          )}
          {!list && !error && <CampaignsSkeleton />}
          {list && type === 'seasonal' && <StatusFilter active={filter} onSelect={setFilter} />}
          {list && sections.map((section) => (
            <Section key={section.id} section={section}>
              {section.items.map((card) => (
                <Card
                  key={card.code}
                  card={card}
                  canChase={showsChase(card, list.can)}
                  busy={busy === card.code}
                  error={chaseError?.code === card.code ? chaseError.error : null}
                  onChase={() => void chase(card)}
                  onOpen={() => open(card.code)}
                  terms={terms.get(card.code)}
                  ratioUnits={ratioUnits}
                />
              ))}
            </Section>
          ))}
        </TypeTabs>
      </div>
      {children}
      <Toast toast={toast} />
    </DialogHost.Provider>
  );
}

/**
 * *Seasonal* · *Structural* (`#type-tabs`, `:3667-3670`): a tab list whose chosen tab is announced, one stop
 * for the keyboard, ← and → between the two. Its one panel holds the view.
 */
function TypeTabs({
  active, onSelect, children,
}: { active: CampaignType; onSelect: (type: CampaignType) => void; children: ReactNode }) {
  const group = useId();
  const refs = useRef<Partial<Record<CampaignType, HTMLButtonElement | null>>>({});
  const go = (to: number) => {
    const next = TYPES[(to + TYPES.length) % TYPES.length].id;
    onSelect(next);
    refs.current[next]?.focus();
  };
  return (
    <>
      <div className="mb-[18px] border-b-[1.5px] border-hairline">
        <div role="tablist" aria-label={OWN_COPY.types} className="-mb-[1.5px] flex gap-[26px]">
          {TYPES.map((tab, i) => {
            const on = tab.id === active;
            return (
              <button
                key={tab.id}
                ref={(el) => { refs.current[tab.id] = el; }}
                type="button"
                role="tab"
                id={`${group}-${tab.id}`}
                aria-selected={on}
                aria-controls={`${group}-panel`}
                tabIndex={on ? 0 : -1}
                onClick={() => onSelect(tab.id)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') go(i + 1);
                  else if (e.key === 'ArrowLeft') go(i - 1);
                  else if (e.key === 'Home') go(0);
                  else if (e.key === 'End') go(TYPES.length - 1);
                  else return;
                  e.preventDefault();
                }}
                className={cn(
                  'border-b-[2.5px] px-1 py-2.5 font-display text-[0.9375rem] font-bold',
                  on ? 'border-amber text-navy' : 'border-transparent text-muted hover:text-navy',
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      <div role="tabpanel" id={`${group}-panel`} aria-labelledby={`${group}-${active}`} className="min-w-0">
        {children}
      </div>
    </>
  );
}

/** *All · Running · Upcoming · Ended* (`#seasonal-segmented`, `:3674-3679`; `.segmented`, `:1871-1876`). */
function StatusFilter({ active, onSelect }: { active: SeasonalFilter; onSelect: (f: SeasonalFilter) => void }) {
  return (
    <div role="group" aria-label={OWN_COPY.statusFilter} className="mb-[22px] inline-flex max-w-full flex-wrap rounded-[9px] border border-hairline bg-card p-[3px]">
      {SEASONAL_FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          aria-pressed={f.id === active}
          onClick={() => onSelect(f.id)}
          className={cn(
            'rounded-[6px] px-4 py-[7px] text-base font-semibold',
            f.id === active ? 'bg-navy text-white' : 'text-muted hover:text-navy',
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

/** A section: its label in small grey capitals (`.section-label`, `:1878`), its grid, or its empty line. */
function Section({ section, children }: { section: CampaignSection; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="mb-8" data-section={section.id}>
      <h2 id={id} className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{section.heading}</h2>
      {section.items.length === 0 ? (
        <p className="px-[18px] py-10 text-center text-md text-muted">{section.empty}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,290px),1fr))] gap-4">{children}</div>
      )}
    </section>
  );
}

/**
 * **One card** (`campaignCardHtml`, `:8040-8074`): the poster and its tags, *Promotion path*, the title and its
 * window, the blurb, 🏆 the prize, *Needs:* and each requirement in its words joined by *" + "* (P18.95-T10 AC-3,
 * where the prototype wrote *Requirements:* and *" | "*), and the foot — the chase and *View details*. An ended
 * card is grey (`.is-ended`, `:1884-1886`) and **draws no chase** (P18.95-T10 AC-2; UI-024), where D-lists drew
 * it disabled with its reason: the poster's *Ended* says why. Every authored word is text, never markup.
 */
function Card({
  card, canChase, busy, error, onChase, onOpen, terms = [], ratioUnits,
}: {
  card: CampaignCard;
  canChase: boolean;
  busy: boolean;
  error: ApiError | null;
  onChase: () => void;
  onOpen: () => void;
  /** The terms this card is the first to name: its title's, blurb's, prize's and *Needs:* line's (`cardTerms`). */
  terms?: TermKey[][];
  /** How the office writes each ratio, so a requirement on one reads in that unit (P18.97-T7). */
  ratioUnits?: RatioUnits;
}) {
  const titleId = useId();
  const [titleTerms = [], blurbTerms = [], rewardTerms = [], needsTerms = []] = terms;
  const title = <h3 id={titleId} className="text-[0.90625rem] font-bold leading-snug text-navy">{card.title}</h3>;
  const ended = card.kind === 'seasonal' && card.phase === 'ended';
  return (
    <article
      aria-labelledby={titleId}
      data-campaign-card={card.code}
      className={cn(
        'min-w-0 overflow-hidden rounded-lg border border-hairline bg-card transition-shadow hover:shadow-modal',
        ended && 'grayscale-[45%] hover:grayscale-[20%]',
      )}
    >
      <Poster campaign={card} size="card" />
      <div className={cn('px-4 pb-4 pt-3.5', ended && 'bg-navy/[0.02]')}>
        {card.subtype === 'promotion' && <PromotionLabel />}
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          {titleTerms.length === 0 ? title : (
            // Beside the heading, not in it, so the card is still named by its title alone.
            <span className="flex items-center gap-1">
              {title}
              {titleTerms.map((term) => <TermTip key={term} term={term} />)}
            </span>
          )}
          <span className="whitespace-nowrap text-sm font-medium text-muted">{card.duration}</span>
        </div>
        {card.blurb && <p className="mb-3 text-[0.78125rem] leading-snug text-muted"><TermText text={card.blurb} terms={blurbTerms} /></p>}
        {card.reward && (
          // Navy words on the prize's amber wash, where the prototype's amber-dark is 2.6:1 (row 44).
          <p className="mb-2.5 flex items-center gap-1.5 rounded-[7px] bg-amber/10 px-2.5 py-1.5 text-[0.78125rem] font-semibold text-navy">
            <span aria-hidden="true" className="shrink-0">🏆</span>
            <span className="min-w-0"><TermText text={card.reward} terms={rewardTerms} /></span>
          </p>
        )}
        {card.requirements.length > 0 && (
          <p className="mb-[9px] text-[0.78125rem] leading-normal text-navy">
            <span className="font-bold text-muted">{OWN_COPY.needs}</span>{' '}
            <TermText text={requirementsLine(card.requirements, ratioUnits)} terms={needsTerms} />
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {canChase ? (
            <ChaseButton chasing={card.chasing} blocked={card.chaseBlocked} busy={busy} onToggle={onChase} />
          ) : <span />}
          <Button
            variant="secondary"
            onClick={onOpen}
            data-open-campaign
            className="h-auto rounded-[7px] border-[1.5px] border-navy px-3.5 py-2 text-base"
          >
            {PROTOTYPE_COPY.viewDetails}
          </Button>
        </div>
        {error && <div className="mt-2.5"><ErrorBanner {...error} /></div>}
      </div>
    </article>
  );
}

/**
 * **Which card first names each term, and where on it** (P18.95-T9 AC-3; UI-028: *APE*, *MDRT* unexplained): the
 * cards in the order they are drawn, each card's title, blurb, prize and *Needs:* line in reading order. A term the
 * list names on twelve cards gets one ⓘ, on the first.
 */
function cardTerms(sections: readonly CampaignSection[], ratioUnits?: RatioUnits): Map<string, TermKey[][]> {
  const cards = sections.flatMap((section) => section.items);
  const texts = cards.flatMap((card) => [
    card.title, card.blurb, card.reward, card.requirements.length > 0 ? requirementsLine(card.requirements, ratioUnits) : null,
  ]);
  const found = firstMentions(texts, CONTENT_TERM_KEYS);
  return new Map(cards.map((card, i) => [card.code, found.slice(i * 4, i * 4 + 4)]));
}

/** Two sections of cards, shaped like the list that is coming. */
export function CampaignsSkeleton() {
  return (
    <Skeleton label={OWN_COPY.loading}>
      <SkeletonBar className="mb-[22px] h-9 w-72 max-w-full" />
      {[0, 1].map((s) => (
        <div key={s} className="mb-8">
          <SkeletonBar className="mb-3 h-3 w-20" />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,290px),1fr))] gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="overflow-hidden rounded-lg border border-hairline bg-card">
                <SkeletonBar className="h-[100px] w-full rounded-none" />
                <div className="px-4 py-3.5">
                  <SkeletonBar className="h-4 w-2/3" />
                  <SkeletonBar className="mt-2 w-full" />
                  <SkeletonBar className="mt-2 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Skeleton>
  );
}
