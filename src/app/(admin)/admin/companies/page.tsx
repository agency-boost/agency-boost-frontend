'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Page } from '@/components/page';
import { IntakeButton } from '@/components/proposal-data/intake-button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Modal } from '@/components/ui/modal';
import { AddSheet, ChoiceRows, RowMenu } from '@/components/ui/rows-and-sheets';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import {
  insurersOf, isTemplateLibrary, listCompanies, listOrgLevels, readPlatformOverview, setCompanyStatus, updateCompany,
  type Company, type CompanyCard,
} from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { readPublicationSummary, setUpCompany, type CompanyStart, type PublicationSummary } from '@/lib/companies-console';
import { SLUG_MAX, toSlug } from '@/lib/slug';
import { companyHref } from '@/lib/template-sections';
import { useMessages } from '@/i18n/language-provider';
import { adminCompaniesConsoleMessages } from '@/i18n/messages/admin-companies-console';
import { adminTemplateCompaniesMessages } from '@/i18n/messages/admin-template-companies';

/** The server's slug pattern, letter for letter (`CreateCompanyDto.slug`). */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * ***Perusahaan & template*** (`/admin/companies`; P19.23-T4 AC-1; ADR-0278 §2, §3; frames 27–28).
 *
 * - **Cards**: the ***Default template*** first (the Template library, ADR-0164 — the basis of every new company: its
 *   ladder and its *Default template* pill, *Ubah default template →*), then each company: its two letters, its name, its
 *   ladder (*Agent → AAB → AB*), its KPMs and members (the Overview's counts, test accounts never counted), one line on
 *   its template — *n perubahan belum diterbitkan*, *Semua KPM memakai versi terbaru* or *Template masih kosong*
 *   (`GET …/publication?summary=true`) — and *Buka template →*. A count that cannot be read is a dash, never a zero.
 * - ***+ Perusahaan baru*** opens a dialog — a sheet on a phone — with the name and *Mulai dari*: the *Default template*
 *   (*disarankan*) or *Salin dari perusahaan lain* with the company chosen; *✓ Buat perusahaan* makes it with its default
 *   template (`POST /admin/companies/setup`) and opens it. The slug is made from the name, as the old sheet made it; a
 *   taken one is said on the name.
 * - **Kept from before** (P19.2-T2 UI-126; P19.15-T3): ⋯ on a company's card — *Ubah*, *Tangguhkan* or *Aktifkan
 *   kembali* — and *Unggah file* for the proposal data of any insurer. Parity I-1190.
 *
 * Super Admin only: `company:crud` and `company_template:read`; the API refuses every tenant role.
 */
export default function CompaniesPage() {
  const t = useMessages(adminCompaniesConsoleMessages);
  const old = useMessages(adminTemplateCompaniesMessages);
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [counts, setCounts] = useState<Map<string, CompanyCard> | null>(null);
  const [libraryLadder, setLibraryLadder] = useState<string[] | null>(null);
  const [summaries, setSummaries] = useState<Map<string, PublicationSummary | null>>(new Map());
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [suspending, setSuspending] = useState<Company | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    setLoadError(null);
    void listCompanies()
      .then((rows) => { if (live) setCompanies(rows); })
      .catch((err) => { if (live) setLoadError(toDisplayError(err)); });
    void readPlatformOverview()
      .then((o) => { if (live) setCounts(new Map((o.companies ?? []).map((c) => [c.companyId, c]))); })
      .catch(() => { if (live) setCounts(null); });
    return () => { live = false; };
  }, [attempt]);

  const library = companies?.find(isTemplateLibrary) ?? null;
  const insurers = companies ? [...insurersOf(companies)].sort((a, b) => a.name.localeCompare(b.name)) : null;
  const insurerIds = insurers?.map((c) => c._id).join(',') ?? '';

  // The library's ladder is not in the Overview (it holds no KPM): read from its own rungs.
  useEffect(() => {
    if (!library) return;
    let live = true;
    void listOrgLevels(library._id)
      .then((rows) => {
        if (live) setLibraryLadder(rows.filter((r) => r.status === 'active').sort((a, b) => a.displayOrder - b.displayOrder).map((r) => r.label));
      })
      .catch(() => { if (live) setLibraryLadder(null); });
    return () => { live = false; };
  }, [library]);

  // Each company's template line, read per card; one that cannot be read says nothing rather than a guess.
  useEffect(() => {
    if (!insurerIds) return;
    let live = true;
    void Promise.all(insurerIds.split(',').map(async (id) => {
      try {
        return [id, await readPublicationSummary(id)] as const;
      } catch {
        return [id, null] as const;
      }
    })).then((pairs) => { if (live) setSummaries(new Map(pairs)); });
    return () => { live = false; };
  }, [insurerIds]);

  async function run(action: () => Promise<Company>) {
    setError(null);
    try {
      const row = await action();
      setCompanies((cs) => (cs ?? []).map((c) => (c._id === row._id ? { ...c, ...row } : c)));
      setEditing(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }

  const menuOf = (c: Company) => [
    { label: old.edit, onSelect: () => { setError(null); setEditing(c); } },
    c.status === 'active'
      ? { label: old.suspend, tone: 'alert' as const, hint: old.suspendTip, onSelect: () => setSuspending(c) }
      : { label: old.reactivate, onSelect: () => void run(() => setCompanyStatus(c._id, 'active')) },
  ];

  return (
    <Page title={t.title}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* No subtitle on a phone (UI-213 (21 Nov)); from 768px as before. */}
        <p className="text-md text-muted max-md:hidden">{t.lead}</p>
        <Button className="gap-1 max-md:w-full" onClick={() => setCreating(true)}>
          <LineIcon name="plus" className="h-4 w-4" />
          {t.newCompany}
        </Button>
      </div>

      {error && !editing && <div className="mb-4"><ErrorBanner {...error} /></div>}

      {loadError && (
        <div className="flex flex-col gap-2">
          <ErrorBanner {...loadError} />
          <Button variant="secondary" className="self-start" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button>
        </div>
      )}

      {!loadError && companies === null && <CardsSkeleton label={t.loading} />}

      {companies && (
        <ul aria-label={t.cards} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {library && (
            <li>
              <article data-company-card="library" className="flex h-full flex-col gap-3 rounded-lg border-2 border-primary bg-card p-4">
                <CardHead initials={t.library.initials} accent name={t.library.name} sub={t.library.lead} />
                <p className="flex items-center gap-1.5 text-md font-semibold text-navy">
                  <LineIcon name="stairs" className="h-4 w-4 text-muted" />
                  {libraryLadder ? libraryLadder.join(' → ') : '—'}
                </p>
                <p className="flex items-center gap-1.5 rounded-md bg-secondary/[0.08] px-3 py-1.5 text-md font-semibold text-navy">
                  {t.library.pill}
                </p>
                <CardLink href={companyHref(library._id)}>{t.library.open}</CardLink>
              </article>
            </li>
          )}
          {insurers?.map((c) => {
            const count = counts?.get(c._id);
            const summary = summaries.get(c._id);
            return (
              <li key={c._id}>
                <article data-company-card={c._id} className="flex h-full flex-col gap-3 rounded-lg border border-card-edge bg-card p-4">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <CardHead initials={c.name.slice(0, 2).toUpperCase()} name={c.name} sub={count?.ladder.length ? count.ladder.join(' → ') : '—'} />
                    </div>
                    <RowMenu name={c.name} items={menuOf(c)} />
                  </div>
                  <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-md font-semibold text-navy">
                    <span className="inline-flex items-center gap-1.5">
                      <LineIcon name="building" className="h-4 w-4 text-muted" />
                      {count ? t.card.kpms({ n: count.kpmCount }) : '—'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <LineIcon name="users" className="h-4 w-4 text-muted" />
                      {count ? t.card.members({ n: count.memberCount }) : '—'}
                    </span>
                  </p>
                  {summary && <TemplateLine summary={summary} kpms={count?.kpmCount ?? null} />}
                  <CardLink href={companyHref(c._id)}>{t.card.open}</CardLink>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {insurers?.length === 0 && !library && (
        <div className="rounded-lg border border-card-edge bg-card"><EmptyState title={t.none} /></div>
      )}

      {/* P19.15-T3 (ADR-0259): *Unggah file* for a file of any insurer — kept from before. */}
      <div className="mt-6">
        {/* *Pembacaan file belum dinyalakan…* is Platform › Pengaturan's alone, at every size (UI-213 (21 Nov); ADR-0283 §7). */}
        <IntakeButton companyId={null} canManage explainOff={false} />
      </div>

      {creating && (
        <NewCompanyDialog
          insurers={insurers ?? []}
          onClose={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); router.push(companyHref(id)); }}
        />
      )}

      {editing && (
        <RenameSheet
          company={editing}
          error={error}
          onClose={() => { setEditing(null); setError(null); }}
          onSave={(input) => run(() => updateCompany(editing._id, input))}
        />
      )}

      <Dialog
        open={suspending !== null}
        message={suspending ? old.suspendAsk({ name: suspending.name }) : ''}
        confirmLabel={old.suspend}
        cancelLabel={old.cancel}
        tone="danger"
        onCancel={() => setSuspending(null)}
        onConfirm={() => {
          const c = suspending;
          setSuspending(null);
          if (c) void run(() => setCompanyStatus(c._id, 'suspended'));
        }}
      />
    </Page>
  );
}

/** A card's head: the two letters on a tile — orange for the Default template — the name, and one line under it. */
function CardHead({ initials, name, sub, accent = false }: { initials: string; name: string; sub: string; accent?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm font-bold',
          accent ? 'bg-primary text-primary-contrast' : 'bg-pill-grey text-navy',
        )}
      >
        {initials}
      </span>
      <div className="min-w-0">
        <h2 className="truncate text-md font-bold text-navy">{name}</h2>
        <p className="text-sm text-muted">{sub}</p>
      </div>
    </div>
  );
}

/** *Buka template →*: the card's one way in. */
function CardLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="mt-auto inline-flex min-h-10 items-center gap-1 text-md font-bold text-primary-ink">
      {children}
      <LineIcon name="chevronRight" className="h-4 w-4" />
    </Link>
  );
}

/** The template's one line: changes waiting (amber), every KPM current (green), or an empty template (amber). */
function TemplateLine({ summary, kpms }: { summary: PublicationSummary; kpms: number | null }) {
  const t = useMessages(adminCompaniesConsoleMessages).card;
  const [words, good] = summary.templateEmpty ? [t.empty, false]
    : summary.changes > 0 ? [t.waiting({ n: summary.changes }), false] : [t.current, true];
  // *Semua KPM memakai versi terbaru* of a company with no KPM says nothing true: on a phone it goes (UI-218 (21 Nov)).
  const noKpm = good && kpms === 0;
  return (
    <p
      data-template-line={good ? 'current' : summary.templateEmpty ? 'empty' : 'waiting'}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-md font-semibold',
        good ? 'bg-success/10 text-success' : 'bg-primary-50 text-primary-ink',
        noKpm && 'max-md:hidden',
      )}
    >
      <LineIcon name={good ? 'check' : 'info'} className="h-4 w-4" />
      {words}
    </p>
  );
}

