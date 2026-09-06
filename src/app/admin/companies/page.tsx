'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { createCompany, listCompanies, type Company } from '@/lib/admin';
import { toDisplayError } from '@/lib/api-client';

const SLUG = /^[a-z0-9-]+$/;

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  const badSlug = slug.length > 0 && !SLUG.test(slug);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createCompany({ name: name.trim(), slug: slug.trim() });
      setCompanies((cs) => [...(cs ?? []), created].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
      setSlug('');
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell
      title="Companies"
      subtitle="Each company has its own role ladder, product catalog, and KPM template. A KPM belongs to exactly one, and inherits its currency, locale and time zone."
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div>
          {companies === null && (
            <p role="status" className="text-md text-muted">
              Loading…
            </p>
          )}
          {companies?.length === 0 && (
            <div className="rounded-lg border border-hairline bg-card">
              <EmptyState title="No insurers yet. Add one to start provisioning offices." />
            </div>
          )}
          {companies && companies.length > 0 && (
            <DataTable caption="Companies" columns={['Name', 'Slug', 'Currency', 'Time zone']}>
              {companies.map((c) => (
                <Row key={c._id}>
                  <Cell className="font-semibold">{c.name}</Cell>
                  <Cell>
                    <code className="text-sm">{c.slug}</code>
                  </Cell>
                  <Cell>{c.defaultCurrency}</Cell>
                  <Cell>{c.defaultTimezone}</Cell>
                </Row>
              ))}
            </DataTable>
          )}
        </div>

        <Card>
          <h2 className="font-display text-lg font-bold text-navy">Add an insurer</h2>
          <form onSubmit={submit} className="mt-3 flex flex-col gap-4" noValidate>
            {error && <ErrorBanner {...error} />}
            <Field label="Name" htmlFor="name">
              <TextInput id="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field
              label="Slug"
              htmlFor="slug"
              hint="Lower-case letters, digits and hyphens. Unique, and not renamed later."
              error={badSlug ? 'Lower-case letters, digits and hyphens only.' : undefined}
            >
              <TextInput id="slug" required value={slug} onChange={(e) => setSlug(e.target.value)} invalid={badSlug} />
            </Field>
            <Button type="submit" disabled={busy || badSlug || !name.trim() || !slug.trim()}>
              {busy ? 'Adding…' : 'Add insurer'}
            </Button>
          </form>
        </Card>
      </div>
    </AdminShell>
  );
}
