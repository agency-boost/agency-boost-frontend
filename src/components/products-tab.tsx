'use client';

import { useCallback, useEffect, useState } from 'react';
import { ConfigBadge } from '@/components/ui/config-badge';
import { DragHandle } from '@/components/ui/drag-handle';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Button, Card, CodeField, Field, FieldRow, ReadOnlyField, Select, Textarea, TextInput,
} from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { suggestCode } from '@/lib/config-code';
import { formatDecimalInput, parseDecimal } from '@/lib/format';
import {
  closeProductToNewBusiness, COMMISSION_MAX_YEARS, createProduct, readProducts, reopenProduct, reorderProducts,
  updateProduct, withdrawProduct,
  type Product, type ProductFields, type ProductLifecycle,
} from '@/lib/admin';
import { AGE_CHOICES, budgetChoices, channelLabel, needLabel } from '@/lib/product-catalog';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import type { MessagesOf } from '@/i18n/catalogue';
import type { Language } from '@/i18n/language';
import { adminTemplateProductsMessages } from '@/i18n/messages/admin-template-products';
import { productCatalogMessages } from '@/i18n/messages/product-catalog';
import { settingsMessages } from '@/i18n/messages/settings';

/** The two channels, named as the agents' catalogue names them (`channelLabel`). */
const CHANNELS = ['conventional', 'syariah'] as const;

/** The categories, named as the catalogue's tabs (§A.3, kept): the words are `admin-template-products.tsx`' `categories`. */
const CATEGORIES = ['life', 'health', 'ci', 'education', 'investment'] as const;
type CategoryCode = (typeof CATEGORIES)[number];
const isCategory = (value: string): value is CategoryCode => (CATEGORIES as readonly string[]).includes(value);

/** `accident` is a need and not a category — accident products sit under health. */
const NEEDS = [
  'life-protection', 'health', 'ci', 'accident', 'education', 'investment', 'retirement', 'legacy',
];

/**
 * The seven fields the Owner's own override modal names (`KPM_Owner.html:1786-1793`), **in its
 * order** — the numbers are the modal's, and a reader who meets them as 0, 1, 3, 4a, 4b, 5, 2 is
 * reading a form that lost one. Their words are the catalogue's (`plan`).
 *
 * `benefits` is a list the reader types one per line, which is why it carries `list`.
 */
const PLAN_FIELDS: {
  key: keyof Product['defaultAttackPlan']; lines?: number; list?: true;
}[] = [
  { key: 'goodFit' },
  { key: 'opening', lines: 2 },
  { key: 'benefits', lines: 4, list: true },
  { key: 'fullScript', lines: 6 },
  { key: 'objectionTheySay', lines: 2 },
  { key: 'objectionYouSay', lines: 3 },
  { key: 'nextAction', lines: 2 },
];

type ProductWords = MessagesOf<typeof adminTemplateProductsMessages.en>;

/** A category's name, kept English (§A.3); a code the list does not hold, as it is. */
const categoryLabel = (t: ProductWords, value: string) => (isCategory(value) ? t.categories[value] : value);

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
 * figure is written (ADR-0167 §1; P18.98-T3, `formatDecimalInput`): *12.5* in English.
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
 * office of the company on their next read, with no Owner pressing publish. The card at the top
 * says that in place of the draft bar the other tabs carry, so a Super Admin is never left looking
 * for a Publish button that should not exist.
 */
