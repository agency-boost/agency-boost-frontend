'use client';

import { useEffect, useId, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { Button, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import {
  importTemplate, listCompanies, listTemplates, type Company, type NamedTemplate,
} from '@/lib/admin';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { TEMPLATE_NAME_MAX } from '@/lib/templates';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';

/**
 * **Import from another company** (ADR-0115 §5, §6; P13.2-T7 AC-7): one of another company's templates
 * becomes a new template of this one — a copy, never a link.
 *
 * Three fields, in the order they depend on each other: the company, one of **its** active templates
 * (read when the company is chosen, its default first and chosen), and the new template's name — the
 * source's, until the reader types their own. No prototype draws it (`Superadmin.html` has no template
 * screen, *KPM template* is *Soon*, `:179`): an addition the client asked for on 2026-10-07, registered
 * as an *Improve* row.
 *
 * Every refusal is the API's, in its words: a taken name under *Name*; a role this company's ladder lacks,
 * or a file that never finished uploading, in the banner, where the dialog stays open so another source
 * can be chosen — and choosing another company clears it, with any failure to read the last one's
 * templates (P13.2's exit review). A company with no active template says so, in a sentence.
 */
export function ImportTemplateDialog({
  open,
  companyId,
  onClose,
  onImported,
}: {
  open: boolean;
  /** The company importing — never offered as its own source. */
  companyId: string;
  onClose: () => void;
  onImported: (template: NamedTemplate) => void;
}) {
  const t = useMessages(adminTemplateMessages);
  const id = useId();
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [fromCompanyId, setFromCompanyId] = useState('');
  const [templates, setTemplates] = useState<NamedTemplate[] | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [name, setName] = useState('');
  const [named, setNamed] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  /** A failed read of the chosen company's templates — that company's, so cleared when another is chosen. */
  const [templatesError, setTemplatesError] = useState<ApiError | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  // Opened again, it starts over: the companies read afresh, nothing chosen, no old refusal.
  useEffect(() => {
    if (!open) return;
    setCompanies(null);
    setFromCompanyId('');
    setTemplates(null);
    setTemplateId('');
    setName('');
    setNamed(false);
    setNameError(undefined);
    setLoadError(null);
    setTemplatesError(null);
    setError(null);
    let live = true;
    listCompanies()
      .then((rows) => { if (live) setCompanies(rows.filter((c) => c._id !== companyId)); })
      .catch((err) => { if (live) setLoadError(toDisplayError(err)); });
    return () => { live = false; };
  }, [open, companyId]);

  // The chosen company's templates: the active ones, its default first and chosen. What was said about
  // the company chosen before — its templates unread, or its template refused — is not said of this one.
  useEffect(() => {
    if (!fromCompanyId) return;
    setTemplates(null);
    setTemplateId('');
    setTemplatesError(null);
    setError(null);
    let live = true;
    listTemplates(fromCompanyId)
      .then((rows) => {
        if (!live) return;
        const offered = rows.filter((t) => t.status === 'active');
        setTemplates(offered);
        setTemplateId((offered.find((t) => t.isDefault) ?? offered[0])?.id ?? '');
      })
      .catch((err) => { if (live) setTemplatesError(toDisplayError(err)); });
    return () => { live = false; };
  }, [fromCompanyId]);

  // The name follows the source chosen until the reader writes one of their own.
  const source = templates?.find((t) => t.id === templateId);
  useEffect(() => {
    if (!named) setName(source?.name ?? '');
  }, [source, named]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setNameError(undefined);
    setError(null);
    // The button waits for a template; a submit by Enter before one is chosen does nothing.
    if (!fromCompanyId || !templateId) return;
    if (!name.trim()) {
      setNameError(t.nameMissing);
      return;
    }
    setSaving(true);
    try {
      onImported(await importTemplate(companyId, { fromCompanyId, templateId, name: name.trim() }));
    } catch (err) {
      if (err instanceof ApiRequestError && err.error.code === 'TEMPLATE_NAME_TAKEN') {
        setNameError(err.error.message);
      } else {
        setError(toDisplayError(err));
      }
    } finally {
      setSaving(false);
    }
  }

  const none = companies !== null && companies.length === 0;
  const fromName = companies?.find((c) => c._id === fromCompanyId)?.name;

  return (
    <Modal
      open={open}
      title={t.importing.title}
      description={t.importing.lead}
      onClose={onClose}
      className="max-w-[30rem]"
      footer={(
        <div className="flex flex-wrap gap-2">
          {!none && (
            <Button type="submit" form={`${id}-form`} disabled={saving || !templateId}>
              {saving ? t.importing.importing : t.importing.submit}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t.cancel}</Button>
        </div>
      )}
    >
      <form id={`${id}-form`} onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {loadError && <ErrorBanner {...loadError} />}
        {templatesError && <ErrorBanner {...templatesError} />}
        {error && <ErrorBanner {...error} />}
        {companies === null && !loadError && <FieldSkeleton label={t.loadingCompanies} />}
        {none && <p className="text-md text-muted">{t.importing.noOtherCompany}</p>}
        {companies !== null && !none && (
          <>
            <Field label={t.company} htmlFor={`${id}-company`}>
              <Select
                id={`${id}-company`}
                value={fromCompanyId}
                onChange={(e) => setFromCompanyId(e.target.value)}
              >
                <option value="" disabled>{t.importing.chooseCompany}</option>
                {companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </Select>
            </Field>
            {fromCompanyId && templates === null && !templatesError && (
              <FieldSkeleton label={t.importing.loadingTemplates} />
            )}
            {/* The empty state, said rather than drawn as a select with nothing in it (L-01). */}
            {templates !== null && templates.length === 0 && (
              <p className="text-md text-muted">{t.importing.noActive({ company: fromName ?? null })}</p>
            )}
            {templates !== null && templates.length > 0 && (
              <Field label={t.importing.template} htmlFor={`${id}-template`}>
                <Select id={`${id}-template`} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  {templates.map((row) => (
                    <option key={row.id} value={row.id}>{row.isDefault ? t.picker.withDefault({ name: row.name }) : row.name}</option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label={t.name} htmlFor={`${id}-name`} error={nameError}>
              <TextInput
                id={`${id}-name`}
                value={name}
                maxLength={TEMPLATE_NAME_MAX}
                invalid={Boolean(nameError)}
                onChange={(e) => { setNamed(true); setName(e.target.value); }}
              />
            </Field>
          </>
        )}
      </form>
    </Modal>
  );
}

/** A field on its way: its label and its control as bars, the wait named once for a screen reader. */
function FieldSkeleton({ label }: { label: string }) {
  return (
    <Skeleton label={label}>
      <SkeletonBar className="w-20" />
      <SkeletonBar className="mt-2 h-10 w-full" />
    </Skeleton>
  );
}
