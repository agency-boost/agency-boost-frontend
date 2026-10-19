'use client';

import { useId, useState } from 'react';
import { PdfUploadNotice, usePdfUpload } from '@/components/recruitment/pdf-upload';
import { Button, ErrorBanner } from '@/components/ui/field';
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
   * Navy words on the amber tint, as the roster's *Watch closely* pill has them (parity I-116): no
   * amber in the palette clears 4.5:1 as small text on an amber ground. The tint and the dot carry
   * the colour; the words carry the meaning.
   */
  review: { pill: 'bg-amber/[0.14] text-navy', dot: 'bg-amber-dark' },
};

/**
 * The badge (`.status-badge`, `:681-696`): a word as well as a tint, always.
 *
 * The office reads the completion rule's four states; agents read only whether there is a file to
 * show, *Missing* or *Uploaded*, as the prototype's agent view draws it (`:696`).
 */
function badgeOf(slot: PitchSlot, audience: PitchAudience): { tone: Tone; label: string } {
  if (!slot.file || slot.state === 'missing') return { tone: 'alert', label: PITCH_COPY.missing };
  if (audience === 'agent') return { tone: 'success', label: PITCH_COPY.uploaded };
  if (slot.state === 'complete') return { tone: 'success', label: PITCH_COPY.complete };
  if (slot.state === 'partial') {
    const ticked = slot.checklist.filter((i) => i.ticked).length;
    return { tone: 'review', label: PITCH_COPY.confirmed(ticked, slot.checklist.length) };
  }
  return { tone: 'success', label: PITCH_COPY.uploaded };
}

function PitchBadge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      data-tone={tone}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 py-1',
        'text-xs font-bold uppercase tracking-wide',
        BADGE[tone].pill,
      )}
    >
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', BADGE[tone].dot)} />
      {label}
    </span>
  );
}

type Notice =
  | { kind: 'stale' }
  | { kind: 'tick'; error: ApiError }
  | { kind: 'link'; error: ApiError };

/**
 * One of the four documents (`.doc-card`, `Recruitment_Section.html:676-753`), for the office's page
 * and the agents' tab alike, from the same props (D-components).
 *
 * **What it draws is the server's**: the title, the checklist's labels, the state, the file's name,
 * size and day. A file's name is rendered as text — the prototype pours it through `innerHTML`
 * (contradiction 3). The slot's `line` is not drawn: the prototype defines it and never renders it,
 * as it never renders a slot's `tooltip` (`:676-727`).
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

  const tick = async (item: string, ticked: boolean) => {
    // A second press on a box whose first is still being written is ignored rather than refused:
    // disabling the box would drop the keyboard's focus with it.
    if (item in pending) return;
    setPending((now) => ({ ...now, [item]: ticked }));
    setNotice(null);
    setSaid('');
    try {
      onChanged?.(await setPitchConfirmation(slot.slot, item, ticked, slot.version));
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) {
        setNotice({ kind: 'stale' });
        onStale?.();
      } else {
        setNotice({ kind: 'tick', error: toDisplayError(err) });
      }
    } finally {
      setPending(({ [item]: _done, ...rest }) => rest);
    }
  };

  return (
    <article
      aria-labelledby={titleId}
      data-slot={slot.slot}
      data-state={slot.state}
      className={cn(
        'flex flex-col gap-3.5 rounded-lg border bg-card px-5 py-5 sm:px-6',
        missing ? 'border-dashed border-alert/35' : 'border-hairline',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={titleId} className="m-0 text-lg font-bold text-navy">{slot.title}</h2>
        <PitchBadge tone={badge.tone} label={badge.label} />
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
            return (
              <label
                key={item.code}
                htmlFor={id}
                className={cn(
                  'flex items-center gap-2.5 py-1.5',
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
                    onChange={(e) => void tick(item.code, e.target.checked)}
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
