'use client';

import { useEffect, useId, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { ErrorBanner } from '@/components/ui/field';
import { FLOATING_BAR_BUTTON, FLOATING_BAR_ROOM, FloatingBar } from '@/components/ui/floating-bar';
import { LineIcon } from '@/components/ui/line-icon';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useMessages } from '@/i18n/language-provider';
import { proposalMessages } from '@/i18n/messages/proposal';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  addProposalItem, PAY_FREQUENCIES, patchProposal, patchProposalItem, PROPOSAL_CHANNELS, PROPOSAL_ITEMS_MAX,
  proposalCatalog, removeProposalItem, type CatalogProduct, type PayFrequency, type ProposalCatalog,
  type ProposalChannel, type ProposalItemPatch,
} from '@/lib/proposals';
import { CHIP, CHIP_OFF, CHIP_ON, ItemPanel } from './item-panel';
import { CategoryIcon, SaveLine, StepHeading } from './proposal-frame';
import type { ProposalEditor } from './use-proposal';

/**
 * **Step 2, *Pilih produk*** (AC-5 to AC-9; Acc. 7, 10–14, 17, 21; ADR-0221 §3, §9; ADR-0225 §7).
 *
 * - **Two settings, once per proposal**: *Konvensional / Syariah*, two large buttons, and *Cara bayar*, four chips,
 *   *Bulanan* first. A change of channel that would leave an added product outside it asks first — *"{n} produk tidak
 *   tersedia untuk pilihan ini dan akan dihapus."* — and the server takes those out in the same write. A change of *Cara
 *   bayar* empties every premium (*"Cara bayar diubah — isi lagi preminya."*): a monthly figure is not an annual one.
 * - **The cards** are the products the server offers for this channel and this client's age (`GET /proposals/catalog`):
 *   large, with the category's icon, the type label and the name. A tap adds one and a tick shows it; a tap on a ticked
 *   card opens its panel. A sixth cannot be added. With nothing to offer: *"Belum ada produk — minta Owner
 *   menambahkannya"*, never an error.
 * - **Every change is saved** through the editor's queue, pinned; *Lanjut* goes on to the PDF.
 */
