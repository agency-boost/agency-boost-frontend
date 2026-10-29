'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Switch } from '@/components/ui/field';
import { InlineSaveStatus, useInlineSave, type InlineSaveStatusProps } from '@/components/ui/inline-save-status';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useMessages } from '@/i18n/language-provider';
import { calendarMessages } from '@/i18n/messages/calendar';
import { readCalendarSettings, saveCalendarSettings } from '@/lib/calendar';

/** The setting as the page holds it: `null` until the read answers, and while it cannot be read. */
export interface HideDetails {
  on: boolean | null;
  /** The last save the server refused, which put the switch back; `null` once another is made. */
  error: ApiError | null;
  change: (next: boolean) => void;
  /** *Saving… → Saved ✓*, or *Couldn't save — retry* (P18.95-T1 AC-5), beside the switch. */
  status: InlineSaveStatusProps;
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
 *
 * **It says its save beside it** (P18.95-T1 AC-5, ADR-0167 §5; UI-007), and a refused one offers the retry,
 * which switches it to the same side again and saves; the banner still says why.
 */
export function useHideDetails(enabled: boolean): HideDetails {
  const [on, setOn] = useState<boolean | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const saving = useRef(false);
  const { save: track, statusOf } = useInlineSave();

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
    void track('hideDetails', async () => {
      saving.current = true;
      setOn(next);
      setError(null);
      try {
        setOn((await saveCalendarSettings({ hideDetails: next })).hideDetails);
        return true;
      } catch (err) {
        setOn(before);
        setError(toDisplayError(err));
        return false;
      } finally {
        saving.current = false;
      }
    });
  };

  return { on, error, change, status: statusOf('hideDetails') };
}

/**
 * The toolbar's switch: the client's words for it, and an ⓘ beside it whose tooltip says what turning it
 * on does — leaders see only *Busy*, and the people invited still see the details (ADR-0062 §2's second
 * form). The same words are the switch's description, so a screen reader hears them with it.
 */
export function HideDetailsSwitch({
  on, onChange, status = { state: 'idle' },
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  /** Its save confirmation, after the ⓘ on the toolbar's line (P18.95-T1 AC-5). */
  status?: InlineSaveStatusProps;
}) {
  const t = useMessages(calendarMessages);
  const id = useId();
  return (
    <span className="inline-flex items-center gap-1">
      <Switch id={`${id}-switch`} label={t.hideDetails} checked={on} describedBy={`${id}-tip`} onChange={onChange} />
      <span id={`${id}-tip`} className="sr-only">{t.hideDetailsTip}</span>
      <TippedGlyph glyph="ⓘ" name={t.hideDetailsTip} tip={t.hideDetailsTip} align="fit" className="-my-1.5" />
      <InlineSaveStatus {...status} label={t.hideDetails} className="ml-1" />
    </span>
  );
}
