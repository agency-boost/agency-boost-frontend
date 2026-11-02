'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfigBadge } from '@/components/ui/config-badge';
import {
  Button, Card, ErrorBanner, Field, FieldRow, ReadOnlyField, Select, TextInput,
} from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { SkeletonTable } from '@/components/ui/skeleton';
import {
  createCompany, insurersOf, isTemplateLibrary, listCompanies, setCompanyStatus, updateCompany, type Company,
} from '@/lib/admin';
import { companyHref } from '@/lib/template-sections';
import { toDisplayError } from '@/lib/api-client';
import { SLUG_MAX, toSlug } from '@/lib/slug';
import type { MessagesOf } from '@/i18n/catalogue';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateCompaniesMessages } from '@/i18n/messages/admin-template-companies';

/**
 * The server's pattern, letter for letter (`CreateCompanyDto.slug`). It is the shape
 * derivation produces rather than merely the characters it allows — so `--a--`, which
 * the old rule accepted and no derived slug could ever be, is refused here too.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The skeleton and the table read the same array, so a column added to one cannot
 * be missing from the other — which is what keeps the placeholder the same width as
 * the thing it stands in for. Its words are the catalogue's, in the reader's language.
 */
const columnsOf = (t: MessagesOf<typeof adminTemplateCompaniesMessages.en>['columns']) => [
  // A company's name opens its page — its KPM templates and its own settings (ADR-0185 §2).
  t.name, t.slug, t.currency, t.timeZone, t.status,
  { label: t.actions, visuallyHidden: true },
] as const;

