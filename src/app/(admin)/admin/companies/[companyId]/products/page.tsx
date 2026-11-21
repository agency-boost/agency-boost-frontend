'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { CompanyFrame, useCompany } from '@/components/kpm-template/company-frame';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ButtonLink, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Modal } from '@/components/ui/modal';
import { RowMenu } from '@/components/ui/rows-and-sheets';
import { SkeletonCards } from '@/components/ui/skeleton';
import { readProducts, type Product } from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  createProductDraft, discardProductDraft, listProductDrafts, withDraft, type ProductDraftView,
} from '@/lib/companies-console';
import { productDetailsHref, productHref, proposalHref } from '@/lib/template-sections';
import { useMessages } from '@/i18n/language-provider';
import { adminCompaniesConsoleMessages } from '@/i18n/messages/admin-companies-console';

const CATEGORIES = ['life', 'health', 'ci', 'education', 'investment'] as const;
type Category = (typeof CATEGORIES)[number];
/** The server's code rule (`CreateProductDto.code`). */
const CODE = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * **A company's page, tab *Produk & proposal*** (`/admin/companies/[companyId]/products`; P19.23-T4 AC-3; ADR-0278 §4;
 * frame 30): the catalogue per category — *Semua n · Jiwa n · Kesehatan n* as pills, then a heading per category with
 * its count and **the cards agents see**: the channel and currency chips, the name, its short description, *Ubah →* and
 * ⋯ — with *Draf* on a product whose edits wait or that no KPM has yet. *Tabel premi* opens the proposal data (ADR-0258);
 * *+ Produk baru* makes a product released to nobody (`POST …/products/drafts`) and opens it.
 *
 * ⋯ holds ***Detail lengkap*** — the full editor (riders, needs, bands, commission, lifecycle), kept and saving as it
 * always did (OD-423) — and *Hapus draf* where a draft waits. Withdrawn products are left off, as agents never see them.
 * Super Admin only (`product_catalog:crud`).
 */
