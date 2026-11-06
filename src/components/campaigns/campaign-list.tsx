'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
  type CSSProperties, type ReactNode,
} from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { Toast, useToast } from '@/components/ui/toast';
import type { Language } from '@/i18n/language';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { campaignsMessages } from '@/i18n/messages/campaigns';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { CONTENT_TERM_KEYS, firstMentions, type TermKey } from '@/lib/terms';
import {
  campaignHref, chaseCampaign, chaseToast, ratioUnitsOf, readCampaigns, requirementsLine,
  seasonalSections, showsChase, structuralSections, unchaseCampaign,
  type CampaignCard, type CampaignList as CampaignListView, type CampaignSection, type RatioUnits,
} from '@/lib/campaigns';
import { useTenantConfig } from '@/lib/tenant-config-cache';
import { usePhone } from '@/lib/use-phone';
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

/** The toast a chase answer says (`:8144`): `lib/campaigns.ts`' (P18.11-T16), re-exported for the list's importers. */
export { chaseToast } from '@/lib/campaigns';

type CampaignType = 'seasonal' | 'structural';
const TYPES: readonly CampaignType[] = ['seasonal', 'structural'];

/**
 * **Campaigns** (`/campaigns`, and its dialog at `/campaigns/[campaignCode]`; `Overall.html:3664-3702`, CSS
 * `:1857-1975`, logic `:7920-8243`; P18.2-T7).
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
 *
 * **UI V1 on a phone** (UI-108, P18.11): *Musiman | Struktural* one segmented control, the groups with their counts and
 * no status row, an empty group hidden, the compact card (`campaign-phone.tsx`).
 *
 * *Changed 2026-11-05 (P19.1-T5 AC-4, AC-5; UI-123, `campaign-event-tablet-desktop` 1 and 2):* **a tablet and a laptop
 * draw the phone's list too** — *"Card content as UI-108"* — where they drew the prototype's: the segmented control,
 * no *All · Running · Upcoming · Ended* row, each group's heading in sentence case with its count (*Berjalan 1*), an
 * empty group hidden (D-08), the compact card and the ended row. **The cards in a grid** `repeat(auto-fill, minmax(300px,
 * 1fr))`, and **a group of one or two cards shares a row** with the next (*Berjalan* | *Akan datang*): each group is as
 * wide as its cards, so three cards stand in a row at 1280px. Kept from the wider card, the client's earlier request: a
 * term's ⓘ where the list first names it (P18.7-T9 AC-3). The phone's markup is what it was, to the byte
 * (`campaigns/campaigns-wide.spec.tsx`).
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
  const [busy, setBusy] = useState<string | null>(null);
  const [chaseError, setChaseError] = useState<{ code: string; error: ApiError } | null>(null);
  const { toast, show } = useToast();
  /** Whether this list pushed the dialog's address — so closing it can go back rather than forward. */
  const openedHere = useRef(false);
  /**
   * **A ratio requirement in the office's unit for it** (P18.9-T7; ADR-0174 §2): *Recruitment success rate 30%*, as the
   * settings write it since P18.9-T4 AC-8, where the card read *0,30*. From the office's published configuration.
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
  // There is no status row (UI-108: *no extra chip row*; UI-123 at every size): every group, each with its count, the
  // empty hidden (D-08).
  const sections = list
    ? (type === 'seasonal' ? seasonalSections(list.campaigns, 'all', language) : structuralSections(list.campaigns, language))
    : [];
  const phoneSections = sections.filter((section) => section.items.length > 0);
  const terms = cardTerms(phoneSections, ratioUnits, language, figures);

  return (
    <DialogHost.Provider value={host}>
      {/* Behind the open dialog the list takes no focus and no click: the dialog is modal. */}
      <div className="min-w-0" inert={dialogOpen || undefined}>
        <TypeTabs active={type} onSelect={setType} phone={phone}>
          {error && (
            <div>
              <ErrorBanner {...error} />
              <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{t.tryAgain}</Button>
            </div>
          )}
          {!list && !error && <CampaignsSkeleton />}
          {list && phoneSections.length === 0 && sections[0] && (
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
          {list && !phone && phoneSections.length > 0 && (
            // A tablet and a laptop (P19.1-T5 AC-4; UI-123): the groups side by side while they fit, each as wide as its cards.
            <div data-campaign-groups="" className="flex flex-wrap gap-x-2.5">
              {phoneSections.map((section) => (
                <PhoneSection key={section.id} section={section} style={shareOf(section.items.length)} wide>
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
                        terms={terms.get(card.code)}
                      />
                    )))}
                </PhoneSection>
              ))}
            </div>
          )}
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
  active, onSelect, phone, children,
}: { active: CampaignType; onSelect: (type: CampaignType) => void; phone: boolean; children: ReactNode }) {
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
      {/*
        * On a phone, one segmented control, *Musiman | Struktural* (UI-108): the same tabs on a white pill track. On a
        * tablet and a laptop (P19.1-T5 AC-4; UI-123, `shared-2026-11-02.css`'s `.seg`) the same control as wide as its
        * words, 44px on a tablet and 40px on a laptop — where the prototype's underlined tabs were.
        */}
      <div className={phone ? 'mb-[18px] border-b-[1.5px] border-hairline max-md:mb-0 max-md:mt-3 max-md:border-b-0' : 'mb-1'}>
        <div
          role="tablist"
          aria-label={t.types}
          className={phone
            ? '-mb-[1.5px] flex gap-[26px] max-md:mb-0 max-md:gap-0 max-md:rounded-pill max-md:bg-card'
            : 'inline-flex h-10 rounded-pill bg-card p-[3px] md:max-lg:h-11'}
        >
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
                className={phone ? cn(
                  'border-b-[2.5px] px-1 py-2.5 font-display text-[0.9375rem] font-bold',
                  on ? 'border-primary text-navy' : 'border-transparent text-muted hover:text-navy',
                  'max-md:flex max-md:min-h-11 max-md:flex-1 max-md:rounded-pill max-md:border-b-0 max-md:p-[3px] max-md:text-base max-md:font-semibold',
                ) : cn(
                  'flex h-full items-center justify-center whitespace-nowrap rounded-pill px-3.5 text-md font-semibold',
                  on ? 'bg-secondary text-secondary-contrast' : 'text-muted hover:text-navy',
                )}
              >
                {phone ? (
                  <span
                    className={cn(
                      'max-md:flex max-md:w-full max-md:items-center max-md:justify-center max-md:rounded-pill',
                      on && 'max-md:bg-secondary max-md:text-secondary-contrast',
                    )}
                  >
                    {t[tab]}
                  </span>
                ) : t[tab]}
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

/**
 * **A group on a phone** (UI V1, UI-108; `campaign-event-mobile` 1): its heading in sentence case with its count —
 * *Berjalan 3* — not the small uppercase label, and its cards one under another.
 *
 * **`wide`, a tablet's and a laptop's** (P19.1-T5 AC-4; UI-123): the same heading over a grid of cards, each at least
 * 300px, as many to a row as fit; `style` says how wide the group stands beside the others (`shareOf`).
 */
function PhoneSection({ section, wide = false, style, children }: {
  section: CampaignSection;
  wide?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-section={section.id} className={wide ? 'min-w-0' : undefined} style={style}>
      <h2 className="mx-0.5 mb-1.5 mt-3.5 flex items-baseline gap-1.5 text-lg font-bold text-navy">
        <span id={id}>{section.heading}</span>
        <span className="text-sm font-semibold text-muted">{section.items.length}</span>
      </h2>
      <div className={wide ? WIDE_GRID : 'flex flex-col gap-2'}>{children}</div>
    </section>
  );
}

/** A card's narrowest on a tablet and a laptop (UI-123: `minmax(300px, 1fr)`), and the gap between two. */
const CARD_MIN_PX = 300;
const CARD_GAP = '0.625rem';
const WIDE_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] items-start gap-2.5';

