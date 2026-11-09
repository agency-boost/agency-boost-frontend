'use client';

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AddButton, AddSheet, ChoiceRows } from '@/components/ui/rows-and-sheets';
import { ObjectionCards, objectionsToSave } from '@/components/objection-cards';
import { ProductProposalEditor, proposalSettingsOf, proposalToSave } from '@/components/product-proposal-editor';
import { ConfigBadge } from '@/components/ui/config-badge';
import { Dialog } from '@/components/ui/dialog';
import { DragHandle } from '@/components/ui/drag-handle';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Button, CodeField, Field, ReadOnlyField, Select, Textarea, TextInput,
} from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { FilterChips, ListCard, ListRow, SearchPill } from '@/components/ui/list-rows';
import { Modal } from '@/components/ui/modal';
import { ReorderArrows } from '@/components/ui/reorder-arrows';
import { SkeletonCards } from '@/components/ui/skeleton';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { TonePill, type PillTone } from '@/components/ui/tone-pill';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { suggestCode } from '@/lib/config-code';
import { cn } from '@/lib/cn';
import { formatCurrencies, formatDecimalInput, parseDecimal } from '@/lib/format';
import {
  closeProductToNewBusiness, COMMISSION_MAX_YEARS, createProduct, deleteProduct, PRODUCT_CURRENCIES,
  readProducts, reopenProduct, reorderProducts, updateProduct, withdrawProduct,
  type ObjectionCard, type Product, type ProductCurrency, type ProductFields, type ProductKind, type ProductLifecycle,
} from '@/lib/admin';
import { AGE_CHOICES, budgetChoices, channelLabel, needLabel } from '@/lib/product-catalog';
import { useMediaQuery } from '@/lib/use-media-query';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import type { MessagesOf } from '@/i18n/catalogue';
import type { Language } from '@/i18n/language';
import { adminTemplateProductsMessages } from '@/i18n/messages/admin-template-products';
import { productCatalogMessages } from '@/i18n/messages/product-catalog';
import { settingsMessages } from '@/i18n/messages/settings';

/** The two channels, named as the agents' catalogue names them (`channelLabel`). */
const CHANNELS = ['conventional', 'syariah'] as const;
type ChannelCode = (typeof CHANNELS)[number];

/** The categories, named as the catalogue's tabs (§A.3, kept): the words are `admin-template-products.tsx`' `categories`. */
const CATEGORIES = ['life', 'health', 'ci', 'education', 'investment'] as const;
type CategoryCode = (typeof CATEGORIES)[number];
const isCategory = (value: string): value is CategoryCode => (CATEGORIES as readonly string[]).includes(value);

/** `accident` is a need and not a category — accident products sit under health. */
const NEEDS = [
  'life-protection', 'health', 'ci', 'accident', 'education', 'investment', 'retirement', 'legacy',
];

/** The plan's text fields, each typed into one box; `objections` is a list of cards beside them. */
type PlanTextKey = 'goodFit' | 'opening' | 'benefits' | 'fullScript' | 'nextAction';

/**
 * The fields the Owner's own override modal names (`KPM_Owner.html:1786-1793`), **in its order** — the numbers are the
 * modal's, and a reader who meets them out of order is reading a form that lost one. Their words are the catalogue's
 * (`plan`). *4 · If they push back* is the objection cards (P19.4-T4 AC-1, ADR-0209 §9), drawn between *3* and *5*.
 *
 * `benefits` is a list the reader types one per line, which is why it carries `list`.
 */
const PLAN_BEFORE_OBJECTIONS: { key: PlanTextKey; lines?: number; list?: true }[] = [
  { key: 'goodFit' },
  { key: 'opening', lines: 2 },
  { key: 'benefits', lines: 4, list: true },
  { key: 'fullScript', lines: 6 },
];
const PLAN_AFTER_OBJECTIONS: { key: PlanTextKey; lines?: number; list?: true }[] = [
  { key: 'nextAction', lines: 2 },
];

/** The list's filter by kind (P19.4-T4 AC-9): *Semua · Produk dasar · Rider*. */
type KindFilter = 'all' | ProductKind;
const KIND_FILTERS: readonly KindFilter[] = ['all', 'base', 'rider'];

/** The list's filters UI-131 adds: the channel's chips below 1024px, the category's from 1024px or in the sheet. */
type ChannelFilter = 'all' | ChannelCode;
type CategoryFilter = 'all' | CategoryCode;

/** A pressed-button group's button, as the agents' catalogue draws its channel toggle (`product-catalog.tsx`). */
const toggle = (on: boolean) => cn(
  'rounded-[6px] px-[13px] py-[7px] text-base font-semibold',
  on ? 'bg-secondary text-secondary-contrast' : 'text-muted hover:text-navy',
  'max-md:flex max-md:min-h-[2.375rem] max-md:items-center max-md:px-3 max-md:py-0 max-md:text-sm',
);
const TOGGLE_GROUP = 'inline-flex rounded-[9px] border border-hairline bg-card p-[3px]';
/** The same toggle inside a product's sheet: 44px tall below 1024px (UI-135), as the sheet's other controls. */
const sheetToggle = (on: boolean) => cn(toggle(on), 'max-lg:flex max-lg:min-h-11 max-lg:items-center max-lg:py-0');

/**
 * **The pills a row wears** (UI-131: *Konvensional/Syariah pill, Aktif/Ditarik pill*; `admin-mobile` 3, `admin-desktop` 2):
 * the report's tones — a grey *Konvensional*, a blue *Syariah*, a green *Aktif*, a red *Ditarik* — and run-off amber,
 * the status amber of something that still runs and is not sold. A tint and its words, never a dot (D-27).
 */
const CHANNEL_TONE: Record<string, PillTone> = { conventional: 'grey', syariah: 'blue' };
const LIFECYCLE_TONE: Record<ProductLifecycle, PillTone> = {
  active: 'green', closed_to_new_business: 'amber', withdrawn: 'red',
};

/** Two lists of ids holding the same ids, whatever their order. */
const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

type ProductWords = MessagesOf<typeof adminTemplateProductsMessages.en>;

/** A category's name, kept English (§A.3); a code the list does not hold, as it is. */
const categoryLabel = (t: ProductWords, value: string) => (isCategory(value) ? t.categories[value] : value);

/** A product sold in more than the platform's IDR says so on its row (P19.4-T4 AC-12): *USD*, *IDR + USD*. */
const notIdrOnly = (p: Product) => !(p.currencies.length === 1 && p.currencies[0] === 'IDR');

const move = <T,>(rows: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= rows.length) return rows;
  const next = [...rows];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
};

/** Lines a reader types, one per line, as the array the API takes. */
const linesToList = (value: string) => value.split('\n').map((l) => l.trim()).filter(Boolean);

/**
 * A stored proportion as the percentage typed and read on screen: `0.125` is `12,5` — the reader's decimal mark, as the
 * figure is written (ADR-0167 §1; P18.10-T3, `formatDecimalInput`): *12.5* in English.
 *
 * Through `toFixed`, because `0.07 * 100` is `7.000000000000001` and a Super Admin who typed 7
 * should read 7 back.
 */
const percentOf = (rate: number, figures: Language) => formatDecimalInput(Number((rate * 100).toFixed(4)), figures);

