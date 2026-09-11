'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, ErrorBanner, Field, ReadOnlyField, TextInput } from '@/components/ui/field';
import { SkeletonTable } from '@/components/ui/skeleton';
import { createCompany, listCompanies, type Company } from '@/lib/admin';
import { toDisplayError } from '@/lib/api-client';
import { SLUG_MAX, toSlug } from '@/lib/slug';

/**
 * The server's pattern, letter for letter (`CreateCompanyDto.slug`). It is the shape
 * derivation produces rather than merely the characters it allows — so `--a--`, which
 * the old rule accepted and no derived slug could ever be, is refused here too.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The skeleton and the table read the same array, so a column added to one cannot
 * be missing from the other — which is what keeps the placeholder the same width as
 * the thing it stands in for.
 */
const COLUMNS = [
  'Name', 'Slug', 'Currency', 'Time zone',
  // The template belongs to the company (ADR-0018), so it is reached through the company
  // rather than from a nav item that would have nothing to point at.
  { label: 'KPM template', visuallyHidden: true },
] as const;

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  /**
   * Derivation stops the moment somebody edits the slug themselves. Without the latch a
   * hand-made slug is silently overwritten by the next keystroke in the name, which is
   * the worst of both — it looks editable and is not.
   */
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  const badSlug = slug.length > 0 && !SLUG.test(slug);
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
      const created = await createCompany({ name: name.trim(), slug: slug.trim() });
      setCompanies((cs) => [...(cs ?? []), created].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
      setSlug('');
      setSlugTouched(false);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      title="Companies"
      subtitle="Each company has its own role ladder, product catalog, and KPM template. A KPM belongs to exactly one, and inherits its currency, locale and time zone."
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div>
          {companies === null && (
            <SkeletonTable caption="Companies" columns={COLUMNS} rows={4} />
          )}
          {companies?.length === 0 && (
            <div className="rounded-lg border border-hairline bg-card">
              <EmptyState title="No companies yet. Add one to start provisioning offices." />
            </div>
          )}
          {companies && companies.length > 0 && (
            <DataTable caption="Companies" columns={COLUMNS}>
              {companies.map((c) => (
                <Row key={c._id}>
                  <Cell className="font-semibold">{c.name}</Cell>
                  <Cell>
                    <code className="text-sm">{c.slug}</code>
                  </Cell>
                  <Cell>{c.defaultCurrency}</Cell>
                  <Cell>{c.defaultTimezone}</Cell>
                  <Cell>
                    <Link
                      href={`/admin/companies/${c._id}/template`}
                      className="text-md font-semibold text-navy underline"
                    >
                      KPM template
                    </Link>
                  </Cell>
                </Row>
              ))}
            </DataTable>
          )}
        </div>

        <Card>
          <h2 className="font-display text-lg font-bold text-navy">Add a company</h2>
          <form onSubmit={submit} className="mt-3 flex flex-col gap-4" noValidate>
            {/* A taken slug is explained on the Slug field, so the banner would announce
                the same failure twice — a screen reader reads both. */}
            {error && !takenSlug && <ErrorBanner {...error} />}
            <Field label="Name" htmlFor="name">
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
              label="Slug"
              htmlFor="slug"
              hint="Filled in from the name, and yours to change. Unique, and not renamed later."
              error={badSlug ? 'Lower-case letters and digits, separated by single hyphens.' : takenSlug}
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
            <ReadOnlyField
              label="Offices inherit"
              value="IDR · Asia/Jakarta · id-ID"
              reason="Currency, time zone and locale are the same for every company in v1, so a new office takes them without being asked."
            />
            <Button type="submit" disabled={busy || badSlug || !name.trim() || !slug.trim()}>
              {busy ? 'Adding…' : 'Add company'}
            </Button>
          </form>
        </Card>
      </div>
    </Page>
  );
}
