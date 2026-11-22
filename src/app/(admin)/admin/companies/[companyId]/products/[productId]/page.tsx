'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { BackLink, CompanyFrame, useCompany } from '@/components/kpm-template/company-frame';
import { ObjectionCards } from '@/components/objection-cards';
import { Button, ErrorBanner, Field, ReadOnlyField, Select, Textarea, TextInput } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Segmented } from '@/components/ui/segmented';
import { SkeletonCards } from '@/components/ui/skeleton';
import { Toast, useToast } from '@/components/ui/toast';
import { PRODUCT_CURRENCIES, readProducts, type AttackPlan, type Product, type ProductCurrency } from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  listProductDrafts, saveProductDraft, withDraft, type ProductDraftFields, type ProductDraftView,
} from '@/lib/companies-console';
import { productsHref, proposalHref, publishHref } from '@/lib/template-sections';
import { useMessages } from '@/i18n/language-provider';
import { adminCompaniesConsoleMessages } from '@/i18n/messages/admin-companies-console';

type Tab = 'info' | 'plan' | 'proposal';
type Words = ReturnType<typeof useWords>;
const useWords = () => useMessages(adminCompaniesConsoleMessages);
const CATEGORIES = ['life', 'health', 'ci', 'education', 'investment'] as const;
type PlanText = 'goodFit' | 'opening' | 'fullScript' | 'nextAction';

/** The editor's working copy: the product with its draft laid over it. */
interface Working {
  name: string;
  category: Product['category'];
  channel: Product['channel'];
  currencies: ProductCurrency[];
  tagline: string;
  plan: AttackPlan;
  alsoFits: string[];
}

const workingOf = (p: Product & { alsoFits: string[] }): Working => ({
  name: p.name, category: p.category, channel: p.channel, currencies: [...p.currencies], tagline: p.tagline,
  plan: JSON.parse(JSON.stringify(p.defaultAttackPlan)) as AttackPlan, alsoFits: [...p.alsoFits],
});

/** Only what differs from what was read: the draft is merged field by field on the server. */
function changesOf(from: Working, to: Working): ProductDraftFields {
  const out: ProductDraftFields = {};
  if (to.name !== from.name) out.name = to.name;
  if (to.category !== from.category) out.category = to.category;
  if (to.channel !== from.channel) out.channel = to.channel;
  if (to.currencies.join() !== from.currencies.join()) out.currencies = to.currencies;
  if (to.tagline !== from.tagline) out.tagline = to.tagline;
  if (JSON.stringify(to.plan) !== JSON.stringify(from.plan)) out.defaultAttackPlan = to.plan;
  if (to.alsoFits.join() !== from.alsoFits.join()) out.alsoFits = to.alsoFits;
  return out;
}

/**
 * **One product** (`/admin/companies/[companyId]/products/[productId]`; P19.23-T4 AC-3; ADR-0278 §4; frames 31–34):
 * *‹ Katalog produk*, its head (*KESEHATAN · KONVENSIONAL*, the name, its description, *Draf · belum diterbitkan* while
 * edits wait or no KPM has it) and three tabs:
 *
 * - ***Info produk***: *Nama produk, Kategori, Jenis, Mata uang, Deskripsi singkat (kartu katalog), Brosur / file* (the
 *   brochure read; it is uploaded where it always was — OD-423).
 * - ***Sales attack plan***: the parts agents see, numbered as they see them — *Cocok untuk, Kalimat pembuka, Tekankan
 *   manfaat berikut, Script lengkap, Jika ada keberatan, Tindakan berikutnya* — and *Juga sesuai*, each with *✎ Ubah*.
 * - ***Proposal & premi***: the product's proposal columns in order and *Tabel premi · ganti file*, on the proposal data
 *   (ADR-0258's dated tables, not drafted — OD-423).
 *
 * The bar under them says *Perubahan disimpan sebagai draf template · KPM baru melihatnya setelah Anda terbitkan (pilih
 * KPM dulu)*: ***Simpan draf*** saves what changed (`PUT …/draft`), ***Terbitkan…*** saves and opens *Terbitkan ke KPM*.
 */
