'use client';

import { useId } from 'react';
import { PlanIcon, type PlanIconName } from '@/components/plan/plan-icons';
import { ErrorBanner } from '@/components/ui/field';
import { TermText, TermTip } from '@/components/ui/term-tip';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { campaignsMessages } from '@/i18n/messages/campaigns';
import type { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { requirementsLine, type CampaignCard, type PosterColor, type RatioUnits } from '@/lib/campaigns';
import type { TermKey } from '@/lib/terms';

/**
 * **A campaign's line icon, where the prototype drew its poster's emoji** (UI V1, UI-108: *emoji art* gone; UI-102: no
 * emoji as icons). The office still picks an emoji for its poster, which the wider card and the dialog draw; on a phone
 * that pick chooses one of the line-icon set's glyphs, so the card says the same thing without the emoji. An emoji with
 * no counterpart is a flag.
 */
const ICON_FOR_EMOJI: Readonly<Record<string, PlanIconName>> = {
  '🚀': 'rocket', '🧲': 'magnet', '🎯': 'target', '📚': 'graduation', '🎓': 'graduation', '🏆': 'trophy',
  '🥇': 'trophy', '📈': 'chartUp', '📊': 'barChart', '👥': 'users', '🤝': 'users', '⭐': 'star', '🌟': 'star',
  '🔥': 'bolt', '⚡': 'bolt', '📣': 'megaphone', '📢': 'megaphone', '💼': 'box', '🧭': 'compass', '🏁': 'flag',
};

export const campaignIcon = (emoji: string): PlanIconName => ICON_FOR_EMOJI[emoji.trim()] ?? 'flag';

/** The icon's tile, tinted from the poster's colour — tokens only; words on each clear 4.5:1 as the pills' do. */
const TILE: Record<PosterColor, string> = {
  amber: 'bg-amber/[0.14] text-amber-ink',
  'amber-dark': 'bg-amber/[0.14] text-amber-ink',
  navy: 'bg-navy/[0.08] text-navy',
  'navy-soft': 'bg-pill-blue text-pill-blue-ink',
  muted: 'bg-pill-grey text-pill-grey-ink',
  success: 'bg-pill-green text-pill-green-ink',
  gold: 'bg-gold/[0.14] text-gold-ink',
};

/** The office's tag and the window: *KPM · 1 Agu – 31 Okt 2026*. */
function Meta({ card }: { card: CampaignCard }) {
  const t = useMessages(campaignsMessages);
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-1 text-sm text-muted">
      <span className="rounded-pill bg-pill-grey px-2 py-px font-semibold text-pill-grey-ink">{t.sourceTag}</span>
      {card.duration}
    </span>
  );
}

/**
 * **A campaign on a phone** (UI V1, UI-108; `campaign-event-mobile` 1; Mobile only): the line icon in its tinted tile,
 * the name on one line, the office's tag and the period, and a **round star for *Kejar*** — orange once chased, its
 * state also its `aria-pressed` and its name *Kejar {name}*; under them a light panel with two aligned rows, **Hadiah**
 * and **Syarat**. The description and the full terms are the detail's alone: **the card is the target** that opens it
 * (a button stretched over the card), the star above it. 12px padding all round.
 *
 * The star is drawn only where the wider card draws *Kejar* (`showsChase`); a campaign closed to the reader's rung that
 * they are not chasing is drawn, held, with the reason as its title. A refused chase is said under the card.
 *
 * *Changed 2026-11-05 (P19.1-T5 AC-4; UI-123: "Card content as UI-108"):* **the card of a tablet and a laptop too**, in
 * their grid. There it carries what the wider card carried and the client asked for earlier: an ⓘ after a term where
 * the list first names it (`terms`, P18.7-T9 AC-3) — each its own target, above the card's. A phone passes none, and
 * draws what it drew.
 */
