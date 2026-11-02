'use client';

import { useId, useRef, useState } from 'react';
import { ErrorBanner } from '@/components/ui/field';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { useMessages } from '@/i18n/language-provider';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  callLink, nationalDigits, normalisedPhone, PHONE_COUNTRY_PREFIX, PHONE_NATIONAL_DIGITS, phoneFieldValue, whatsAppHref,
} from '@/lib/phone-number';

/** What opens once a number is saved: WhatsApp's chat or the dialler. */
export type Channel = 'whatsapp' | 'call';

/*
 * **The sheet in a module of its own** (P18.99-T16, the bundle): `ContactButtons` and New hire detail load it with
 * `next/dynamic` when it is first needed; the lead sheet, itself loaded on demand, imports it.
 */

/**
 * ***Isi nomor WhatsApp*** (UI V1, UI-081; D-22, D-01): a bottom sheet on a phone and a tablet, a small centred dialog
 * on a desktop (`ResponsiveSheet`).
 *
 * The person's name under the title; **one field after a fixed *+62***, `inputmode="tel"`, 16px, focused on open;
 * **one pinned *Simpan***. What was typed is read as the server reads it (`nationalDigits`): a leading 0, +62, spaces and
 * dashes go, and **9 to 13 digits** are kept — else an inline error under the field, and nothing is sent. Saved, it
 * hands the stored number back and **opens WhatsApp or the dialler at once**: WhatsApp's tab is opened while the tap
 * is still a tap, so a browser does not block it as a pop-up, and is pointed at the chat once the number has landed.
 */
export function PhoneNumberSheet({
  open,
  name,
  phone,
  onClose,
  onSave,
  onSaved,
  then = 'whatsapp',
  whatsAppText,
}: {
  open: boolean;
  name: string;
  phone?: string | null;
  onClose: () => void;
  onSave: (phone: string) => Promise<string>;
  onSaved: (stored: string) => void;
  /** What opens once it is saved; `null` opens nothing (a profile's own field). */
  then?: Channel | null;
  whatsAppText?: string;
}) {
  const t = useMessages(uiV1Messages);
  const formId = useId();
  const fieldId = useId();
  const errorId = useId();
  const field = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(() => phoneFieldValue(phone));
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const stored = normalisedPhone(typed);
    if (stored === null) {
      setInvalid(true);
      field.current?.focus();
      return;
    }
    setInvalid(false);
    setError(null);
    setSaving(true);
    // Opened during the tap, pointed at the chat after the save (a tab opened after an `await` is a blocked pop-up).
    const tab = then === 'whatsapp' && typeof window.open === 'function' ? window.open('', '_blank') : null;
    // The chat never reaches back into the app through `window.opener`.
    if (tab) tab.opener = null;
    try {
      const answer = await onSave(stored);
      onSaved(answer);
      if (then === 'whatsapp') {
        const href = whatsAppHref(answer, whatsAppText);
        if (href && tab) tab.location.href = href;
        else if (href) window.location.assign(href);
      } else if (then === 'call') {
        const href = callLink(answer);
        if (href) window.location.assign(href);
      }
    } catch (err) {
      tab?.close();
      setError(toDisplayError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveSheet
      open={open}
      title={t.contact.sheetTitle}
      description={name}
      onClose={onClose}
      initialFocus={field}
      footer={(
        <button
          type="submit"
          form={formId}
          disabled={saving}
          className="min-h-12 w-full rounded-pill bg-amber px-5 text-md font-bold text-navy hover:bg-amber-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? t.contact.saving : t.contact.save}
        </button>
      )}
    >
      <form id={formId} onSubmit={submit} noValidate className="pb-2">
        <label htmlFor={fieldId} className="mb-1.5 block text-base font-semibold text-navy">{t.contact.field}</label>
        <div
          className={cn(
            'flex h-12 items-center overflow-hidden rounded-md border bg-card focus-within:border-amber focus-within:ring-2 focus-within:ring-amber',
            invalid ? 'border-alert' : 'border-line',
          )}
        >
          <span aria-hidden="true" className="flex h-full items-center border-r border-line bg-base px-3 text-[1rem] font-semibold text-muted">
            {PHONE_COUNTRY_PREFIX}
          </span>
          <input
            ref={field}
            id={fieldId}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
              if (invalid && nationalDigits(e.target.value) !== null) setInvalid(false);
            }}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-[1rem] text-ink outline-none focus-visible:outline-none"
          />
        </div>
        {invalid && (
          <p id={errorId} className="mt-1.5 text-base text-alert">
            {t.contact.invalid(PHONE_NATIONAL_DIGITS)}
          </p>
        )}
        {error && <div className="mt-3"><ErrorBanner {...error} /></div>}
      </form>
    </ResponsiveSheet>
  );
}