export default function CompaniesPage() {
  const t = useMessages(adminTemplateCompaniesMessages);
  const columns = columnsOf(t.columns);
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  /**
   * Derivation stops the moment somebody edits the slug themselves. Without the latch a
   * hand-made slug is silently overwritten by the next keystroke in the name, which is
   * the worst of both — it looks editable and is not.
   */
  const [slugTouched, setSlugTouched] = useState(false);
  /**
   * **Start from** (ADR-0164 §4, ADR-0185 §1): a copy of *Template bawaan AgencyBoost*, or *Empty*.
   *
   * **The built-in templates by default, because they are right almost every time** — an insurer being
   * onboarded wants the twelve activity types and the five ratios to edit, not a blank screen. *Empty* is for
   * a company whose presets are being authored from scratch, and it has to be a choice made *here*.
   */
  const [withDefaults, setWithDefaults] = useState(true);
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  /** The company being renamed, and the draft. `null` when nothing is open. */
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', slug: '' });

  useEffect(() => {
    void listCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  const badSlug = slug.length > 0 && !SLUG.test(slug);
  /**
   * **The platform's built-in templates** (ADR-0164, ADR-0185 §1): the library company, which a new company copies —
   * one card above the insurers, never a row among them. Absent where no migration has made it.
   */
  const library = companies?.find(isTemplateLibrary) ?? null;
  const insurers = companies ? insurersOf(companies) : null;
  // A slug already in use comes back as its own code, so it belongs on the field that
  // caused it rather than only in the banner above the form.
  const takenSlug = error?.code === 'COMPANY_SLUG_TAKEN' ? error.message : undefined;

  function changeName(value: string) {
    setName(value);
    if (!slugTouched) setSlug(toSlug(value));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createCompany({
        name: name.trim(), slug: slug.trim(), usesPlatformDefaults: withDefaults,
      });
      setCompanies((cs) => [...(cs ?? []), created].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
      setSlug('');
      setSlugTouched(false);
      setWithDefaults(true);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  /** One write, then the row it changed. Used by both the rename and the status change. */
  async function run(action: () => Promise<Company>) {
    setBusy(true);
    setError(null);
    try {
      const row = await action();
      setCompanies((cs) => (cs ?? [])
        .map((c) => (c._id === row._id ? row : c))
        .sort((a, b) => a.name.localeCompare(b.name)));
      setEditing(null);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  const draftSlugBad = draft.slug.length > 0 && !SLUG.test(draft.slug);

  return (
    // The nav item's words (P18.95-T9 AC-2; UI-027): *Manage companies* (`Superadmin.html:177`).
    <Page title={t.title} subtitle={t.subtitle}>
      {/* `minmax(0, 1fr)`, not `1fr`: a column is otherwise at least as wide as its table, which pushed the page sideways
          at every size; the table scrolls in its own frame instead (P18.98-T4 AC-6, the walk of 2026-10-29). */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          {library && (
            <Link
              href={companyHref(library._id)}
              className="mb-4 flex items-center gap-4 rounded-lg border border-card-edge bg-card px-5 py-4 hover:border-navy/30"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-bold text-navy">{t.library.name}</span>
                <span className="block text-md text-muted">{t.library.lead}</span>
              </span>
              <LineIcon name="chevronRight" className="h-5 w-5 shrink-0 text-navy" />
            </Link>
          )}
          {insurers === null && (
            <SkeletonTable caption={t.caption} columns={columns} rows={4} />
          )}
          {insurers?.length === 0 && (
            <div className="rounded-lg border border-card-edge bg-card">
              <EmptyState title={t.empty} />
            </div>
          )}
          {insurers && insurers.length > 0 && (
            <DataTable caption={t.caption} columns={columns}>
              {insurers.map((c) => (editing === c._id ? (
                <Row key={c._id}>
                  {/* The whole row, because a rename is two fields and a name field alone
                      would leave the slug reachable only by creating a second company. */}
                  <Cell colSpan={columns.length}>
                    <FieldRow>
                      <Field label={t.name} htmlFor={`name-${c._id}`}>
                        <TextInput
                          id={`name-${c._id}`}
                          value={draft.name}
                          maxLength={120}
                          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                        />
                      </Field>
                      <Field
                        label={t.slug}
                        htmlFor={`slug-${c._id}`}
                        hint={t.slugEditHint}
                        error={draftSlugBad ? t.slugShape : takenSlug}
                      >
                        <TextInput
                          id={`slug-${c._id}`}
                          value={draft.slug}
                          maxLength={SLUG_MAX}
                          invalid={draftSlugBad || Boolean(takenSlug)}
                          onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
                        />
                      </Field>
                      <FieldRow.Actions>
                        <Button
                          disabled={busy || draftSlugBad || !draft.name.trim() || !draft.slug.trim()}
                          onClick={() => void run(() => updateCompany(c._id, {
                            name: draft.name.trim(), slug: draft.slug.trim(),
                          }))}
                        >
                          {t.save}
                        </Button>
                        <Button variant="secondary" onClick={() => setEditing(null)}>{t.cancel}</Button>
                      </FieldRow.Actions>
                    </FieldRow>
                  </Cell>
                </Row>
              ) : (
                <Row key={c._id}>
                  <Cell className="font-semibold">
                    <Link href={companyHref(c._id)} className="inline-flex items-center gap-1 text-navy underline">
                      {c.name}
                      <LineIcon name="chevronRight" className="h-4 w-4" />
                    </Link>
                  </Cell>
                  <Cell>
                    <code className="text-sm">{c.slug}</code>
                  </Cell>
                  <Cell>{c.defaultCurrency}</Cell>
                  <Cell>{c.defaultTimezone}</Cell>
                  <Cell>
                    <span className="flex flex-wrap items-center gap-2">
                      <ConfigBadge tone={c.status === 'active' ? 'won' : 'open'}>
                        {c.status === 'active' ? t.active : t.suspended}
                      </ConfigBadge>
                      {/* Said once, on the row it is true of. A company that took nothing
                          shows every template section empty, and this is the only thing that
                          explains why. */}
                      {!c.usesPlatformDefaults && (
                        <ConfigBadge tone="open">{t.startedBlank}</ConfigBadge>
                      )}
                    </span>
                  </Cell>
                  <Cell>
                    <span className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="inline"
                        disabled={busy}
                        onClick={() => {
                          setEditing(c._id);
                          setDraft({ name: c.name, slug: c.slug });
                        }}
                      >
                        {t.edit}
                      </Button>
                      {c.status === 'active' ? (
                        <Button
                          variant="inlineDanger"
                          disabled={busy}
                          title={t.suspendTip}
                          onClick={() => void run(() => setCompanyStatus(c._id, 'suspended'))}
                        >
                          {t.suspend}
                        </Button>
                      ) : (
                        <Button
                          variant="inline"
                          disabled={busy}
                          onClick={() => void run(() => setCompanyStatus(c._id, 'active'))}
                        >
                          {t.reactivate}
                        </Button>
                      )}
                    </span>
                  </Cell>
                </Row>
              )))}
            </DataTable>
          )}
        </div>

        <Card>
          <h2 className="font-display text-lg font-bold text-navy">{t.addTitle}</h2>
          <form onSubmit={submit} className="mt-3 flex flex-col gap-4" noValidate>
            {/* A taken slug is explained on the Slug field, so the banner would announce
                the same failure twice — a screen reader reads both. */}
            {error && !takenSlug && <ErrorBanner {...error} />}
            <Field label={t.name} htmlFor="name">
              <TextInput
                id="name"
                required
                minLength={2}
                maxLength={120}
                value={name}
                onChange={(e) => changeName(e.target.value)}
              />
            </Field>
            <Field
              label={t.slug}
              htmlFor="slug"
              hint={t.slugAddHint}
              error={badSlug ? t.slugShape : takenSlug}
            >
              <TextInput
                id="slug"
                required
                maxLength={SLUG_MAX}
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                invalid={badSlug || Boolean(takenSlug)}
              />
            </Field>
            {/* Every office inherits these, and no screen can change them: v1 is
                single-currency and single-timezone (ADR-0016). Shown rather than offered,
                because a form field nobody can vary is worse than a stated fact. */}
            {/*
              * **The built-in templates by default, and a choice rather than a fact** (ADR-0185 §1): named the
              * same whether the library exists or the API falls back to the code's own starting point — the
              * same settings either way, and *AgencyBoost defaults* is no longer a name the console says.
              */}
            <Field
              label={t.startFrom}
              htmlFor="start-from"
              hint={withDefaults ? t.fromLibraryHint : t.emptyHint}
            >
              <Select
                id="start-from"
                value={withDefaults ? 'template' : 'empty'}
                disabled={busy}
                onChange={(e) => setWithDefaults(e.target.value === 'template')}
              >
                <option value="template">{t.fromLibrary}</option>
                <option value="empty">{t.startEmpty}</option>
              </Select>
            </Field>
            <ReadOnlyField
              label={t.inherit}
              value="IDR · Asia/Jakarta · id-ID"
              reason={t.inheritReason}
            />
            <Button type="submit" disabled={busy || badSlug || !name.trim() || !slug.trim()}>
              {busy ? t.adding : t.add}
            </Button>
          </form>
        </Card>
      </div>
    </Page>
  );
}
