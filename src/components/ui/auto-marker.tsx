'use client';

import { useMessages } from '@/i18n/language-provider';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { cn } from '@/lib/cn';
import { LineIcon } from './line-icon';
import { TippedGlyph } from './tipped-glyph';

/**
 * **The automatic marker: a small ⚡, and the explanation behind ⓘ** (UI V1, UI-027 and UI-061; D-25) — never the
 * uppercase *OTOMATIS — SELESAI SAAT …* sentence. New hire detail's checklist items that complete themselves, Goal
 * Setting's figures that fill themselves, the Coaching Session's *Dari leads*.
 *
 * - **⚡** in the accent's ink, 14px, named *Otomatis* for a screen reader.
 * - **ⓘ** opens the caller's `explanation` on a tap, a hover or the keyboard's focus (`TippedGlyph`) — the rule in
 *   sentence case, and who completed it from where (*Diselesaikan dari … oleh …*). Without one, the ⚡ stands alone.
 */
export function AutoMarker({
  name,
  explanation,
  className,
}: {
  /** What is automatic — the item's name — for the ⓘ's accessible name: *Kenapa First sale otomatis*. */
  name: string;
  /** The sentence behind ⓘ. */
  explanation?: string;
  className?: string;
}) {
  const t = useMessages(uiV1Messages);
  return (
    <span data-auto-marker="" className={cn('inline-flex items-center gap-0.5 align-middle', className)}>
      <span className="inline-flex text-amber-ink">
        <LineIcon name="bolt" className="h-3.5 w-3.5" />
        <span className="sr-only">{t.auto.marker}</span>
      </span>
      {explanation && (
        <TippedGlyph
          glyph={<LineIcon name="info" className="h-4 w-4" />}
          name={t.auto.why({ name })}
          tip={explanation}
          align="fit"
          face="text-signal-grey"
        />
      )}
    </span>
  );
}
