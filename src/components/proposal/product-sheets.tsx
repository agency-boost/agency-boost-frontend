'use client';

import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { TonePill } from '@/components/ui/tone-pill';
import { useMessages } from '@/i18n/language-provider';
import { proposalMessages } from '@/i18n/messages/proposal';
import { cn } from '@/lib/cn';
import type { CatalogFaq, CatalogPlan, ProposalChannel } from '@/lib/proposals';

/**
 * ***Lihat semua plan*** (AC-8; Acc. 13): one card per plan, **stacked** — never a wide table, so nothing scrolls sideways
 * at 375 px — in the catalogue's order, cheapest to richest. Each: the plan's name, its three or four highlights (the
 * office's approved ones, else the company's; ADR-0225 §5), *"Premi: lihat ilustrasi resmi"* (*Kontribusi* on a
 * *Syariah* proposal), and *Paling banyak dipilih* on the one the owner marked. A tap chooses it.
 */
export function PlanSheet({
  open, product, plans, channel, chosen, readOnly, onChoose, onClose,
}: {
  open: boolean;
  product: string;
  plans: readonly CatalogPlan[];
  channel: ProposalChannel;
  chosen: string | null;
  readOnly: boolean;
  onChoose: (name: string) => void;
  onClose: () => void;
}) {
  const t = useMessages(proposalMessages).plans;
  return (
    <ResponsiveSheet open={open} title={t.title({ product })} onClose={onClose}>
      <ul data-plan-cards="" className="flex flex-col gap-2.5">
        {plans.map((plan) => {
          const on = plan.name === chosen;
          return (
            <li key={plan.name}>
              <button
                type="button"
                aria-pressed={on}
                disabled={readOnly}
                onClick={() => onChoose(plan.name)}
                className={cn(
                  'flex w-full min-w-0 flex-col gap-2 rounded-lg border-[1.5px] bg-card p-4 text-left disabled:cursor-not-allowed',
                  on ? 'border-secondary' : 'border-hairline hover:border-secondary',
                )}
              >
                <span className="flex w-full flex-wrap items-center gap-2">
                  <span className="text-md font-bold text-ink">{plan.name}</span>
                  {plan.popular && <TonePill tone="amber">{t.popular}</TonePill>}
                  {on && <TonePill tone="blue">{t.chosen}</TonePill>}
                </span>
                <span className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm">
                  {plan.highlights.map((h) => (
                    <span key={h.label} className="contents">
                      <span className="text-muted">{h.label}</span>
                      <span className="text-right font-semibold text-ink">{h.value}</span>
                    </span>
                  ))}
                </span>
                <span className="text-sm text-muted">{channel === 'syariah' ? t.contribution : t.premium}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </ResponsiveSheet>
  );
}

/**
 * ***Tanya-jawab*** (AC-9; Acc. 14): the product's FAQ, for the agent to read before answering — the office's approved
 * one, else the company's. **Never on the PDF.** The link that opens it is not drawn when there is none.
 */
export function FaqSheet({ open, product, faq, onClose }: {
  open: boolean;
  product: string;
  faq: readonly CatalogFaq[];
  onClose: () => void;
}) {
  const t = useMessages(proposalMessages).faq;
  return (
    <ResponsiveSheet open={open} title={t.title({ product })} onClose={onClose}>
      <dl data-faq="" className="flex flex-col gap-4">
        {faq.map((entry) => (
          <div key={entry.question}>
            <dt className="text-md font-bold text-ink">{entry.question}</dt>
            <dd className="mt-1 whitespace-pre-line text-md text-muted">{entry.answer}</dd>
          </div>
        ))}
      </dl>
    </ResponsiveSheet>
  );
}
