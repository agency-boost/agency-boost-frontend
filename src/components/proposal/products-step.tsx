'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useState } from 'react';
import { ErrorBanner } from '@/components/ui/field';
import { FLOATING_BAR_BUTTON, FLOATING_BAR_ROOM, FloatingBar } from '@/components/ui/floating-bar';
import { LineIcon } from '@/components/ui/line-icon';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useMessages } from '@/i18n/language-provider';
import { leadsMessages } from '@/i18n/messages/leads';
import { proposalMessages } from '@/i18n/messages/proposal';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  addProposalItem, patchProposalItem, PROPOSAL_ITEMS_MAX, proposalCatalog, proposalHref, removeProposalItem,
  type CatalogProduct, type ProposalCatalog, type ProposalItemPatch,
} from '@/lib/proposals';
import { CHIP, CHIP_OFF, CHIP_ON, ItemPanel } from './item-panel';
import { SaveLine, StepHeading } from './proposal-frame';
import type { ProposalEditor } from './use-proposal';

/**
 * **Step 2, *Produk*** (P19.14-T2 AC-1 to AC-6; ADR-0255; the 11 Nov spec's *Step 2*). **No proposal-wide settings**: no
 * *Konvensional / Syariah* switch — a syariah product is a product of its own — and no proposal-wide *Cara bayar*.
 *
 * - **The client's line** at the top — *"✓ Pak Budi · 35 th · Laki-laki · ada di Leads"* — taps back to step 1.
 * - **A search box and chips by category** (*Semua* and each product's type label), then the products as chips: a tap
 *   adds a card, a second tap removes it. **A product the client's age cannot enter is greyed** with *"Usia 35 di luar
 *   batas (21–70)"* and cannot be added (the server's `outOfAge`). A sixth cannot be added. With nothing to offer:
 *   *"Belum ada produk — minta Owner menambahkannya"*, never an error.
 * - **The cards** (`ItemPanel`) under the list, each with its own *Tertanggung*, fields, pay term, *Cara bayar* and
 *   amounts; every change saved through the editor's queue, pinned.
 * - ***Lihat proposal***, the floating pill, opens the result — the PDF — once a product has a premium.
 */
