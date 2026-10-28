'use client';

import { useId, useState } from 'react';
import { PdfUploadNotice, usePdfUpload } from '@/components/recruitment/pdf-upload';
import { ConfigBadge } from '@/components/ui/config-badge';
import { Button, ErrorBanner } from '@/components/ui/field';
import { InlineSaveStatus, useInlineSave, type InlineSaveOutcome } from '@/components/ui/inline-save-status';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatShortDay } from '@/lib/format';
import {
  attachPitchDocument, formatFileSize, PITCH_COPY, PITCH_OWN_COPY, pitchDocumentUrl,
  requestPitchUpload, setPitchConfirmation, type PitchSlot,
} from '@/lib/recruitment-pitch';

/**
 * Who is looking (D-settings, D-agent-view): the office's page, or the agents' tab. The prototype's
 * *Viewing as Agent* / *Viewing as KPM* toggle (`:358-361`) is two routes instead, and the
 * permissions decide which one a reader reaches (contradiction 1).
 */
export type PitchAudience = 'office' | 'agent';

type Tone = 'success' | 'alert' | 'review';

const BADGE: Record<Tone, { pill: string; dot: string }> = {
  success: { pill: 'bg-success/10 text-success', dot: 'bg-success' },
  alert: { pill: 'bg-alert/10 text-alert', dot: 'bg-alert' },
  /*
   * **The amber badge**: the amber tint and the amber-dark dot, with navy words, as the roster's *Watch
   * closely* pill has them (parity I-116) — no amber in the palette clears 4.5:1 as small text on an amber
   * ground, and navy on this tint over the card is 12.7:1 (`pitch-card.spec.tsx` measures both). The tint and
   * the dot carry the colour; the words carry the meaning: *Uploaded · needs confirmation* (I-519).
   */
  review: { pill: 'bg-amber/[0.14] text-navy', dot: 'bg-amber-dark' },
};

/**
 * The badge (`.status-badge`, `:681-696`): a word as well as a tint, always — or **none**, on an optional
 * document with no file, which is never *Missing* (ADR-0177 §2): its *Optional* tag and *Not uploaded yet* say
 * what it is.
 *
 * - **No file**: *Missing* on a required document; no badge on an optional one.
 * - **A file whose checklist is not finished** (`partial`): ***Uploaded · needs confirmation***, amber, to the
 *   office and to agents alike (ADR-0177 §1; P18.97-T5 AC-1) — where the office read *"{n}/{m} confirmed"*
 *   (`:688`) and agents *Uploaded* (`:696`). It still opens for every member (ADR-0126).
 * - **A file with every item ticked** (`complete`): *Complete* to the office, *Uploaded* to agents, as the
 *   prototype's agent view draws it (`:696`).
 * - **A file on a slot with no checklist** (`uploaded`): *Uploaded*, to everybody.
 */
function badgeOf(slot: PitchSlot, audience: PitchAudience): { tone: Tone; label: string } | null {
  if (!slot.file || slot.state === 'missing') {
    return slot.required ? { tone: 'alert', label: PITCH_COPY.missing } : null;
  }
  if (slot.state === 'partial') return { tone: 'review', label: PITCH_COPY.needsConfirmation };
  if (slot.state === 'complete' && audience === 'office') return { tone: 'success', label: PITCH_COPY.complete };
  return { tone: 'success', label: PITCH_COPY.uploaded };
}

/**
 * The state's pill. It may wrap below the title where the card is too narrow for both on one line — *Uploaded ·
 * needs confirmation* is long — and its own words wrap only on a screen narrower than any the product is drawn
 * for, so it never runs off the card.
 */
function PitchBadge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      data-badge=""
      data-tone={tone}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-pill px-2.5 py-1',
        'text-xs font-bold uppercase tracking-wide',
        BADGE[tone].pill,
      )}
    >
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', BADGE[tone].dot)} />
      {label}
    </span>
  );
}

type Notice =
  | { kind: 'stale' }
  | { kind: 'tick'; error: ApiError }
  | { kind: 'link'; error: ApiError };

/**
 * One of the six documents (`.doc-card`, `Recruitment_Section.html:676-753`), for the office's page
 * and the agents' tab alike, from the same props (D-components).
 *
 * **What it draws is the server's**: the title, whether the document is required, the checklist's labels,
 * the state, the file's name, size and day. A file's name is rendered as text — the prototype pours it
 * through `innerHTML` (contradiction 3). The slot's `line` is not drawn: the prototype defines it and never
 * renders it, as it never renders a slot's `tooltip` (`:676-727`).
 *
 * **An optional document** — *Company Profile*, *Agency Profile* (UI-042; ADR-0177 §2) — carries the tag
 * ***Optional*** beside its title, the quiet chip (`ConfigBadge`'s navy), on both pages and for every reader.
 * Empty, it reads *Not uploaded yet* with no badge and a neutral dashed edge, never *Missing* and never the
 * missing card's red one; filled, it is uploaded, opened and replaced as the four are.
 *
 * **Writes are the office's alone** (`canWrite`: `tenant_config:write`, which a read-only support
 * session never holds): *Upload PDF*, *Replace*, and the checklist's boxes, each written at once.
 * A tick names the slot's `version`, so one made against a file replaced since is refused `409`; the
 * card says so and the page reads every slot again (D-replace).
 *
 * *View PDF* asks for a link signed for 300 seconds when it is pressed and opens it in a new tab
 * (contradiction 6). The tab is opened as the click lands, so a browser that blocks windows opened
 * later lets it through, and it is cut from this page before it navigates.
 */
