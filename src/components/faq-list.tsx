'use client';

import { Button, Field, Textarea, TextInput } from '@/components/ui/field';
import { ReorderArrows } from '@/components/ui/reorder-arrows';
import { useMessages } from '@/i18n/language-provider';
import { adminProductProposalMessages } from '@/i18n/messages/admin-product-proposal';
import { PROPOSAL_LIMITS, type FaqEntry } from '@/lib/admin';

/*
 * **A module of its own** (the bundle, 2026-11-06; `performance-and-scale.md`): an office's *Produk* settings draws this
 * list and none of the Super Admin's proposal editor (`product-proposal-editor.tsx`), which it loaded whole for it. The
 * row helpers and the two card classes are the editor's too, so a question and a plan card stay the same card.
 */

/** A row moved one place up or down; past either end, the rows as they were. */
export const moveRow = <T,>(rows: T[], from: number, by: -1 | 1): T[] => {
  const to = from + by;
  if (to < 0 || to >= rows.length) return rows;
  const next = [...rows];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
};
export const withoutRow = <T,>(rows: T[], at: number) => rows.filter((_, i) => i !== at);
export const replaceRow = <T,>(rows: T[], at: number, row: T) => rows.map((r, i) => (i === at ? row : r));

export const PROPOSAL_CARD = 'mt-3 rounded-md border border-hairline bg-card p-3';
export const PROPOSAL_H4 = 'text-sm font-semibold text-navy';

/**
 * ***Tanya-jawab*, as a list of questions and answers** (ADR-0225 §1, §5): added, edited, removed and moved with ↑ / ↓ —
 * the Super Admin's on a product, and an office's own on its *Produk* settings, the same control.
 */
export function FaqList({
  idPrefix,
  entries,
  onChange,
  disabled = false,
  hint,
}: {
  idPrefix: string;
  entries: FaqEntry[];
  onChange: (next: FaqEntry[]) => void;
  disabled?: boolean;
  /** Under the heading: whose it is, on an office's settings. */
  hint?: string;
}) {
  const t = useMessages(adminProductProposalMessages);
  return (
    <div data-faq-list="">
      <h4 className={`mt-4 ${PROPOSAL_H4}`}>{t.faq}</h4>
      <p className="text-sm text-muted">{hint ?? t.faqHint}</p>
      <ol className="flex flex-col">
        {entries.map((entry, at) => (
          <li key={at} className={PROPOSAL_CARD}>
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-60 flex-1">
                <Field label={t.question({ n: at + 1 })} htmlFor={`${idPrefix}-${at}-q`}>
                  <TextInput id={`${idPrefix}-${at}-q`} value={entry.question} maxLength={200} disabled={disabled}
                    onChange={(e) => onChange(replaceRow(entries, at, { ...entry, question: e.target.value }))} />
                </Field>
                <Field label={t.answer({ n: at + 1 })} htmlFor={`${idPrefix}-${at}-a`} className="mt-2">
                  <Textarea id={`${idPrefix}-${at}-a`} rows={3} value={entry.answer} maxLength={1000} disabled={disabled}
                    onChange={(e) => onChange(replaceRow(entries, at, { ...entry, answer: e.target.value }))} />
                </Field>
              </div>
              <span className="flex items-center">
                <ReorderArrows label={t.questionName({ n: at + 1 })} index={at} count={entries.length} disabled={disabled}
                  onMove={(by) => onChange(moveRow(entries, at, by))} />
                <Button variant="inlineDanger" disabled={disabled} onClick={() => onChange(withoutRow(entries, at))}>
                  {t.removeQuestion({ n: at + 1 })}
                </Button>
              </span>
            </div>
          </li>
        ))}
      </ol>
      <Button variant="inline" className="mt-2" disabled={disabled || entries.length >= PROPOSAL_LIMITS.FAQ}
        onClick={() => onChange([...entries, { question: '', answer: '' }])}>
        {t.addQuestion}
      </Button>
    </div>
  );
}
