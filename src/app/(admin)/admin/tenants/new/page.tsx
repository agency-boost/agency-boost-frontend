'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Page } from '@/components/page';
import {
  Button, ButtonLink, Card, ErrorBanner, Field, ReadOnlyField, Select, TextInput,
} from '@/components/ui/field';
import {
  createTenant, listCompanies, listTemplates, type Company, type NamedTemplate, type StartFrom,
} from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';

const CODE = /^[A-Za-z0-9-]{2,16}$/;

/** What each *Start from* choice gives the office, said under the field. */
const START_HINT = {
  template: 'Its settings are copied from this template’s published sections; a section it has not published starts empty.',
  defaults: 'Every section as AgencyBoost ships it.',
  empty: 'Nothing but the three activity types the goal plan counts. The Owner builds the rest.',
} as const;

/** `template:<id>`, `defaults` or `empty`: one select's value for the three kinds of source. */
function startFromOf(value: string): StartFrom {
  if (value === 'defaults' || value === 'empty') return { kind: value };
  return { kind: 'template', templateId: value.slice('template:'.length) };
}

export default function NewTenantPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState({
    companyId: '',
    code: '',
    branchName: '',
    address: '',
    contactPhone: '',
  });
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * **Start from** (ADR-0115 §4): the company's active templates, the default first and chosen, then
   * the AgencyBoost defaults and *Empty*. Read again whenever the company changes; `null` while it is.
   */
  const [templates, setTemplates] = useState<NamedTemplate[] | null>(null);
  const [startFrom, setStartFrom] = useState('');
  /**
   * **The templates could not be read** (P13.2's exit review, finding 7). Nothing is chosen and the form
   * cannot be sent until they are: choosing the AgencyBoost defaults for the reader — what this did — made
   * an office from something they were never shown, when the company's default was what they expected.
   * Leaving `startFrom` out instead would have had the API pick a template this page could not name.
   */
  const [templatesError, setTemplatesError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!form.companyId) return;
    let current = true;
    setTemplates(null);
    setStartFrom('');
    setTemplatesError(null);
    void listTemplates(form.companyId)
      .then((rows) => {
        if (!current) return;
        // Archived templates are kept to be read, never offered.
        const offered = rows.filter((t) => t.status === 'active')
          .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
        setTemplates(offered);
        setStartFrom(offered[0] ? `template:${offered[0].id}` : 'defaults');
      })
      .catch((err) => {
        if (current) setTemplatesError(toDisplayError(err));
      });
    return () => { current = false; };
  }, [form.companyId, attempt]);

  useEffect(() => {
    void listCompanies()
      .then((cos) => {
        setCompanies(cos);
        setForm((f) => (f.companyId ? f : { ...f, companyId: cos[0]?._id ?? '' }));
      })
      .catch(() => setCompanies([]));
  }, []);

  const badCode = form.code.length > 0 && !CODE.test(form.code);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const kpm = await createTenant({
        companyId: form.companyId,
        code: form.code,
        branchName: form.branchName,
        ...(form.address ? { address: form.address } : {}),
        ...(form.contactPhone ? { contactPhone: form.contactPhone } : {}),
        startFrom: startFromOf(startFrom),
      });
      router.push(`/admin/tenants/${kpm._id}`);
    } catch (err) {
      setError(toDisplayError(err));
      setBusy(false);
    }
  }

  return (
    <Page
      title="New office"
      subtitle="Its settings are copied from what it starts from; the office owns them afterwards."
    >
      <Card className="max-w-2xl">
        {companies.length === 0 ? (
          <div>
            <p className="text-md text-navy">There is no company to attach an office to.</p>
            <Link href="/admin/companies" className="mt-2 inline-block text-md text-navy underline">
              Create a company first
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            {error && <ErrorBanner {...error} />}

            <Field label="Company" htmlFor="companyId">
              <Select id="companyId" required value={form.companyId} onChange={set('companyId')}>
                {companies.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex flex-col gap-1">
              <Field
                label="Start from"
                htmlFor="startFrom"
                hint={templatesError ? undefined : START_HINT[startFrom.startsWith('template:') ? 'template' : (startFrom || 'template') as 'defaults' | 'empty']}
                error={templatesError ? `This company’s templates could not be read, so there is nothing to start from yet. ${templatesError.message}` : undefined}
              >
                <Select
                  id="startFrom"
                  value={startFrom}
                  disabled={templates === null}
                  invalid={Boolean(templatesError)}
                  onChange={(e) => setStartFrom(e.target.value)}
                >
                  {templates === null && <option value="">{templatesError ? 'Not loaded' : 'Loading…'}</option>}
                  {templates?.map((t) => (
                    <option key={t.id} value={`template:${t.id}`}>
                      {t.isDefault ? `${t.name} · Default` : t.name}
                    </option>
                  ))}
                  {templates !== null && <option value="defaults">AgencyBoost defaults</option>}
                  {templates !== null && <option value="empty">Empty</option>}
                </Select>
              </Field>
              {/* Outside the field, which links its hint and error to one control only. */}
              {templatesError && (
                <Button variant="inline" className="self-start" onClick={() => setAttempt((n) => n + 1)}>
                  Try again
                </Button>
              )}
            </div>

            <Field
              label="Office code"
              htmlFor="code"
              hint="Unique within the company. Effectively permanent."
              error={badCode ? '2–16 characters: letters, digits and hyphens.' : undefined}
            >
              <TextInput id="code" required value={form.code} onChange={set('code')} invalid={badCode} />
            </Field>

            <Field label="Branch name" htmlFor="branchName">
              <TextInput id="branchName" required minLength={2} value={form.branchName} onChange={set('branchName')} />
            </Field>

            <Field label="Address" htmlFor="address" hint="Optional.">
              <TextInput id="address" value={form.address} onChange={set('address')} />
            </Field>

            <Field label="Contact phone" htmlFor="contactPhone" hint="Optional.">
              <TextInput id="contactPhone" value={form.contactPhone} onChange={set('contactPhone')} />
            </Field>

            {/* Shown, not asked for. This was a free-text box: `Asia/Jakata` was
                accepted by both halves, and every day boundary in that office then
                resolved to an Invalid DateTime for ever, with nothing raised at
                creation (ADR-0016). */}
            <ReadOnlyField
              label="Time zone"
              value="Asia/Jakarta"
              reason="Every day boundary in this office — what counts as today, which week a figure falls in, when a month closes — is worked out in this zone, not in yours and not in the server's. v1 runs every office on Jakarta time."
            />

            <div className="flex gap-2">
              <Button type="submit" disabled={busy || badCode || !form.code || !form.branchName || !startFrom}>
                {busy ? 'Creating…' : 'Create office'}
              </Button>
              <ButtonLink href="/admin/tenants" variant="secondary">
                Cancel
              </ButtonLink>
            </div>
          </form>
        )}
      </Card>
    </Page>
  );
}
