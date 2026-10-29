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
  createTenant, insurersOf, isTemplateLibrary, listCompanies, listTemplates,
  type Company, type NamedTemplate, type StartFrom,
} from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';

const CODE = /^[A-Za-z0-9-]{2,16}$/;

/**
 * `template:<id>`, `library:<id>` or `empty`: one select's value for the three kinds of source. `library:` is
 * the Template library's template (ADR-0164 §5), copied across companies. *AgencyBoost defaults* is not one:
 * the Template's Default template holds them, and the API refuses the source (ADR-0168 §2).
 */
function startFromOf(value: string): StartFrom {
  if (value === 'empty') return { kind: 'empty' };
  if (value.startsWith('library:')) {
    return { kind: 'template', templateLibrary: true, templateId: value.slice('library:'.length) };
  }
  return { kind: 'template', templateId: value.slice('template:'.length) };
}

/** The hint under *Start from* for one select value: what each choice gives the office (the catalogue's words). */
function hintOf(value: string): 'template' | 'library' | 'empty' {
  if (value.startsWith('template:') || !value) return 'template';
  if (value.startsWith('library:')) return 'library';
  return 'empty';
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
   * **Start from** (ADR-0115 §4, ADR-0168 §2): the company's active templates, the default first and chosen,
   * then *Template · Default template* and *Empty*. Read again whenever the company changes; `null` while it is.
   * `startFrom` is the reader's choice, or the company's default once its templates arrive; `chosen`, below, is
   * what the form sends.
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
  /**
   * **The Template library's default template** (ADR-0164 §5), offered after the company's own as *Template ·
   * Default template*. Read once; where it cannot be read, or there is no library, it is simply not offered —
   * the company's own templates stay the choice, and nothing is chosen for the reader that they were not shown.
   * `undefined` until the read has answered, `null` for none.
   */
  const [libraryTemplate, setLibraryTemplate] = useState<NamedTemplate | null | undefined>(undefined);
  const library = companies.find(isTemplateLibrary) ?? null;
  // The insurers: the Template library holds no office (ADR-0164 §3), and the API refuses one.
  const insurers = insurersOf(companies);

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
        setStartFrom(offered[0] ? `template:${offered[0].id}` : '');
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
        setForm((f) => (f.companyId ? f : { ...f, companyId: insurersOf(cos)[0]?._id ?? '' }));
      })
      .catch(() => setCompanies([]));
  }, []);

  const libraryId = library?._id ?? null;
  useEffect(() => {
    if (!libraryId) return;
    let current = true;
    void listTemplates(libraryId)
      .then((rows) => {
        if (current) setLibraryTemplate(rows.find((t) => t.isDefault && t.status === 'active') ?? null);
      })
      .catch(() => {
        if (current) setLibraryTemplate(null);
      });
    return () => { current = false; };
  }, [libraryId]);

  /**
   * **What is chosen** (ADR-0168 §2): the reader's pick, or the company's default template. A company with no
   * active template of its own — the only case the AgencyBoost defaults were chosen for before — gets the
   * Template's Default template, which holds them, once its read has answered; with no Template library to
   * offer, *Empty*. Nothing while either read is outstanding, so the form waits rather than guessing.
   */
  const libraryRead = !libraryId || libraryTemplate !== undefined;
  const fallback = templates?.length === 0 && libraryRead
    ? (libraryTemplate ? `library:${libraryTemplate.id}` : 'empty')
    : '';
  const chosen = startFrom || fallback;

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
        startFrom: startFromOf(chosen),
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
                hint={templatesError ? undefined : t.hint[hintOf(chosen)]}
                error={templatesError ? t.templatesFailed({ message: templatesError.message }) : undefined}
              >
                <Select
                  id="startFrom"
                  value={chosen}
                  disabled={templates === null}
                  invalid={Boolean(templatesError)}
                  onChange={(e) => setStartFrom(e.target.value)}
                >
                  {!chosen && <option value="">{templatesError ? t.notLoaded : t.loading}</option>}
                  {templates?.map((template) => (
                    <option key={template.id} value={`template:${template.id}`}>
                      {template.isDefault ? t.defaultTemplate({ name: template.name }) : template.name}
                    </option>
                  ))}
                  {templates !== null && library && libraryTemplate && (
                    <option value={`library:${libraryTemplate.id}`}>
                      {`${library.name} · ${libraryTemplate.name}`}
                    </option>
                  )}
                  {templates !== null && <option value="empty">{t.empty}</option>}
                </Select>
              </Field>
              {/* Outside the field, which links its hint and error to one control only. */}
              {templatesError && (
                <Button variant="inline" className="self-start" onClick={() => setAttempt((n) => n + 1)}>
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
