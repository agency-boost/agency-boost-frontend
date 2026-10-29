'use client';

import { Button } from '@/components/ui/field';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { campaignsMessages } from '@/i18n/messages/campaigns';
import { cn } from '@/lib/cn';
import {
  statusWords,
  type CampaignCard, type ChaseBlock, type PosterColor,
} from '@/lib/campaigns';

/**
 * The pieces the card, the dialog and the Summary's rows share (`Overall.html:8023-8074`, `:8177-8222`).
 */

/** The poster's fill, a token for each of the server's palette names: the prototype's seven hexes (row 44). */
export const POSTER_FILL: Record<PosterColor, string> = {
  amber: 'bg-amber',
  'amber-dark': 'bg-amber-dark',
  navy: 'bg-navy',
  'navy-soft': 'bg-navy-soft',
  muted: 'bg-muted',
  success: 'bg-success',
  gold: 'bg-gold',
};

/** A small capital tag on the poster (`.source-tag`, `.status-tag`, `:1888-1904`). */
const TAG = 'whitespace-nowrap rounded-pill px-[9px] py-[3px] text-2xs font-bold uppercase tracking-wide';

/**
 * The status tag's words in their tone, on the prototype's white wash (`.status-tag`, `:1897-1904`). *Ongoing*
 * is amber-ink where the prototype's amber-dark is 2.99:1 on white (row 44); the rest are as drawn.
 */
const STATUS_TONE = {
  running: 'text-success',
  upcoming: 'text-navy-soft',
  ended: 'text-muted',
  ongoing: 'text-amber-ink',
} as const;

const statusKey = (c: Pick<CampaignCard, 'kind' | 'phase'>) => (c.kind === 'structural' ? 'ongoing' : c.phase);

/**
 * **The poster** (`.campaign-poster`, `:1874-1882`; `.campaign-modal-poster`, `:1921`): the campaign's emoji
 * on its colour — a token, never the prototype's raw hex — the source tag top left and the status tag top
 * right; an ended campaign's darkened (`.is-ended-poster`, `:1880-1882`). The emoji is decoration: the title
 * names the campaign.
 *
 * **The source tag reads *KPM*** on every campaign (OD-156, ADR-0146: company campaigns are deferred), with
 * navy words on the prototype's amber-dark (`.tag-kpm`, `:1893`) where its white ones are 2.99:1 (row 44).
 */
export function Poster({
  campaign, size, children,
}: {
  campaign: Pick<CampaignCard, 'kind' | 'phase' | 'poster'>;
  size: 'card' | 'dialog';
  /** The dialog's ✕, over the poster. */
  children?: React.ReactNode;
}) {
  const t = useMessages(campaignsMessages);
  const language = useLanguage();
  const ended = campaign.kind === 'seasonal' && campaign.phase === 'ended';
  return (
    <div
      className={cn(
        'relative flex items-center justify-center',
        size === 'card' ? 'h-[100px] text-[2rem]' : 'h-[170px] text-[3.375rem]',
        POSTER_FILL[campaign.poster.color],
        ended && "before:absolute before:inset-0 before:bg-navy/[0.28] before:content-['']",
      )}
    >
      <span aria-hidden="true" className="relative">{campaign.poster.emoji}</span>
      {size === 'card' && (
        <>
          <span className={cn(TAG, 'absolute left-2.5 top-2.5 bg-amber-dark text-navy')}>{t.sourceTag}</span>
          <span className={cn(TAG, 'absolute right-2.5 top-2.5 bg-card/[0.92]', STATUS_TONE[statusKey(campaign)])}>
            {statusWords(campaign, language)}
          </span>
        </>
      )}
      {children}
    </div>
  );
}

/**
 * The dialog's two tags under its poster (`.campaign-modal-tags`, `:8180-8186`): *KPM*, and the status on a
 * navy wash — *Ongoing* in navy words on an amber wash, where the prototype's amber-dark is 2.6:1 (row 44).
 */
export function DialogTags({ campaign }: { campaign: Pick<CampaignCard, 'kind' | 'phase'> }) {
  const t = useMessages(campaignsMessages);
  const language = useLanguage();
  const ongoing = campaign.kind === 'structural';
  return (
    <div className="mb-2.5 flex flex-wrap gap-2">
      <span className={cn(TAG, 'px-2.5 bg-amber-dark text-navy')}>{t.sourceTag}</span>
      <span className={cn(TAG, 'px-2.5 text-navy', ongoing ? 'bg-amber/[0.14]' : 'bg-navy/[0.06]')}>
        {statusWords(campaign, language)}
      </span>
    </div>
  );
}

/** *Promotion path* over a promotion's title (`.promo-label`, `:1913`): amber-ink, where amber-dark is 2.99:1. */
export function PromotionLabel({ className }: { className?: string }) {
  const t = useMessages(campaignsMessages);
  return (
    <p className={cn('mb-1 text-2xs font-bold uppercase tracking-wide text-amber-ink', className)}>
      {t.promotionPath}
    </p>
  );
}

/**
 * **☆ Chase / ⭐ Chasing** (`chaseBtnHtml`, `:8036-8038`), on the card and in the dialog.
 *
 * **An action button** (ADR-0137): the primary variant, amber with navy words, both ways — where the
 * prototype drew an outlined grey *Chase* and white words on amber for *Chasing* (2.23:1, row 44). Pressing
 * it chases, or stops chasing. **The chased state is carried three ways**, never by colour: the label
 * (*Chasing*), a ✓ before it, and `aria-pressed` — the calendar's *Accept* is the precedent (ADR-0137's sweep).
 * The prototype's ☆ and ⭐ stay, hidden from a screen reader with the ✓, so the name is the word.
 *
 * **Where it cannot be pressed it says why** (D-lists, AC-3): a campaign not for the reader's rung that they are
 * not chasing draws the button disabled and an ⓘ beside it whose name and tooltip are the reason (ADR-0062 §2,
 * form 2). A chaser whose rung has changed can still drop the chase. The caller draws no control at all where
 * the reader may not chase (`can.chase`: a support session) **or the campaign has ended** (`showsChase`;
 * P18.95-T10 AC-2, UI-024 — it was drawn disabled with an ⓘ until then); the `ended` branch below stays as the
 * guard should a caller draw one anyway.
 */
export function ChaseButton({
  chasing, blocked, busy, onToggle, compact = true,
}: {
  chasing: boolean;
  blocked: ChaseBlock | null;
  busy: boolean;
  onToggle: () => void;
  /** The card's pill (`.chase-btn`, `:1925-1933`); the dialog's sits at the button's own size. */
  compact?: boolean;
}) {
  // A chaser may always drop a chase that has not ended, even once the campaign is no longer for their rung
  // (the API takes the DELETE): only an ended campaign, or one closed to the reader who is not chasing it, is held.
  const t = useMessages(campaignsMessages);
  const held = blocked === 'ended' || (blocked === 'not_eligible' && !chasing);
  return (
    <span className="inline-flex items-center gap-1">
      <Button
        variant="primary"
        aria-pressed={chasing}
        disabled={busy || held}
        onClick={onToggle}
        data-chase
        className={cn('gap-1.5', compact && 'h-auto rounded-pill px-[11px] py-[5px] text-sm')}
      >
        <span aria-hidden="true">{chasing ? '✓ ⭐' : '☆'}</span>
        {chasing ? t.chasing : t.chase}
      </Button>
      {blocked && held && (
        <TippedGlyph glyph="ⓘ" name={t.blocked[blocked]} tip={t.blocked[blocked]} align="fit" />
      )}
    </span>
  );
}