export function ProductsTab({ companyId }: { companyId: string }) {
  const t = useMessages(adminTemplateProductsMessages);
  const settings = useMessages(settingsMessages);
  const language = useLanguage();
  const [rows, setRows] = useState<Product[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="text-md text-navy">
          <strong>{t.live}</strong>{' '}
          <span className="text-muted">{t.liveDetail}</span>
        </p>
        <p className="mt-2 text-sm text-muted">
          {t.counts({ products: rows.length, active: live, byDefault: rows.filter((p) => p.activeByDefault).length })}
        </p>
      </Card>

      {error && (
        <div role="alert" className="rounded-md border border-amber bg-card p-4">
          <p className="text-md text-navy">{error.message}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t.reorderHint}</p>
        <Button disabled={busy || adding} onClick={() => setAdding(true)}>{t.addProduct}</Button>
      </div>

      {adding && (
        <AddProduct
          disabled={busy}
          taken={(code) => rows.some((p) => p.code === code)}
          onCancel={() => setAdding(false)}
          onAdd={async (body) => {
            if (await run(() => createProduct(companyId, body))) setAdding(false);
          }}
        />
      )}

      {rows.length === 0 ? (
        <EmptyState title={t.empty} />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((product, index) => (
            <li key={product.id}>
              <Card
                className={`p-0 ${over === product.id ? 'bg-canvas' : ''} `
                  + `${dragging === product.id ? 'opacity-40' : ''}`}
                onDragOver={(e) => {
                  if (!dragging) return;
                  e.preventDefault();
                  setOver(product.id);
                }}
                onDragLeave={() => setOver((now) => (now === product.id ? null : now))}
                onDrop={(e) => {
                  e.preventDefault();
                  const held = dragging;
                  setDragging(null);
                  setOver(null);
                  if (held && held !== product.id) {
                    void reorder(rows.findIndex((p) => p.id === held), index);
                  }
                }}
              >
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <DragHandle
                    label={product.name}
                    disabled={busy}
                    className="cursor-grab select-none text-md text-muted disabled:cursor-not-allowed"
                    onPick={() => setDragging(product.id)}
                    onDrop={() => { setDragging(null); setOver(null); }}
                    onMove={(by) => void reorder(index, index + by)}
                  />
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-navy text-sm font-bold text-navy"
                    aria-hidden
                  >
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    {/* An `h2` per card, as the taxonomy editor heads its sections: the page's
                        `h1` is the screen's, and the editor's own blocks are `h3` below this. */}
                    <h2 className="text-md font-semibold text-navy">{product.name}</h2>
                    {product.tagline && (
                      <p className="mt-0.5 text-sm text-muted">{product.tagline}</p>
                    )}
                    <p className="mt-1 flex flex-wrap items-center gap-2">
                      <ConfigBadge tone="open">{channelLabel(product.channel, language)}</ConfigBadge>
                      <ConfigBadge tone="open">{categoryLabel(t, product.category)}</ConfigBadge>
                      <ConfigBadge tone={product.lifecycle === 'active' ? 'won' : 'open'}>
                        {t.lifecycle[product.lifecycle]}
                      </ConfigBadge>
                      {product.activeByDefault && (
                        <ConfigBadge tone="won">{t.activeByDefault}</ConfigBadge>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="inline"
                      disabled={busy}
                      onClick={() => setEditing(editing === product.id ? null : product.id)}
                    >
                      {editing === product.id ? t.close : settings.edit}
                    </Button>
                  </div>
                </div>

                {editing === product.id && (
                  <ProductEditor
                    product={product}
                    others={rows.filter((p) => p.id !== product.id)}
                    disabled={busy}
                    onSave={async (fields) => {
                      if (await run(() => updateProduct(companyId, product.id, fields))) {
                        setEditing(null);
                      }
                    }}
                    onLifecycle={async (next, replacedByProductId) => {
                      const call = () => {
                        if (next === 'active') return reopenProduct(companyId, product.id);
                        if (next === 'withdrawn') {
                          return withdrawProduct(companyId, product.id, replacedByProductId);
                        }
                        return closeProductToNewBusiness(
                          companyId, product.id, replacedByProductId,
                        );
                      };
                      await run(call);
                    }}
                  />
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
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
  disabled,
  onSave,
  onLifecycle,
}: {
  product: Product;
  /** Candidate successors: a replacement has to be on the same company's shelf. */
  others: Product[];
  disabled?: boolean;
  onSave: (fields: ProductFields) => void | Promise<void>;
  onLifecycle: (next: ProductLifecycle, replacedByProductId?: string) => void | Promise<void>;
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
    plan: { ...product.defaultAttackPlan, benefits: product.defaultAttackPlan.benefits.join('\n') },
  });
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
  const setPlan = (key: keyof Product['defaultAttackPlan'], value: string) =>
    setForm((now) => ({ ...now, plan: { ...now.plan, [key]: value } }));

  const toggle = (key: 'primaryNeeds', value: string) => set(
    key,
    form[key].includes(value) ? form[key].filter((v) => v !== value) : [...form[key], value],
  );
  const toggleBand = (key: 'eligibleAgeBands' | 'eligibleBudgetBands', band: number) => set(
    key,
    form[key].includes(band) ? form[key].filter((b) => b !== band) : [...form[key], band].sort(),
  );

  return (
    <div className="border-t border-hairline px-4 py-4 sm:px-5">
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
                  ADR-0167 §1, P18.98-T3): *< Rp 500 rb* … *Lump-sum*, *< IDR 500K* in English. */}
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
      <p className="text-sm text-muted">{t.plan.lead}</p>
      {PLAN_FIELDS.map((field) => (
        <Field
          key={field.key}
          label={t.plan[field.key]}
          htmlFor={`${field.key}-${product.id}`}
          hint={field.list ? t.onePerLine : undefined}
          className="mt-3"
        >
          {field.lines ? (
            <Textarea
              id={`${field.key}-${product.id}`}
              rows={field.lines}
              value={form.plan[field.key]}
              disabled={disabled}
              onChange={(e) => setPlan(field.key, e.target.value)}
            />
          ) : (
            <TextInput
              id={`${field.key}-${product.id}`}
              value={form.plan[field.key]}
              disabled={disabled}
              onChange={(e) => setPlan(field.key, e.target.value)}
            />
          )}
        </Field>
      ))}

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
            if (scheduleInvalid) {
              setTriedSave(true);
              return;
            }
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
              defaultAttackPlan: {
                goodFit: form.plan.goodFit.trim(),
                opening: form.plan.opening.trim(),
                benefits: linesToList(form.plan.benefits),
                fullScript: form.plan.fullScript.trim(),
                objectionTheySay: form.plan.objectionTheySay.trim(),
                objectionYouSay: form.plan.objectionYouSay.trim(),
                nextAction: form.plan.nextAction.trim(),
              },
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

/** A new product: its name, the code filled in from it, and the two facts a product cannot lack. */
function AddProduct({
  disabled,
  taken,
  onAdd,
  onCancel,
}: {
  disabled?: boolean;
  taken: (code: string) => boolean;
  onAdd: (body: ProductFields & { code: string }) => void | Promise<void>;
  onCancel: () => void;
}) {
  const t = useMessages(adminTemplateProductsMessages);
  const settings = useMessages(settingsMessages);
  const language = useLanguage();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);
  const [channel, setChannel] = useState('conventional');
  const [category, setCategory] = useState('life');
  const clash = code.trim() !== '' && taken(code.trim().toUpperCase());

  return (
    <Card>
      <FieldRow>
        <Field label={settings.name} htmlFor="add-product-name" className="min-w-60 flex-1">
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
          className="min-w-48"
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
        <Field label={t.channel} htmlFor="add-product-channel" className="min-w-40">
          <Select
            id="add-product-channel"
            value={channel}
            disabled={disabled}
            onChange={(e) => setChannel(e.target.value)}
          >
            {CHANNELS.map((value) => <option key={value} value={value}>{channelLabel(value, language)}</option>)}
          </Select>
        </Field>
        <Field label={t.category} htmlFor="add-product-category" className="min-w-40">
          <Select
            id="add-product-category"
            value={category}
            disabled={disabled}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((value) => <option key={value} value={value}>{t.categories[value]}</option>)}
          </Select>
        </Field>
        <FieldRow.Actions>
          <Button
            disabled={disabled || !name.trim() || !code.trim() || clash}
            onClick={() => void onAdd({
              code: code.trim(),
              name: name.trim(),
              channel: channel as Product['channel'],
              category: category as Product['category'],
            })}
          >
            {settings.add}
          </Button>
          <Button variant="secondary" disabled={disabled} onClick={onCancel}>{settings.cancel}</Button>
        </FieldRow.Actions>
      </FieldRow>
    </Card>
  );
}
