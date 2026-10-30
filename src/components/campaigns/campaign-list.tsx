'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { TermText, TermTip } from '@/components/ui/term-tip';
import { Toast, useToast } from '@/components/ui/toast';
import type { Language } from '@/i18n/language';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { campaignsMessages } from '@/i18n/messages/campaigns';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { CONTENT_TERM_KEYS, firstMentions, type TermKey } from '@/lib/terms';
import {
  campaignHref, chaseCampaign, chaseToast, ratioUnitsOf, readCampaigns, requirementsLine,
  seasonalFilters, seasonalSections, showsChase, structuralSections, unchaseCampaign,
  type CampaignCard, type CampaignList as CampaignListView, type CampaignSection, type RatioUnits, type SeasonalFilter,
} from '@/lib/campaigns';
import { useTenantConfig } from '@/lib/tenant-config-cache';
import { usePhone } from '@/lib/use-phone';
import { ChaseButton, Poster, PromotionLabel } from './campaign-parts';
import { PhoneCampaignCard, PhoneEndedRow } from './campaign-phone';

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

/** The toast a chase answer says (`:8144`): `lib/campaigns.ts`' (P18.99-T16), re-exported for the list's importers. */
export { chaseToast } from '@/lib/campaigns';

type CampaignType = 'seasonal' | 'structural';
const TYPES: readonly CampaignType[] = ['seasonal', 'structural'];

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
  const t = useMessages(campaignsMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
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
  const phone = usePhone();

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
      show(chaseToast(next, language));
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
      show(chaseToast(card, language));
    },
  }), [close, replace, show, language]);

  const dialogOpen = pathname !== '/campaigns';
  // On a phone there is no status row (UI-108: *no extra chip row*): every group, each with its count, the empty hidden.
  const sections = list
    ? (type === 'seasonal' ? seasonalSections(list.campaigns, phone ? 'all' : filter, language) : structuralSections(list.campaigns, language))
    : [];
  const phoneSections = sections.filter((section) => section.items.length > 0);
  const terms = cardTerms(sections, ratioUnits, language, figures);

  return (
    <DialogHost.Provider value={host}>
      {/* Behind the open dialog the list takes no focus and no click: the dialog is modal. */}
      <div className="min-w-0" inert={dialogOpen || undefined}>
        <TypeTabs active={type} onSelect={setType}>
          {error && (
            <div>
              <ErrorBanner {...error} />
              <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{t.tryAgain}</Button>
            </div>
          )}
          {!list && !error && <CampaignsSkeleton />}
          {list && type === 'seasonal' && !phone && <StatusFilter active={filter} onSelect={setFilter} />}
          {list && phone && phoneSections.length === 0 && sections[0] && (
            <p className="px-[18px] py-10 text-center text-md text-muted">{sections[0].empty}</p>
          )}
          {list && phone && phoneSections.map((section) => (
            <PhoneSection key={section.id} section={section}>
              {section.items.map((card) => (card.kind === 'seasonal' && card.phase === 'ended'
                ? <PhoneEndedRow key={card.code} card={card} onOpen={() => open(card.code)} />
                : (
                  <PhoneCampaignCard
                    key={card.code}
                    card={card}
                    canChase={showsChase(card, list.can)}
                    busy={busy === card.code}
                    error={chaseError?.code === card.code ? chaseError.error : null}
                    onChase={() => void chase(card)}
                    onOpen={() => open(card.code)}
                    ratioUnits={ratioUnits}
                  />
                )))}
            </PhoneSection>
          ))}
          {list && !phone && sections.map((section) => (
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
  const t = useMessages(campaignsMessages);
  const group = useId();
  const refs = useRef<Partial<Record<CampaignType, HTMLButtonElement | null>>>({});
  const go = (to: number) => {
    const next = TYPES[(to + TYPES.length) % TYPES.length];
    onSelect(next);
    refs.current[next]?.focus();
  };
  return (
    <>
      {/* On a phone, one segmented control, *Musiman | Struktural* (UI-108): the same tabs on a white pill track. */}
      <div className="mb-[18px] border-b-[1.5px] border-hairline max-md:mb-0 max-md:mt-3 max-md:border-b-0">
        <div role="tablist" aria-label={t.types} className="-mb-[1.5px] flex gap-[26px] max-md:mb-0 max-md:gap-0 max-md:rounded-pill max-md:bg-card">
          {TYPES.map((tab, i) => {
            const on = tab === active;
            return (
              <button
                key={tab}
                ref={(el) => { refs.current[tab] = el; }}
                type="button"
                role="tab"
                id={`${group}-${tab}`}
                aria-selected={on}
                aria-controls={`${group}-panel`}
                tabIndex={on ? 0 : -1}
                onClick={() => onSelect(tab)}
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
                  'max-md:flex max-md:min-h-11 max-md:flex-1 max-md:rounded-pill max-md:border-b-0 max-md:p-[3px] max-md:text-base max-md:font-semibold',
                )}
              >
                <span
                  className={cn(
                    'max-md:flex max-md:w-full max-md:items-center max-md:justify-center max-md:rounded-pill',
                    on && 'max-md:bg-navy max-md:text-white',
                  )}
                >
                  {t[tab]}
                </span>
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
  const t = useMessages(campaignsMessages);
  const language = useLanguage();
  return (
    <div role="group" aria-label={t.statusFilter} className="mb-[22px] inline-flex max-w-full flex-wrap rounded-[9px] border border-hairline bg-card p-[3px]">
      {seasonalFilters(language).map((f) => (
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
/**
 * **A group on a phone** (UI V1, UI-108; `campaign-event-mobile` 1): its heading in sentence case with its count —
 * *Berjalan 3* — not the small uppercase label, and its cards one under another.
 */
function PhoneSection({ section, children }: { section: CampaignSection; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-section={section.id}>
      <h2 className="mx-0.5 mb-1.5 mt-3.5 flex items-baseline gap-1.5 text-lg font-bold text-navy">
        <span id={id}>{section.heading}</span>
        <span className="text-sm font-semibold text-muted">{section.items.length}</span>
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

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
  const t = useMessages(campaignsMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const titleId = useId();
  const [titleTerms = [], blurbTerms = [], rewardTerms = [], needsTerms = []] = terms;
  const title = <h3 id={titleId} className="text-[0.90625rem] font-bold leading-snug text-navy">{card.title}</h3>;
  const ended = card.kind === 'seasonal' && card.phase === 'ended';
  return (
    <article
      aria-labelledby={titleId}
      data-campaign-card={card.code}
      className={cn(
        'min-w-0 overflow-hidden rounded-lg border border-card-edge bg-card transition-shadow hover:shadow-modal',
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
            <span className="font-bold text-muted">{t.needs}</span>{' '}
            <TermText text={requirementsLine(card.requirements, ratioUnits, language, figures)} terms={needsTerms} />
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
            {t.viewDetails}
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
function cardTerms(
  sections: readonly CampaignSection[], ratioUnits: RatioUnits | undefined, language: Language, figures: Language,
): Map<string, TermKey[][]> {
  const cards = sections.flatMap((section) => section.items);
  const texts = cards.flatMap((card) => [
    card.title, card.blurb, card.reward,
    card.requirements.length > 0 ? requirementsLine(card.requirements, ratioUnits, language, figures) : null,
  ]);
  const found = firstMentions(texts, CONTENT_TERM_KEYS);
  return new Map(cards.map((card, i) => [card.code, found.slice(i * 4, i * 4 + 4)]));
}

/** Two sections of cards, shaped like the list that is coming. */
export function CampaignsSkeleton() {
  const t = useMessages(campaignsMessages);
  return (
    <Skeleton label={t.loading}>
      <SkeletonBar className="mb-[22px] h-9 w-72 max-w-full" />
      {[0, 1].map((s) => (
        <div key={s} className="mb-8">
          <SkeletonBar className="mb-3 h-3 w-20" />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,290px),1fr))] gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="overflow-hidden rounded-lg border border-card-edge bg-card">
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