/** A typed percentage — a comma or a point (`parseDecimal`) — as the proportion the API stores (`commissionSchedule`, parity F-15). */
const proportionOf = (percent: string) => parseDecimal(percent) / 100;

/**
 * Why a typed rate cannot be saved, or `null` when it can: a number from 0 to 100, **to at most two
 * decimal places** — what the drawer prints (`formatRate`, `toFixed(2)`), so the rate an agent reads is
 * the rate stored rather than a rounding of it (the Phase 14 exit review). In the reader's words (`t`).
 */
function rateError(percent: string, t: ProductWords['commission']): string | null {
  const typed = percent.trim();
  const value = parseDecimal(typed);
  if (typed === '' || !Number.isFinite(value) || value < 0 || value > 100) return t.outOfRange;
  const [, decimals = ''] = typed.split(/[.,]/);
  return decimals.length > 2 ? t.tooPrecise : null;
}

/**
 * The Company template's **Products** tab (P5-T4, ADR-0033, parity I-62).
 *
 * **The one tab with no draft and no version.** Every other tab edits a preset copied into an
 * office when it is created; a product is read **live**, so what is written here reaches every
 * office of the company on their next read, with no Owner pressing publish. The line at the top
 * says that in place of the draft bar the other tabs carry, so a Super Admin is never left looking
 * for a Publish button that should not exist.
 *
 * **A save names the version it was opened at** (P19-T6 AC-2; the 11-03 handover's B1-10): a product somebody else
 * saved, closed or withdrew since is refused `409 VERSION_CONFLICT`, and the banner says so in this screen's words with
 * *Muat ulang* — the shelf read again and the editor closed — while what was typed stays on screen until then.
 *
 * **One line per product, and the product opened from it** (P19.2-T2 AC-2; UI-131, `admin-mobile` screen 3,
 * `admin-desktop` screen 2):
 *
 * - **Below 1024px a 52px row** — the name, the channel's pill, the lifecycle's pill, › — under the search pill and the
 *   chips *Semua n · Konvensional · Syariah*, with a filter button opening the category sheet (and, there, the riders
 *   spec's *Semua · Produk dasar · Rider* and *Tampilkan ditarik*). **From 1024px a 52px table row** — *# · Produk ·
 *   Kanal · Kategori · Status · Default di KPM baru · ›* — under the search and the category chips, the kind's toggle
 *   and *Tampilkan ditarik* beside the count line as P19.4-T4 put them.
 * - **A row opens the product**: a sheet below 1024px, a side panel from it (`Modal`'s `drawer`), holding everything the
 *   card's editor held — the description, *Aktif secara default*, the kind's switch (moved from the row: the riders
 *   spec's *"Produk dasar / Rider"*, one tap away), the plan, the commission, the lifecycle.
 * - **A rider's row keeps the riders spec's chip *Rider* and *"Untuk: …"*** (or its warning), and a product sold in more
 *   than IDR its currencies (P19.4-T4 AC-12) — the one row in the list that has a second line.
 * - **Reordering only in *Ubah urutan***: ⠿ (drag, or focus and ↑ ↓) from 1024px, ↑ and ↓ buttons below it, where a drag
 *   never starts; the row opens nothing while the list is being reordered.
 */
