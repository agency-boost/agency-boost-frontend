'use client';

import { useEffect, useId, useRef } from 'react';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import type { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatDay } from '@/lib/format';
import { whatsAppLink, type Lead } from '@/lib/leads';

/** What the table hands the dialog for the three text fields: its drafts, and its one-field write. */
export interface DetailsEditor {
  /** What is in the box — the typing if there is any, otherwise what is stored. */
  value: (field: DetailsField, stored: string | null) => string;
  change: (field: DetailsField, value: string) => void;
  /** Leaving a field commits it, when it changed. */
  commit: (field: DetailsField) => void;
}

export type DetailsField = 'phone' | 'email' | 'source';

/** Everything a keyboard can land on inside the box, in document order. */
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Everything about a lead that is not a pipeline field (P13.1-T4 AC-2, ADR-0108 §2).
 *
 * **What the client asked for on 2026-10-07**, out of what was *Contact details for {name}*: the phone,
 * the email and where they came from as before; *Registered {date}*, moved here from the table's last
 * column; *Last changed by {name}*, moved here from a ✎ in the Actions column (ADR-0044 still decides
 * when it shows — the table works that out and hands it over); and a WhatsApp button. *Why you may hold
 * these* went, with the server rule it answered (ADR-0108 §1). Renamed *Lead details* for what it now
 * holds.
 *
 * **WhatsApp opens a chat with the number in the box** — what the reader sees, typing included, read by
 * `whatsAppNumber`: digits only, Indonesia's `62` in front. A link, because it navigates, to a new tab,
 * and with no opener: the chat is somebody else's page. No number WhatsApp could open, no button.
 *
 * **Its own component, not `ui/dialog.tsx` with a content slot.** That one is confirmations only,
 * deliberately (F-72): a `children` prop is how the two forms I-21 and I-25 moved *out* of modals get
 * put back. It keeps that one's manners: focus moves in and comes back to the ⋮ that opened it, Tab
 * stays inside, and Escape or the backdrop closes it.
 *
 * Every field saves as it is left, exactly as a cell of the table does, and whatever the server refuses
 * is shown here while the dialog is open and beneath the lead once it is closed. **Read-only** under a
 * finalized coaching session's lock: the boxes hold what is stored and save nothing, and the WhatsApp
 * button still opens the chat — reading a number is not writing one.
 */
export function LeadDetailsDialog({
  lead,
  saving,
  errors,
  editor,
  editedBy,
  readOnly = false,
  onClose,
}: {
  lead: Lead;
  /** A write on this lead is in flight. The fields hold still rather than lose focus. */
  saving: boolean;
  /** Every refusal still standing on this lead — one per field it concerns, repeats removed. */
  errors: readonly ApiError[];
  editor: DetailsEditor;
  /** *Last changed by {name}*, when ADR-0044 says the reader is to be told — `null` when not. */
  editedBy: string | null;
  /** A finalized session's lock: nothing here writes. */
  readOnly?: boolean;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const id = useId();

  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => returnTo?.focus?.();
  }, []);

  /**
   * **Leaving by Escape still leaves the field.** Removing a focused input fires no `blur`, so the
   * one field still being typed in would close unsaved — the only edit here that is not committed
   * as it is left. Blurring first commits it the way Tab would have.
   */
  const close = () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    onClose();
  };

  const trap = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const stops = [...(box.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
      .filter((el) => !el.hasAttribute('disabled'));
    const [first, last] = [stops[0], stops[stops.length - 1]];
    const edge = e.shiftKey ? first : last;
    if (document.activeElement === edge) {
      (e.shiftKey ? last : first)?.focus();
      e.preventDefault();
    }
  };

  const text = (field: DetailsField, label: string, stored: string | null, extra: {
    type?: string; placeholder?: string; after?: React.ReactNode;
  } = {}) => (
    <Field label={label} htmlFor={`${id}-${field}`}>
      <div className={cn(extra.after ? 'flex items-center gap-2' : undefined)}>
        <TextInput
          id={`${id}-${field}`}
          type={extra.type}
          placeholder={readOnly ? undefined : extra.placeholder}
          className={cn(extra.after ? 'min-w-0 flex-1' : 'w-full')}
          value={readOnly ? stored ?? '' : editor.value(field, stored)}
          // `readOnly`, not `disabled`: a disabled field drops the focus it holds, and a focus that
          // falls out of a modal lands on the page behind it.
          readOnly={saving || readOnly}
          onChange={(e) => {
            if (!readOnly) editor.change(field, e.target.value);
          }}
          onBlur={() => {
            if (!readOnly) editor.commit(field);
          }}
        />
        {extra.after}
      </div>
    </Field>
  );

  const phone = readOnly ? lead.contact.phone : editor.value('phone', lead.contact.phone);
  const chat = whatsAppLink(phone);
  const name = lead.name || 'this lead';

  return (
    // The backdrop closes; a click inside the box must not, or selecting a number to copy it
    // would dismiss the dialog it is in.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/35 p-5" onClick={close}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={trap}
        className="flex max-h-full w-full max-w-md flex-col gap-4 overflow-y-auto rounded-lg bg-card p-6 shadow-modal"
      >
        <h2 id={titleId} className="text-md font-bold text-navy">
          Lead details for {name}
        </h2>

        {text('phone', 'Phone', lead.contact.phone, {
          type: 'tel',
          after: chat && (
            <a
              href={chat}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Chat with ${name} on WhatsApp (opens in a new tab)`}
              className={cn(
                'inline-flex h-10 shrink-0 items-center justify-center rounded-md border border-success/40',
                'bg-card px-3 text-md font-semibold text-success hover:bg-success/[0.08]',
              )}
            >
              WhatsApp
            </a>
          ),
        })}
        {text('email', 'Email', lead.contact.email, { type: 'email' })}
        {text('source', 'Where they came from', lead.source, { placeholder: 'e.g. Referral from Desi' })}

        {/* Grey, as the table's `.registered-cell` had it (`Overall.html:501`): a fact, not a field. */}
        {(lead.dateRegistered || editedBy) && (
          <div className="flex flex-col gap-0.5 text-sm text-muted">
            {lead.dateRegistered && (
              <p>Registered <time dateTime={lead.dateRegistered}>{formatDay(lead.dateRegistered)}</time></p>
            )}
            {editedBy && <p>{editedBy}</p>}
          </div>
        )}

        {errors.map((error) => <ErrorBanner key={`${error.code} ${error.message}`} {...error} />)}

        <div className="flex justify-end">
          <Button variant="secondary" onClick={close}>Close</Button>
        </div>
      </div>
    </div>
  );
}
