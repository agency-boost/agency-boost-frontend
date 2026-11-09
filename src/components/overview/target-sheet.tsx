'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { useMessages } from '@/i18n/language-provider';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { parseTarget, saveRecruitTarget, type RecruitTarget } from '@/lib/kpm-overview';

/**
 * **The recruitment target's sheet** (P19.3-T2 AC-1, AC-4; UI-148: *"Recruitment pipeline → the target sheet (today's
 * 'Ubah')"*, UI-149 step 7, *Atur target rekrutmen*): the office's target for its current month, the number box and
 * *Simpan* pinned at the foot, *"Tersimpan"* once it is saved — the same write as the card's *Ubah*
 * (`PUT /kpm/overview/recruit-target`, audited with before and after). A sheet below 1024px, centred from it.
 *
 * Opened from the setup card's step 7 and from the pipeline card's ›; `onSaved` gives the page the target, so step 7
 * ticks without a reload. Only for whoever may set it (`kpm_overview:set_recruit_target`): the page opens it for no one
 * else.
 */
export function TargetSheet({
  open, onClose, month, target, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** The office's current month, the only one a target is set for. */
  month: string;
  target: number | null;
  onSaved: (written: RecruitTarget) => void;
}) {
  const t = useMessages(kpmOverviewMessages);
  const formId = useId();
  const inputId = useId();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [asked, setAsked] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Filled each time it opens, with the target as it stands then; a save while open keeps what it says.
  const standing = useRef(target);
  standing.current = target;
  useEffect(() => {
    if (!open) return;
    setTyped(standing.current === null ? '' : String(standing.current));
    setSaved(false);
    setAsked(false);
    setError(null);
  }, [open]);

  const value = parseTarget(typed);
  const invalid = asked && value === null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setAsked(true);
    if (value === null) return;
    setBusy(true);
    setError(null);
    try {
      const written = await saveRecruitTarget({ month, target: value });
      setSaved(true);
      onSaved(written);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveSheet
      open={open}
      title={t.targetSheetTitle}
      onClose={onClose}
      footer={(
        <div className="flex items-center gap-3">
          <Button type="submit" form={formId} disabled={busy}>{t.save}</Button>
          {saved && <p role="status" className="text-md text-success">{t.saved}</p>}
        </div>
      )}
    >
      <form id={formId} onSubmit={submit} noValidate>
        <Field label={t.target} htmlFor={inputId} error={invalid ? t.targetInvalid : undefined}>
          <TextInput
            id={inputId}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={typed}
            invalid={invalid}
            onChange={(e) => { setTyped(e.target.value); setSaved(false); }}
          />
        </Field>
        {error && <div className="mt-3"><ErrorBanner {...error} /></div>}
      </form>
    </ResponsiveSheet>
  );
}