export function ProductsTab({ companyId }: { companyId: string }) {
  const t = useMessages(adminTemplateProductsMessages);
  const language = useLanguage();
  const rowsBelowLaptop = useMediaQuery(['phone', 'tablet']);
  const [rows, setRows] = useState<Product[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  /** *Semua · Produk dasar · Rider* and *"Tampilkan ditarik"* (P19.4-T4 AC-9, AC-13): withdrawn hidden by default. */
  const [filter, setFilter] = useState<KindFilter>('all');
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  /** The withdrawn product whose delete is being asked about (P19.4-T4 AC-13). */
  const [deleting, setDeleting] = useState<Product | null>(null);
  /** UI-131's search, chips and category, and *Ubah urutan*. */
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [ordering, setOrdering] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await readProducts(companyId));
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);

  /** One place for every write: it clears the last refusal, runs, and puts the row back. */
  const run = async (action: () => Promise<Product | Product[]>) => {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      setRows((now) => {
        if (Array.isArray(result)) return result;
        if (now === null) return now;
        return now.some((p) => p.id === result.id)
          ? now.map((p) => (p.id === result.id ? result : p))
          : [...now, result];
      });
      return true;
    } catch (err) {
      setError(toDisplayError(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const reorder = async (from: number, to: number) => {
    if (rows === null || to < 0 || to >= rows.length) return;
    const next = move(rows, from, to);
    // Shown at once, then sent: the whole shelf goes, so two people dragging cannot interleave.
    setRows(next);
    if (!await run(() => reorderProducts(companyId, next.map((p) => p.id)))) await load();
  };

  /** A withdrawn product nothing references, deleted softly; a refusal says what still names it (ADR-0209 §10). */
  const remove = async (product: Product) => {
    setBusy(true);
    setError(null);
    try {
      await deleteProduct(companyId, product.id);
      setRows((now) => now?.filter((p) => p.id !== product.id) ?? now);
      setEditing(null);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  };

  if (error && rows === null) {
    return (
      <EmptyState
        title={t.readFailed({ message: error.message })}
        action={<Button onClick={() => void load()}>{t.tryAgain}</Button>}
      />
    );
  }
  if (rows === null) return <SkeletonCards count={4} />;

  const live = rows.filter((p) => p.lifecycle === 'active').length;
  const byId = new Map(rows.map((p) => [p.id, p]));
  const isActiveBase = (p: Product | undefined) => p !== undefined && p.kind === 'base' && p.lifecycle === 'active';
  /** The channel's chips are drawn below 1024px only, so from 1024px they narrow nothing. */
  const channelOn: ChannelFilter = rowsBelowLaptop ? channel : 'all';
  const term = search.trim().toLocaleLowerCase();
  /** Whether a product passes every filter — the one named in `skip` aside, for that filter's own *Semua n*. */
  const passes = (p: Product, skip?: 'channel' | 'category') =>
    (showWithdrawn || p.lifecycle !== 'withdrawn')
    && (filter === 'all' || p.kind === filter)
    && (skip === 'channel' || channelOn === 'all' || p.channel === channelOn)
    && (skip === 'category' || category === 'all' || p.category === category)
    && (term === '' || [p.name, p.code].some((v) => v.toLocaleLowerCase().includes(term)));
  /** The rows the filters leave, each with its place on the whole shelf — reordering moves the whole shelf. */
  const visible = rows.filter((p) => passes(p));
  /** A rider no active base offers: hidden from agents, and its row says so (ADR-0209 §4). */
  const unattached = (p: Product) => p.kind === 'rider' && p.lifecycle !== 'withdrawn'
    && !p.attachesTo.some((id) => isActiveBase(byId.get(id)));
  const namesOf = (ids: readonly string[]) => ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!.name] : [])).join(', ');
  const opened = editing === null ? null : byId.get(editing) ?? null;
  const narrowed = category !== 'all' || filter !== 'all' || showWithdrawn;

  /** Opens a product's sheet or panel — never while the list is being reordered. */
  const openProduct = (product: Product) => {
    setError(null);
    setEditing(product.id);
  };

  /** A product's place moved by one past the row shown beside it: the handle's keys and the ↑ ↓ buttons. */
  const shift = (product: Product, place: number, by: -1 | 1) => {
    if (!visible[place + by]) return;
    void reorder(rows.indexOf(product), rows.indexOf(visible[place + by]));
  };

  const refusal = error && (
    <div role="alert" className="rounded-md border border-primary bg-card p-4">
      <p className="text-md text-navy">{error.code === 'VERSION_CONFLICT' ? t.savedElsewhere : error.message}</p>
      {error.code === 'VERSION_CONFLICT' && (
        <Button
          variant="secondary"
          className="mt-3 max-lg:h-11"
          disabled={busy}
          onClick={() => {
            setEditing(null);
            void load();
          }}
        >
          {t.reload}
        </Button>
      )}
    </div>
  );

  /** A rider's chip and *"Untuk: …"*, or its warning; a product sold in more than IDR, its codes. */
  const riderLine = (product: Product): ReactNode => {
    if (product.kind !== 'rider') return null;
    if (unattached(product)) return <span className="font-semibold text-alert">{t.unattached}</span>;
    if (product.attachesTo.length > 0) return <span>{t.forBases({ names: namesOf(product.attachesTo) })}</span>;
    return null;
  };
  const facts = (product: Product) => (
    <>
      {product.kind === 'rider' && <ConfigBadge tone="navy">{t.riderChip}</ConfigBadge>}
      {/* What it is sold in, as codes: *USD*, *IDR + USD* (P19.4-T4 AC-12) — said where it is not the platform's IDR. */}
      {notIdrOnly(product) && <ConfigBadge tone="open">{formatCurrencies(product.currencies)}</ConfigBadge>}
    </>
  );
  const channelPill = (product: Product) => (
    <TonePill tone={CHANNEL_TONE[product.channel] ?? 'grey'}>{channelLabel(product.channel, language)}</TonePill>
  );
  const lifecyclePill = (product: Product) => (
    // *Ditutup untuk penjualan baru* is long: on a row below 1024px it takes two lines rather than the name's room.
    <TonePill
      tone={LIFECYCLE_TONE[product.lifecycle]}
      className="max-lg:max-w-[7.5rem] max-lg:whitespace-normal max-lg:text-center max-lg:leading-4"
    >
      {t.lifecycle[product.lifecycle]}
    </TonePill>
  );

  const reorderToggle = (
    <Button
      variant="secondary"
      disabled={busy}
      className="gap-1.5 rounded-pill max-lg:h-11"
      onClick={() => {
        setEditing(null);
        setOrdering((now) => !now);
      }}
    >
      {!ordering && <span aria-hidden="true">⇅</span>}
      {ordering ? t.reorderDone : t.reorder}
    </Button>
  );
  const add = <AddButton label={t.addProduct} onClick={() => { setError(null); setAdding(true); }} />;
  const count = (
    <p className="min-w-0 flex-1 text-sm text-muted">
      {t.counts({ products: rows.length, active: live, byDefault: rows.filter((p) => p.activeByDefault).length })}
    </p>
  );
  /*
    * **The 45 words behind ⓘ from 768px, and not drawn on a phone** (P19.2-T2 AC-7; UI-136, Appendix A's Produk row:
    * *Remove · ⓘ · ⓘ*, wording unchanged): *Katalog ini langsung berlaku.* with its ⓘ, the rest the ⓘ's words.
    */
  const liveLine = (
    <p className="flex items-center gap-1 text-md text-navy max-md:hidden">
      <strong>{t.live}</strong>
      <TippedGlyph glyph="ⓘ" name={t.liveAbout} tip={t.liveDetail} align="fit" />
    </p>
  );

  const list = rows.length === 0 ? (
    <EmptyState title={t.empty} />
  ) : visible.length === 0 ? (
    <EmptyState title={t.noneShown} />
  ) : rowsBelowLaptop ? (
    <ListCard label={t.caption}>
      {visible.map((product, place) => (
        <ListRow
          key={product.id}
          data-row={product.id}
          className="min-h-[3.25rem]"
          title={product.name}
          meta={product.kind === 'rider' || notIdrOnly(product)
            ? <>{facts(product)}{riderLine(product)}</> : undefined}
          trailing={ordering ? (
            <ReorderArrows
              label={product.name}
              index={place}
              count={visible.length}
              disabled={busy}
              onMove={(by) => shift(product, place, by)}
            />
          ) : <>{channelPill(product)}{lifecyclePill(product)}</>}
          haspopup={!ordering}
          onSelect={ordering ? undefined : () => openProduct(product)}
        />
      ))}
    </ListCard>
  ) : (
    <ProductsTable
      t={t}
      visible={visible}
      ordering={ordering}
      busy={busy}
      indexOf={(p) => rows.indexOf(p)}
      dragging={dragging}
      over={over}
      onOpen={openProduct}
      onPick={setDragging}
      onOver={setOver}
      onDrop={(target) => {
        const held = dragging;
        setDragging(null);
        setOver(null);
        if (held && held !== target.id) void reorder(rows.findIndex((p) => p.id === held), rows.indexOf(target));
      }}
      onShift={shift}
      cells={(product) => ({
        name: <>{facts(product)}</>,
        line: riderLine(product),
        channel: channelPill(product),
        category: categoryLabel(t, product.category),
        status: lifecyclePill(product),
      })}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {rowsBelowLaptop ? (
        <>
          {liveLine}
          <SearchPill label={t.search} value={search} onChange={setSearch} />
          <div className="flex items-center gap-1.5">
            <FilterChips
              label={t.channelFilter}
              className="min-w-0 flex-1"
              active={channel}
              onSelect={setChannel}
              chips={[
                { key: 'all', label: t.filters.all, count: rows.filter((p) => passes(p, 'channel')).length },
                ...CHANNELS.map((c) => ({ key: c, label: channelLabel(c, language) })),
              ]}
            />
            <button
              type="button"
              aria-haspopup="dialog"
              aria-label={narrowed ? t.filterOn : t.filter}
              onClick={() => setFiltersOpen(true)}
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-pill',
                narrowed ? 'bg-secondary text-secondary-contrast' : 'bg-card text-navy hover:bg-hover-row',
              )}
            >
              <LineIcon name="adjust" className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {count}
            {reorderToggle}
            {add}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {liveLine}
            <span className="flex-1" />
            {reorderToggle}
            {add}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SearchPill label={t.search} value={search} onChange={setSearch} className="w-72" />
            <FilterChips
              label={t.categoryFilter}
              className="min-w-0"
              active={category}
              onSelect={setCategory}
              chips={[
                { key: 'all', label: t.filters.all, count: rows.filter((p) => passes(p, 'category')).length },
                ...CATEGORIES.map((c) => ({ key: c, label: t.categories[c] })),
              ]}
            />
          </div>
          {/* The riders spec's chips over the list, and the withdrawn ones behind a box (P19.4-T4 AC-9, AC-13). */}
          <div className="flex flex-wrap items-center gap-3">
            <div role="group" aria-label={t.filterLabel} className={TOGGLE_GROUP}>
              {KIND_FILTERS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={filter === kind}
                  className={toggle(filter === kind)}
                  onClick={() => setFilter(kind)}
                >
                  {t.filters[kind]}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-md text-navy">
              <input type="checkbox" checked={showWithdrawn} onChange={(e) => setShowWithdrawn(e.target.checked)} />
              {t.showWithdrawn}
            </label>
            {count}
          </div>
        </>
      )}

      {ordering && !rowsBelowLaptop && <p className="text-sm text-muted">{t.reorderHint}</p>}
      {/* A refusal while a product or the add sheet is open is said in that sheet, where the reader is. */}
      {!opened && !adding && refusal}

      {list}

      {/* **The category sheet** below 1024px (UI-131: *a filter button (category sheet: Life, Health, …)*), with the kind
          and the withdrawn ones the riders spec puts over the list: one row of chips has room for the channel only. */}
      <Modal
        open={filtersOpen && rowsBelowLaptop}
        title={t.filter}
        onClose={() => setFiltersOpen(false)}
        placement="responsive"
        handle
        closeLabel={t.close}
      >
        <div className="flex flex-col gap-4 pb-4">
          <div>
            <p id="products-category" className="mb-1.5 text-md font-semibold text-navy">{t.category}</p>
            <ChoiceRows
              labelledBy="products-category"
              value={category}
              onChange={setCategory}
              options={[
                { key: 'all', label: t.filters.all },
                ...CATEGORIES.map((c) => ({ key: c, label: t.categories[c] })),
              ]}
            />
          </div>
          <div>
            <p id="products-kind" className="mb-1.5 text-md font-semibold text-navy">{t.filterLabel}</p>
            <ChoiceRows
              labelledBy="products-kind"
              value={filter}
              onChange={setFilter}
              options={KIND_FILTERS.map((kind) => ({ key: kind, label: t.filters[kind] }))}
            />
          </div>
          <label className="flex min-h-11 items-center gap-3 text-md text-navy">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={showWithdrawn}
              onChange={(e) => setShowWithdrawn(e.target.checked)}
            />
            {t.showWithdrawn}
          </label>
        </div>
      </Modal>

      {adding && (
        <AddProduct
          disabled={busy}
          taken={(code) => rows.some((p) => p.code === code)}
          error={refusal || null}
          onCancel={() => { setAdding(false); setError(null); }}
          onAdd={async (body) => {
            if (await run(() => createProduct(companyId, body))) setAdding(false);
          }}
        />
      )}

      {/* **The product, opened from its row**: a sheet below 1024px, a side panel from it (UI-131). */}
      <Modal
        key={opened?.id ?? 'none'}
        open={opened !== null}
        title={opened?.name ?? ''}
        onClose={() => setEditing(null)}
        placement="drawer"
        handle
        closeLabel={t.close}
        className="lg:max-w-[34rem]"
      >
        {opened && (
          <div className="flex flex-col gap-3">
            {refusal}
            <ProductEditor
              key={opened.id}
              product={opened}
              others={rows.filter((p) => p.id !== opened.id)}
              bases={rows.filter((p) => p.id !== opened.id && (isActiveBase(p) || opened.attachesTo.includes(p.id)))}
              riders={rows.filter((p) => p.kind === 'rider' && p.attachesTo.includes(opened.id))}
              disabled={busy}
              onOpen={(riderId) => {
                // *Rider yang tersedia*'s link: the rider, opened, with the filters letting its row show behind it.
                setFilter('all');
                if (byId.get(riderId)?.lifecycle === 'withdrawn') setShowWithdrawn(true);
                setEditing(riderId);
              }}
              onSave={async (fields) => {
                // Pinned to the version this sheet was read at (P19-T6 AC-2).
                const pinned = { ...fields, expectedVersion: opened.version };
                if (await run(() => updateProduct(companyId, opened.id, pinned))) setEditing(null);
              }}
              onLifecycle={async (next, replacedByProductId) => {
                const product = opened;
                const call = () => {
                  if (next === 'active') return reopenProduct(companyId, product.id);
                  if (next === 'withdrawn') {
                    return withdrawProduct(companyId, product.id, replacedByProductId);
                  }
                  return closeProductToNewBusiness(
                    companyId, product.id, replacedByProductId,
                  );
                };
                // A withdrawn base leaves its riders (ADR-0209 §4): the shelf is read again so theirs shows.
                const hadRiders = rows.some((p) => p.kind === 'rider' && p.attachesTo.includes(product.id));
                if (!await run(call)) return;
                // Withdrawn and hidden (P19.4-T4 AC-13): its sheet goes with its row, as the card's editor did.
                if (next === 'withdrawn' && !showWithdrawn) setEditing(null);
                if (next === 'withdrawn' && hadRiders) await load();
              }}
              onDelete={() => {
                // The question takes the sheet's place, so a refusal is said on the page, beside the row it is about.
                setEditing(null);
                setDeleting(opened);
              }}
            />
          </div>
        )}
      </Modal>

      <Dialog
        open={deleting !== null}
        message={deleting ? t.deleteConfirm({ name: deleting.name }) : ''}
        confirmLabel={t.deleteConfirmLabel}
        tone="danger"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const product = deleting;
          setDeleting(null);
          if (product) void remove(product);
        }}
      />
    </div>
  );
}

