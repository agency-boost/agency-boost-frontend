'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Page } from '@/components/page';
import {
  Button, ButtonLink, Card, ErrorBanner, Field, ReadOnlyField, Select, TextInput,
} from '@/components/ui/field';
import { useMessages } from '@/i18n/language-provider';
import { adminOfficesMessages } from '@/i18n/messages/admin-offices';
import {
  createTenant, insurersOf, listCompanies, type Company, type StartFrom,
} from '@/lib/admin';
import { toDisplayError } from '@/lib/api-client';
import {
  allSources, TemplateSourceSelect, useTemplateSources, type SourceOption,
} from '@/components/kpm-template/template-sources';

const CODE = /^[A-Za-z0-9-]{2,16}$/;

/**
 * What the form sends for one *Mulai dari* choice (ADR-0115 §4, ADR-0164 §5, ADR-0185 §5): `empty`, one of the
 * company's own templates, or one of the platform's built-in ones — copied across companies (`templateLibrary`).
 * *AgencyBoost defaults* is not one: the built-in templates hold them, and the API refuses the source (ADR-0168 §2).
 */
function startFromOf(option: SourceOption | null, companyId: string): StartFrom {
  if (!option) return { kind: 'empty' };
  if (option.companyId === companyId) return { kind: 'template', templateId: option.templateId };
  return { kind: 'template', templateLibrary: true, templateId: option.templateId };
}

export default function NewTenantPage() {
  const router = useRouter();
  const { create: t, cancel } = useMessages(adminOfficesMessages);
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
   * **Mulai dari** (ADR-0115 §4, ADR-0168 §2, ADR-0185 §5): the one picker *Template baru* uses — the company's active
   * templates under its name, the default first and chosen; *Template bawaan AgencyBoost*; and *Kosong*. Read again
   * whenever the company changes; nothing is chosen, and the form cannot be sent, until it has been read (P13.2's exit
   * review, finding 7: choosing for the reader made an office from something they were never shown).
   */
  const sources = useTemplateSources(Boolean(form.companyId), { companyId: form.companyId, others: false, archived: false });
  const options = allSources(sources.groups);
  const [startFrom, setStartFrom] = useState('');
  useEffect(() => { setStartFrom(''); }, [form.companyId]);
  // The reader's pick; else the company's default; else — a company with no template of its own — the platform's.
  const fallback = sources.groups === null ? '' : (options[0]?.value ?? 'empty');
  const chosen = startFrom === 'empty' || options.some((o) => o.value === startFrom) ? startFrom : fallback;
  const option = options.find((o) => o.value === chosen) ?? null;
  const hint = chosen === 'empty' ? 'empty' : option && option.companyId !== form.companyId ? 'library' : 'template';
  // The insurers: the built-in templates' company holds no office (ADR-0164 §3), and the API refuses one.
  const insurers = insurersOf(companies);

  useEffect(() => {
    void listCompanies()
      .then((cos) => {
        setCompanies(cos);
        setForm((f) => (f.companyId ? f : { ...f, companyId: insurersOf(cos)[0]?._id ?? '' }));
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
        startFrom: startFromOf(option, form.companyId),
      });
      router.push(`/admin/tenants/${kpm._id}`);
    } catch (err) {
      setError(toDisplayError(err));
      setBusy(false);
    }
  }

  return (
    <Page
      title={t.title}
      subtitle={t.subtitle}
    >
      <Card className="max-w-2xl">
        {insurers.length === 0 ? (
          <div>
            <p className="text-md text-navy">{t.noCompany}</p>
            <Link href="/admin/companies" className="mt-2 inline-block text-md text-navy underline">
              {t.createCompany}
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            {error && <ErrorBanner {...error} />}

            <Field label={t.company} htmlFor="companyId">
              <Select id="companyId" required value={form.companyId} onChange={set('companyId')}>
                {insurers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex flex-col gap-1">
              <Field
                label={t.startFrom}
                htmlFor="startFrom"
                hint={sources.error ? undefined : t.hint[hint]}
                error={sources.error ? t.templatesFailed({ message: sources.error.message }) : undefined}
              >
                {/* One element throughout, so the control a reader is on is never replaced under them. */}
                <TemplateSourceSelect
                  id="startFrom"
                  groups={sources.groups ?? []}
                  value={chosen}
                  onChange={setStartFrom}
                  disabled={sources.groups === null}
                  invalid={Boolean(sources.error)}
                >
                  {sources.groups === null
                    ? <option value="">{sources.error ? t.notLoaded : t.loading}</option>
                    : <option value="empty">{t.empty}</option>}
                </TemplateSourceSelect>
              </Field>
              {/* Outside the field, which links its hint and error to one control only. */}
              {sources.error && (
                <Button variant="inline" className="self-start" onClick={sources.retry}>
                  {t.tryAgain}
                </Button>
              )}
            </div>

            <Field
              label={t.code}
              htmlFor="code"
              hint={t.codeHint}
              error={badCode ? t.codeError : undefined}
            >
              <TextInput id="code" required value={form.code} onChange={set('code')} invalid={badCode} />
            </Field>

            <Field label={t.branchName} htmlFor="branchName">
              <TextInput id="branchName" required minLength={2} value={form.branchName} onChange={set('branchName')} />
            </Field>

            <Field label={t.address} htmlFor="address" hint={t.optional}>
              <TextInput id="address" value={form.address} onChange={set('address')} />
            </Field>

            <Field label={t.contactPhone} htmlFor="contactPhone" hint={t.optional}>
              <TextInput id="contactPhone" value={form.contactPhone} onChange={set('contactPhone')} />
            </Field>

            {/* Shown, not asked for. This was a free-text box: `Asia/Jakata` was
                accepted by both halves, and every day boundary in that office then
                resolved to an Invalid DateTime for ever, with nothing raised at
                creation (ADR-0016). */}
            <ReadOnlyField
              label={t.timeZone}
              value="Asia/Jakarta"
              reason={t.timeZoneReason}
            />

            <div className="flex gap-2">
              <Button type="submit" disabled={busy || badCode || !form.code || !form.branchName || !chosen}>
                {busy ? t.creating : t.submit}
              </Button>
              <ButtonLink href="/admin/tenants" variant="secondary">
                {cancel}
              </ButtonLink>
            </div>
          </form>
        )}
      </Card>
    </Page>
  );
}