export function ProductsStep({ editor, readOnly, onNext }: { editor: ProposalEditor; readOnly: boolean; onNext: () => void }) {
  const t = useMessages(proposalMessages);
  const { show } = useToast();
  const uid = useId();
  const proposal = editor.proposal!;
  const [catalog, setCatalog] = useState<ProposalCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<ApiError | null>(null);
  const [open, setOpen] = useState<string | null>(proposal.items.at(-1)?.itemId ?? null);
  const [asking, setAsking] = useState<{ n: number; apply: () => void } | null>(null);

  useEffect(() => {
    let live = true;
    setCatalog(null);
    setCatalogError(null);
    proposalCatalog(proposal.channel, proposal.client.age)
      .then((next) => { if (live) setCatalog(next); })
      .catch((err) => { if (live) setCatalogError(toDisplayError(err)); });
    return () => { live = false; };
  }, [proposal.channel, proposal.client.age]);

  const offered = (productId: string): CatalogProduct | null =>
    catalog?.products.find((p) => p.productId === productId) ?? null;
  const added = (productId: string) => proposal.items.find((i) => i.productId === productId) ?? null;
  const full = proposal.items.length >= PROPOSAL_ITEMS_MAX;

  const changeChannel = async (next: ProposalChannel) => {
    if (next === proposal.channel || readOnly) return;
    const apply = () => { void editor.write((v) => patchProposal(proposal.id, v, { channel: next })); };
    if (proposal.items.length === 0) { apply(); return; }
    try {
      const then = await proposalCatalog(next, proposal.client.age);
      const unfit = proposal.items.filter((i) => !then.products.some((p) => p.productId === i.productId)).length;
      if (unfit > 0) setAsking({ n: unfit, apply });
      else apply();
    } catch (err) {
      setCatalogError(toDisplayError(err));
    }
  };

  const changePay = async (next: PayFrequency) => {
    if (next === proposal.payFrequency || readOnly) return;
    const hadPremium = proposal.items.some((i) => i.premium.amountMinor !== null);
    const answer = await editor.write((v) => patchProposal(proposal.id, v, { payFrequency: next }));
    if (answer && hadPremium) show(t.products.payChanged);
  };

  const tap = async (product: CatalogProduct) => {
    const item = added(product.productId);
    if (item) { setOpen(item.itemId); return; }
    if (full || readOnly) return;
    const answer = await editor.write((v) => addProposalItem(proposal.id, v, product.productId));
    const last = answer?.items.at(-1);
    if (last) setOpen(last.itemId);
  };

  const patchItem = (itemId: string) => (body: ProposalItemPatch) => {
    void editor.write((v) => patchProposalItem(proposal.id, itemId, v, body));
  };
  const remove = (itemId: string) => {
    void editor.write((v) => removeProposalItem(proposal.id, itemId, v));
    if (open === itemId) setOpen(null);
  };

  const fullId = `${uid}-full`;
  return (
    <div className={FLOATING_BAR_ROOM}>
      <StepHeading>{t.products.heading}</StepHeading>

      <div data-proposal-settings="" className="mb-4 flex flex-col gap-4 rounded-lg bg-card p-4">
        <div role="group" aria-label={t.products.channelLabel} className="grid grid-cols-2 gap-2">
          {PROPOSAL_CHANNELS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={proposal.channel === c}
              disabled={readOnly}
              onClick={() => { void changeChannel(c); }}
              className={cn(CHIP, 'min-h-14 text-lg', proposal.channel === c ? CHIP_ON : CHIP_OFF)}
            >
              {t.products.channels[c]}
            </button>
          ))}
        </div>
        <div>
          <p id={`${uid}-pay`} className="mb-2 text-sm font-semibold text-navy">{t.products.payLabel}</p>
          <div role="group" aria-labelledby={`${uid}-pay`} className="flex flex-wrap gap-2">
            {PAY_FREQUENCIES.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={proposal.payFrequency === f}
                disabled={readOnly}
                onClick={() => { void changePay(f); }}
                className={cn(CHIP, proposal.payFrequency === f ? CHIP_ON : CHIP_OFF)}
              >
                {t.products.pay[f]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <SaveLine save={editor.save} conflict={editor.conflict} onRetry={editor.retry} />
      {editor.refusal && <div className="mb-3"><ErrorBanner {...editor.refusal} /></div>}
      {catalogError && <div className="mb-3"><ErrorBanner {...catalogError} /></div>}

      {!catalog && !catalogError && (
        <Skeleton label={t.products.loading}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg bg-card p-4"><SkeletonBar className="w-2/3" /><SkeletonBar className="mt-2 w-1/2" /></div>
            ))}
          </div>
        </Skeleton>
      )}
      {catalog && catalog.products.length === 0 && (
        <p data-no-products="" className="rounded-lg bg-card px-4 py-8 text-center text-md text-muted">{t.products.noProducts}</p>
      )}
      {catalog && catalog.products.length > 0 && (
        <>
          {full && <p id={fullId} className="mb-2 text-sm text-muted">{t.products.full({ max: PROPOSAL_ITEMS_MAX })}</p>}
          <ul aria-label={t.products.cardsLabel} className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3">
            {catalog.products.map((product) => {
              const on = added(product.productId) !== null;
              return (
                <li key={product.productId} className="min-w-0">
                  <button
                    type="button"
                    data-product-card={product.code}
                    aria-pressed={on}
                    aria-describedby={!on && full ? fullId : undefined}
                    disabled={readOnly || (!on && full)}
                    onClick={() => { void tap(product); }}
                    className={cn(
                      'relative flex min-h-[7.5rem] w-full flex-col items-start gap-2 rounded-lg border-[1.5px] bg-card p-3 text-left',
                      'disabled:cursor-not-allowed disabled:opacity-40',
                      on ? 'border-secondary' : 'border-transparent hover:border-hairline',
                    )}
                  >
                    <CategoryIcon category={product.category} />
                    <span className="text-xs font-bold uppercase tracking-wide text-muted">{product.typeLabel}</span>
                    <span className="text-md font-bold leading-snug text-ink">{product.name}</span>
                    {on && (
                      <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-secondary-contrast">
                        <LineIcon name="check" className="h-4 w-4" />
                        <span className="sr-only">{t.products.added}</span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="flex flex-col gap-2.5">
        {proposal.items.map((item) => (
          <ItemPanel
            key={item.itemId}
            proposal={proposal}
            item={item}
            offered={offered(item.productId)}
            open={open === item.itemId}
            readOnly={readOnly}
            onToggle={() => setOpen(open === item.itemId ? null : item.itemId)}
            onPatch={patchItem(item.itemId)}
            onRemove={() => remove(item.itemId)}
          />
        ))}
      </div>

      <FloatingBar wide="pill" pillClassName="justify-end">
        <button type="button" className={cn(FLOATING_BAR_BUTTON, 'min-h-12 flex-1')} onClick={onNext}>
          {t.next}
        </button>
      </FloatingBar>

      <Dialog
        open={asking !== null}
        message={asking ? t.products.willRemove({ n: asking.n }) : ''}
        confirmLabel={t.products.continue}
        cancelLabel={t.products.cancel}
        onConfirm={() => { asking?.apply(); setAsking(null); }}
        onCancel={() => setAsking(null)}
      />
    </div>
  );
}
