'use client';

import { useEffect, useId, useRef } from 'react';
import { Button, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import type { ApiError } from '@/lib/api-client';
import { LAWFUL_BASIS_LABEL, type LawfulBasis, type Lead } from '@/lib/leads';

/** What the table hands the dialog for the three text fields: its drafts, and its one-field write. */
export interface ContactEditor {
  /** What is in the box — the typing if there is any, otherwise what is stored. */
  value: (field: ContactField, stored: string | null) => string;
  change: (field: ContactField, value: string) => void;
  /** Leaving a field commits it, when it changed. */
  commit: (field: ContactField) => void;
}

export type ContactField = 'phone' | 'email' | 'source';

/** Everything a keyboard can land on inside the box, in document order. */
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * A lead's contact details and the ground for holding them (P10.1-T4 AC-8, ADR-0063 §2).
 *
 * **A dialog, because the table has no room and the law has no exception.** A phone number or an
 * email belongs to somebody who never signed up to this platform, and UU 27/2022 asks on what
 * ground it is held — so the server refuses the details without a lawful basis
 * (`LEAD_CONSENT_REQUIRED`), and what is stored has to stay where it can be seen, corrected and
 * cleared. The prototype has no contact details at all (F-58); ADR-0062 §2 puts what a hard
 * requirement adds in the smallest form that serves it, and a glyph in the Actions column opening
 * this is that form. The details row it replaces widened every lead it was opened on (I-122).
 *
 * **Its own component, not `ui/dialog.tsx` with a content slot.** That one is confirmations only,
 * deliberately (F-72): a `children` prop is how the two forms I-21 and I-25 moved *out* of modals
 * get put back. This is the one form ADR-0063 decided belongs in a dialog, and naming it for what
 * it holds keeps the general component closed. It keeps that one's manners: focus moves in and
 * comes back to the glyph that opened it, Tab stays inside, and Escape or the backdrop closes it.
 *
 * **The lawful basis comes first**, because it is the question the other three wait on. Every
 * field saves as it is left, exactly as a cell of the table does, and whatever the server refuses
 * is shown here while the dialog is open and beneath the lead once it is closed. A phone number or
 * an email refused for want of a basis is not dropped: recording the basis sends it again (the
 * table does that, since it holds the typing), and until then the refusal stays beside it.
 */
export function LeadContactDialog({
  lead,
  saving,
  errors,
  editor,
  onLawfulBasis,
  onClose,
}: {
  lead: Lead;
  /** A write on this lead is in flight. The fields hold still rather than lose focus. */
  saving: boolean;
  /** Every refusal still standing on this lead — one per field it concerns, repeats removed. */
  errors: readonly ApiError[];
  editor: ContactEditor;
  onLawfulBasis: (value: LawfulBasis | null) => void;
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

  const text = (field: ContactField, label: string, stored: string | null, extra: {
    type?: string; placeholder?: string;
  } = {}) => (
    <Field label={label} htmlFor={`${id}-${field}`}>
      <TextInput
        id={`${id}-${field}`}
        type={extra.type}
        placeholder={extra.placeholder}
        value={editor.value(field, stored)}
        // `readOnly`, not `disabled`: a disabled field drops the focus it holds, and a focus that
        // falls out of a modal lands on the page behind it.
        readOnly={saving}
        onChange={(e) => editor.change(field, e.target.value)}
        onBlur={() => editor.commit(field)}
      />
    </Field>
  );

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
        className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-card p-6 shadow-modal"
      >
        <h2 id={titleId} className="text-md font-bold text-navy">
          Contact details for {lead.name || 'this lead'}
        </h2>

        <Field
          label="Why you may hold these"
          htmlFor={`${id}-basis`}
          hint="Required before a phone number or an email is stored."
        >
          <Select
            id={`${id}-basis`}
            value={lead.lawfulBasis ?? ''}
            aria-disabled={saving || undefined}
            onChange={(e) => {
              if (saving) return;
              onLawfulBasis(e.target.value === '' ? null : (e.target.value as LawfulBasis));
            }}
          >
            <option value="">Not recorded</option>
            {(Object.keys(LAWFUL_BASIS_LABEL) as LawfulBasis[]).map((basis) => (
              <option key={basis} value={basis}>{LAWFUL_BASIS_LABEL[basis]}</option>
            ))}
          </Select>
        </Field>
        {text('phone', 'Phone', lead.contact.phone, { type: 'tel' })}
        {text('email', 'Email', lead.contact.email, { type: 'email' })}
        {text('source', 'Where they came from', lead.source, { placeholder: 'e.g. Referral from Desi' })}

        {errors.map((error) => <ErrorBanner key={`${error.code} ${error.message}`} {...error} />)}

        <div className="flex justify-end">
          <Button variant="secondary" onClick={close}>Close</Button>
        </div>
      </div>
    </div>
  );
}