export function PitchCard({
  slot,
  audience,
  canWrite = false,
  onChanged,
  onStale,
}: {
  slot: PitchSlot;
  audience: PitchAudience;
  /** The office's page only: may upload, replace and tick. Never on the agents' tab. */
  canWrite?: boolean;
  /** A write answered with the slot as it now is. */
  onChanged?: (next: PitchSlot) => void;
  /** A tick was refused because the file was replaced since: every slot is read again. */
  onStale?: () => void;
}) {
  const titleId = useId();
  const boxId = useId();
  const [opening, setOpening] = useState(false);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [said, setSaid] = useState('');

  const office = audience === 'office';
  const writes = office && canWrite;
  const badge = badgeOf(slot, audience);
  const missing = !slot.file;
  // The dashed edge says the slot is empty; red only where that is a gap in the pitch (a required document).
  const edge = !missing ? 'border-hairline' : slot.required ? 'border-dashed border-alert/35' : 'border-dashed border-hairline';

  const upload = usePdfUpload({
    sign: requestPitchUpload,
    attach: (storageKey) => attachPitchDocument(slot.slot, storageKey),
    onAttached: (next: PitchSlot) => {
      setNotice(null);
      setSaid(PITCH_OWN_COPY.attached(next.file?.name ?? '', slot.checklist.some((i) => i.ticked)));
      onChanged?.(next);
    },
  });

  const open = async () => {
    // Ignored while it signs, rather than disabled: a disabled button drops the focus.
    if (opening) return;
    setOpening(true);
    setNotice(null);
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    try {
      // The link was signed a moment ago for 300 seconds, so it is opened as it comes: comparing its
      // expiry with this device's clock would refuse every link on a phone whose clock runs fast.
      const { url } = await pitchDocumentUrl(slot.slot);
      if (tab) tab.location.href = url;
      else window.open(url, '_blank', 'noopener');
    } catch (err) {
      tab?.close();
      setNotice({ kind: 'link', error: toDisplayError(err) });
    } finally {
      setOpening(false);
    }
  };

  /** Each box's *Saving… → Saved ✓*, or *Couldn't save — retry* (P18.95-T1 AC-5). */
  const inline = useInlineSave();
  const saveKey = (item: string) => `${slot.slot}\n${item}`;

  const tick = (item: string, ticked: boolean) => {
    // A second press on a box whose first is still being written is ignored rather than refused:
    // disabling the box would drop the keyboard's focus with it.
    if (item in pending) return;
    // Pinned to the file it was made against: a retry after the file was replaced is refused 409, as the
    // first press would have been.
    const version = slot.version;
    void inline.save(saveKey(item), () => confirm(item, ticked, version));
  };

  /**
   * One write of a tick, answering how it went — and **the retry sends the same tick again**. A `409` is the
   * file replaced since: the slots are read again, so there is nothing left to retry (`null`).
   */
  const confirm = async (item: string, ticked: boolean, version: number): Promise<InlineSaveOutcome> => {
    setPending((now) => ({ ...now, [item]: ticked }));
    setNotice(null);
    setSaid('');
    try {
      onChanged?.(await setPitchConfirmation(slot.slot, item, ticked, version));
      return true;
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) {
        setNotice({ kind: 'stale' });
        onStale?.();
        return null;
      }
      setNotice({ kind: 'tick', error: toDisplayError(err) });
      return false;
    } finally {
      setPending(({ [item]: _done, ...rest }) => rest);
    }
  };

  return (
    <article
      aria-labelledby={titleId}
      data-slot={slot.slot}
      data-state={slot.state}
      className={cn('flex flex-col gap-3.5 rounded-lg border bg-card px-5 py-5 sm:px-6', edge)}
    >
      {/* The title (and an optional document's tag) and the state, on one line where they fit, else the state
          under the title: the long amber words never squeeze the title out of the card. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          <h2 id={titleId} className="m-0 text-lg font-bold text-navy">{slot.title}</h2>
          {!slot.required && <ConfigBadge tone="navy">{PITCH_COPY.optional}</ConfigBadge>}
        </div>
        {badge && <PitchBadge tone={badge.tone} label={badge.label} />}
      </div>

      {slot.file ? (
        <div className="flex items-center gap-2.5 rounded-md border border-hairline bg-base px-3.5 py-3">
          <span
            aria-hidden="true"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md bg-alert/10 text-xs font-extrabold text-alert"
          >
            {PITCH_COPY.fileIcon}
          </span>
          <div className="min-w-0">
            <p className="m-0 break-all text-base font-semibold text-navy">{slot.file.name}</p>
            <p className="m-0 text-sm text-muted">
              {PITCH_COPY.updated(formatFileSize(slot.file.bytes), formatShortDay(slot.file.uploadedOn, { year: true }))}
            </p>
          </div>
        </div>
      ) : (
        <p className="m-0 text-base italic text-muted">{PITCH_COPY.noFile}</p>
      )}

      {office && slot.file && slot.checklist.length > 0 && (
        <fieldset className="m-0 min-w-0 border-0 p-0 pt-1">
          <legend className="mb-2.5 p-0 text-xs font-bold uppercase tracking-wide text-muted">
            {PITCH_COPY.checklist}
          </legend>
          {slot.checklist.map((item) => {
            const id = `${boxId}-${item.code}`;
            const checked = pending[item.code] ?? item.ticked;
            const status = inline.statusOf(saveKey(item.code));
            return (
              // The box's status beside it, at the row's end and outside the label, so the box's name stays the
              // server's words (AC-5). A retry gives the focus back to the box, as a cell's does.
              <div key={item.code} className="flex items-center gap-2.5">
                <label
                  htmlFor={id}
                  className={cn(
                    'flex min-w-0 flex-1 items-center gap-2.5 py-1.5',
                    writes ? 'cursor-pointer' : 'cursor-not-allowed',
                  )}
                >
                  <span className="relative flex shrink-0">
                    <input
                      id={id}
                      type="checkbox"
                      checked={checked}
                      disabled={!writes}
                      aria-busy={item.code in pending || undefined}
                      onChange={(e) => tick(item.code, e.target.checked)}
                      className="peer absolute inset-0 m-0 h-[18px] w-[18px] cursor-pointer opacity-0 disabled:cursor-not-allowed"
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex h-[18px] w-[18px] items-center justify-center rounded-sm border-[1.5px] transition-colors',
                        checked ? 'border-success bg-success' : 'border-hairline bg-card',
                        // The amber ring the project keeps, on the visible box: the input is transparent.
                        'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-amber',
                        'peer-disabled:opacity-40',
                      )}
                    >
                      {checked && (
                        <svg viewBox="0 0 24 24" fill="none" className="h-[11px] w-[11px] text-white">
                          <path
                            d="M4 12.5L9.5 18L20 6"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                  </span>
                  <span className="text-md leading-snug text-navy">{item.label}</span>
                </label>
                <InlineSaveStatus
                  state={status.state}
                  label={`${item.label}, ${slot.title}`}
                  onRetry={() => {
                    status.onRetry?.();
                    document.getElementById(id)?.focus();
                  }}
                />
              </div>
            );
          })}
        </fieldset>
      )}

      {(slot.file || writes) && (
        <div className="mt-auto flex flex-wrap items-center gap-2.5">
          {slot.file && (
            <Button
              aria-label={PITCH_OWN_COPY.viewName(slot.title)}
              aria-disabled={opening || undefined}
              className="aria-disabled:opacity-60"
              onClick={() => void open()}
            >
              {opening ? PITCH_OWN_COPY.opening : PITCH_COPY.viewPdf}
            </Button>
          )}
          {writes && (
            <Button
              variant={slot.file ? 'secondary' : 'primary'}
              aria-label={slot.file
                ? PITCH_OWN_COPY.replaceName(slot.title)
                : PITCH_OWN_COPY.uploadName(slot.title)}
              // Not `disabled`, which would drop the focus while the file is on its way.
              aria-disabled={upload.busy || undefined}
              className="aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
              onClick={() => { if (!upload.busy) upload.choose(); }}
            >
              {slot.file ? PITCH_COPY.replace : PITCH_COPY.uploadPdf}
            </Button>
          )}
          {writes && upload.picker}
        </div>
      )}

      <PdfUploadNotice state={upload} className="flex flex-col gap-2" />

      {notice?.kind === 'stale' && (
        <p role="alert" className="m-0 text-base font-semibold text-alert">{PITCH_OWN_COPY.replacedSince}</p>
      )}
      {(notice?.kind === 'link' || notice?.kind === 'tick') && (
        <div className="flex flex-col gap-1.5">
          <p className="m-0 text-base text-alert">
            {notice.kind === 'link' ? PITCH_OWN_COPY.linkFailed : PITCH_OWN_COPY.tickFailed}
          </p>
          <ErrorBanner {...notice.error} />
        </div>
      )}

      <p role="status" className="sr-only">{said}</p>
    </article>
  );
}
