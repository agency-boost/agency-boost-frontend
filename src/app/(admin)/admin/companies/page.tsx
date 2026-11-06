'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { Page } from '@/components/page';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfigBadge } from '@/components/ui/config-badge';
import { ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { ListCard, ListRow } from '@/components/ui/list-rows';
import { SkeletonTable } from '@/components/ui/skeleton';
import {
  createCompany, insurersOf, isTemplateLibrary, listCompanies, listTemplates, readPlatformOverview, setCompanyStatus,
  startedBlank, updateCompany, type Company, type CompanyCard, type NamedTemplate,
} from '@/lib/admin';
import { companyHref, templateProgress } from '@/lib/template-sections';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { SLUG_MAX, toSlug } from '@/lib/slug';
import { useMediaQuery } from '@/lib/use-media-query';
import { formatNumber } from '@/lib/format';
import type { MessagesOf } from '@/i18n/catalogue';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';
import { adminTemplateCompaniesMessages } from '@/i18n/messages/admin-template-companies';
import { AddButton, AddSheet, ChoiceRows, RowMenu } from '@/components/ui/rows-and-sheets';

/**
 * The server's pattern, letter for letter (`CreateCompanyDto.slug`). It is the shape
 * derivation produces rather than merely the characters it allows — so `--a--`, which
 * the old rule accepted and no derived slug could ever be, is refused here too.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** What every office inherits in v1 (ADR-0016): codes, the same in both languages. */
const INHERITED = 'IDR · Asia/Jakarta · id-ID';

type Words = MessagesOf<typeof adminTemplateCompaniesMessages.en>;

/**
 * **A laptop's columns** (P19.2-T2 AC-1; UI-126: *Nama · Status · Template default · KPM · Anggota · ⋯*): the table
 * takes the content's width, and *Slug*, *Mata uang* and *Zona waktu* — the same for every company in v1 — are on the
 * company's *Pengaturan perusahaan* tab. The skeleton and the table read the same array, so the placeholder is the
 * width of what it stands in for.
 */
const columnsOf = (t: Words['columns']) => [
  t.name, t.status, t.templateDefault, t.kpm, t.members,
  { label: t.actions, visuallyHidden: true },
] as const;

/** A company's default template as its row shows it: the name, and how many of its sections wait in a draft. */
interface DefaultTemplate {
  name: string;
  waiting: number;
}

/**
 * The default among a company's templates (exactly one, ADR-0115 §3), with its sections waiting to be published counted
 * as its card on the company's page counts them (`templateProgress`, ADR-0185 §3) — `admin-desktop` screen 1's
 * *"2 perubahan belum terbit"*, data the app already shows.
 */
function defaultOf(templates: NamedTemplate[]): DefaultTemplate | null {
  const found = Array.isArray(templates) ? templates.find((tpl) => tpl.isDefault && tpl.status === 'active') : undefined;
  if (!found?.sections) return found ? { name: found.name, waiting: 0 } : null;
  return { name: found.name, waiting: templateProgress(found).waiting };
}

/**
 * **Manage companies** (P3.1-T14, ADR-0018, ADR-0164, ADR-0185; P19.2-T2 AC-1, AC-3, AC-4, AC-5 — UI-126, UI-133,
 * UI-134, UI-135; `admin-mobile` screens 2 and 7, `admin-desktop` screens 1 and 4).
 *
 * - **Below 1024px no table** (UI-126): one 56px row per company — its two letters, its NAME in capitals, *slug · n
 *   KPM*, its state, and ⋯ (*Ubah · Tangguhkan*); the row opens the company. **From 1024px the table** takes the
 *   content's width, its columns *Nama · Status · Template default · KPM · Anggota · ⋯*.
 * - **No form until *+* is pressed** (UI-133): *+ Tambah perusahaan* on the title row (a round *+* on a phone) opens the
 *   company sheet — a bottom sheet on a phone, a centred modal from 768px — its *Mulai dari* two choice rows (UI-134),
 *   *Batal / Tambah perusahaan* pinned. *Ubah* in ⋯ opens the same sheet for a rename; *Tangguhkan* asks first.
 * - **The counts are the Overview's** (`GET /admin/overview`'s companies), so the two pages cannot count differently;
 *   the default template and its waiting sections are the company's own list (`GET /admin/companies/{id}/templates`).
 *   A count or a template that cannot be read is a dash, never a zero.
 */
export default function CompaniesPage() {
  const t = useMessages(adminTemplateCompaniesMessages);
  const card = useMessages(adminTemplateMessages).card;
  const figures = useFigureLanguage();
  const rows = useMediaQuery(['phone', 'tablet']);
  const phone = useMediaQuery('phone');
  const columns = columnsOf(t.columns);
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [counts, setCounts] = useState<Map<string, CompanyCard> | null>(null);
  const [defaults, setDefaults] = useState<Map<string, DefaultTemplate | null>>(new Map());
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  /** Which sheet is open: adding, or the company being changed. */
  const [sheet, setSheet] = useState<{ mode: 'add' } | { mode: 'edit'; company: Company } | null>(null);
  /** The company whose *Tangguhkan* is being asked about. */
  const [suspending, setSuspending] = useState<Company | null>(null);

  useEffect(() => {
    void listCompanies().then(setCompanies).catch(() => setCompanies([]));
    void readPlatformOverview()
      .then((o) => setCounts(new Map((o.companies ?? []).map((c) => [c.companyId, c]))))
      .catch(() => setCounts(null));
  }, []);

  /** Each insurer's default template, read once the list is in. A company whose read fails shows a dash. */
  const insurerIds = companies ? insurersOf(companies).map((c) => c._id).join(',') : '';
  useEffect(() => {
    if (!insurerIds) return;
    let live = true;
    void Promise.all(insurerIds.split(',').map(async (id) => {
      try {
        return [id, defaultOf(await listTemplates(id))] as const;
      } catch {
        return [id, null] as const;
      }
    })).then((pairs) => { if (live) setDefaults(new Map(pairs)); });
    return () => { live = false; };
  }, [insurerIds]);

  /**
   * **The platform's built-in templates** (ADR-0164, ADR-0185 §1): the library company, which a new company copies —
   * one card above the insurers, never a row among them. Absent where no migration has made it.
   */
  const library = companies?.find(isTemplateLibrary) ?? null;
  const insurers = companies ? insurersOf(companies) : null;
  const sorted = (cs: Company[]) => [...cs].sort((a, b) => a.name.localeCompare(b.name));

  /** One write, then the row it changed. Used by the rename and the status change. */
  async function run(action: () => Promise<Company>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const row = await action();
      setCompanies((cs) => sorted((cs ?? []).map((c) => (c._id === row._id ? { ...c, ...row } : c))));
      setSheet(null);
      return true;
    } catch (err) {
      setError(toDisplayError(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create(input: { name: string; slug: string; usesPlatformDefaults: boolean }) {
    setBusy(true);
    setError(null);
    try {
      const created = await createCompany(input);
      setCompanies((cs) => sorted([...(cs ?? []), created]));
      setSheet(null);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  const open = (next: typeof sheet) => {
    setError(null);
    setSheet(next);
  };

  /** ⋯ (UI-126: *Ubah · Tangguhkan*): *Aktifkan kembali* in *Tangguhkan*'s place on a suspended company. */
  const menuOf = (c: Company) => [
    { label: t.edit, onSelect: () => open({ mode: 'edit', company: c }) },
    c.status === 'active'
      ? { label: t.suspend, tone: 'alert' as const, hint: t.suspendTip, onSelect: () => setSuspending(c) }
      : { label: t.reactivate, onSelect: () => void run(() => setCompanyStatus(c._id, 'active')) },
  ];

  const status = (c: Company) => (
    <span className="flex flex-wrap items-center gap-2">
      <ConfigBadge tone={c.status === 'active' ? 'won' : 'open'}>
        {c.status === 'active' ? t.active : t.suspended}
      </ConfigBadge>
      {/* Said once, on the row it is true of. A company that took nothing shows every template section empty, and this
          is the only thing that explains why — **until its default template has a published section** (P19.4-T3
          AC-12; SA UI-017): the server's word, so Manulife's row stops saying it once its template is filled. */}
      {startedBlank(c) && <ConfigBadge tone="open">{t.startedBlank}</ConfigBadge>}
    </span>
  );

  const count = (c: Company, of: 'kpmCount' | 'memberCount') => {
    const found = counts?.get(c._id);
    return found ? found[of] : null;
  };

  return (
    // The nav item's words (P18.7-T9 AC-2; UI-027): *Manage companies* (`Superadmin.html:177`). No sub-line (P19.2-T2
    // AC-7; UI-136). The add button on the title row at every size (UI-133): `actions` alone is the row's at every width.
    <Page title={t.title} actions={<AddButton label={t.add} phone={phone} onClick={() => open({ mode: 'add' })} />}>
      {library && (
        <Link
          href={companyHref(library._id)}
          className="mb-4 flex items-center gap-4 rounded-lg border border-card-edge bg-card px-5 py-4 hover:border-secondary/30 max-lg:min-h-14 max-lg:px-3 max-lg:py-2"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-bold text-navy max-lg:text-md">{t.library.name}</span>
            {/* `admin-mobile` screen 2 draws the library as a row with its name alone. */}
            <span className="block text-md text-muted max-lg:hidden">{t.library.lead}</span>
          </span>
          <LineIcon name="chevronRight" className="h-5 w-5 shrink-0 text-navy" />
        </Link>
      )}

      {/* A failed write the open sheet does not show — a suspension, a reactivation — is said here. */}
      {error && !sheet && <ErrorBanner {...error} />}

      {insurers === null && <SkeletonTable caption={t.caption} columns={columns} rows={4} />}
      {insurers?.length === 0 && (
        <div className="rounded-lg border border-card-edge bg-card">
          <EmptyState title={t.empty} />
        </div>
      )}

      {insurers && insurers.length > 0 && rows && (
        <ListCard label={t.caption}>
          {insurers.map((c) => (
            <ListRow
              key={c._id}
              data-row={c._id}
              href={companyHref(c._id)}
              caps
              lead={<Initials name={c.name} />}
              title={c.name}
              meta={t.rowMeta({ slug: c.slug, n: count(c, 'kpmCount') })}
              trailing={<>{status(c)}<RowMenu name={c.name} items={menuOf(c)} /></>}
            />
          ))}
        </ListCard>
      )}

      {insurers && insurers.length > 0 && !rows && (
        <DataTable caption={t.caption} columns={columns}>
          {insurers.map((c) => {
            const tpl = defaults.get(c._id);
            const kpms = count(c, 'kpmCount');
            const members = count(c, 'memberCount');
            return (
              <Row key={c._id}>
                <Cell className="font-semibold">
                  {/* A company's name opens its page — its KPM templates and its own settings (ADR-0185 §2). */}
                  <span className="flex items-center gap-2">
                    <Initials name={c.name} />
                    <Link href={companyHref(c._id)} className="text-navy underline">{c.name}</Link>
                  </span>
                </Cell>
                <Cell>{status(c)}</Cell>
                <Cell>
                  {tpl ? (
                    <span className="flex flex-wrap items-center gap-2">
                      {tpl.name}
                      {tpl.waiting > 0 && <ConfigBadge tone="open">{card.waiting({ n: tpl.waiting })}</ConfigBadge>}
                    </span>
                  ) : <span className="text-muted">—</span>}
                </Cell>
                <Cell className="tabular-nums">{kpms === null ? '—' : formatNumber(kpms, {}, figures)}</Cell>
                <Cell className="tabular-nums">{members === null ? '—' : formatNumber(members, {}, figures)}</Cell>
                <Cell className="w-14 text-right"><RowMenu name={c.name} items={menuOf(c)} /></Cell>
              </Row>
            );
          })}
        </DataTable>
      )}

      {sheet && (
        <CompanySheet
          key={sheet.mode === 'edit' ? sheet.company._id : 'add'}
          editing={sheet.mode === 'edit' ? sheet.company : null}
          busy={busy}
          error={error}
          onClose={() => { setSheet(null); setError(null); }}
          onCreate={create}
          onRename={(c, input) => run(() => updateCompany(c._id, input))}
        />
      )}

      <Dialog
        open={suspending !== null}
        message={suspending ? t.suspendAsk({ name: suspending.name }) : ''}
        confirmLabel={t.suspend}
        cancelLabel={t.cancel}
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

/** The company's two letters on a 36px tile (`admin-mobile` screen 2's `MA`, `PR`). Decoration: the name follows it. */
function Initials({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-pill-grey text-sm font-bold text-navy"
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

/**
 * **The company sheet** (UI-133, UI-134): *Tambah perusahaan* — the name, the slug filled in from it, *Mulai dari* as two
 * choice rows and what an office inherits — or *Ubah perusahaan*, the name and the slug. **The main button is enabled**;
 * a field left empty says so on the field when it is pressed, and a slug of a shape the server refuses says so as it is
 * typed — neither is sent. A taken slug comes back as its own code, so it is said on the Slug field rather than only in
 * the banner.
 */
function CompanySheet({
  editing,
  busy,
  error,
  onClose,
  onCreate,
  onRename,
}: {
  editing: Company | null;
  busy: boolean;
  error: ApiError | null;
  onClose: () => void;
  onCreate: (input: { name: string; slug: string; usesPlatformDefaults: boolean }) => Promise<void>;
  onRename: (company: Company, input: { name: string; slug: string }) => Promise<boolean>;
}) {
  const t = useMessages(adminTemplateCompaniesMessages);
  const [name, setName] = useState(editing?.name ?? '');
  const [slug, setSlug] = useState(editing?.slug ?? '');
  /**
   * Derivation stops the moment somebody edits the slug themselves — and never runs on a rename. Without the latch a
   * hand-made slug is silently overwritten by the next keystroke in the name, which looks editable and is not.
   */
  const [slugTouched, setSlugTouched] = useState(editing !== null);
  /**
   * **Start from** (ADR-0164 §4, ADR-0185 §1): a copy of *Template bawaan AgencyBoost*, or *Empty*. The built-in
   * templates by default, because they are right almost every time; *Empty* has to be a choice made here.
   */
  const [startFrom, setStartFrom] = useState<'template' | 'empty'>('template');
  const [pressed, setPressed] = useState(false);

  const badSlug = slug.length > 0 && !SLUG.test(slug);
  const takenSlug = error?.code === 'COMPANY_SLUG_TAKEN' ? error.message : undefined;
  const nameError = pressed && !name.trim() ? t.required : undefined;
  const slugError = badSlug ? t.slugShape : pressed && !slug.trim() ? t.required : takenSlug;

  function submit(event: FormEvent) {
    event.preventDefault();
    setPressed(true);
    if (!name.trim() || !slug.trim() || badSlug || busy) return;
    if (editing) void onRename(editing, { name: name.trim(), slug: slug.trim() });
    else void onCreate({ name: name.trim(), slug: slug.trim(), usesPlatformDefaults: startFrom === 'template' });
  }

  return (
    <AddSheet
      open
      title={editing ? t.editTitle : t.addTitle}
      submitLabel={editing ? t.save : busy ? t.adding : t.add}
      busy={busy}
      onClose={onClose}
      onSubmit={submit}
    >
      {/* A taken slug is explained on the Slug field, so the banner would announce the same failure twice. */}
      {error && !takenSlug && <ErrorBanner {...error} />}
      <Field label={t.name} htmlFor="company-name" error={nameError}>
        <TextInput
          id="company-name"
          maxLength={120}
          value={name}
          invalid={Boolean(nameError)}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(toSlug(e.target.value));
          }}
        />
      </Field>
      <Field label={t.slug} htmlFor="company-slug" hint={editing ? t.slugEditHint : t.slugAddHint} error={slugError}>
        <TextInput
          id="company-slug"
          maxLength={SLUG_MAX}
          value={slug}
          invalid={Boolean(slugError)}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
        />
      </Field>
      {!editing && (
        <>
          <div>
            <p id="company-start-from" className="mb-1.5 text-md font-semibold text-navy">{t.startFrom}</p>
            <ChoiceRows
              labelledBy="company-start-from"
              value={startFrom}
              onChange={setStartFrom}
              disabled={busy}
              options={[
                { key: 'template', label: t.fromLibrary, hint: t.fromLibraryHint },
                { key: 'empty', label: t.startEmpty, hint: t.emptyHint },
              ]}
            />
          </div>
          {/* Every office inherits these, and no screen can change them: v1 is single-currency and single-timezone
              (ADR-0016). Stated rather than offered, because a field nobody can vary is worse than a stated fact. */}
          <p className="text-sm text-muted">
            <span className="font-semibold text-navy">{t.inherit}</span>
            {' · '}
            <span>{INHERITED}</span>
          </p>
        </>
      )}
    </AddSheet>
  );
}