export default function ProductPage({ params }: { params: Promise<{ companyId: string; productId: string }> }) {
  const { companyId, productId } = use(params);
  const t = useWords();
  const router = useRouter();
  const company = useCompany(companyId);
  const [product, setProduct] = useState<(Product & { alsoFits: string[] }) | null | undefined>(undefined);
  const [others, setOthers] = useState<Product[]>([]);
  const [draft, setDraft] = useState<ProductDraftView | undefined>(undefined);
  const [read, setRead] = useState<Working | null>(null);
  const [work, setWork] = useState<Working | null>(null);
  const [tab, setTab] = useState<Tab>('info');
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    try {
      setError(null);
      const [rows, states] = await Promise.all([readProducts(companyId), listProductDrafts(companyId)]);
      const found = rows.find((p) => p.id === productId);
      const state = states.find((d) => d.id === productId);
      setOthers(rows.filter((p) => p.id !== productId && p.lifecycle !== 'withdrawn' && p.kind !== 'rider'));
      setDraft(state);
      if (!found) { setProduct(null); return; }
      const shown = withDraft(found, state);
      setProduct(shown);
      setRead(workingOf(shown));
      setWork(workingOf(shown));
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [companyId, productId]);

  useEffect(() => { void load(); }, [load]);

  const changes = read && work ? changesOf(read, work) : {};
  const dirty = Object.keys(changes).length > 0;

  async function save(): Promise<boolean> {
    if (!dirty) return true;
    setBusy(true);
    setError(null);
    try {
      await saveProductDraft(companyId, productId, changes);
      await load();
      show(t.products.saved);
      return true;
    } catch (err) {
      setError(toDisplayError(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const back = <div className="mb-3"><BackLink href={productsHref(companyId)}>{t.products.back}</BackLink></div>;
  let body: ReactNode;
  if (product === null) {
    body = <p className="rounded-lg bg-card p-4 text-md text-navy">{t.products.notFound}</p>;
  } else if (!product || !work) {
    body = error ? <ErrorBanner {...error} /> : <SkeletonCards count={3} label={t.products.loading} />;
  } else {
    const unpublished = (draft?.state ?? 'published') !== 'published' || dirty;
    body = (
      <>
        <div className="mb-4 rounded-lg bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-primary-ink">
              {`${t.products.categories[work.category]} · ${t.products.channels[work.channel]}`}
            </p>
            {unpublished && (
              <span data-product-state="draft" className="rounded-pill bg-primary-50 px-2.5 py-0.5 text-sm font-bold text-primary-ink">
                {t.products.unpublished}
              </span>
            )}
          </div>
          <h2 className="font-display text-xl font-bold text-navy">{work.name}</h2>
          <p className="text-md text-muted">{work.tagline}</p>
        </div>
        <Segmented
          label={t.products.tabs}
          active={tab}
          onSelect={(id) => setTab(id as Tab)}
          tabs={[
            { id: 'info', label: t.products.info },
            { id: 'plan', label: t.products.plan },
            { id: 'proposal', label: t.products.proposal },
          ]}
        >
          {(active) => (
            <div className="mt-3 rounded-lg bg-card p-4">
              {active === 'info' && <InfoTab t={t} work={work} onChange={setWork} brochure={draft?.brochure ?? null} />}
              {active === 'plan' && <PlanTab t={t} work={work} onChange={setWork} others={others} />}
              {active === 'proposal' && <ProposalTab t={t} product={product} companyId={companyId} />}
            </div>
          )}
        </Segmented>
        {error && <div className="mt-3"><ErrorBanner {...error} /></div>}
        <div data-draft-bar="" className="mt-4 flex flex-col gap-3 rounded-lg bg-card p-4 md:flex-row md:items-center">
          <p className="min-w-0 flex-1 text-md text-navy">{t.products.bar}</p>
          <div className="flex gap-2 max-md:flex-col">
            <Button variant="secondary" className="max-md:w-full" disabled={busy || !dirty} onClick={() => { void save(); }}>
              {busy ? t.products.saving : t.products.saveDraft}
            </Button>
            <Button
              className="max-md:w-full"
              disabled={busy}
              onClick={() => { void save().then((ok) => { if (ok) router.push(publishHref(companyId)); }); }}
            >
              {t.products.publish}
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <CompanyFrame companyId={companyId} company={company} permission="product_catalog:crud" active="products">
      {back}
      {body}
      <Toast toast={toast} />
    </CompanyFrame>
  );
}

/** *Info produk* (frame 33): the six fields, two columns from a tablet. */
function InfoTab({
  t, work, onChange, brochure,
}: { t: Words; work: Working; onChange: (w: Working) => void; brochure: { label: string } | null }) {
  const id = useId();
  const currency = work.currencies.length === 2 ? 'both' : work.currencies[0] ?? 'IDR';
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label={t.info.name} htmlFor={`${id}-name`}>
        <TextInput id={`${id}-name`} maxLength={200} value={work.name} onChange={(e) => onChange({ ...work, name: e.target.value })} />
      </Field>
      <Field label={t.info.category} htmlFor={`${id}-category`}>
        <Select id={`${id}-category`} value={work.category} onChange={(e) => onChange({ ...work, category: e.target.value as Product['category'] })}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{t.products.categories[c]}</option>)}
        </Select>
      </Field>
      <Field label={t.info.channel} htmlFor={`${id}-channel`}>
        <Select id={`${id}-channel`} value={work.channel} onChange={(e) => onChange({ ...work, channel: e.target.value as Product['channel'] })}>
          <option value="conventional">{t.products.channels.conventional}</option>
          <option value="syariah">{t.products.channels.syariah}</option>
        </Select>
      </Field>
      <Field label={t.info.currency} htmlFor={`${id}-currency`}>
        <Select
          id={`${id}-currency`}
          value={currency}
          onChange={(e) => onChange({
            ...work, currencies: e.target.value === 'both' ? ['IDR', 'USD'] : [e.target.value as ProductCurrency],
          })}
        >
          {PRODUCT_CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
          <option value="both">{t.info.both}</option>
        </Select>
      </Field>
      <Field label={t.info.tagline} htmlFor={`${id}-tagline`}>
        <TextInput id={`${id}-tagline`} maxLength={160} value={work.tagline} onChange={(e) => onChange({ ...work, tagline: e.target.value })} />
      </Field>
      <ReadOnlyField label={t.info.brochure} value={brochure?.label ?? t.info.noBrochure} />
    </div>
  );
}

/** One part of the plan: its number in a circle, its title in capitals, *✎ Ubah*, and what agents read. */
function Part({
  n, title, editing, onToggle, t, children,
}: { n: number | null; title: string; editing: boolean; onToggle: () => void; t: Words; children: ReactNode }) {
  return (
    <section className="border-b border-divider py-3 last:border-b-0">
      <div className="mb-2 flex items-center gap-2">
        {n !== null && (
          <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-pill border border-secondary text-xs font-bold text-navy">{n}</span>
        )}
        <h3 className="min-w-0 flex-1 text-sm font-bold uppercase tracking-wide text-navy">{title}</h3>
        <Button variant="inline" className="gap-1 text-primary-ink" onClick={onToggle} aria-expanded={editing}>
          <LineIcon name="pencil" className="h-3.5 w-3.5" />
          {editing ? t.plan.done : t.plan.change}
        </Button>
      </div>
      {children}
    </section>
  );
}

/** *Sales attack plan* (frame 32): the six parts agents see, and *Juga sesuai*. */
function PlanTab({
  t, work, onChange, others,
}: { t: Words; work: Working; onChange: (w: Working) => void; others: Product[] }) {
  const id = useId();
  const [open, setOpen] = useState<string | null>(null);
  const plan = work.plan;
  const set = (next: Partial<AttackPlan>) => onChange({ ...work, plan: { ...plan, ...next } });
  const toggle = (key: string) => setOpen((o) => (o === key ? null : key));
  const text = (key: PlanText, n: number | null, title: string, rows = 3) => (
    <Part n={n} title={title} editing={open === key} onToggle={() => toggle(key)} t={t}>
      {open === key ? (
        <Textarea id={`${id}-${key}`} aria-label={title} rows={rows} value={plan[key]} onChange={(e) => set({ [key]: e.target.value })} />
      ) : (
        <p className="whitespace-pre-line text-md text-navy">{plan[key] || <span className="text-muted">{t.plan.empty}</span>}</p>
      )}
    </Part>
  );

  return (
    <div>
      {text('goodFit', 0, t.plan.goodFit)}
      {text('opening', 1, t.plan.opening)}
      <Part n={2} title={t.plan.benefits} editing={open === 'benefits'} onToggle={() => toggle('benefits')} t={t}>
        {open === 'benefits' ? (
          <div className="flex flex-col gap-2">
            {plan.benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <TextInput
                  aria-label={t.plan.benefit({ n: i + 1 })}
                  value={b}
                  maxLength={400}
                  onChange={(e) => set({ benefits: plan.benefits.map((x, j) => (j === i ? e.target.value : x)) })}
                />
                <Button variant="icon" aria-label={t.plan.removeBenefit({ n: i + 1 })} onClick={() => set({ benefits: plan.benefits.filter((_, j) => j !== i) })}>
                  <LineIcon name="trash" className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="inline" className="self-start gap-1 text-primary-ink" onClick={() => set({ benefits: [...plan.benefits, ''] })}>
              <LineIcon name="plus" className="h-4 w-4" />
              {t.plan.addBenefit}
            </Button>
          </div>
        ) : plan.benefits.length ? (
          <ul className="list-disc pl-5 text-md text-navy marker:text-primary">{plan.benefits.map((b, i) => <li key={i}>{b}</li>)}</ul>
        ) : <p className="text-md text-muted">{t.plan.empty}</p>}
      </Part>
      {text('fullScript', 3, t.plan.fullScript, 6)}
      <Part n={4} title={t.plan.objections} editing={open === 'objections'} onToggle={() => toggle('objections')} t={t}>
        {open === 'objections' ? (
          <ObjectionCards idPrefix={`${id}-obj`} legend={t.plan.objections} cards={plan.objections} onChange={(cards) => set({ objections: cards })} />
        ) : plan.objections.length ? (
          <dl className="flex flex-col gap-2 text-md">
            {plan.objections.map((o, i) => (
              <div key={i}>
                <dt className="font-semibold text-navy">{`“${o.objection}”`}</dt>
                <dd className="text-muted">{o.answer}</dd>
              </div>
            ))}
          </dl>
        ) : <p className="text-md text-muted">{t.plan.empty}</p>}
      </Part>
      {text('nextAction', 5, t.plan.nextAction)}
      <Part n={null} title={t.plan.alsoFits} editing={open === 'alsoFits'} onToggle={() => toggle('alsoFits')} t={t}>
        <p className="mb-2 text-sm text-muted">{t.plan.alsoFitsHint}</p>
        {open === 'alsoFits' ? (
          others.length ? (
            <ul className="flex flex-col gap-1">
              {others.map((p) => (
                <li key={p.id}>
                  <label className="flex min-h-10 items-center gap-2 text-md text-navy">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-primary"
                      checked={work.alsoFits.includes(p.code)}
                      onChange={(e) => onChange({
                        ...work,
                        alsoFits: e.target.checked ? [...work.alsoFits, p.code] : work.alsoFits.filter((c) => c !== p.code),
                      })}
                    />
                    {p.name}
                  </label>
                </li>
              ))}
            </ul>
          ) : <p className="text-md text-muted">{t.plan.noOthers}</p>
        ) : work.alsoFits.length ? (
          <p className="text-md text-navy">{work.alsoFits.map((c) => others.find((p) => p.code === c)?.name ?? c).join(', ')}</p>
        ) : <p className="text-md text-muted">{t.plan.empty}</p>}
      </Part>
    </div>
  );
}

/** *Proposal & premi* (frame 34): the proposal's columns in order, and the premium table, on the proposal data. */
function ProposalTab({ t, product, companyId }: { t: Words; product: Product; companyId: string }) {
  const fields = product.proposalFields ?? [];
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-navy">{t.proposalTab.columns}</h3>
      {fields.length ? (
        <ol className="mb-4 [&>li+li]:border-t [&>li+li]:border-divider">
          {fields.map((f, i) => (
            <li key={f.key} className="flex min-h-10 items-center gap-6 text-md">
              <span className="w-6 text-muted">{i + 1}</span>
              <span className="font-semibold text-navy">{f.label}</span>
            </li>
          ))}
        </ol>
      ) : <p className="mb-4 text-md text-muted">{t.proposalTab.none}</p>}
      <Link href={proposalHref(companyId)} className="inline-flex min-h-10 items-center gap-1.5 rounded-pill border border-hairline px-4 text-md font-semibold text-navy">
        <LineIcon name="grid" className="h-4 w-4" />
        {t.proposalTab.table}
      </Link>
    </div>
  );
}
