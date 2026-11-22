'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { PdfUploadNotice, usePdfUpload } from '@/components/recruitment/pdf-upload';
import { PitchCard } from '@/components/recruitment/pitch-card';
import { usePitchOpen } from '@/components/recruitment/pitch-open';
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { LazyResponsiveSheet } from '@/components/ui/lazy-responsive-sheet';
import { Skeleton, SkeletonBar, SkeletonText } from '@/components/ui/skeleton';
import { TonePill, type PillTone } from '@/components/ui/tone-pill';
import type { MessagesOf } from '@/i18n/catalogue';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { recruitmentPitchMessages } from '@/i18n/messages/recruitment-pitch';
import { settingsMessages } from '@/i18n/messages/settings';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatShortDay } from '@/lib/format';
import {
  attachPitchDocument, readPitchMaterials, requestPitchUpload, setPitchLink,
  type PitchMaterialsView, type PitchSlot,
} from '@/lib/recruitment-pitch';

type Words = MessagesOf<typeof recruitmentPitchMessages.en>;

/**
 * **A material's state, as the list says it** (P19.21-T3 AC-6; frame 22): *Siap* — a file or a link with nothing left
 * to confirm (`complete`, `uploaded`); *Perlu dicek* — one with a checklist item still open (`partial`); *Belum ada* —
 * nothing (`missing`). The server's state, by its one completion rule; only the words are the list's.
 */
const STATE: Record<PitchSlot['state'], { tone: PillTone; words: (t: Words) => string }> = {
  complete: { tone: 'green', words: (t) => t.ready },
  uploaded: { tone: 'green', words: (t) => t.ready },
  partial: { tone: 'amber', words: (t) => t.needsCheck },
  missing: { tone: 'red', words: (t) => t.missing },
};