export function ProductsStep({ editor, readOnly, onNext }: { editor: ProposalEditor; readOnly: boolean; onNext: () => void }) {
  const t = useMessages(proposalMessages);
  const genders = useMessages(leadsMessages).sheet.genders;
  const { show } = useToast();
  const uid = useId();
  const proposal = editor.proposal!;
  const [catalog, setCatalog] = useState<ProposalCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<ApiError | null>(null);
  const [term, setTerm] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const clientAge = proposal.client.age;

  useEffect(() => {
    let live = true;
    setCatalog(null);
    setCatalogError(null);
    proposalCatalog(clientAge)
      .then((next) => { if (live) setCatalog(next); })
      .catch((err) => { if (live) setCatalogError(toDisplayError(err)); });
    return () => { live = false; };
  }, [clientAge]);

  const offered = (productId: string): CatalogProduct | null =>
    catalog?.products.find((p) => p.productId === productId) ?? null;
  const added = (productId: string) => proposal.items.find((i) => i.productId === productId) ?? null;
  const full = proposal.items.length >= PROPOSAL_ITEMS_MAX;

  const categories = useMemo(
    () => [...new Set((catalog?.products ?? []).map((p) => p.typeLabel))],
    [catalog],
  );
  const needle = term.trim().toLowerCase();
  const shown = (catalog?.products ?? []).filter((p) =>
    (category === null || p.typeLabel === category) && (needle === '' || p.name.toLowerCase().includes(needle)));

  const tap = async (product: CatalogProduct) => {
    if (readOnly) return;
    const item = added(product.productId);
    if (item) { void editor.write((v) => removeProposalItem(proposal.id, item.itemId, v)); return; }
    if (full || product.outOfAge) return;
    await editor.write((v) => addProposalItem(proposal.id, v, product.productId));
  };

  const patchItem = (itemId: string) => (body: ProposalItemPatch) => {
    const before = proposal.items.find((i) => i.itemId === itemId);
    void editor.write((v) => patchProposalItem(proposal.id, itemId, v, body)).then((answer) => {
      // A change of *Cara bayar* empties that card's premium (ADR-0255 §2): say so, once.
      if (answer && body.payFrequency && before?.premium) show(t.panel.payChanged);
    });
  };
  const remove = (itemId: string) => { void editor.write((v) => removeProposalItem(proposal.id, itemId, v)); };

  const ready = proposal.items.some((i) => i.premium !== null && i.premium.amountMinor > 0);
  const fullId = `${uid}-full`;
  const waitId = `${uid}-wait`;
  const gender = proposal.client.gender ? genders[proposal.client.gender] : '';
  return (
    <div className={FLOATING_BAR_ROOM}>
      <StepHeading>{t.products.heading}</StepHeading>

      <Link
        href={proposalHref(proposal.id, 1)}
        data-client-line=""
        title={t.products.clientLineHint}
        className="mb-4 flex min-h-12 items-center gap-2 rounded-lg bg-card px-4 py-2 text-md font-semibold text-navy hover:bg-secondary/[0.06]"
      >
        <span className="min-w-0 flex-1">
          {t.products.clientLine({ name: proposal.client.name, age: clientAge ?? 0, gender })}
        </span>
        <LineIcon name="pencil" className="h-4 w-4 shrink-0 text-muted" />
        <span className="sr-only">{t.products.clientLineHint}</span>
      </Link>

      <SaveLine save={editor.save} conflict={editor.conflict} onRetry={editor.retry} />
      {editor.refusal && <div className="mb-3"><ErrorBanner {...editor.refusal} /></div>}
      {catalogError && <div className="mb-3"><ErrorBanner {...catalogError} /></div>}

      {!catalog && !catalogError && (
        <Skeleton label={t.products.loading}>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-12 w-32 rounded-pill bg-card"><SkeletonBar className="w-2/3" /></div>)}
          </div>
        </Skeleton>
      )}
      {catalog && catalog.products.length === 0 && (
        <p data-no-products="" className="rounded-lg bg-card px-4 py-8 text-center text-md text-muted">{t.products.noProducts}</p>
      )}
      {catalog && catalog.products.length > 0 && (
        <div className="mb-4 flex flex-col gap-3">
          <div className="relative">
            <LineIcon name="search" className="pointer-events-none absolute left-4 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-signal-grey" />
            <input
              type="search"
              aria-label={t.products.searchName}
              placeholder={t.products.searchPlaceholder}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="h-12 w-full rounded-pill border-0 bg-card pl-11 pr-4 text-md text-ink"
            />
          </div>
          {categories.length > 1 && (
            <div role="group" aria-label={t.products.categoriesLabel} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {[null, ...categories].map((c) => (
                <button
                  key={c ?? 'all'}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                  className={cn(CHIP, 'shrink-0 whitespace-nowrap', category === c ? CHIP_ON : CHIP_OFF)}
                >
                  {c === null ? t.products.all : c}
                </button>
              ))}
            </div>
          )}
          {full && <p id={fullId} className="text-sm text-muted">{t.products.full({ max: PROPOSAL_ITEMS_MAX })}</p>}
          {shown.length === 0 && <p className="px-1 py-4 text-center text-md text-muted">{t.products.noMatch({ term: term.trim() })}</p>}
          <ul aria-label={t.products.cardsLabel} className="flex flex-wrap gap-2">
            {shown.map((product) => {
              const on = added(product.productId) !== null;
              const blocked = !on && (product.outOfAge || full);
              const reasonId = `${uid}-${product.productId}-age`;
              return (
                <li key={product.productId} className="min-w-0 max-w-full">
                  <button
                    type="button"
                    data-product-chip={product.code}
                    aria-pressed={on}
                    aria-describedby={product.outOfAge && !on ? reasonId : !on && full ? fullId : undefined}
                    disabled={readOnly || blocked}
                    onClick={() => { void tap(product); }}
                    className={cn(
                      'flex min-h-12 max-w-full flex-col items-start justify-center rounded-lg px-4 py-2 text-left',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                      on ? CHIP_ON : CHIP_OFF,
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-md font-semibold">
                      {on && <LineIcon name="check" className="h-4 w-4 shrink-0" />}
                      {product.name}
                      {on && <span className="sr-only">, {t.products.added}</span>}
                    </span>
                    {product.outOfAge && product.entryAge && clientAge !== null && (
                      <span id={reasonId} className="text-sm font-normal">
                        {t.products.outOfAge({ age: clientAge, min: product.entryAge.min, max: product.entryAge.max })}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {proposal.items.map((item) => (
          <ItemPanel
            key={item.itemId}
            proposal={proposal}
            item={item}
            offered={offered(item.productId)}
            readOnly={readOnly}
            onPatch={patchItem(item.itemId)}
            onRemove={() => remove(item.itemId)}
          />
        ))}
      </div>

      <FloatingBar wide="pill" pillClassName="justify-end">
        <button
          type="button"
          className={cn(FLOATING_BAR_BUTTON, 'min-h-12 flex-1')}
          disabled={!ready}
          aria-describedby={!ready ? waitId : undefined}
          onClick={onNext}
        >
          {t.products.seeProposal}
        </button>
        {!ready && <span id={waitId} className="sr-only">{t.products.seeProposalWait}</span>}
      </FloatingBar>
    </div>
  );
}
