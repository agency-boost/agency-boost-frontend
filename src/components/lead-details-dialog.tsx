'use client';

import { useEffect, useId, useRef } from 'react';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { InlineSaveField, type InlineSaveStatusProps } from '@/components/ui/inline-save-status';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { leadsMessages } from '@/i18n/messages/leads';
import type { ApiError } from '@/lib/api-client';
import { formatDay } from '@/lib/format';
import type { Lead } from '@/lib/leads';
import { useScrollLock } from '@/lib/use-scroll-lock';

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
 * column; and *Last changed by {name}*, moved here from a ✎ in the Actions column (ADR-0044 still
 * decides when it shows — the table works that out and hands it over). *Why you may hold these* went,
 * with the server rule it answered (ADR-0108 §1). Renamed *Lead details* for what it now holds.
 *
 * **No WhatsApp button since 2026-10-26** (ADR-0161 §2): the client moved it into the table, beside the
 * row's ⋮, so a chat is one press from the list rather than two. The phone saved here is the number that
 * link opens.
 *
 * **Its own component, not `ui/dialog.tsx` with a content slot.** That one is confirmations only,
 * deliberately (F-72): a `children` prop is how the two forms I-21 and I-25 moved *out* of modals get
 * put back. It keeps that one's manners: focus moves in and comes back to the ⋮ that opened it, Tab
 * stays inside, and Escape or the backdrop closes it.
 *
 * Every field saves as it is left, exactly as a cell of the table does, and whatever the server refuses
 * is shown here while the dialog is open and beneath the lead once it is closed. **And says so under the
 * box** — *Saving…*, *Saved ✓*, *Couldn't save — retry* — as a cell does (P18.95-T1 AC-5). **Read-only** under a
 * finalized coaching session's lock: the boxes hold what is stored and save nothing.
 */
export function LeadDetailsDialog({
  lead,
  saving,
  errors,
  editor,
  editedBy,
  readOnly = false,
  status,
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
  /** Each box's save confirmation, the table's own for this lead (AC-5). */
  status?: (field: DetailsField) => InlineSaveStatusProps;
  onClose: () => void;
}) {
  const t = useMessages(leadsMessages);
  const figures = useFigureLanguage();
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const id = useId();

  // The table behind holds still while it is open (P18.96-T1 AC-2).
  useScrollLock(true);

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
    type?: string; placeholder?: string;
  } = {}) => (
    <Field label={label} htmlFor={`${id}-${field}`}>
      <InlineSaveField status={status?.(field) ?? { state: 'idle' }} label={label}>
        <TextInput
          id={`${id}-${field}`}
          type={extra.type}
          placeholder={readOnly ? undefined : extra.placeholder}
          className="w-full"
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
      </InlineSaveField>
    </Field>
  );

  const name = lead.name || t.thisLead;

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
        className="flex max-h-full w-full max-w-md flex-col gap-4 overflow-y-auto overscroll-contain rounded-lg bg-card p-6 shadow-modal"
      >
        <h2 id={titleId} className="text-md font-bold text-navy">{t.details.title({ who: name })}</h2>

        {text('phone', t.details.phone, lead.contact.phone, { type: 'tel' })}
        {text('email', t.details.email, lead.contact.email, { type: 'email' })}
        {text('source', t.details.source, lead.source, { placeholder: t.details.sourcePlaceholder })}

        {/* Grey, as the table's `.registered-cell` had it (`Overall.html:501`): a fact, not a field. */}
        {(lead.dateRegistered || editedBy) && (
          <div className="flex flex-col gap-0.5 text-sm text-muted">
            {lead.dateRegistered && (
              <p>
                {t.details.registered({
                  day: <time dateTime={lead.dateRegistered}>{formatDay(lead.dateRegistered, figures)}</time>,
                })}
              </p>
            )}
            {editedBy && <p>{editedBy}</p>}
          </div>
        )}

        {errors.map((error) => <ErrorBanner key={`${error.code} ${error.message}`} {...error} />)}

        <div className="flex justify-end">
          <Button variant="secondary" onClick={close}>{t.close}</Button>
        </div>
      </div>
    </div>
  );
}
