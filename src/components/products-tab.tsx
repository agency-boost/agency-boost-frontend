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
import {
  closeProductToNewBusiness, createProduct, readProducts, reopenProduct, reorderProducts,
  updateProduct, withdrawProduct,
  type Product, type ProductFields, type ProductLifecycle,
} from '@/lib/admin';

const CHANNELS = [
  { value: 'conventional', label: 'Conventional' },
  { value: 'syariah', label: 'Syariah' },
];

const CATEGORIES = [
  { value: 'life', label: 'Life' },
  { value: 'health', label: 'Health' },
  { value: 'ci', label: 'Critical illness' },
  { value: 'education', label: 'Education' },
  { value: 'investment', label: 'Investment' },
];

/** `accident` is a need and not a category — accident products sit under health. */
const NEEDS = [
  'life-protection', 'health', 'ci', 'accident', 'education', 'investment', 'retirement', 'legacy',
];

/** From `Overall.html:9527-9533`, which is the copy the seeded bands are scored against. */
const AGE_BANDS = [
  { band: 1, label: '< 25' }, { band: 2, label: '25–34' }, { band: 3, label: '35–49' },
  { band: 4, label: '50–64' }, { band: 5, label: '65+' },
];
const BUDGET_BANDS = [
  { band: 1, label: '< Rp500K' }, { band: 2, label: 'Rp500K–Rp2M' }, { band: 3, label: 'Rp2M–Rp5M' },
  { band: 4, label: 'Rp5M–Rp10M' }, { band: 5, label: 'Rp10M–Rp20M' }, { band: 6, label: '> Rp20M' },
  { band: 7, label: 'Lump-sum' },
];

/**
 * The seven fields the Owner's own override modal names (`KPM_Owner.html:1786-1793`), **in its
 * order** — the numbers are the modal's, and a reader who meets them as 0, 1, 3, 4a, 4b, 5, 2 is
 * reading a form that lost one.
 *
 * `benefits` is a list the reader types one per line, which is why it carries `list`.
 */
const PLAN_FIELDS: {
  key: keyof Product['defaultAttackPlan']; label: string; lines?: number; list?: true;
}[] = [
  { key: 'goodFit', label: '0 · Good fit for' },
  { key: 'opening', label: '1 · Opening line', lines: 2 },
  { key: 'benefits', label: '2 · Lead with these benefits', lines: 4, list: true },
  { key: 'fullScript', label: '3 · Full script', lines: 6 },
  { key: 'objectionTheySay', label: '4a · If they push back — they say', lines: 2 },
  { key: 'objectionYouSay', label: '4b · If they push back — you say', lines: 3 },
  { key: 'nextAction', label: '5 · Next action', lines: 2 },
];

const LIFECYCLE_LABEL: Record<ProductLifecycle, string> = {
  active: 'Active',
  closed_to_new_business: 'Closed to new business',
  withdrawn: 'Withdrawn',
};

const label = (options: { value: string; label: string }[], value: string) =>
  options.find((o) => o.value === value)?.label ?? value;

const move = <T,>(rows: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= rows.length) return rows;
  const next = [...rows];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
};

