'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { PublishBar } from '@/components/publish-bar';
import { PdfUploadNotice, usePdfUpload } from '@/components/recruitment/pdf-upload';
import { useSandboxedDocument } from '@/components/sandboxed-document';
import { SettingsScreen } from '@/components/settings-screen';
import { SettingsReviewed } from '@/components/settings-reviewed';
import { BelowDesktopTip } from '@/components/ui/below-desktop-tip';
import { ConfigBadge } from '@/components/ui/config-badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Button, Card, CodeField, Field, Switch, Textarea, TextInput,
} from '@/components/ui/field';
import { InlineSaveStatus, useInlineSave } from '@/components/ui/inline-save-status';
import { FilterChips, ListCard, ListRow, SearchPill } from '@/components/ui/list-rows';
import { CONTROL_PHONE } from '@/components/ui/phone';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { SkeletonCards } from '@/components/ui/skeleton';
import { SHOWN_FROM_DESKTOP } from '@/components/ui/tablet';
import { TonePill, type PillTone } from '@/components/ui/tone-pill';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { settingsMessages } from '@/i18n/messages/settings';
import { settingsProductsMessages } from '@/i18n/messages/settings-products';
import { adminProductProposalMessages } from '@/i18n/messages/admin-product-proposal';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { isHtmlDocument } from '@/lib/html-document';
import { useCan } from '@/lib/session';
import { useHashTab } from '@/lib/use-hash-tab';
import { categoryLabel, channelLabel } from '@/lib/product-catalog';
import { usePhone } from '@/lib/use-phone';
import {
  approveScript, kpmProductDocumentUrl, listKpmProducts, listScriptReviews, readBranchInfo,
  readEffectiveScript, rejectScript, requestProductUpload, resetKpmProductDocument,
  resetKpmProductOverride, saveKpmProductOverrides, setKpmProductActive, setKpmProductDocument,
  PRODUCT_DESCRIPTION_MAX, type KpmProductRow, type ProductDocumentSlotView,
} from '@/lib/tenant-config';
import { PROPOSAL_LIMITS, type FaqEntry, type ObjectionCard, type PlanHighlight } from '@/lib/admin';
import { ObjectionCards, objectionsToSave } from '@/components/objection-cards';
import { FaqList } from '@/components/product-proposal-editor';

/**
 * The seven the override modal names, in its order (`KPM_Owner.html:1785-1791`); each one's label is the catalogue's
 * (`settingsProductsMessages.script`). *Short description (shown to agents)* is too — the prototype's own label, guidance
 * folded into it (`KPM_Owner.html:1781`; parity L-20) — and the shelf's one grey sentence (P18.9-T4 AC-6).
 */
const SCRIPT_FIELDS = [
  { key: 'goodFit', lines: 2 },
  { key: 'opening', lines: 2 },
  { key: 'benefits', lines: 5, list: true },
  { key: 'fullScript', lines: 5 },
  // The cards (P19.4-T4 AC-1, ADR-0209 §9): the office's whole list, or the company's.
  { key: 'objections', lines: 0 },
  { key: 'nextAction', lines: 2 },
] as const;

/** The draft of the cards, held as text beside the other fields' drafts and read back when saved. */
const cardsOfDraft = (text: string | undefined): ObjectionCard[] => {
  try {
    const cards = JSON.parse(text ?? '[]') as unknown;
    return Array.isArray(cards) ? cards as ObjectionCard[] : [];
  } catch {
    return [];
  }
};