function CardsSkeleton({ label }: { label: string }) {
  return (
    <Skeleton label={label}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-card-edge bg-card p-4">
            <SkeletonBar className="h-5 w-40" />
            <SkeletonBar className="mt-3 w-56 max-w-full" />
            <SkeletonBar className="mt-3 w-32" />
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

/**
 * ***Perusahaan baru*** (AC-1, frame 28): the name, *Mulai dari* — *Default template* (*disarankan*) or *Salin dari
 * perusahaan lain* with the company — the note that products are filled in for the company itself, and *✓ Buat
 * perusahaan*. A centred dialog from 1024px, a bottom sheet below it (§12).
 */
function NewCompanyDialog({
  insurers, onClose, onCreated,
}: { insurers: Company[]; onClose: () => void; onCreated: (companyId: string) => void }) {
  const t = useMessages(adminCompaniesConsoleMessages).setup;
  const formId = useId();
  const startId = useId();
  const [name, setName] = useState('');
  const [from, setFrom] = useState<CompanyStart>('default');
  const [source, setSource] = useState('');
  const [pressed, setPressed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const slug = toSlug(name).slice(0, SLUG_MAX);
  const nameError = pressed && !name.trim() ? t.required
    : error?.code === 'COMPANY_SLUG_TAKEN' ? error.message : undefined;
  const sourceError = pressed && from === 'company' && !source ? t.required : undefined;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPressed(true);
    if (!name.trim() || !SLUG.test(slug) || (from === 'company' && !source) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const made = await setUpCompany({ name: name.trim(), slug, from, ...(from === 'company' ? { fromCompanyId: source } : {}) });
      onCreated(made._id);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={t.title}
      description={t.lead}
      placement="responsive"
      handle
      closeLabel={t.close}
      onClose={onClose}
      footer={(
        <Button type="submit" form={formId} disabled={busy} className="w-full gap-1">
          <LineIcon name="check" className="h-4 w-4" />
          {busy ? t.creating : t.submit}
        </Button>
      )}
    >
      <form id={formId} onSubmit={(e) => { void submit(e); }} className="flex flex-col gap-4" noValidate>
        {error && error.code !== 'COMPANY_SLUG_TAKEN' && <ErrorBanner {...error} />}
        <Field label={t.name} htmlFor={`${formId}-name`} error={nameError}>
          <TextInput id={`${formId}-name`} maxLength={120} value={name} invalid={Boolean(nameError)} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div>
          <p id={startId} className="mb-1.5 text-md font-semibold text-navy">{t.startFrom}</p>
          <ChoiceRows
            labelledBy={startId}
            value={from}
            onChange={setFrom}
            disabled={busy}
            options={[
              { key: 'default', label: `${t.fromDefault} · ${t.recommended}`, hint: t.fromDefaultHint },
              { key: 'company', label: t.fromCompany, hint: t.fromCompanyHint },
            ]}
          />
        </div>
        {from === 'company' && (
          <Field label={t.company} htmlFor={`${formId}-source`} error={sourceError}>
            <Select id={`${formId}-source`} value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">{t.pick}</option>
              {insurers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </Select>
          </Field>
        )}
        <p className="text-sm text-muted">{t.note}</p>
      </form>
    </Modal>
  );
}

/** *Ubah* in ⋯ (kept, UI-126): the company's name and slug. */
function RenameSheet({
  company, error, onClose, onSave,
}: {
  company: Company;
  error: ApiError | null;
  onClose: () => void;
  onSave: (input: { name: string; slug: string }) => Promise<void>;
}) {
  const t = useMessages(adminTemplateCompaniesMessages);
  const [name, setName] = useState(company.name);
  const [slug, setSlug] = useState(company.slug);
  const [busy, setBusy] = useState(false);
  const badSlug = slug.length > 0 && !SLUG.test(slug);
  const nameError = !name.trim() ? t.required : undefined;
  const slugError = badSlug ? t.slugShape : error?.code === 'COMPANY_SLUG_TAKEN' ? error.message : undefined;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (nameError || badSlug || !slug.trim() || busy) return;
    setBusy(true);
    await onSave({ name: name.trim(), slug: slug.trim() });
    setBusy(false);
  }

  return (
    <AddSheet open title={t.editTitle} submitLabel={t.save} busy={busy} onClose={onClose} onSubmit={(e) => { void submit(e); }}>
      {error && error.code !== 'COMPANY_SLUG_TAKEN' && <ErrorBanner {...error} />}
      <Field label={t.name} htmlFor="company-name" error={nameError}>
        <TextInput id="company-name" maxLength={120} value={name} invalid={Boolean(nameError)} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={t.slug} htmlFor="company-slug" hint={t.slugEditHint} error={slugError}>
        <TextInput id="company-slug" maxLength={SLUG_MAX} value={slug} invalid={Boolean(slugError)} onChange={(e) => setSlug(e.target.value)} />
      </Field>
    </AddSheet>
  );
}