/** Lines a reader types, one per line, as the array the API takes. */
const linesToList = (value: string) => value.split('\n').map((l) => l.trim()).filter(Boolean);

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
        title={`Could not read this company’s catalog. ${error.message}`}
        action={<Button onClick={() => void load()}>Try again</Button>}
      />
    );
  }
  if (rows === null) return <SkeletonCards count={4} />;

  const live = rows.filter((p) => p.lifecycle === 'active').length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="text-md text-navy">
          <strong>This catalog is live.</strong>{' '}
          <span className="text-muted">
            It has no draft and no version: what you change here reaches every office of this
            company on their next read, and no Owner has to publish it. What an office decides —
            which of these it sells, and its own wording — stays the office’s.
          </span>
        </p>
        <p className="mt-2 text-sm text-muted">
          {rows.length} {rows.length === 1 ? 'product' : 'products'} · {live} active ·{' '}
          {rows.filter((p) => p.activeByDefault).length} active by default in a new office
        </p>
      </Card>

      {error && (
        <div role="alert" className="rounded-md border border-amber bg-card p-4">
          <p className="text-md text-navy">{error.message}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Drag ⠿ to reorder, or focus it and press ↑ or ↓.</p>
        <Button disabled={busy || adding} onClick={() => setAdding(true)}>Add a product</Button>
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
        <EmptyState
          title={'This company has no products yet. Add the first one, and every office of this '
            + 'company can sell it from their next read.'}
        />
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
                      <ConfigBadge tone="open">{label(CHANNELS, product.channel)}</ConfigBadge>
                      <ConfigBadge tone="open">{label(CATEGORIES, product.category)}</ConfigBadge>
                      <ConfigBadge tone={product.lifecycle === 'active' ? 'won' : 'open'}>
                        {LIFECYCLE_LABEL[product.lifecycle]}
                      </ConfigBadge>
                      {product.activeByDefault && (
                        <ConfigBadge tone="won">Active by default</ConfigBadge>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="inline"
                      disabled={busy}
                      onClick={() => setEditing(editing === product.id ? null : product.id)}
                    >
                      {editing === product.id ? 'Close' : 'Edit'}
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
 * an attack-plan telemetry row all point at it (ADR-0006). Everything else is editable, and the
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
          reason="Typed once. A policy and a lead point at it, so it never changes."
        />
        <ReadOnlyField
          label="Version"
          value={String(product.version)}
          reason="Bumped by every change but a reorder, which is presentation."
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <Field label="Name" htmlFor={`name-${product.id}`} className="min-w-60 flex-1">
          <TextInput
            id={`name-${product.id}`}
            value={form.name}
            disabled={disabled}
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>
        <Field label="Tagline" htmlFor={`tagline-${product.id}`} className="min-w-60 flex-1">
          <TextInput
            id={`tagline-${product.id}`}
            value={form.tagline}
            disabled={disabled}
            onChange={(e) => set('tagline', e.target.value)}
          />
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <Field label="Channel" htmlFor={`channel-${product.id}`} className="min-w-48">
          <Select
            id={`channel-${product.id}`}
            value={form.channel}
            disabled={disabled}
            onChange={(e) => set('channel', e.target.value)}
          >
            {CHANNELS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <Field label="Category" htmlFor={`category-${product.id}`} className="min-w-48">
          <Select
            id={`category-${product.id}`}
            value={form.category}
            disabled={disabled}
            onChange={(e) => set('category', e.target.value)}
          >
            {CATEGORIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-navy">Primary need</legend>
        <p className="text-sm text-muted">
          What the customer is buying. Accident is a need, not a category — accident products sit
          under Health.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          {NEEDS.map((need) => (
            <label key={need} className="flex items-center gap-2 text-md text-navy">
              <input
                type="checkbox"
                checked={form.primaryNeeds.includes(need)}
                disabled={disabled}
                onChange={() => toggle('primaryNeeds', need)}
              />
              {need}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-navy">Who it fits</legend>
        <p className="text-sm text-muted">
          What the fit check scores a prospect against, from phase 12.
        </p>
        <div className="mt-2 flex flex-wrap gap-4">
          <div>
            <p className="text-sm font-semibold text-muted">Age</p>
            <div className="mt-1 flex flex-wrap gap-3">
              {AGE_BANDS.map(({ band, label: text }) => (
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
            <p className="text-sm font-semibold text-muted">Monthly budget</p>
            <div className="mt-1 flex flex-wrap gap-3">
              {BUDGET_BANDS.map(({ band, label: text }) => (
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
        label="Benefits"
        htmlFor={`benefits-${product.id}`}
        hint="One per line."
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

      <Field label="What makes it different" htmlFor={`diff-${product.id}`} className="mt-3">
        <Textarea
          id={`diff-${product.id}`}
          rows={3}
          value={form.differentiator}
          disabled={disabled}
          onChange={(e) => set('differentiator', e.target.value)}
        />
      </Field>

      <Field label="Best for" htmlFor={`bestfor-${product.id}`} className="mt-3">
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
          Active by default
          <span className="block text-sm text-muted">
            What an office sells before its Owner has an opinion about this product. An office that
            has already decided keeps its decision.
          </span>
        </span>
      </label>

      <h3 className="mt-5 font-display text-md font-bold text-navy">The default attack plan</h3>
      <p className="text-sm text-muted">
        The words an agent opens with. An office may override them, and its own approval gate
        decides when its agents see the override.
      </p>
      {PLAN_FIELDS.map((field) => (
        <Field
          key={field.key}
          label={field.label}
          htmlFor={`${field.key}-${product.id}`}
          hint={field.list ? 'One per line.' : undefined}
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

      <h3 className="mt-5 font-display text-md font-bold text-navy">Commission</h3>
      {(product.commissionSchedule ?? []).length === 0 ? (
        <p className="text-sm text-muted">
          {product.commissionSchedule === undefined
            ? 'You are not shown commission rates.'
            : 'Not set. Nothing is shown to an agent until this company states its schedule — '
              + 'a figure somebody reads as their pay is never one this product invents.'}
        </p>
      ) : (
        <ul className="mt-1 flex flex-wrap gap-3">
          {product.commissionSchedule!.map((year) => (
            <li key={year.year} className="text-md text-navy">
              Year {year.year}: <strong>{(year.rate * 100).toFixed(1)}%</strong>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
        <Button
          disabled={disabled}
          onClick={() => void onSave({
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
          })}
        >
          Save product
        </Button>
      </div>

      <div className="mt-4 border-t border-hairline pt-4">
        <h3 className="font-display text-md font-bold text-navy">Lifecycle</h3>
        <p className="text-sm text-muted">
          Each of these reaches <strong>every office of this company</strong> on their next read.
          There is no delete: a policy whose product vanished is a record nobody can read.
        </p>

        {product.lifecycle !== 'withdrawn' && (
          <Field
            label="Replaced by"
            htmlFor={`successor-${product.id}`}
            hint="Optional, and only a product on this company’s shelf."
            className="mt-3 max-w-md"
          >
            <Select
              id={`successor-${product.id}`}
              value={successor}
              disabled={disabled}
              onChange={(e) => setSuccessor(e.target.value)}
            >
              <option value="">Nothing replaces it</option>
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
              title="Existing policies keep running; nobody sells it to somebody new."
              onClick={() => void onLifecycle('closed_to_new_business', successor || undefined)}
            >
              Close to new business
            </Button>
          )}
          {product.lifecycle !== 'withdrawn' && (
            <Button
              variant="inlineDanger"
              disabled={disabled}
              title="Every office of this company stops selling it on their next read."
              onClick={() => void onLifecycle('withdrawn', successor || undefined)}
            >
              Withdraw
            </Button>
          )}
          {product.lifecycle !== 'active' && (
            <Button
              variant="inline"
              disabled={disabled}
              title="Back on sale. Offices keep whatever they had decided."
              onClick={() => void onLifecycle('active')}
            >
              Reopen
            </Button>
          )}
        </div>
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
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);
  const [channel, setChannel] = useState('conventional');
  const [category, setCategory] = useState('life');
  const clash = code.trim() !== '' && taken(code.trim().toUpperCase());

  return (
    <Card>
      <FieldRow>
        <Field label="Name" htmlFor="add-product-name" className="min-w-60 flex-1">
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
          label="Code"
          htmlFor="add-product-code"
          hint="Filled in from the name. Typed once, and never reused."
          error={clash ? 'This company already has a product with this code.' : undefined}
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
        <Field label="Channel" htmlFor="add-product-channel" className="min-w-40">
          <Select
            id="add-product-channel"
            value={channel}
            disabled={disabled}
            onChange={(e) => setChannel(e.target.value)}
          >
            {CHANNELS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <Field label="Category" htmlFor="add-product-category" className="min-w-40">
          <Select
            id="add-product-category"
            value={category}
            disabled={disabled}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
            Add
          </Button>
          <Button variant="secondary" disabled={disabled} onClick={onCancel}>Cancel</Button>
        </FieldRow.Actions>
      </FieldRow>
    </Card>
  );
}
