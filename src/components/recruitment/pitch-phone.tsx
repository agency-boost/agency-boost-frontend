'use client';

import { useId, useState } from 'react';
import { PlanIcon } from '@/components/plan/plan-icons';
import { ErrorBanner } from '@/components/ui/field';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { recruitmentPitchMessages } from '@/i18n/messages/recruitment-pitch';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatShortDay } from '@/lib/format';
import { pitchDocumentUrl, pitchRing, type PitchMaterialsView, type PitchSlot } from '@/lib/recruitment-pitch';

/**
 * **Pitch Materials on a phone** (UI V1, UI-107; `attack-plan-mobile` 6; Mobile only, the agents' tab): a progress ring
 * and one line in place of the pink banner — *Recruitment Pitch belum lengkap · 2 belum ada* — then **Wajib** and
 * **Opsional**, each with its count, and one row per document: a file glyph, the document's English name as the app
 * names it (the server's title, UI-107), then the file's name and day with a small *Lihat*, or *Belum diunggah*.
 *
 * **No state pills** (the owner: there is no *Terunggah* or *Perlu konfirmasi* to an agent) and no file size (*< 1 KB*
 * dropped). **The ring counts the required documents with a file** (*2/4 = required materials uploaded*), so a document
 * whose checklist the office has not finished counts as uploaded here; the server's own summary, which counts it as
 * not yet done, still draws the banner from 768px and the office's page. *Lihat* opens the PDF as the card's *Lihat
 * PDF* does: a link signed on the tap, in a new tab.
 */
export function PhonePitch({ view }: { view: PitchMaterialsView }) {
  const t = useMessages(recruitmentPitchMessages);
  const required = view.slots.filter((s) => s.required);
  const optional = view.slots.filter((s) => !s.required);
  const uploaded = required.filter((s) => s.file !== null).length;
  const missing = required.length - uploaded;
  const share = required.length === 0 ? 1 : uploaded / required.length;
  return (
    <div data-layout="phone-pitch">
      <div className="mt-3 flex items-center gap-3 rounded-lg bg-card p-3" data-state={missing === 0 ? 'complete' : 'incomplete'}>
        <span
          role="img"
          aria-label={t.uploadedRing({ done: uploaded, total: required.length })}
          // The ring's share as a conic fill: the accent over the grey pill ground, never a colour alone (the figure says it).
          style={{ background: `conic-gradient(var(--color-amber) ${share * 360}deg, var(--color-pill-grey) 0)` }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        >
          <span aria-hidden="true" className="flex h-[2.125rem] w-[2.125rem] items-center justify-center rounded-full bg-card text-sm font-bold text-navy">
            {pitchRing(uploaded, required.length)}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-md font-bold text-navy">{missing === 0 ? t.completeTitle : t.incompleteTitle}</p>
          <p className="m-0 mt-0.5 text-sm text-muted">{missing === 0 ? t.allUploaded : t.missingCount({ n: missing })}</p>
        </div>
      </div>
      <Group label={t.requiredGroup} slots={required} />
      {optional.length > 0 && <Group label={t.optionalGroup} slots={optional} />}
    </div>
  );
}

function Group({ label, slots }: { label: string; slots: readonly PitchSlot[] }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 className="mx-0.5 mb-1.5 mt-3.5 flex items-baseline gap-1.5 text-lg font-bold text-navy">
        <span id={id}>{label}</span>
        <span className="text-sm font-semibold text-muted">{slots.length}</span>
      </h2>
      <ul className="m-0 list-none overflow-hidden rounded-lg bg-card p-0">
        {slots.map((slot) => <Row key={slot.slot} slot={slot} />)}
      </ul>
    </section>
  );
}

function Row({ slot }: { slot: PitchSlot }) {
  const t = useMessages(recruitmentPitchMessages);
  const figures = useFigureLanguage();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const open = async () => {
    if (opening) return;
    setOpening(true);
    setError(null);
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    try {
      const { url } = await pitchDocumentUrl(slot.slot);
      if (tab) tab.location.href = url;
      else window.open(url, '_blank', 'noopener');
    } catch (err) {
      tab?.close();
      setError(toDisplayError(err));
    } finally {
      setOpening(false);
    }
  };

  return (
    <li className="border-t border-divider px-3 py-2 first:border-t-0" data-slot={slot.slot}>
      <div className="flex min-h-11 items-center gap-2.5">
        <span
          aria-hidden="true"
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]',
            slot.file ? 'bg-pill-red text-pill-red-ink' : 'bg-pill-grey text-signal-grey',
          )}
        >
          <PlanIcon name={slot.file ? 'file' : 'fileOff'} className="h-[1.125rem] w-[1.125rem]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-md font-bold text-ink">{slot.title}</p>
          <p className="m-0 mt-0.5 truncate text-sm text-muted">
            {slot.file
              ? `${slot.file.name} · ${formatShortDay(slot.file.uploadedOn, { year: true }, figures)}`
              : t.noFile}
          </p>
        </div>
        {slot.file && (
          <button
            type="button"
            onClick={() => void open()}
            aria-label={t.viewName({ title: slot.title })}
            aria-disabled={opening || undefined}
            className="relative flex h-[2.125rem] shrink-0 items-center rounded-pill border-[1.5px] border-hairline px-3 text-base font-bold text-navy after:absolute after:-inset-y-[5px] after:inset-x-0 after:content-['']"
          >
            {opening ? t.opening : t.view}
          </button>
        )}
      </div>
      {error && <div className="mt-2"><ErrorBanner {...error} /></div>}
    </li>
  );
}