/** A draft held as JSON text beside the others (the FAQ, the plan highlights), read back as what it holds. */
function parsed<T>(text: string | undefined, fallback: T): T {
  try {
    return text === undefined ? fallback : JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/** A review's badge tone; its words are the catalogue's (`review`). */
const REVIEW_TONE: Record<string, 'won' | 'open'> = { pending: 'open', approved: 'won', rejected: 'open' };

/**
 * **A phone's row pill: the review's state, in its colour** (P19.2-T3 AC-3; UI-141: *one status pill only when there is
 * one — Disetujui / Menunggu persetujuan / Dikembalikan*), the badge's words in the report's tones.
 */
const ROW_TONE: Record<Exclude<KpmProductRow['reviewState'], 'none'>, PillTone> = {
  approved: 'green', pending: 'amber', rejected: 'red',
};

/** The phone's chips (UI-141: *chips for what needs the owner*): every product, or those whose script waits on them. */
type ShelfChip = 'all' | 'pending' | 'rejected';

/** A field's value as the review reads it: a list one per line, and each objection card *“…” — …* (ADR-0209 §9). */
const asText = (value: string | string[] | ObjectionCard[]) => (Array.isArray(value)
  ? value.map((v) => (typeof v === 'string' ? v : `“${v.objection}” — ${v.answer}`)).join('\n')
  : value);

/** A product's *Agents sell it* switch, in its *Saving… → Saved ✓* (P18.7-T1 AC-5). */
const sellKey = (productId: string) => `${productId}\nactive`;

/**
 * **A document's *Open*** (P17-T9): a PDF in a new tab, as it always was — and **an HTML page in the sandboxed window,
 * never a tab** (P19.6-T2, ADR-0217 §4), the writer's preview of what an agent will see.
 */
function DocumentOpen({
  productId,
  doc,
  onFailed,
}: {
  productId: string;
  doc: ProductDocumentSlotView;
  onFailed: (error: ApiError) => void;
}) {
  const t = useMessages(settingsProductsMessages);
  const page = useSandboxedDocument();
  const html = isHtmlDocument(doc.mimeType);
  const open = async () => {
    try {
      if (html) {
        await page.open(doc.label, async () => (await kpmProductDocumentUrl(productId, doc.slot)).url);
        return;
      }
      const { url } = await kpmProductDocumentUrl(productId, doc.slot);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      onFailed(toDisplayError(err));
    }
  };
  return (
    <>
      <Button variant="inline" onClick={() => void open()}>{t.open}</Button>
      {html && page.dialog}
    </>
  );
}

/**
 * A product document's upload (P17-T9, D-productdocs): the office's own PDF for one slot, through the
 * control the recruitment pitch uses — refused here when it is not a PDF or larger than the bound,
 * signed into the office's own folder, sent straight to storage, then attached by
 * `PUT /kpm/settings/products/:productId/documents/:slot`, which confirms what landed.
 *
 * The prototype's words and place (`KPM_Owner.html:2404`): a row action beside *Open link →*, *Replace*
 * when the slot holds a file — the company's or the office's — and *+ Upload* when it holds none.
 * Offered on a product the office keeps on only (AC-1), and never without `tenant_config:write`, which
 * a read-only support session does not hold. The name says which document, since every row has one.
 */
function DocumentUpload({
  productId,
  slot,
  label,
  hasFile,
  disabled,
  onAttached,
}: {
  productId: string;
  slot: string;
  label: string;
  hasFile: boolean;
  disabled: boolean;
  onAttached: (row: KpmProductRow) => void;
}) {
  const t = useMessages(settingsProductsMessages);
  const upload = usePdfUpload<KpmProductRow>({
    sign: requestProductUpload,
    // The label is the file's own name, cut to the 200 characters the attach takes, so a long name that
    // signed and uploaded is never refused afterwards.
    attach: (storageKey, file) => setKpmProductDocument(productId, slot, { storageKey, label: file.name.slice(0, 200) }),
    onAttached,
  });
  const blocked = disabled || upload.busy;

  return (
    <>
      <Button
        variant="inline"
        aria-label={hasFile ? t.replaceName({ label }) : t.uploadName({ label })}
        // Not `disabled`, which would drop the focus while the file is on its way.
        aria-disabled={blocked || undefined}
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
        onClick={() => { if (!blocked) upload.choose(); }}
      >
        {hasFile ? t.replace : t.upload}
      </Button>
      {upload.picker}
      {/* Under the row, whichever of its actions comes after: the row wraps it onto its own line. */}
      <PdfUploadNotice state={upload} className="order-last flex basis-full flex-col gap-2" />
    </>
  );
}

/**
 * What this office sells, and the words it sells it with (P5-T5, ADR-0033).
 *
 * **The catalog is the company's and is read live.** Nothing here copies a product: each row shows
 * the company's value with this office's decision laid over it, field by field, so a company edit
 * to something this office has not touched arrives on the next read with nobody publishing
 * anything — and a product the company withdraws stops being sellable with no action here at all.
 *
 * **Every "use my company's again" is an unset, never a copy.** The prototype's Reset copies the
 * default into the form, which looks identical today and silently freezes today's wording into the
 * office for ever.
 */
/** The two halves of this screen: the shelf, and what is waiting on somebody (P5-T10). */
const TABS = [
  { label: settingsProductsMessages.en.tabs.products, href: '#products' },
  { label: settingsProductsMessages.en.tabs.approvals, href: '#approvals' },
];

export default function KpmProductsPage() {
  const t = useMessages(settingsProductsMessages);
  const s = useMessages(settingsMessages);
  /** The proposal section's title, *Proposal*, as the Super Admin's editor names it. */
  const p = useMessages(adminProductProposalMessages);
  const language = useLanguage();
  const canWrite = useCan('tenant_config:write');
  /** The screen's own read: without it the gate refuses, and nothing here asks the API for the drafts. */
  const canRead = useCan('product_settings:read');
  /**
   * Approving is its **own** permission (ADR-0037), and the one deliberate exception to
   * ADR-0027's single settings permission — so somebody may be able to edit a script and not to
   * approve it the day that grant moves.
   */
  const canApprove = useCan('sales_script:approve');
  const [tab, setTab] = useHashTab(TABS);
  /**
   * The product whose *Review* was chosen on the shelf (P18.9-T4 AC-7, ADR-0176 §7; UI-028): its card on *Script
   * approvals* takes the focus once the queue holds it, so the reader lands on the script they asked to review.
   */
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [sendingBack, setSendingBack] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [rows, setRows] = useState<KpmProductRow[] | null>(null);
  /**
   * The office's own insurer, read rather than assumed.
   *
   * The prototype writes **Prudential** into this screen eleven times (`KPM_Owner.html:1705`,
   * `:1784`, `:2397`…). A second insurer's office would read another company's name on every row
   * of its own settings.
   */
  const [companyName, setCompany] = useState<string | null>(null);
  const company = companyName ?? t.yourCompany;
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  /**
   * The queue, read from its own route rather than filtered out of the shelf.
   *
   * The shelf is 31 rows and the queue is usually none of them; asking the server which ones are
   * waiting is both the cheaper read and the one whose answer cannot drift from the gate's own
   * idea of what is pending.
   */
  const [queue, setQueue] = useState<KpmProductRow[] | null>(null);
  /** What agents are reading **right now**, per product — the comparison a decision needs. */
  const [served, setServed] = useState<Record<string, { source: 'kpm' | 'company' }>>({});
  const inline = useInlineSave();
  /*
   * **Below 768px the shelf is one line per product, and a product's controls are in its sheet** (P19.2-T3 AC-3; UI-141:
   * *products with "Agent menjualnya" switch and "Sesuaikan" on every row*, 6.1 screens at 375; `kpm-owner-mobile` 7).
   * Asked where the screen mounts, so a phone never draws the cards first. From 768px the shelf is as it was.
   */
  const phone = usePhone();
  /** The product whose sheet is open, on a phone. */
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [chip, setChip] = useState<ShelfChip>('all');
  /*
   * *Customize* in a sheet gives way to the words it opens, so the focus goes to the first of them rather than to the
   * top of the page with the button that had it (WCAG 2.4.3).
   */
  useEffect(() => {
    if (phone && open !== null && open === sheetFor) document.getElementById(`name-${open}`)?.focus();
  }, [phone, open, sheetFor]);

  const load = useCallback(async () => {
    try {
      const [shelf, branch] = await Promise.all([listKpmProducts(), readBranchInfo()]);
      setRows(shelf);
      setCompany(branch.companyName);
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { if (canRead) void load(); }, [load, canRead]);

  const loadQueue = useCallback(async () => {
    try {
      const waiting = await listScriptReviews();
      setQueue(waiting);
      // What each one's agents are reading today, so an approval is a comparison rather than a
      // leap: this is the same read Phase 12 serves an agent, so what is shown here is what they
      // have, not a reconstruction of it.
      const now = await Promise.all(waiting.map(async (p) => {
        const { source } = await readEffectiveScript(p.productId);
        return [p.productId, { source }] as const;
      }));
      setServed(Object.fromEntries(now));
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { if (canRead && tab === '#approvals') void loadQueue(); }, [tab, loadQueue, canRead]);

  // *Review*'s landing: the product's card, once it is drawn — the queue read may still be on its way.
  useEffect(() => {
    if (tab !== '#approvals' || reviewing === null || queue === null) return;
    const card = document.getElementById(`review-${reviewing}`);
    if (!card) return;
    card.scrollIntoView?.({ block: 'center' });
    card.focus();
    setReviewing(null);
  }, [tab, reviewing, queue]);

  const run = async (action: () => Promise<KpmProductRow>) => {
    setBusy(true);
    setError(null);
    try {
      const row = await action();
      setRows((now) => now?.map((p) => (p.productId === row.productId ? row : p)) ?? now);
      return row;
    } catch (err) {
      setError(toDisplayError(err));
      return null;
    } finally {
      setBusy(false);
    }
  };

  /** A decision leaves the queue: it changes both halves, so both are re-read. */
  const decide = async (action: () => Promise<KpmProductRow>) => {
    const row = await run(action);
    if (row) await loadQueue();
    return row;
  };

  function body() {
    if (rows === null) return error ? null : <SkeletonCards count={4} />;
    if (rows.length === 0) {
      return (
        <EmptyState title={t.noProducts({ company })} />
      );
    }

    // A rider is not a product of the shelf: it sits under its bases (P19.4-T4 AC-8, ADR-0209 §6).
    const shelf = rows.filter((p) => p.kind !== 'rider');
    const selling = shelf.filter((p) => p.sellable && p.active.value).length;
    const countCard = (
      <Card>
        <p className={cn('text-md text-muted', SHOWN_FROM_DESKTOP)}>{t.shelfNote}</p>
        {/*
          * Counted from what is actually sellable. The prototype's header reads "6 active" over
          * seven toggles, because it counts a list it no longer matches (P5-T5 AC-8). Below 1024px it is the card's
          * first line, and the sentence above it is the ⓘ after it (P18.9-T4 AC-6).
          */}
        <p className="text-sm text-muted lg:mt-2">
          {t.shelfCount({
            n: shelf.length,
            selling: <strong>{selling}</strong>,
            withdrawn: shelf.some((p) => !p.sellable) ? shelf.filter((p) => !p.sellable).length : null,
            company,
          })}
          <BelowDesktopTip text={t.shelfNote} className="ml-1" />
        </p>
      </Card>
    );
    const refusal = error && (
      <div role="alert" className="rounded-md border border-primary bg-card p-4">
        <p className="text-md text-navy">{error.message}</p>
      </div>
    );

    if (phone) return phoneShelf(countCard, refusal);

    return (
      <div className="flex flex-col gap-4">
        {countCard}

        {refusal}

        <ul className="flex flex-col gap-3">
          {shelf.map((product) => (
            <li key={product.productId}>
              <Card className="p-0">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-md font-semibold text-navy">
                      {product.displayName.value}
                    </h2>
                    {product.displayName.overridden && (
                      <p className="mt-0.5 text-sm text-muted">
                        {t.callsIt({ company, name: product.companyName })}
                      </p>
                    )}
                    {badges(product)}
                    {ridersUnder(product)}
                  </div>

                  {rowControls(product)}
                </div>

                {open === product.productId && panel(product)}
              </Card>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  /**
   * **The riders sold with a base** (P19.4-T4 AC-8; the riders spec's rule 6; ADR-0209 §6): under each base it attaches
   * to, with no switch of its own — on exactly when one of its bases is, which the server derives.
   */
  function ridersUnder(product: KpmProductRow) {
    const riders = (rows ?? []).filter((p) => p.kind === 'rider' && p.sellable && p.attachesTo.includes(product.productId));
    if (riders.length === 0) return null;
    return (
      <div className="mt-2">
        <p className="text-sm font-semibold text-muted">{t.ridersUnder}</p>
        <ul className="mt-1 flex flex-col gap-1">
          {riders.map((rider) => (
            <li key={rider.productId} className="flex flex-wrap items-center gap-2 text-md text-navy" data-rider={rider.code}>
              <ConfigBadge tone="navy">{t.riderChip}</ConfigBadge>
              <span>{rider.displayName.value}</span>
              <span className="text-sm text-muted">{t.riderFollows({ on: rider.active.value })}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  /** A product's badges: its category, its channel, withdrawn, its review and the review's action (P18.9-T4 AC-7). */
  function badges(product: KpmProductRow) {
    return (
      <p className="mt-1 flex flex-wrap items-center gap-2">
        <ConfigBadge tone="open">{product.category}</ConfigBadge>
        {/*
          * Syariah green, conventional grey, exactly as the prototype has them
          * (`KPM_Owner.html:1714`, `:1748`). The field arrived from the API from the
          * day this screen was built and nothing rendered it, so an office selling
          * both could not tell one shelf from the other.
          */}
        <ConfigBadge tone={product.channel === 'syariah' ? 'won' : 'open'}>
          {channelLabel(product.channel === 'syariah' ? 'syariah' : 'conventional', language)}
        </ConfigBadge>
        {!product.sellable && (
          <ConfigBadge tone="open">{t.withdrawnBy({ company })}</ConfigBadge>
        )}
        {product.reviewState !== 'none' && (
          <ConfigBadge tone={REVIEW_TONE[product.reviewState]}>
            {t.review[product.reviewState]}
          </ConfigBadge>
        )}
        {/*
          * **The badge's action, beside it** (P18.9-T4 AC-7, ADR-0176 §7; UI-028: *"WAITING FOR YOUR
          * APPROVAL"* with no way to act on it from the row): the product's script review, where it is
          * approved or sent back — for whoever holds `sales_script:approve`, which the API checks again.
          */}
        {product.reviewState === 'pending' && canApprove && (
          <Button
            variant="inline"
            aria-label={t.reviewName({ name: product.displayName.value })}
            onClick={() => {
              setReviewing(product.productId);
              setSheetFor(null);
              setTab('#approvals');
            }}
          >
            {t.reviewButton}
          </Button>
        )}
      </p>
    );
  }

  /** A product's *Agents sell it* switch and its *Customize* — on its card from 768px, in its sheet below it. */
  function rowControls(product: KpmProductRow, inSheet = false) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {product.sellable && (
          /*
            * The prototype's switch (`KPM_Owner.html:1715`), which is also why there
            * is no *"Your agents sell it"* badge any more: the switch's state **is**
            * that sentence, and two things saying it invites them to disagree.
            *
            * A reader who cannot write still sees it, disabled — the shelf is worth
            * reading even when it is not yours to change.
            */
          <>
            <Switch
              id={`sell-${product.productId}`}
              label={t.agentsSellIt}
              checked={product.active.value}
              disabled={busy || !canWrite}
              // A 44 × 44px target on a phone, the track as drawn (P18.9-T7 AC-6; UI-040), and on a tablet (P19.2-T3 AC-4).
              phoneTarget
              tabletTarget
              // It saves itself, and says so beside it (P18.7-T1 AC-5): a retry sends this same value
              // again. The reason for a refusal stays in the alert above the shelf, where it was.
              onChange={(next) => void inline.save(sellKey(product.productId), async () =>
                (await run(() => setKpmProductActive(product.productId, next))) !== null)}
            />
            <InlineSaveStatus
              state={inline.stateOf(sellKey(product.productId))}
              label={t.agentsSellItFor({ name: product.displayName.value })}
              onRetry={() => {
                inline.retry(sellKey(product.productId));
                document.getElementById(`sell-${product.productId}`)?.focus();
              }}
            />
          </>
        )}
        {/* In a phone's sheet *Customize* opens the product's words and they stay open until the sheet closes. */}
        {!(inSheet && open === product.productId) && (
          <Button
            variant="inline"
            disabled={busy}
            onClick={() => {
              const next = open === product.productId ? null : product.productId;
              setOpen(next);
              setDraft(next ? draftOf(product) : {});
            }}
          >
            {open === product.productId ? t.close : t.customize}
          </Button>
        )}
      </div>
    );
  }

  /**
   * **The shelf on a phone** (P19.2-T3 AC-3; UI-141, `kpm-owner-mobile` 7): *Cari produk*, the chips for what waits on
   * the owner, the count line, then one 56px row per product — its name, *category · channel*, one pill only when there
   * is one (withdrawn, or the script's review), › — which opens the product's sheet. Everything a card held is in the
   * sheet: the badges and *Review*, *Agents sell it*, *Customize* and the product's own words.
   */
  function phoneShelf(countCard: ReactNode, refusal: ReactNode) {
    const all = (rows ?? []).filter((p) => p.kind !== 'rider');
    const pending = all.filter((p) => p.reviewState === 'pending').length;
    const rejected = all.filter((p) => p.reviewState === 'rejected').length;
    const term = search.trim().toLocaleLowerCase();
    const shown = all
      .filter((p) => chip === 'all' || p.reviewState === chip)
      .filter((p) => term === ''
        || [p.displayName.value, p.companyName, p.code].some((v) => v.toLocaleLowerCase().includes(term)));
    const chips = [
      { key: 'all' as const, label: t.chips.all, count: all.length },
      ...(pending > 0 ? [{ key: 'pending' as const, label: t.chips.pending, count: pending }] : []),
      ...(rejected > 0 ? [{ key: 'rejected' as const, label: t.chips.rejected, count: rejected }] : []),
    ];
    return (
      <div className="flex flex-col gap-2.5">
        <SearchPill label={t.search} value={search} onChange={setSearch} />
        {chips.length > 1 && <FilterChips label={t.chips.label} chips={chips} active={chip} onSelect={setChip} />}
        {countCard}
        {refusal}
        {shown.length === 0 ? (
          <p className="px-1 py-3 text-md text-muted">{t.noMatch}</p>
        ) : (
          <ListCard label={t.tabs.products}>
            {shown.map((product) => (
              <ListRow
                key={product.productId}
                data-row={product.productId}
                title={product.displayName.value}
                meta={`${categoryLabel(product.category, language) ?? product.category} · ${
                  channelLabel(product.channel === 'syariah' ? 'syariah' : 'conventional', language)}`}
                trailing={rowPill(product)}
                haspopup
                onSelect={() => { setSheetFor(product.productId); setOpen(null); setDraft({}); }}
              />
            ))}
          </ListCard>
        )}
      </div>
    );
  }

  /** The one pill a phone's row wears, when there is one: withdrawn first — nobody can sell it — then the review. */
  function rowPill(product: KpmProductRow) {
    if (!product.sellable) return <TonePill tone="grey">{t.withdrawnBy({ company })}</TonePill>;
    if (product.reviewState === 'none') return null;
    return <TonePill tone={ROW_TONE[product.reviewState]}>{t.review[product.reviewState]}</TonePill>;
  }

  /** The product opened from its row, on a phone: what its card held, and its words under *Customize*. */
  function productSheet() {
    const product = sheetFor === null ? null : rows?.find((p) => p.productId === sheetFor) ?? null;
    return (
      <ResponsiveSheet
        open={product !== null}
        title={product?.displayName.value ?? ''}
        onClose={() => { setSheetFor(null); setOpen(null); setDraft({}); }}
      >
        {product && (
          <div className="flex flex-col gap-3">
            {product.displayName.overridden && (
              <p className="text-sm text-muted">{t.callsIt({ company, name: product.companyName })}</p>
            )}
            {badges(product)}
            {ridersUnder(product)}
            {rowControls(product, true)}
            {open === product.productId && <div className="-mx-6">{panel(product)}</div>}
          </div>
        )}
      </ResponsiveSheet>
    );
  }

  /**
   * What is waiting on somebody here.
   *
   * A queue rather than a hunt through 31 products: the point of a gate is that whoever holds it
   * can see what is behind it.
   */
  function approvalsTab() {
    if (queue === null) return error ? null : <SkeletonCards count={2} />;
    const waiting = queue.filter((p) => p.reviewState === 'pending');
    const sentBack = queue.filter((p) => p.reviewState === 'rejected');

    return (
      <div className="flex flex-col gap-4">
        <Card>
          <p className="text-md text-navy">
            <strong>{t.ownCheck}</strong>{' '}
            <span className="text-muted">
              {t.ownCheckLine({ company })}
            </span>
          </p>
          <p className="mt-2 text-sm text-muted">
            {t.untilApproved({ company })}
          </p>
        </Card>

        {waiting.length === 0 && sentBack.length === 0 ? (
          <EmptyState title={t.nothingWaiting} />
        ) : (
          <ul className="flex flex-col gap-3">
            {[...waiting, ...sentBack].map((product) => (
              <li key={product.productId}>
                <Card>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Where the shelf's *Review* lands (P18.9-T4 AC-7): focusable by script, never a tab stop. */}
                      <h2 id={`review-${product.productId}`} tabIndex={-1} className="text-md font-semibold text-navy">
                        {product.displayName.value}
                      </h2>
                      <p className="mt-1 flex flex-wrap items-center gap-2">
                        <ConfigBadge tone={REVIEW_TONE[product.reviewState]}>
                          {product.reviewState !== 'none' && t.review[product.reviewState]}
                        </ConfigBadge>
                      </p>
                      {product.rejectionReason && (
                        <p className="mt-1 text-sm text-muted">
                          {t.sentBack({ reason: product.rejectionReason })}
                        </p>
                      )}
                      <p className="mt-1 text-sm text-muted">
                        {served[product.productId]?.source === 'kpm'
                          ? t.readingEarlier
                          : t.readingCompany({ company })}
                      </p>
                      <ul className="mt-2 flex flex-col gap-1">
                        {/* Held with the script since OD-136, so it is decided with it. */}
                        {product.description?.overridden && (
                          <li className="text-md text-navy">
                            <span className="text-sm font-semibold text-muted">{t.description}: </span>
                            {product.description.value}
                          </li>
                        )}
                        {/* The words as the office typed them, line breaks kept (P19-T6 AC-1). */}
                        {SCRIPT_FIELDS.filter((f) => product.script[f.key]?.overridden).map((f) => (
                          <li key={f.key} className="whitespace-pre-line text-md text-navy">
                            <span className="text-sm font-semibold text-muted">{t.script[f.key]}: </span>
                            {asText(product.script[f.key].value)}
                          </li>
                        ))}
                        {/* The proposal's FAQ and plan highlights, decided with the script (P19.7-T1 AC-3; ADR-0225 §5). */}
                        {product.faq?.overridden && (
                          <li className="whitespace-pre-line text-md text-navy" data-review-faq="">
                            <span className="text-sm font-semibold text-muted">{t.faqToApprove}: </span>
                            {product.faq.value.map((q) => `${q.question} — ${q.answer}`).join('\n')}
                          </li>
                        )}
                        {(product.plans ?? []).filter((plan) => plan.highlights.overridden).map((plan) => (
                          <li key={plan.name} className="text-md text-navy">
                            <span className="text-sm font-semibold text-muted">{t.highlightsToApprove({ plan: plan.name })}: </span>
                            {plan.highlights.value.map((h) => `${h.label} ${h.value}`).join(' · ')}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {canApprove && product.reviewState === 'pending' && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={busy}
                          className={CONTROL_PHONE}
                          onClick={() => void decide(() => approveScript(product.productId))}
                        >
                          {t.approve}
                        </Button>
                        <Button
                          variant="inline"
                          disabled={busy}
                          onClick={() => { setSendingBack(product.productId); setReason(''); }}
                        >
                          {t.sendBack}
                        </Button>
                      </div>
                    )}
                  </div>

                  {sendingBack === product.productId && (
                    <div className="mt-3 border-t border-hairline pt-3">
                      <Field
                        label={t.whySendBack}
                        htmlFor={`reason-${product.productId}`}
                        hint={t.whySendBackHint}
                      >
                        <Textarea
                          id={`reason-${product.productId}`}
                          rows={2}
                          value={reason}
                          disabled={busy}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </Field>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          disabled={busy || !reason.trim()}
                          className={CONTROL_PHONE}
                          onClick={() => void decide(async () => {
                            const next = await rejectScript(product.productId, reason.trim());
                            setSendingBack(null);
                            return next;
                          })}
                        >
                          {t.sendItBack}
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={busy}
                          className={CONTROL_PHONE}
                          onClick={() => setSendingBack(null)}
                        >
                          {s.cancel}
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const draftOf = (product: KpmProductRow): Record<string, string> => ({
    displayName: product.displayName.value,
    description: product.description?.value ?? '',
    // The proposal's two, held as JSON like the cards (P19.7-T1 AC-3).
    faq: JSON.stringify(product.faq?.value ?? []),
    planHighlights: JSON.stringify(Object.fromEntries((product.plans ?? []).map((p) => [p.name, p.highlights.value]))),
    ...Object.fromEntries(
      SCRIPT_FIELDS.map((f) => [f.key, f.key === 'objections'
        ? JSON.stringify(product.script.objections?.value ?? [])
        : asText(product.script[f.key]?.value ?? '')]),
    ),
  });

  /**
   * One product opened: the name, the description, the seven script fields, and the three
   * document slots.
   */
  function panel(product: KpmProductRow) {
    /**
     * **The plans the office has a word on**: those it already replaced, and those changed in this draft — never a copy
     * of the company's highlights for a plan nobody touched, which would freeze today's into the office (ADR-0033).
     */
    const highlightsToSave = (): Record<string, PlanHighlight[]> => {
      const typed = parsed<Record<string, PlanHighlight[]>>(draft.planHighlights, {});
      return Object.fromEntries((product.plans ?? [])
        .filter((plan) => plan.highlights.overridden
          || JSON.stringify(typed[plan.name] ?? []) !== JSON.stringify(plan.highlights.value))
        .map((plan) => [plan.name, (typed[plan.name] ?? []).filter((h) => h.label.trim() || h.value.trim())]));
    };
    const save = async (key: string) => {
      const value = key === 'benefits'
        ? draft.benefits.split('\n').map((l) => l.trim()).filter(Boolean)
        : key === 'objections' ? objectionsToSave(cardsOfDraft(draft.objections))
          : key === 'faq' ? parsed<FaqEntry[]>(draft.faq, []).filter((q) => q.question.trim() || q.answer.trim())
            : key === 'planHighlights' ? highlightsToSave() : draft[key];
      const row = await run(() => saveKpmProductOverrides(product.productId, { [key]: value }));
      // A blank description is given back to the company, so the box shows the company's again.
      if (row && key === 'description') {
        setDraft((n) => ({ ...n, description: row.description?.value ?? '' }));
      }
      return row;
    };

    /*
     * **The proposal's FAQ and each plan's highlights, the office's own** (P19.7-T1 AC-3; ADR-0225 §5; the proposal
     * spec's decision 6): the company's until the office writes its own, held for approval with the script, *Use
     * {company}'s* an unset. Only the plans the company has.
     */
    const faq = parsed<FaqEntry[]>(draft.faq, []);
    const highlights = parsed<Record<string, PlanHighlight[]>>(draft.planHighlights, {});
    const setHighlights = (plan: string, next: PlanHighlight[]) =>
      setDraft((n) => ({ ...n, planHighlights: JSON.stringify({ ...highlights, [plan]: next }) }));
    const resetButton = (field: 'faq' | 'planHighlights') => (
      <Button
        variant="inline"
        disabled={busy}
        onClick={() => void run(async () => {
          const row = await resetKpmProductOverride(product.productId, field);
          setDraft(draftOf(row));
          return row;
        })}
      >
        {t.useCompanys({ company })}
      </Button>
    );
    const proposalBlock = (
      <div data-office-proposal="">
        <h3 className="mt-5 font-display text-md font-bold text-navy">{p.title}</h3>
        <p className="text-sm text-muted">{t.proposalLine({ company })}</p>
        <FaqList
          idPrefix={`faq-${product.productId}`}
          entries={faq}
          onChange={(next) => setDraft((n) => ({ ...n, faq: JSON.stringify(next) }))}
          disabled={!canWrite || busy}
          hint={product.faq?.overridden ? t.yours : t.following({ company })}
        />
        {canWrite && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} className={CONTROL_PHONE} onClick={() => void save('faq')}>{t.saveFaq}</Button>
            {product.faq?.overridden && resetButton('faq')}
          </div>
        )}

        {(product.plans ?? []).length > 0 && (
          <fieldset className="mt-4" data-office-plans="">
            <legend className="text-sm font-semibold text-navy">{t.planHighlights}</legend>
            <ul className="flex flex-col gap-3">
              {(product.plans ?? []).map((plan) => {
                const rows = highlights[plan.name] ?? [];
                return (
                  <li key={plan.name} className="rounded-md border border-hairline p-3" data-office-plan={plan.name}>
                    <p className="flex flex-wrap items-center gap-2 text-md font-semibold text-navy">
                      {plan.name}
                      {plan.popular && <ConfigBadge tone="won">{t.popularPlan}</ConfigBadge>}
                      <span className="text-sm font-normal text-muted">{plan.highlights.overridden ? t.yours : t.following({ company })}</span>
                    </p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {rows.map((h, n) => (
                        <li key={n} className="flex flex-wrap items-center gap-2">
                          <TextInput
                            aria-label={t.planHighlight({ plan: plan.name, n: n + 1, part: 'label' })}
                            value={h.label}
                            maxLength={30}
                            disabled={!canWrite || busy}
                            className={cn('min-w-40 flex-1', CONTROL_PHONE)}
                            onChange={(e) => setHighlights(plan.name, rows.map((r, i) => (i === n ? { ...r, label: e.target.value } : r)))}
                          />
                          <TextInput
                            aria-label={t.planHighlight({ plan: plan.name, n: n + 1, part: 'value' })}
                            value={h.value}
                            maxLength={40}
                            disabled={!canWrite || busy}
                            className={cn('min-w-40 flex-1', CONTROL_PHONE)}
                            onChange={(e) => setHighlights(plan.name, rows.map((r, i) => (i === n ? { ...r, value: e.target.value } : r)))}
                          />
                          {canWrite && (
                            <Button variant="inline" disabled={busy} onClick={() => setHighlights(plan.name, rows.filter((_, i) => i !== n))}>
                              {t.removeHighlight({ plan: plan.name, n: n + 1 })}
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                    {canWrite && (
                      <Button
                        variant="inline"
                        className="mt-1"
                        disabled={busy || rows.length >= PROPOSAL_LIMITS.PLAN_HIGHLIGHTS}
                        onClick={() => setHighlights(plan.name, [...rows, { label: '', value: '' }])}
                      >
                        {t.addHighlight({ plan: plan.name })}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
            {canWrite && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="secondary" disabled={busy} className={CONTROL_PHONE} onClick={() => void save('planHighlights')}>
                  {t.saveHighlights}
                </Button>
                {(product.plans ?? []).some((plan) => plan.highlights.overridden) && resetButton('planHighlights')}
              </div>
            )}
          </fieldset>
        )}
      </div>
    );

    return (
      <div className="border-t border-hairline px-4 py-4 sm:px-5">
        <CodeField
          id={`code-product-code-${product.code}`}
          value={product.code}
          reason={t.codeReason({ company })}
          className="max-w-xs"
          inputClassName={CONTROL_PHONE}
        />

        <Field
          label={t.officeName}
          htmlFor={`name-${product.productId}`}
          hint={product.displayName.overridden
            ? t.yoursCalls({ company, name: product.companyName })
            : t.following({ company })}
          className="mt-3"
        >
          <TextInput
            id={`name-${product.productId}`}
            value={draft.displayName ?? ''}
            disabled={!canWrite || busy}
            className={CONTROL_PHONE}
            onChange={(e) => setDraft((n) => ({ ...n, displayName: e.target.value }))}
          />
        </Field>
        {canWrite && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button disabled={busy} className={CONTROL_PHONE} onClick={() => void save('displayName')}>{t.saveName}</Button>
            {product.displayName.overridden && (
              <Button
                variant="inline"
                disabled={busy}
                onClick={() => void run(async () => {
                  const row = await resetKpmProductOverride(product.productId, 'displayName');
                  setDraft(draftOf(row));
                  return row;
                })}
              >
                {t.useCompanyName({ company })}
              </Button>
            )}
          </div>
        )}

        {/*
          * The Details tab's one field (`KPM_Owner.html:1781`), which nothing built until OD-136.
          * Held for approval with the script (ADR-0120): a tagline is a sentence an agent may repeat
          * to a customer, so agents read the company's until the office approves its own.
          */}
        <div className="mt-3">
          <Field
            label={t.description}
            htmlFor={`description-${product.productId}`}
            hint={product.description?.overridden ? t.yours : t.following({ company })}
          >
            <Textarea
              id={`description-${product.productId}`}
              rows={2}
              maxLength={PRODUCT_DESCRIPTION_MAX}
              value={draft.description ?? ''}
              disabled={!canWrite || busy}
              onChange={(e) => setDraft((n) => ({ ...n, description: e.target.value }))}
            />
          </Field>
          {canWrite && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" disabled={busy} className={CONTROL_PHONE} onClick={() => void save('description')}>
                {s.save}
              </Button>
              {product.description?.overridden && (
                <Button
                  variant="inline"
                  disabled={busy}
                  onClick={() => void run(async () => {
                    const row = await resetKpmProductOverride(product.productId, 'description');
                    setDraft(draftOf(row));
                    return row;
                  })}
                >
                  {t.useCompanys({ company })}
                </Button>
              )}
            </div>
          )}
        </div>

        <h3 className="mt-5 font-display text-md font-bold text-navy">{t.attackPlan}</h3>
        <p className="text-sm text-muted">
          {t.attackPlanLine({ company })}
        </p>
        {product.reviewState === 'rejected' && product.rejectionReason && (
          <p role="alert" className="mt-2 text-md text-navy">
            <strong>{t.sentBackLabel}</strong> {product.rejectionReason}
          </p>
        )}

        {SCRIPT_FIELDS.map((f) => (
          <div key={f.key} className="mt-3">
            {f.key === 'objections' ? (
              <ObjectionCards
                idPrefix={`objections-${product.productId}`}
                legend={t.script.objections}
                hint={product.script.objections?.overridden ? t.yours : t.following({ company })}
                cards={cardsOfDraft(draft.objections)}
                onChange={(cards) => setDraft((n) => ({ ...n, objections: JSON.stringify(cards) }))}
                disabled={!canWrite || busy}
              />
            ) : (
              <Field
                label={t.script[f.key]}
                htmlFor={`${f.key}-${product.productId}`}
                hint={product.script[f.key]?.overridden
                  ? t.yours
                  : t.following({ company })}
              >
                <Textarea
                  id={`${f.key}-${product.productId}`}
                  rows={f.lines}
                  value={draft[f.key] ?? ''}
                  disabled={!canWrite || busy}
                  onChange={(e) => setDraft((n) => ({ ...n, [f.key]: e.target.value }))}
                />
              </Field>
            )}
            {canWrite && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="secondary" disabled={busy} className={CONTROL_PHONE} onClick={() => void save(f.key)}>
                  {s.save}
                </Button>
                {product.script[f.key]?.overridden && (
                  <Button
                    variant="inline"
                    disabled={busy}
                    onClick={() => void run(async () => {
                      const row = await resetKpmProductOverride(product.productId, f.key);
                      setDraft(draftOf(row));
                      return row;
                    })}
                  >
                    {t.useCompanys({ company })}
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}

        {proposalBlock}

        <h3 className="mt-5 font-display text-md font-bold text-navy">{t.documents}</h3>
        <ul className="mt-2 flex flex-col divide-y divide-hairline">
          {product.documents.map((doc) => (
            <li key={doc.slot} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-md text-navy">{doc.label}</p>
                <p className="text-sm text-muted">
                  {doc.source === 'kpm' && t.uploadedByOffice({ file: doc.filename ?? '' })}
                  {doc.source === 'company' && t.fromCatalog({ company })}
                  {doc.source === 'none' && t.noDocument}
                </p>
              </div>
              {doc.storageKey && (
                <DocumentOpen productId={product.productId} doc={doc} onFailed={setError} />
              )}
              {canWrite && product.sellable && product.active.value && (
                <DocumentUpload
                  productId={product.productId}
                  slot={doc.slot}
                  label={doc.label}
                  hasFile={doc.storageKey !== null}
                  disabled={busy}
                  onAttached={(row) => {
                    setError(null);
                    setRows((now) => now?.map((p) => (p.productId === row.productId ? row : p)) ?? now);
                  }}
                />
              )}
              {canWrite && doc.source === 'kpm' && (
                <Button
                  variant="inline"
                  disabled={busy}
                  onClick={() => void run(() =>
                    resetKpmProductDocument(product.productId, doc.slot))}
                >
                  {t.useCompanys({ company })}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <SettingsScreen
      title={t.title}
      subtitle={t.subtitle({ company })}
      // P19.3-T2 AC-5 (UI-149): *Sudah sesuai*, step 4 of the KPM setup card.
      actions={<SettingsReviewed page="products" />}
      /*
       * The office's drafts and review state live here (ADR-0037), so its read is the Owner's and the
       * Admin's alone — `product_settings:read`, not `tenant_config:read`, which every member holds
       * (the Phase 14 exit review). A field member reads the approved words on `/product-catalog`.
       */
      permission="product_settings:read"
      tabs={TABS.map((tab, i) => ({ ...tab, label: [t.tabs.products, t.tabs.approvals][i] }))}
      tabsLabel={t.tabsLabel}
      activeHref={tab}
      onSelectTab={setTab}
      error={rows === null ? error : null}
      bars={<PublishBar />}
    >
      {tab === '#approvals' ? approvalsTab() : body()}
      {phone && tab !== '#approvals' && productSheet()}
    </SettingsScreen>
  );
}