export default function CompanyProductsPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = use(params);
  const t = useMessages(adminCompaniesConsoleMessages);
  const router = useRouter();
  const company = useCompany(companyId);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [drafts, setDrafts] = useState<Map<string, ProductDraftView>>(new Map());
  const [error, setError] = useState<ApiError | null>(null);
  const [filter, setFilter] = useState<'all' | Category>('all');
  const [adding, setAdding] = useState(false);
  const [discarding, setDiscarding] = useState<Product | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [rows, states] = await Promise.all([readProducts(companyId), listProductDrafts(companyId)]);
      setDrafts(new Map(states.map((d) => [d.id, d])));
      setProducts(rows.filter((p) => p.lifecycle !== 'withdrawn' && p.kind !== 'rider'));
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);

  const shown = (products ?? []).map((p) => withDraft(p, drafts.get(p.id)));
  const present = CATEGORIES.filter((c) => shown.some((p) => p.category === c));
  const sections = present.filter((c) => filter === 'all' || c === filter);

  async function discard(p: Product) {
    setDiscarding(null);
    try {
      await discardProductDraft(companyId, p.id);
      await load();
    } catch (err) {
      setError(toDisplayError(err));
    }
  }

  return (
    <CompanyFrame companyId={companyId} company={company} permission="product_catalog:crud" active="products">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div role="group" aria-label={t.products.filter} className="inline-flex flex-wrap gap-1 rounded-pill border border-card-edge bg-card p-1">
          {(['all', ...present] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                'min-h-10 rounded-pill px-3 text-md font-semibold',
                filter === key ? 'bg-secondary text-secondary-contrast' : 'text-muted hover:text-navy',
              )}
            >
              {key === 'all' ? t.products.all({ n: shown.length })
                : t.products.category({ label: t.products.categories[key], n: shown.filter((p) => p.category === key).length })}
            </button>
          ))}
        </div>
        <div className="flex gap-2 max-md:flex-col">
          <ButtonLink variant="secondary" href={proposalHref(companyId)} className="gap-1 max-md:w-full">
            <LineIcon name="grid" className="h-4 w-4" />
            {t.products.premiumTable}
          </ButtonLink>
          <Button className="gap-1 max-md:w-full" onClick={() => setAdding(true)}>
            <LineIcon name="plus" className="h-4 w-4" />
            {t.products.add}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex flex-col gap-2">
          <ErrorBanner {...error} />
          <Button variant="secondary" className="self-start" onClick={() => { void load(); }}>{t.retry}</Button>
        </div>
      )}
      {!error && products === null && <SkeletonCards count={4} label={t.products.loading} />}
      {products?.length === 0 && (
        <div className="rounded-lg border border-card-edge bg-card"><EmptyState title={t.products.empty} /></div>
      )}

      {sections.map((category) => {
        const rows = shown.filter((p) => p.category === category);
        return (
          <section key={category} aria-label={t.products.categories[category]} className="mb-6">
            <h2 className="mb-3 flex items-baseline gap-2 border-b border-divider pb-2">
              <span className="font-display text-lg font-bold text-navy">{t.products.categories[category]}</span>
              <span className="text-sm text-muted">{t.products.count({ n: rows.length })}</span>
            </h2>
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((p) => {
                const state = drafts.get(p.id)?.state ?? 'published';
                return (
                  <li key={p.id}>
                    <article data-product-card={p.code} className="flex h-full flex-col gap-2 rounded-lg border border-card-edge bg-card p-4">
                      <p className="flex flex-wrap items-center gap-1.5">
                        <Chip tone={p.channel === 'syariah' ? 'amber' : 'grey'}>{t.products.channels[p.channel]}</Chip>
                        {p.currencies.map((c) => <Chip key={c} tone="grey">{c}</Chip>)}
                        {state !== 'published' && <Chip tone="draft">{t.products.draft}</Chip>}
                      </p>
                      <h3 className="text-md font-bold text-navy">{p.name}</h3>
                      <p className="line-clamp-2 text-sm text-muted">{p.tagline}</p>
                      <div className="mt-auto flex items-center justify-between gap-2">
                        <Link href={productHref(companyId, p.id)} className="inline-flex min-h-10 items-center gap-1 text-md font-bold text-primary-ink">
                          {t.products.edit}
                          <LineIcon name="chevronRight" className="h-4 w-4" />
                        </Link>
                        <RowMenu
                          name={t.products.more({ name: p.name })}
                          items={[
                            { label: t.products.details, onSelect: () => router.push(`${productDetailsHref(companyId)}#${p.code}`) },
                            ...(state === 'draft' ? [{ label: t.products.discard, tone: 'alert' as const, onSelect: () => setDiscarding(p) }] : []),
                          ]}
                        />
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {adding && (
        <NewProductDialog
          companyId={companyId}
          onClose={() => setAdding(false)}
          onCreated={(id) => { setAdding(false); router.push(productHref(companyId, id)); }}
        />
      )}
      <Dialog
        open={discarding !== null}
        message={discarding ? t.products.discardAsk({ name: discarding.name }) : ''}
        confirmLabel={t.products.discard}
        cancelLabel={t.publish.cancel}
        tone="danger"
        onCancel={() => setDiscarding(null)}
        onConfirm={() => { if (discarding) void discard(discarding); }}
      />
    </CompanyFrame>
  );
}

/** A card's chip: the channel (syariah amber), a currency, or *Draf*. Words, never colour alone. */
function Chip({ tone, children }: { tone: 'grey' | 'amber' | 'draft'; children: string }) {
  return (
    <span
      className={cn(
        'rounded-pill px-2 py-0.5 text-xs font-bold uppercase tracking-wide',
        tone === 'grey' && 'bg-pill-grey text-navy',
        tone === 'amber' && 'bg-primary-50 text-primary-ink',
        tone === 'draft' && 'bg-primary-50 text-primary-ink normal-case',
      )}
    >
      {children}
    </span>
  );
}

/** ***+ Produk baru***: the code (typed once), the name, the category and the type; released to no KPM yet. */
function NewProductDialog({
  companyId, onClose, onCreated,
}: { companyId: string; onClose: () => void; onCreated: (productId: string) => void }) {
  const t = useMessages(adminCompaniesConsoleMessages);
  const formId = useId();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('life');
  const [channel, setChannel] = useState<Product['channel']>('conventional');
  const [pressed, setPressed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const codeError = pressed && !CODE.test(code.trim()) ? t.setup.required : undefined;
  const nameError = pressed && !name.trim() ? t.setup.required : undefined;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPressed(true);
    if (!CODE.test(code.trim()) || !name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const made = await createProductDraft(companyId, { code: code.trim().toUpperCase(), name: name.trim(), category, channel });
      onCreated(made.id);
    } catch (err) {
      setError(toDisplayError(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={t.products.newTitle}
      placement="responsive"
      handle
      closeLabel={t.setup.close}
      onClose={onClose}
      footer={<Button type="submit" form={formId} disabled={busy} className="w-full">{busy ? t.products.saving : t.products.create}</Button>}
    >
      <form id={formId} onSubmit={(e) => { void submit(e); }} className="flex flex-col gap-4" noValidate>
        {error && <ErrorBanner {...error} />}
        <Field label={t.products.code} htmlFor={`${formId}-code`} hint={t.products.codeHint} error={codeError}>
          <TextInput id={`${formId}-code`} maxLength={60} value={code} invalid={Boolean(codeError)} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Field label={t.info.name} htmlFor={`${formId}-name`} error={nameError}>
          <TextInput id={`${formId}-name`} maxLength={200} value={name} invalid={Boolean(nameError)} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t.info.category} htmlFor={`${formId}-category`}>
          <Select id={`${formId}-category`} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{t.products.categories[c]}</option>)}
          </Select>
        </Field>
        <Field label={t.info.channel} htmlFor={`${formId}-channel`}>
          <Select id={`${formId}-channel`} value={channel} onChange={(e) => setChannel(e.target.value as Product['channel'])}>
            <option value="conventional">{t.products.channels.conventional}</option>
            <option value="syariah">{t.products.channels.syariah}</option>
          </Select>
        </Field>
      </form>
    </Modal>
  );
}