/** Shaped like the count card and the six rows, so they arrive in place (L-01). */
function ListSkeleton() {
  const t = useMessages(recruitmentPitchMessages);
  return (
    <Skeleton label={t.loading}>
      <div className="mb-3 flex items-center gap-3 rounded-lg bg-card px-4 py-3.5">
        <SkeletonBar className="h-6 w-10" />
        <SkeletonText lines={1} className="flex-1" />
      </div>
      <div className="overflow-hidden rounded-lg bg-card">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 border-t border-divider px-4 py-3.5 first:border-t-0">
            <SkeletonText lines={2} className="flex-1" />
            <SkeletonBar className="h-8 w-24" />
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

/**
 * **Pengaturan › Recruitment pitch as one list** (P19.21-T3 AC-6, ADR-0274; `data-upload-pengaturan-*` frame 22): the
 * six materials agents see in *Recruitment › Pitch Materials*, **in one list with no required/optional split**, under
 * *"n/6 materi siap · dipakai agent di Recruitment › Pitch Materials"*. Each row: the name, the file's name and day —
 * or *Link · day*, or *Belum diunggah* — its state, **one button** (*Lihat* where something is to be checked, *Ganti*
 * where it is ready, *Unggah file* where nothing is), and ⋯ for the rest; under the list *"Format apa saja: PDF,
 * PowerPoint, Word, gambar, video, atau link"*.
 *
 * **What the cards held stays, behind *Lihat*** (the owner's rule that fidelity work never strips a requested feature):
 * the material opened as it opens for an agent, *"Pastikan PDF ini benar-benar memuat"* with its ticks, and *Ganti* —
 * the same `PitchCard` the agents' tab draws, in a sheet.
 *
 * Read from `GET /recruitment/pitch-materials`, the one read the agents' tab draws too; after every write it is read
 * again, so the count is always the server's (`summary.all`).
 */
export function PitchList({ canWrite }: { canWrite: boolean }) {
  const t = useMessages(recruitmentPitchMessages);
  const [view, setView] = useState<PitchMaterialsView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [looking, setLooking] = useState<PitchSlot['slot'] | null>(null);
  const [linking, setLinking] = useState<PitchSlot | null>(null);

  const load = useCallback(async () => {
    try {
      setView(await readPitchMaterials());
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (view === null) {
    return error ? (
      <div className="flex flex-col items-start gap-3">
        <p className="m-0 text-md text-navy">{t.readFailed}</p>
        <ErrorBanner {...error} />
        <Button variant="secondary" onClick={() => { setError(null); void load(); }}>{t.tryAgain}</Button>
      </div>
    ) : <ListSkeleton />;
  }

  const changed = (next: PitchSlot) => {
    setView((now) => (now ? { ...now, slots: now.slots.map((s) => (s.slot === next.slot ? next : s)) } : now));
    void load();
  };
  const all = view.summary.all ?? {
    ready: view.slots.filter((s) => s.state === 'complete' || s.state === 'uploaded').length,
    total: view.slots.length,
  };
  const shown = view.slots.find((s) => s.slot === looking) ?? null;

  return (
    <div className="flex flex-col gap-3" data-pitch-list="">
      {error && <ErrorBanner {...error} />}
      <div className="flex items-center gap-3 rounded-lg bg-card px-4 py-3.5" data-pitch-count="">
        <p
          role="img"
          className={cn('m-0 font-display text-2xl font-extrabold tabular-nums', all.ready === all.total ? 'text-success' : 'text-alert')}
          aria-label={t.readyName({ ready: all.ready, total: all.total })}
        >
          <span aria-hidden="true">{`${all.ready}/${all.total}`}</span>
        </p>
        <p className="m-0 min-w-0 flex-1 text-md text-navy">{t.readyLine}</p>
      </div>

      <ul role="list" aria-label={t.readyLine} className="m-0 list-none overflow-hidden rounded-lg bg-card p-0">
        {view.slots.map((slot) => (
          <PitchRow
            key={slot.slot}
            slot={slot}
            canWrite={canWrite}
            onChanged={changed}
            onLook={() => setLooking(slot.slot)}
            onLink={() => setLinking(slot)}
          />
        ))}
      </ul>
      <p className="m-0 px-1 text-sm text-muted">{t.anyFormat}</p>

      <LazyResponsiveSheet open={shown !== null} title={shown?.title ?? ''} onClose={() => setLooking(null)}>
        {shown && (
          <PitchCard slot={shown} audience="office" canWrite={canWrite} onChanged={changed} onStale={() => void load()} />
        )}
      </LazyResponsiveSheet>

      <LinkSheet slot={linking} onClose={() => setLinking(null)} onSaved={(next) => { setLinking(null); changed(next); }} />
    </div>
  );
}

/** One material's row: its name and line, its state, its one button and its ⋯. */
function PitchRow({
  slot, canWrite, onChanged, onLook, onLink,
}: {
  slot: PitchSlot;
  canWrite: boolean;
  onChanged: (next: PitchSlot) => void;
  onLook: () => void;
  onLink: () => void;
}) {
  const t = useMessages(recruitmentPitchMessages);
  const figures = useFigureLanguage();
  const titleId = useId();
  const opener = usePitchOpen(slot);
  const upload = usePdfUpload({
    formats: 'pitch',
    sign: requestPitchUpload,
    attach: (storageKey) => attachPitchDocument(slot.slot, storageKey),
    onAttached: onChanged,
  });
  const has = slot.file !== null || !!slot.link;
  const state = STATE[slot.state];
  const day = (d: string) => formatShortDay(d, { year: true }, figures);
  const line = slot.link ? t.linkLine({ day: day(slot.link.addedOn) })
    : slot.file ? t.fileLine({ name: slot.file.name, day: day(slot.file.uploadedOn) })
      : t.noFile;

  /*
   * The one button the mockup draws: *Lihat* where something waits to be checked — the sheet with its ticks — *Ganti*
   * where it is ready, *Unggah file* where there is nothing. Without the write, *Lihat* opens the material and nothing
   * is offered for one with none.
   */
  const choose = () => { if (!upload.busy) upload.choose(); };
  const primary = slot.state === 'partial'
    ? { words: t.view, name: t.viewMaterialName({ title: slot.title }), act: onLook }
    : !canWrite
      ? (has ? { words: t.view, name: t.viewMaterialName({ title: slot.title }), act: onLook } : null)
      : has
        ? { words: t.replace, name: t.replaceName({ title: slot.title }), act: choose }
        : { words: t.uploadFile, name: t.uploadName({ title: slot.title }), act: choose };

  const items: ActionMenuItem[] = [
    ...(has ? [{ label: t.view, onSelect: onLook }] : []),
    ...(has && opener.kind ? [{ label: opener.kind === 'link' ? t.openLink : opener.kind === 'download' ? t.download : t.viewFile, onSelect: () => void opener.open() }] : []),
    ...(canWrite ? [
      { label: slot.file ? t.replaceFile : t.uploadFile, onSelect: choose },
      { label: slot.link ? t.changeLink : t.useLink, onSelect: onLink },
    ] : []),
  ];

  return (
    <li
      aria-labelledby={titleId}
      data-slot={slot.slot}
      data-state={slot.state}
      className="border-t border-divider px-4 py-3 first:border-t-0"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-48">
          <p id={titleId} className="m-0 text-md font-bold text-navy">{slot.title}</p>
          <p className="m-0 mt-0.5 break-all text-sm text-muted">{line}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <TonePill tone={state.tone}>{state.words(t)}</TonePill>
          {primary && (
            <Button
              variant="secondary"
              className="h-9 rounded-pill px-3.5 max-lg:h-11"
              aria-label={primary.name}
              aria-disabled={upload.busy || undefined}
              aria-haspopup={primary.act === onLook ? 'dialog' : undefined}
              onClick={primary.act}
            >
              {primary.words}
            </Button>
          )}
          {items.length > 0 && (
            <ActionMenu label={t.actionsFor({ title: slot.title })} items={items} glyph="⋯" triggerClassName="max-lg:h-11 max-lg:w-11" />
          )}
        </div>
      </div>
      {canWrite && upload.picker}
      <PdfUploadNotice state={upload} className="mt-2 flex flex-col gap-2" />
      {opener.error && <div className="mt-2"><ErrorBanner {...opener.error} /></div>}
      {opener.dialog}
    </li>
  );
}

/** *Pakai link* / *Ganti link*: one address, saved with `PUT …/:slot/link`; the server's refusal shown as it says it. */
function LinkSheet({
  slot, onClose, onSaved,
}: {
  slot: PitchSlot | null;
  onClose: () => void;
  onSaved: (next: PitchSlot) => void;
}) {
  const t = useMessages(recruitmentPitchMessages);
  const s = useMessages(settingsMessages);
  const formId = useId();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    setUrl(slot?.link?.url ?? '');
    setError(null);
  }, [slot]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!slot || busy) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await setPitchLink(slot.slot, url.trim()));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <LazyResponsiveSheet
      open={slot !== null}
      title={slot ? t.linkTitle({ title: slot.title }) : ''}
      onClose={onClose}
      footer={(
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>{s.cancel}</Button>
          <Button type="submit" form={formId} className="flex-1" disabled={busy || url.trim() === ''}>
            {busy ? s.saving : s.save}
          </Button>
        </div>
      )}
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-3">
        <Field label={t.linkLabel} htmlFor={`${formId}-url`} hint={t.linkHint}>
          <TextInput
            id={`${formId}-url`}
            type="url"
            inputMode="url"
            autoComplete="off"
            value={url}
            disabled={busy}
            onChange={(e) => setUrl(e.target.value)}
          />
        </Field>
        {error && <ErrorBanner {...error} />}
      </form>
    </LazyResponsiveSheet>
  );
}
