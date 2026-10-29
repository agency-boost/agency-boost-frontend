'use client';

import { useId, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button, Field, TextInput } from '@/components/ui/field';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { billingMessages } from '@/i18n/messages/billing';
import {
  maskDate, parseDmy, planEnd, toDmy, validateQuote,
  type BillingPeriod, type QuoteDetails, type QuoteErrors,
} from '@/lib/billing';

/**
 * *Send quote* (`#quote-modal`, `Billing_Subscription.html:374-415`): the product's `Modal`, where the
 * prototype's overlay had no dialog role, no focus management and no Escape (a Fix, ADR-0111 §5).
 *
 * **Mounted afresh on every open**, so the dates start from the page's defaults and no old error
 * survives; the three names are the page's, so reopening keeps them as the prototype does (`:597-607`).
 *
 * - The fields, placeholders and the three messages verbatim; the dates typed as `DD/MM/YYYY`, the
 *   slashes inserted as they are typed (`formatDateInput`, `:589-595`).
 * - **The end follows the start until the end is typed into** (`:613-623`), at the start + the chosen
 *   period − 1 day (a Fix: the prototype added a year either way, `:579`).
 * - *Generate quote* refuses an empty name, an impossible date and an end before the start, each with a
 *   sentence under its field, and moves the focus to the first it refused.
 */
export function QuoteDialog({
  period, names, dates, onNames, onCancel, onGenerate,
}: {
  period: BillingPeriod;
  /** The three names, held by the page across opens. */
  names: Pick<QuoteDetails, 'kpm' | 'pic' | 'sales'>;
  /** The two dates the dialog opens on. */
  dates: Pick<QuoteDetails, 'start' | 'end'>;
  onNames: (names: Pick<QuoteDetails, 'kpm' | 'pic' | 'sales'>) => void;
  onCancel: () => void;
  onGenerate: (details: QuoteDetails) => void;
}) {
  const id = useId();
  const COPY = useMessages(billingMessages).prototype;
  const language = useLanguage();
  const [start, setStart] = useState(dates.start);
  const [end, setEnd] = useState(dates.end);
  const [endEdited, setEndEdited] = useState(false);
  const [errors, setErrors] = useState<QuoteErrors>({});
  const fieldId = (name: keyof QuoteDetails) => `${id}-${name}`;

  const typeStart = (text: string) => {
    const masked = maskDate(text);
    setStart(masked);
    const day = parseDmy(masked);
    if (day && !endEdited) setEnd(toDmy(planEnd(day, period)));
  };

  const generate = () => {
    const details = { ...names, start, end };
    const found = validateQuote(details, language);
    setErrors(found);
    const first = (['kpm', 'pic', 'sales', 'start', 'end'] as const).find((name) => found[name]);
    if (first) {
      document.getElementById(fieldId(first))?.focus();
      return;
    }
    onGenerate(details);
  };

  const nameField = (name: 'kpm' | 'pic' | 'sales', label: string, placeholder: string) => (
    <Field label={label} htmlFor={fieldId(name)} error={errors[name]} className="mb-4">
      <TextInput
        id={fieldId(name)}
        value={names[name]}
        placeholder={placeholder}
        invalid={Boolean(errors[name])}
        onChange={(e) => onNames({ ...names, [name]: e.target.value })}
        className="w-full bg-base"
      />
    </Field>
  );

  const dateField = (name: 'start' | 'end', label: string, value: string, onType: (text: string) => void) => (
    <Field label={label} htmlFor={fieldId(name)} error={errors[name]} className="mb-4 min-w-0 flex-1">
      <TextInput
        id={fieldId(name)}
        type="text"
        inputMode="numeric"
        maxLength={10}
        placeholder={COPY.datePlaceholder}
        value={value}
        invalid={Boolean(errors[name])}
        onChange={(e) => onType(e.target.value)}
        className="w-full bg-base"
      />
    </Field>
  );

  return (
    <Modal
      open
      title={COPY.sendQuote}
      description={COPY.dialogLine}
      onClose={onCancel}
      footer={(
        // 6px under the last field's own 16px, as drawn: the foot's padding less 10px.
        <div className="-mt-2.5 flex flex-wrap gap-2.5">
          <Button type="submit" form={`${id}-form`}>{COPY.generate}</Button>
          <Button variant="secondary" onClick={onCancel}>{COPY.cancel}</Button>
        </div>
      )}
    >
      <form
        id={`${id}-form`}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          generate();
        }}
      >
        {nameField('kpm', COPY.kpmName, COPY.kpmPlaceholder)}
        {nameField('pic', COPY.picName, COPY.picPlaceholder)}
        {nameField('sales', COPY.salesBy, COPY.salesPlaceholder)}
        <div className="flex gap-3">
          {dateField('start', COPY.startDate, start, typeStart)}
          {dateField('end', COPY.endDate, end, (text) => {
            setEnd(maskDate(text));
            setEndEdited(true);
          })}
        </div>
      </form>
    </Modal>
  );
}