/**
 * **The laptop's table** (UI-131: *a 52px table row per product (# · Produk · Jenis · Kategori · Status · Default di KPM
 * baru · ›)*; `admin-desktop` screen 2): the shelf's own number, the name — the row's one target, stretched over the row —
 * then the channel, the category, the lifecycle and whether a new office starts selling it. The mockup's *Jenis* is
 * the channel; *Jenis* is the riders spec's word for the kind on this screen, so the column says *Kanal*, the editor's
 * own word for it.
 *
 * In *Ubah urutan* the number is ⠿ — drag the row, or focus ⠿ and press ↑ ↓ — and the name opens nothing.
 */
function ProductsTable({
  t,
  visible,
  ordering,
  busy,
  indexOf,
  dragging,
  over,
  onOpen,
  onPick,
  onOver,
  onDrop,
  onShift,
  cells,
}: {
  t: ProductWords;
  visible: Product[];
  ordering: boolean;
  busy: boolean;
  /** A product's place on the whole shelf, which a reorder moves. */
  indexOf: (product: Product) => number;
  dragging: string | null;
  over: string | null;
  onOpen: (product: Product) => void;
  onPick: (productId: string | null) => void;
  onOver: (update: (now: string | null) => string | null) => void;
  onDrop: (target: Product) => void;
  onShift: (product: Product, place: number, by: -1 | 1) => void;
  cells: (product: Product) => { name: ReactNode; line: ReactNode; channel: ReactNode; category: string; status: ReactNode };
}) {
  const columns = [t.columns.number, t.columns.product, t.channel, t.category, t.columns.status, t.columns.byDefault];
  const HEAD_CELL = 'sticky top-0 z-[1] border-b border-hairline bg-card px-4 py-2.5 text-sm font-semibold uppercase '
    + 'tracking-wide text-muted first:rounded-tl-lg';
  return (
    <div className="rounded-lg bg-card">
      <table className="relative w-full border-collapse text-left text-md">
        <caption className="sr-only">{t.caption}</caption>
        <thead>
          <tr>
            {columns.map((label) => <th key={label} scope="col" className={HEAD_CELL}>{label}</th>)}
            <th scope="col" className={cn(HEAD_CELL, 'w-10 rounded-tr-lg')}>
              <span className="sr-only">{t.columns.open}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.map((product, place) => {
            const { name, line, channel, category, status } = cells(product);
            return (
              <tr
                key={product.id}
                data-row={product.id}
                className={cn(
                  'relative h-[3.25rem] border-b border-hairline last:border-b-0',
                  !ordering && 'cursor-pointer hover:bg-hover-row',
                  !ordering && 'has-[[data-row-main]:focus-visible]:outline has-[[data-row-main]:focus-visible]:outline-2 has-[[data-row-main]:focus-visible]:-outline-offset-2 has-[[data-row-main]:focus-visible]:outline-primary',
                  over === product.id && 'bg-canvas',
                  dragging === product.id && 'opacity-40',
                )}
                onDragOver={ordering ? (e) => {
                  if (!dragging) return;
                  e.preventDefault();
                  onOver(() => product.id);
                } : undefined}
                onDragLeave={ordering ? () => onOver((now) => (now === product.id ? null : now)) : undefined}
                onDrop={ordering ? (e) => {
                  e.preventDefault();
                  onDrop(product);
                } : undefined}
              >
                <td className="w-12 px-4 py-2 tabular-nums text-muted">
                  {ordering ? (
                    <DragHandle
                      label={product.name}
                      disabled={busy}
                      className="flex h-9 w-9 cursor-grab select-none items-center justify-center rounded-sm text-md text-muted disabled:cursor-not-allowed"
                      onPick={() => onPick(product.id)}
                      onDrop={() => { onPick(null); onOver(() => null); }}
                      onMove={(by) => onShift(product, place, by)}
                    />
                  ) : indexOf(product) + 1}
                </td>
                <td className="px-4 py-2">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {ordering ? (
                      <span className="font-semibold text-ink">{product.name}</span>
                    ) : (
                      <button
                        type="button"
                        data-row-main=""
                        aria-haspopup="dialog"
                        onClick={() => onOpen(product)}
                        className="text-left font-semibold text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                      >
                        {product.name}
                      </button>
                    )}
                    {name}
                  </span>
                  {line && <span className="mt-0.5 block text-sm text-muted">{line}</span>}
                </td>
                <td className="px-4 py-2">{channel}</td>
                <td className="px-4 py-2">{category}</td>
                <td className="px-4 py-2">{status}</td>
                <td className="px-4 py-2">{product.activeByDefault ? t.yes : t.notByDefault}</td>
                <td className="w-10 px-2 py-2">
                  {!ordering && <LineIcon name="chevronRight" className="h-5 w-5 text-signal-grey" />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A product opened for editing.
 *
 * Its identity is read-only — a code is typed once and never changes, because a policy, a lead and
 * a plan's address (`/attack-plan?product=…`) all point at it (ADR-0006). Everything else is editable, and the
 * lifecycle moves through named controls rather than a dropdown, because each of them reaches
 * every office of the company.
 */
function ProductEditor({
  product,
  others,
  bases,
  riders,
  disabled,
  onOpen,
  onSave,
  onLifecycle,
  onDelete,
}: {
  product: Product;
  /** Candidate successors: a replacement has to be on the same company's shelf. */
  others: Product[];
  /** *Bisa ditambahkan ke*'s choices: the company's active base products, and any this rider names already. */
  bases: Product[];
  /** The riders attached to this product: *Rider yang tersedia*. */
  riders: Product[];
  disabled?: boolean;
  /** Opens a rider's row, from *Rider yang tersedia*. */
  onOpen: (riderId: string) => void;
  onSave: (fields: ProductFields) => void | Promise<void>;
  onLifecycle: (next: ProductLifecycle, replacedByProductId?: string) => void | Promise<void>;
  /** Asks to delete this withdrawn product (P19.4-T4 AC-13). */
  onDelete: () => void;
}) {
  const t = useMessages(adminTemplateProductsMessages);
  const settings = useMessages(settingsMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const [form, setForm] = useState({
    name: product.name,
    tagline: product.tagline,
    channel: product.channel as string,
    category: product.category as string,
    primaryNeeds: product.primaryNeeds,
    eligibleAgeBands: product.eligibleAgeBands,
    eligibleBudgetBands: product.eligibleBudgetBands,
    benefits: product.benefits.join('\n'),
    differentiator: product.differentiator,
    bestFor: product.bestFor,
    activeByDefault: product.activeByDefault,
    plan: {
      goodFit: product.defaultAttackPlan.goodFit,
      opening: product.defaultAttackPlan.opening,
      benefits: product.defaultAttackPlan.benefits.join('\n'),
      fullScript: product.defaultAttackPlan.fullScript,
      nextAction: product.defaultAttackPlan.nextAction,
    } satisfies Record<PlanTextKey, string>,
  });
  /** The objection cards (P19.4-T4 AC-1), in order. */
  const [objections, setObjections] = useState<ObjectionCard[]>(
    product.defaultAttackPlan.objections.map((card) => ({ ...card })),
  );
  /** A rider's bases (P19.4-T4 AC-4): empty is *"Pilih minimal satu produk dasar"*, here before the server says it. */
  const [attaches, setAttaches] = useState<string[]>(product.attachesTo);
  /** What it is sold in (P19.4-T4 AC-12): at least one. */
  const [currencies, setCurrencies] = useState<ProductCurrency[]>(product.currencies);
  /** The *Proposal* section (P19.7-T1 AC-3; ADR-0225): sent only when it changed, so an unrelated save meets no rule. */
  const [proposal, setProposal] = useState(() => proposalSettingsOf(product));
  const proposalChanged = JSON.stringify(proposalToSave(proposal)) !== JSON.stringify(proposalToSave(proposalSettingsOf(product)));
  /**
   * **The kind's switch, *"Produk dasar / Rider"*** (P19.4-T4 AC-9; the riders spec's *kind switch on each product row*):
   * in the product's sheet since P19.2-T2 AC-2 (UI-131's one-line row), its first control. Nothing is saved until *Save
   * product* (ADR-0209 §2).
   */
  const [kind, setKind] = useState<ProductKind>(product.kind);
  const rider = kind === 'rider';
  const noBase = rider && attaches.length === 0;
  const noCurrency = currencies.length === 0;
  const [successor, setSuccessor] = useState(product.replacedByProductId ?? '');
  /** One typed percentage per policy year, Y1 first (OD-135). Absent for a reader not sent it. */
  const [rates, setRates] = useState<string[]>(
    (product.commissionSchedule ?? []).map((row) => percentOf(row.rate, figures)),
  );
  /** Errors wait for a save attempt, so a year just added is not shouted at for being empty. */
  const [triedSave, setTriedSave] = useState(false);
  const scheduleInvalid = rates.some((rate) => rateError(rate, t.commission) !== null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((now) => ({ ...now, [key]: value }));
  const setPlan = (key: PlanTextKey, value: string) =>
    setForm((now) => ({ ...now, plan: { ...now.plan, [key]: value } }));
  const planField = (field: { key: PlanTextKey; lines?: number; list?: true }) => (
    <Field
      key={field.key}
      label={t.plan[field.key]}
      htmlFor={`plan-${field.key}-${product.id}`}
      hint={field.list ? t.onePerLine : undefined}
      className="mt-3"
    >
      {field.lines ? (
        <Textarea
          id={`plan-${field.key}-${product.id}`}
          rows={field.lines}
          value={form.plan[field.key]}
          disabled={disabled}
          onChange={(e) => setPlan(field.key, e.target.value)}
        />
      ) : (
        <TextInput
          id={`plan-${field.key}-${product.id}`}
          value={form.plan[field.key]}
          disabled={disabled}
          onChange={(e) => setPlan(field.key, e.target.value)}
        />
      )}
    </Field>
  );

  const toggle = (key: 'primaryNeeds', value: string) => set(
    key,
    form[key].includes(value) ? form[key].filter((v) => v !== value) : [...form[key], value],
  );
  const toggleBand = (key: 'eligibleAgeBands' | 'eligibleBudgetBands', band: number) => set(
    key,
    form[key].includes(band) ? form[key].filter((b) => b !== band) : [...form[key], band].sort(),
  );

  return (
    <div className="pb-4">
      <div role="group" aria-label={t.kindLabel({ name: product.name })} className={cn(TOGGLE_GROUP, 'mb-4')}>
        {(['base', 'rider'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            disabled={disabled}
            className={sheetToggle(kind === k)}
            onClick={() => setKind(k)}
          >
            {t.kinds[k]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <CodeField
          id={`code-product-${product.code}`}
          value={product.code}
          reason={t.codeReason}
        />
        <ReadOnlyField
          label={t.version}
          value={String(product.version)}
          reason={t.versionReason}
        />
      </div>

      {/* A rider names its bases; a base lists its riders, read-only (P19.4-T4 AC-9; the riders spec's admin screen). */}
      {rider ? (
        <fieldset className="mt-4" aria-describedby={noBase ? `attaches-${product.id}-error` : undefined}>
          <legend className="text-sm font-semibold text-navy">{t.attachesTo}</legend>
          <p className="text-sm text-muted">{t.attachesToHint}</p>
          {bases.length === 0 ? (
            <p className="mt-2 text-sm text-muted">{t.noActiveBase}</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-3">
              {bases.map((base) => (
                <label key={base.id} className="flex items-center gap-2 text-md text-navy">
                  <input
                    type="checkbox"
                    checked={attaches.includes(base.id)}
                    disabled={disabled}
                    onChange={() => setAttaches((now) => (now.includes(base.id)
                      ? now.filter((id) => id !== base.id) : [...now, base.id]))}
                  />
                  {base.name}
                </label>
              ))}
            </div>
          )}
          {noBase && (
            <p id={`attaches-${product.id}-error`} role="alert" className="mt-1 text-xs font-semibold text-alert">
              {t.attachAtLeastOne}
            </p>
          )}
        </fieldset>
      ) : (
        <p className="mt-4 text-sm text-navy">
          <span className="font-semibold">{t.ridersAvailable}</span>{' '}
          {riders.length === 0 ? <span className="text-muted">{t.ridersNone}</span> : riders.map((r, i) => (
            <span key={r.id}>
              {i > 0 && ', '}
              <Button variant="inline" aria-label={t.openRider({ name: r.name })} onClick={() => onOpen(r.id)}>
                {r.name}
              </Button>
            </span>
          ))}
        </p>
      )}

      <fieldset className="mt-4" aria-describedby={noCurrency ? `currency-${product.id}-error` : undefined}>
        <legend className="text-sm font-semibold text-navy">{t.currency}</legend>
        <p className="text-sm text-muted">{t.currencyHint}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {PRODUCT_CURRENCIES.map((code) => (
            <label key={code} className="flex items-center gap-2 text-md text-navy">
              <input
                type="checkbox"
                checked={currencies.includes(code)}
                disabled={disabled}
                onChange={() => setCurrencies((now) => PRODUCT_CURRENCIES
                  .filter((c) => (c === code ? !now.includes(c) : now.includes(c))))}
              />
              {code}
            </label>
          ))}
        </div>
        {noCurrency && (
          <p id={`currency-${product.id}-error`} role="alert" className="mt-1 text-xs font-semibold text-alert">
            {t.currencyAtLeastOne}
          </p>
        )}
      </fieldset>

      <div className="mt-3 flex flex-wrap gap-3">
        <Field label={settings.name} htmlFor={`name-${product.id}`} className="min-w-60 flex-1">
          <TextInput
            id={`name-${product.id}`}
            value={form.name}
            disabled={disabled}
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>
        <Field label={t.tagline} htmlFor={`tagline-${product.id}`} className="min-w-60 flex-1">
          <TextInput
            id={`tagline-${product.id}`}
            value={form.tagline}
            disabled={disabled}
            onChange={(e) => set('tagline', e.target.value)}
          />
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <Field label={t.channel} htmlFor={`channel-${product.id}`} className="min-w-48">
          <Select
            id={`channel-${product.id}`}
            value={form.channel}
            disabled={disabled}
            onChange={(e) => set('channel', e.target.value)}
          >
            {CHANNELS.map((value) => <option key={value} value={value}>{channelLabel(value, language)}</option>)}
          </Select>
        </Field>
        <Field label={t.category} htmlFor={`category-${product.id}`} className="min-w-48">
          <Select
            id={`category-${product.id}`}
            value={form.category}
            disabled={disabled}
            onChange={(e) => set('category', e.target.value)}
          >
            {CATEGORIES.map((value) => <option key={value} value={value}>{t.categories[value]}</option>)}
          </Select>
        </Field>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-navy">{t.primaryNeed}</legend>
        <p className="text-sm text-muted">{t.primaryNeedHint}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {NEEDS.map((need) => (
            <label key={need} className="flex items-center gap-2 text-md text-navy">
              <input
                type="checkbox"
                checked={form.primaryNeeds.includes(need)}
                disabled={disabled}
                onChange={() => toggle('primaryNeeds', need)}
              />
              {t.need({ code: need, name: needLabel(need, language) ?? need })}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-navy">{t.whoItFits}</legend>
        {/* It ended by naming the phase that builds the fit check: our schedule, which the
            reader can do nothing with (ADR-0062 §3, P10.1-T2). The bands are saved and read
            back today. */}
        <p className="text-sm text-muted">{t.whoItFitsHint}</p>
        <div className="mt-2 flex flex-wrap gap-4">
          <div>
            <p className="text-sm font-semibold text-muted">{t.age}</p>
            <div className="mt-1 flex flex-wrap gap-3">
              {/* From `Overall.html:9527-9533`, the copy the seeded bands are scored against: figures under a thousand,
                  written alike in both languages (`AGE_CHOICES`). */}
              {AGE_CHOICES.map(({ value: band, label: text }) => (
                <label key={band} className="flex items-center gap-2 text-md text-navy">
                  <input
                    type="checkbox"
                    checked={form.eligibleAgeBands.includes(band)}
                    disabled={disabled}
                    onChange={() => toggleBand('eligibleAgeBands', band)}
                  />
                  {text}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-muted">{t.monthlyBudget}</p>
            <div className="mt-1 flex flex-wrap gap-3">
              {/* Compact, as the catalog's own chips write them, in the reader's figures and words (`budgetChoices`,
                  ADR-0167 §1, P18.10-T3): *< Rp 500 rb* … *Lump-sum*, *< IDR 500K* in English. */}
              {budgetChoices(figures, language).map(({ value: band, label: text }) => (
                <label key={band} className="flex items-center gap-2 text-md text-navy">
                  <input
                    type="checkbox"
                    checked={form.eligibleBudgetBands.includes(band)}
                    disabled={disabled}
                    onChange={() => toggleBand('eligibleBudgetBands', band)}
                  />
                  {text}
                </label>
              ))}
            </div>
          </div>
        </div>
      </fieldset>

      <Field
        label={t.benefits}
        htmlFor={`benefits-${product.id}`}
        hint={t.onePerLine}
        className="mt-4"
      >
        <Textarea
          id={`benefits-${product.id}`}
          rows={4}
          value={form.benefits}
          disabled={disabled}
          onChange={(e) => set('benefits', e.target.value)}
        />
      </Field>

      <Field label={t.differentiator} htmlFor={`diff-${product.id}`} className="mt-3">
        <Textarea
          id={`diff-${product.id}`}
          rows={3}
          value={form.differentiator}
          disabled={disabled}
          onChange={(e) => set('differentiator', e.target.value)}
        />
      </Field>

      <Field label={t.bestFor} htmlFor={`bestfor-${product.id}`} className="mt-3">
        <TextInput
          id={`bestfor-${product.id}`}
          value={form.bestFor}
          disabled={disabled}
          onChange={(e) => set('bestFor', e.target.value)}
        />
      </Field>

      <label className="mt-4 flex items-center gap-2 text-md text-navy">
        <input
          type="checkbox"
          className="mt-1"
          checked={form.activeByDefault}
          disabled={disabled}
          onChange={(e) => set('activeByDefault', e.target.checked)}
        />
        <span>
          {t.activeByDefault}
          <span className="block text-sm text-muted">{t.activeByDefaultHint}</span>
        </span>
      </label>

      <h3 className="mt-5 font-display text-md font-bold text-navy">{t.plan.title}</h3>
      {rider ? (
        // No attack plan of its own (OD-262, ADR-0209 §3): what is stored stays, and agents never read it.
        <p className="text-sm text-muted">{t.plan.riderHasNone}</p>
      ) : (
        <>
          <p className="text-sm text-muted">{t.plan.lead}</p>
          {/* The plan's fields under their own prefix (P19-T6 AC-4, B1-10): *2 · Tekankan manfaat* was `benefits-<id>`,
              the id *Manfaat* above has, so its label named the other textarea and a click on it focused the wrong one. */}
          {PLAN_BEFORE_OBJECTIONS.map(planField)}
          <ObjectionCards
            idPrefix={`plan-${product.id}`}
            legend={t.plan.objections}
            cards={objections}
            onChange={setObjections}
            disabled={disabled}
          />
          {PLAN_AFTER_OBJECTIONS.map(planField)}
        </>
      )}

      {/* A rider is never offered alone, so it has no *Proposal* section (ADR-0209 §3, ADR-0225 §1). */}
      {!rider && (
        <ProductProposalEditor
          product={product}
          channel={form.channel}
          category={form.category}
          currencies={currencies}
          value={proposal}
          onChange={setProposal}
          disabled={disabled}
        />
      )}

      <h3 className="mt-5 font-display text-md font-bold text-navy">{t.commission.title}</h3>
      {product.commissionSchedule === undefined ? (
        <p className="text-sm text-muted">{t.commission.notShown}</p>
      ) : (
        <CommissionEditor
          productId={product.id}
          rates={rates}
          onChange={setRates}
          showErrors={triedSave}
          disabled={disabled}
        />
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
        <Button
          disabled={disabled}
          onClick={() => {
            if (scheduleInvalid || noBase || noCurrency) {
              setTriedSave(true);
              return;
            }
            // The kind and the bases only when they changed: an unrelated save is never refused over a base since
            // closed (ADR-0209 §2).
            const attachments = rider ? attaches : [];
            const kindChanged = kind !== product.kind || !sameIds(attachments, product.attachesTo);
            void onSave({
              name: form.name.trim(),
              tagline: form.tagline.trim(),
              channel: form.channel as Product['channel'],
              category: form.category as Product['category'],
              primaryNeeds: form.primaryNeeds,
              eligibleAgeBands: form.eligibleAgeBands,
              eligibleBudgetBands: form.eligibleBudgetBands,
              benefits: linesToList(form.benefits),
              differentiator: form.differentiator.trim(),
              bestFor: form.bestFor.trim(),
              activeByDefault: form.activeByDefault,
              currencies,
              ...(kindChanged ? { kind, attachesTo: attachments } : {}),
              // A rider's plan is not edited here, so it is not sent (OD-262).
              ...(rider ? {} : {
                defaultAttackPlan: {
                  goodFit: form.plan.goodFit.trim(),
                  opening: form.plan.opening.trim(),
                  benefits: linesToList(form.plan.benefits),
                  fullScript: form.plan.fullScript.trim(),
                  objections: objectionsToSave(objections),
                  nextAction: form.plan.nextAction.trim(),
                },
              }),
              // The proposal's settings, whole, when the section changed (ADR-0225 §2: the API checks them across).
              ...(!rider && proposalChanged ? proposalToSave(proposal) : {}),
              // The whole schedule, Y1 first, as a proportion. Left out for a reader not sent one.
              ...(product.commissionSchedule === undefined ? {} : {
                commissionSchedule: rates.map((rate, index) => ({
                  year: index + 1, rate: proportionOf(rate),
                })),
              }),
            });
          }}
        >
          {t.saveProduct}
        </Button>
      </div>

      <div className="mt-4 border-t border-hairline pt-4">
        <h3 className="font-display text-md font-bold text-navy">{t.lifecycleTitle}</h3>
        <p className="text-sm text-muted">
          {t.lifecycleLead({ strong: (words) => <strong>{words}</strong> })}
        </p>

        {product.lifecycle !== 'withdrawn' && (
          <Field
            label={t.replacedBy}
            htmlFor={`successor-${product.id}`}
            hint={t.replacedByHint}
            className="mt-3 max-w-md"
          >
            <Select
              id={`successor-${product.id}`}
              value={successor}
              disabled={disabled}
              onChange={(e) => setSuccessor(e.target.value)}
            >
              <option value="">{t.nothingReplaces}</option>
              {others.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </Select>
          </Field>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {product.lifecycle === 'active' && (
            <Button
              variant="inline"
              disabled={disabled}
              title={t.closeTip}
              onClick={() => void onLifecycle('closed_to_new_business', successor || undefined)}
            >
              {t.closeToNewBusiness}
            </Button>
          )}
          {product.lifecycle !== 'withdrawn' && (
            <Button
              variant="inlineDanger"
              disabled={disabled}
              title={t.withdrawTip}
              onClick={() => void onLifecycle('withdrawn', successor || undefined)}
            >
              {t.withdraw}
            </Button>
          )}
          {product.lifecycle !== 'active' && (
            <Button
              variant="inline"
              disabled={disabled}
              title={t.reopenTip}
              onClick={() => void onLifecycle('active')}
            >
              {t.reopen}
            </Button>
          )}
          {/* A withdrawn product only, after a question; a refusal says what still names it (P19.4-T4 AC-13). */}
          {product.lifecycle === 'withdrawn' && (
            <Button variant="inlineDanger" disabled={disabled} title={t.deleteTip} onClick={onDelete}>
              {t.delete}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const TH = 'border-b border-hairline py-1.5 pr-6 text-left text-xs font-semibold uppercase tracking-wide text-muted';
const TD = 'border-b border-hairline py-1.5 pr-6 align-top text-md text-navy';

/**
 * The company's commission schedule for one product (OD-135, ADR-0119).
 *
 * **The drawer's own table** (`Overall.html:10244-10253`): *Year · Rate*, a row per year, *Y1*
 * first — so what the Super Admin types is laid out as every agent of the company reads it. A rate
 * is typed as a percentage and stored as a proportion. Years run from 1 with none missing, so a
 * year is added at the end and **only the last is removed**: removing a middle year would move every
 * later rate to the year before it, a silently wrong number. The server refuses a gap as well.
 *
 * Empty is *not set*, and says so: nothing here offers a default (parity F-15).
 */
function CommissionEditor({
  productId, rates, onChange, showErrors, disabled,
}: {
  productId: string;
  rates: string[];
  onChange: (rates: string[]) => void;
  /** Whether a save was tried: until then an empty row is unfinished, not wrong. */
  showErrors: boolean;
  disabled?: boolean;
}) {
  const t = useMessages(adminTemplateProductsMessages).commission;
  const catalog = useMessages(productCatalogMessages).drawer;
  const setRate = (index: number, value: string) =>
    onChange(rates.map((rate, i) => (i === index ? value : rate)));
  /** The API's last policy year reached: no year is added past it. */
  const full = rates.length >= COMMISSION_MAX_YEARS;
  const fullId = `commission-${productId}-full`;

  return (
    <div className="mt-1">
      {rates.length === 0 ? (
        <p className="text-sm text-muted">{t.notSet}</p>
      ) : (
        <table className="relative border-collapse">
          <caption className="sr-only">{t.caption}</caption>
          <thead>
            <tr>
              <th scope="col" className={TH}>{t.year}</th>
              <th scope="col" className={TH}>{t.rate}</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((rate, index) => {
              const year = index + 1;
              const id = `commission-${productId}-y${year}`;
              const error = rateError(rate, t);
              const shown = error && (showErrors || rate.trim() !== '') ? error : null;
              return (
                <tr key={year}>
                  {/* The year as the agents' drawer heads its row (`product-catalog.ts`): *Y1*, *Tahun 1*. */}
                  <th scope="row" className={TD}>{catalog.yearRow({ year })}</th>
                  <td className={TD}>
                    <TextInput
                      id={id}
                      aria-label={t.rateFor({ year })}
                      aria-describedby={shown ? `${id}-error` : undefined}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      suffix="%"
                      className="w-28"
                      value={rate}
                      invalid={shown !== null}
                      disabled={disabled}
                      onChange={(e) => setRate(index, e.target.value)}
                    />
                    {shown && (
                      <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-semibold text-alert">
                        {shown}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {/* At the API's last year the button says why it stopped, rather than failing on save. */}
        <Button
          variant="inline"
          disabled={disabled || full}
          aria-describedby={full ? fullId : undefined}
          onClick={() => onChange([...rates, ''])}
        >
          {t.addYear}
        </Button>
        {rates.length > 0 && (
          <Button
            variant="inline"
            disabled={disabled}
            onClick={() => onChange(rates.slice(0, -1))}
          >
            {t.removeYear({ year: rates.length })}
          </Button>
        )}
        {full && (
          <p id={fullId} className="m-0 text-xs text-muted">{t.full({ max: COMMISSION_MAX_YEARS })}</p>
        )}
      </div>
    </div>
  );
}

/**
 * **A new product, in the add sheet** (P19.2-T2 AC-2; UI-131 with UI-133's pattern: a bottom sheet on a phone, a centred
 * modal from 768px, *Batal / Tambah* pinned): its name, the code filled in from it, and the two facts a product cannot
 * lack. Below 1024px the channel and the category are choice rows (UI-134: *choice rows inside the sheet for 2–5
 * options*); from 1024px the selects they were. *Tambah* waits for a name and a code nobody on the shelf has, as it did.
 */
function AddProduct({
  disabled,
  taken,
  error,
  onAdd,
  onCancel,
}: {
  disabled?: boolean;
  taken: (code: string) => boolean;
  /** A refusal of the create, said in the sheet where the reader is. */
  error: ReactNode;
  onAdd: (body: ProductFields & { code: string }) => void | Promise<void>;
  onCancel: () => void;
}) {
  const t = useMessages(adminTemplateProductsMessages);
  const settings = useMessages(settingsMessages);
  const language = useLanguage();
  const choices = useMediaQuery(['phone', 'tablet']);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);
  const [channel, setChannel] = useState<ChannelCode>('conventional');
  const [category, setCategory] = useState<CategoryCode>('life');
  const clash = code.trim() !== '' && taken(code.trim().toUpperCase());
  const ready = name.trim() !== '' && code.trim() !== '' && !clash;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || disabled) return;
    void onAdd({
      code: code.trim(),
      name: name.trim(),
      channel: channel as Product['channel'],
      category: category as Product['category'],
    });
  }

  return (
    <AddSheet
      open
      title={t.addProduct}
      submitLabel={settings.add}
      busy={Boolean(disabled) || !ready}
      onClose={onCancel}
      onSubmit={submit}
    >
      {error}
      <Field label={settings.name} htmlFor="add-product-name">
        <TextInput
          id="add-product-name"
          value={name}
          disabled={disabled}
          onChange={(e) => {
            setName(e.target.value);
            if (!touched) setCode(suggestCode(e.target.value));
          }}
        />
      </Field>
      <Field
        label={settings.code}
        htmlFor="add-product-code"
        hint={t.addCodeHint}
        error={clash ? t.codeTaken : undefined}
      >
        <TextInput
          id="add-product-code"
          value={code}
          disabled={disabled}
          invalid={clash}
          onChange={(e) => {
            const value = e.target.value.toUpperCase();
            setCode(value);
            setTouched(value !== '');
          }}
        />
      </Field>
      {choices ? (
        <>
          <div>
            <p id="add-product-channel-label" className="mb-1.5 text-md font-semibold text-navy">{t.channel}</p>
            <ChoiceRows
              labelledBy="add-product-channel-label"
              value={channel}
              onChange={setChannel}
              disabled={disabled}
              options={CHANNELS.map((value) => ({ key: value, label: channelLabel(value, language) }))}
            />
          </div>
          <div>
            <p id="add-product-category-label" className="mb-1.5 text-md font-semibold text-navy">{t.category}</p>
            <ChoiceRows
              labelledBy="add-product-category-label"
              value={category}
              onChange={setCategory}
              disabled={disabled}
              options={CATEGORIES.map((value) => ({ key: value, label: t.categories[value] }))}
            />
          </div>
        </>
      ) : (
        <>
          <Field label={t.channel} htmlFor="add-product-channel">
            <Select
              id="add-product-channel"
              value={channel}
              disabled={disabled}
              onChange={(e) => setChannel(e.target.value as ChannelCode)}
            >
              {CHANNELS.map((value) => <option key={value} value={value}>{channelLabel(value, language)}</option>)}
            </Select>
          </Field>
          <Field label={t.category} htmlFor="add-product-category">
            <Select
              id="add-product-category"
              value={category}
              disabled={disabled}
              onChange={(e) => setCategory(e.target.value as CategoryCode)}
            >
              {CATEGORIES.map((value) => <option key={value} value={value}>{t.categories[value]}</option>)}
            </Select>
          </Field>
        </>
      )}
    </AddSheet>
  );
}