export function PhoneCampaignCard({ card, canChase, busy, error, onChase, onOpen, ratioUnits, terms }: {
  card: CampaignCard;
  canChase: boolean;
  busy: boolean;
  error: ApiError | null;
  onChase: () => void;
  onOpen: () => void;
  ratioUnits?: RatioUnits;
  /** The terms this card first names — its title's, *Hadiah*'s and *Syarat*'s — on a tablet and a laptop alone. */
  terms?: TermKey[][];
}) {
  const t = useMessages(campaignsMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const titleId = useId();
  const held = card.chaseBlocked === 'ended' || (card.chaseBlocked === 'not_eligible' && !card.chasing);
  const [titleTerms = [], rewardTerms = [], needsTerms = []] = terms ?? [];
  const title = <h3 id={titleId} className="m-0 truncate text-lg font-bold leading-snug text-ink">{card.title}</h3>;
  const requirements = card.requirements.length > 0 ? requirementsLine(card.requirements, ratioUnits, language, figures) : '';
  return (
    <article aria-labelledby={titleId} data-campaign-card={card.code} className="relative rounded-lg bg-card p-3">
      <button
        type="button"
        aria-labelledby={titleId}
        onClick={onOpen}
        data-open-campaign
        className="absolute inset-0 rounded-lg focus-visible:[outline-offset:-2px]"
      />
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px]', TILE[card.poster.color])}>
          <PlanIcon name={campaignIcon(card.poster.emoji)} className="h-[1.375rem] w-[1.375rem]" />
        </span>
        <div className="min-w-0 flex-1">
          {titleTerms.length === 0 ? title : (
            // Beside the heading, not in it, so the card is still named by its title alone.
            <span className="flex min-w-0 items-center gap-1">
              {title}
              {titleTerms.map((term) => <TermTip key={term} term={term} className="shrink-0" />)}
            </span>
          )}
          <Meta card={card} />
        </div>
        {canChase && (
          <button
            type="button"
            aria-pressed={card.chasing}
            aria-label={t.chaseName({ title: card.title })}
            title={held && card.chaseBlocked ? t.blocked[card.chaseBlocked] : undefined}
            disabled={busy || held}
            onClick={onChase}
            data-chase
            className={cn(
              'relative z-[1] flex h-[2.375rem] w-[2.375rem] shrink-0 items-center justify-center rounded-full border-[1.5px]',
              "after:absolute after:-inset-[3px] after:content-[''] disabled:opacity-40",
              card.chasing ? 'border-primary bg-primary text-primary-contrast' : 'border-hairline bg-card text-navy',
            )}
          >
            <PlanIcon name="star" className={cn('h-[1.125rem] w-[1.125rem]', card.chasing && '[&>path]:fill-current')} />
          </button>
        )}
      </div>
      {(card.reward || card.requirements.length > 0) && (
        <dl className="m-0 mt-2.5 grid grid-cols-[3.5rem_1fr] gap-x-2 gap-y-1 rounded-[12px] bg-hover-row px-2.5 py-2 text-base leading-snug">
          {card.reward && (
            <>
              <dt className="pt-px text-sm font-semibold text-muted">{t.prize}</dt>
              <dd className="m-0 text-ink">{rewardTerms.length === 0 ? card.reward : <TermText text={card.reward} terms={rewardTerms} />}</dd>
            </>
          )}
          {card.requirements.length > 0 && (
            <>
              <dt className="pt-px text-sm font-semibold text-muted">{t.requirementsTitle}</dt>
              <dd className="m-0 text-ink">{needsTerms.length === 0 ? requirements : <TermText text={requirements} terms={needsTerms} />}</dd>
            </>
          )}
        </dl>
      )}
      {error && <div className="relative z-[1] mt-2.5"><ErrorBanner {...error} /></div>}
    </article>
  );
}

/**
 * **An ended campaign on a phone** (UI-108): a short greyed row — the icon on grey, the name in the muted ink, the tag
 * and the period, › — the whole row opening it. Greyed by its colours, not by fading the row, so its words keep 4.5:1.
 */
export function PhoneEndedRow({ card, onOpen }: { card: CampaignCard; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-campaign-card={card.code}
      data-open-campaign
      className="flex w-full items-center gap-2.5 rounded-lg bg-card p-3 text-left"
    >
      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-pill-grey text-muted">
        <PlanIcon name={campaignIcon(card.poster.emoji)} className="h-[1.375rem] w-[1.375rem]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-bold leading-snug text-muted">{card.title}</span>
        <Meta card={card} />
      </span>
      <PlanIcon name="chevronRight" className="h-[1.125rem] w-[1.125rem] text-line" />
    </button>
  );
}
