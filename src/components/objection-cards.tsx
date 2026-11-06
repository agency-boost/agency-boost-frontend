'use client';

import { Button, Field, Textarea } from '@/components/ui/field';
import { useMessages } from '@/i18n/language-provider';
import { objectionCardsMessages } from '@/i18n/messages/objection-cards';
import { OBJECTIONS_MAX, type ObjectionCard } from '@/lib/admin';

/**
 * **The objection cards, edited** (P19.4-T4 AC-1, B1-1; ADR-0209 §9): *4 · If they push back* as a card per objection
 * — what the customer says and the reply, each a textarea that keeps its lines (B1-2) — with *"+ Tambah keberatan"*
 * below and a remove control on each. At most `OBJECTIONS_MAX`, the API's `PRODUCT_OBJECTIONS_MAX`; at the bound the
 * add says why it stopped. A card left blank is the caller's to drop on save.
 *
 * Two users: the company's *Produk* tab (`products-tab.tsx`) and an office's own list on *Settings › Products*. Each
 * passes its own legend, in its own words.
 */
export function ObjectionCards({
  idPrefix, legend, cards, onChange, disabled, hint,
}: {
  /** Unique on the page: each textarea's id is `${idPrefix}-objection-<n>` and `${idPrefix}-answer-<n>`. */
  idPrefix: string;
  legend: string;
  cards: readonly ObjectionCard[];
  onChange: (cards: ObjectionCard[]) => void;
  disabled?: boolean;
  /** A line under the legend — an office's *Yours* or *Following the company*. */
  hint?: string;
}) {
  const t = useMessages(objectionCardsMessages);
  const full = cards.length >= OBJECTIONS_MAX;
  const fullId = `${idPrefix}-objections-full`;
  const set = (index: number, side: keyof ObjectionCard, value: string) =>
    onChange(cards.map((card, i) => (i === index ? { ...card, [side]: value } : card)));
  return (
    <fieldset className="mt-3">
      <legend className="text-sm font-semibold text-navy">{legend}</legend>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      {cards.length === 0 && <p className="text-sm text-muted">{t.none}</p>}
      <ol className="mt-1 flex flex-col gap-3">
        {cards.map((card, index) => {
          const n = index + 1;
          return (
            <li key={index} className="rounded-md border border-hairline p-3" data-objection={n}>
              <Field label={t.objection({ n })} htmlFor={`${idPrefix}-objection-${n}`}>
                <Textarea
                  id={`${idPrefix}-objection-${n}`}
                  rows={2}
                  value={card.objection}
                  disabled={disabled}
                  onChange={(e) => set(index, 'objection', e.target.value)}
                />
              </Field>
              <Field label={t.answer({ n })} htmlFor={`${idPrefix}-answer-${n}`} className="mt-2">
                <Textarea
                  id={`${idPrefix}-answer-${n}`}
                  rows={3}
                  value={card.answer}
                  disabled={disabled}
                  onChange={(e) => set(index, 'answer', e.target.value)}
                />
              </Field>
              <Button
                variant="inlineDanger"
                className="mt-2"
                disabled={disabled}
                onClick={() => onChange(cards.filter((_, i) => i !== index))}
              >
                {t.remove({ n })}
              </Button>
            </li>
          );
        })}
      </ol>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          variant="inline"
          disabled={disabled || full}
          aria-describedby={full ? fullId : undefined}
          onClick={() => onChange([...cards, { objection: '', answer: '' }])}
        >
          {t.add}
        </Button>
        {full && <p id={fullId} className="m-0 text-xs text-muted">{t.full({ max: OBJECTIONS_MAX })}</p>}
      </div>
    </fieldset>
  );
}

/** The cards a save sends: each side trimmed, a card with neither side written dropped. */
export function objectionsToSave(cards: readonly ObjectionCard[]): ObjectionCard[] {
  return cards
    .map((card) => ({ objection: card.objection.trim(), answer: card.answer.trim() }))
    .filter((card) => card.objection !== '' || card.answer !== '');
}
