'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Switch } from '@/components/ui/field';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { OWN_COPY, readCalendarSettings, saveCalendarSettings } from '@/lib/calendar';

/** The setting as the page holds it: `null` until the read answers, and while it cannot be read. */
export interface HideDetails {
  on: boolean | null;
  /** The last save the server refused, which put the switch back; `null` once another is made. */
  error: ApiError | null;
  change: (next: boolean) => void;
}

/**
 * ***Hide my personal activities*** (ADR-0110; P13.1-T8 AC-2): the reader's own setting, read once the
 * page opens, and **switched at once** — the switch moves when it is pressed, the save follows, and a save
 * the server refuses puts it back where it was and says so (`error`).
 *
 * **One save at a time.** A press while one is out is not taken, so the switch never shows a state that
 * a save still on its way could overturn; it is not disabled meanwhile, which would take the focus from
 * it. `enabled` is false where the reader may not save it — a read-only support session, a role with no
 * calendar write — and then nothing is read and nothing is drawn.
 */
export function useHideDetails(enabled: boolean): HideDetails {
  const [on, setOn] = useState<boolean | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const saving = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    readCalendarSettings()
      .then((settings) => { if (live) setOn(settings.hideDetails); })
      // Unread, there is no state to show and nothing to switch from: the switch is not drawn.
      .catch(() => undefined);
    return () => { live = false; };
  }, [enabled]);

  const change = (next: boolean) => {
    if (on === null || saving.current) return;
    const before = on;
    saving.current = true;
    setOn(next);
    setError(null);
    saveCalendarSettings({ hideDetails: next })
      .then((settings) => setOn(settings.hideDetails))
      .catch((err) => {
        setOn(before);
        setError(toDisplayError(err));
      })
      .finally(() => { saving.current = false; });
  };

  return { on, error, change };
}

/**
 * The toolbar's switch: the client's words for it, and an ⓘ beside it whose tooltip says what turning it
 * on does — leaders see only *Busy*, and the people invited still see the details (ADR-0062 §2's second
 * form). The same words are the switch's description, so a screen reader hears them with it.
 */
export function HideDetailsSwitch({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
  const id = useId();
  return (
    <span className="inline-flex items-center gap-1">
      <Switch id={`${id}-switch`} label={OWN_COPY.hideDetails} checked={on} describedBy={`${id}-tip`} onChange={onChange} />
      <span id={`${id}-tip`} className="sr-only">{OWN_COPY.hideDetailsTip}</span>
      <TippedGlyph glyph="ⓘ" name={OWN_COPY.hideDetailsTip} tip={OWN_COPY.hideDetailsTip} align="fit" className="-my-1.5" />
    </span>
  );
}