/**
 * **How wide a group stands** (UI-123: *sections with only one or two cards share a row (Berjalan | Akan datang side by
 * side), so no half-empty rows*): a group of one or two cards asks for their width — 300px a card and the gap — and
 * grows by its share of what is left, so *Berjalan 1* and *Akan datang 2* share a 1280px row as three cards; a group of
 * three or more takes a row of its own. Where two do not fit side by side they stack, each the row's width.
 */
export function shareOf(cards: number): CSSProperties {
  if (cards > 2) return { flex: '1 1 100%' };
  return { flex: `${cards} 1 calc(${cards} * ${CARD_MIN_PX}px + ${cards - 1} * ${CARD_GAP})` };
}

/**
 * **Which card first names each term, and where on it** (P18.7-T9 AC-3; UI-028: *APE*, *MDRT* unexplained): the
 * cards in the order they are drawn, each card's title, *Hadiah* and *Syarat* in reading order. A term the list names
 * on twelve cards gets one ⓘ, on the first. An ended row draws none of the three, so it names nothing.
 *
 * *Changed 2026-11-05 (P19.1-T5 AC-4):* the compact card (UI-108) has no blurb — the description is the detail's — so
 * a term is looked for in the three texts it draws.
 */
function cardTerms(
  sections: readonly CampaignSection[], ratioUnits: RatioUnits | undefined, language: Language, figures: Language,
): Map<string, TermKey[][]> {
  const cards = sections.flatMap((section) => section.items)
    .filter((card) => !(card.kind === 'seasonal' && card.phase === 'ended'));
  const texts = cards.flatMap((card) => [
    card.title, card.reward,
    card.requirements.length > 0 ? requirementsLine(card.requirements, ratioUnits, language, figures) : null,
  ]);
  const found = firstMentions(texts, CONTENT_TERM_KEYS);
  return new Map(cards.map((card, i) => [card.code, found.slice(i * 3, i * 3 + 3)]));
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
