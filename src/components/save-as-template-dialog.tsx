'use client';

import { useEffect, useId, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { Button, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import {
  listCompanies, saveOfficeAsTemplate, type Company, type SavedOfficeTemplate,
} from '@/lib/admin';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { TEMPLATE_NAME_MAX } from '@/lib/templates';

/**
 * **Save as template** (ADR-0115 §5, §6; P13.2-T7 AC-7), from an office's page: what its agents read
 * becomes a new template of its own company — chosen first — or of another.
 *
 * Two fields, *Name* and *Company*. The description says what crosses and what never does, because the
 * button sits on a page about one office and a reader may fairly wonder whether its people come with it
 * (data honesty): its published settings, never unpublished edits, anything archived, or a member, log
 * or lead. No prototype draws it (`Superadmin.html` has no office page beyond *Soon*, `:187`): an
 * addition the client asked for on 2026-10-07, registered as an *Improve* row.
 *
 * Every refusal is the API's, in its words: a taken name under *Name*; a role the chosen company's ladder
 * lacks, settings that would make a broken office, or a file that never finished uploading, in the banner.
 *
 * What the office held that names something archived is not a refusal (P13.2's exit review, finding 2):
 * the API leaves it out and lists it in `dropped`, which `onSaved` hands the page to say
 * (`savedTemplateSentence`).
 */
export function SaveAsTemplateDialog({
  open,
  kpm,
  onClose,
  onSaved,
}: {
  open: boolean;
  kpm: { _id: string; code: string; companyId: string };
  onClose: () => void;
  /** The template as made — with `dropped`, what it left out — and the company it is a template of. */
  onSaved: (template: SavedOfficeTemplate, company: Company | null) => void;
}) {
  const id = useId();
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [companyId, setCompanyId] = useState(kpm.companyId);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  // Opened again, it starts over: the office's own company chosen, no name, no old refusal.
  useEffect(() => {
    if (!open) return;
    setCompanies(null);
    setCompanyId(kpm.companyId);
    setName('');
    setNameError(undefined);
    setLoadError(null);
    setError(null);
    let live = true;
    listCompanies()
      .then((rows) => {
        if (!live) return;
        // Its own company first: the usual destination, and the one the dialog opens on.
        setCompanies([...rows.filter((c) => c._id === kpm.companyId), ...rows.filter((c) => c._id !== kpm.companyId)]);
      })
      .catch((err) => { if (live) setLoadError(toDisplayError(err)); });
    return () => { live = false; };
  }, [open, kpm.companyId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setNameError(undefined);
    setError(null);
    if (!name.trim()) {
      setNameError('Give the template a name.');
      return;
    }
    setSaving(true);
    try {
      const saved = await saveOfficeAsTemplate(kpm._id, { name: name.trim(), companyId });
      onSaved(saved, companies?.find((c) => c._id === companyId) ?? null);
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

  return (
    <Modal
      open={open}
      title="Save as template"
      description={`What KPM ${kpm.code}’s agents read now becomes a new template: its published settings, never unpublished edits or anything archived. No member, log or lead is copied.`}
      onClose={onClose}
      className="max-w-[30rem]"
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {loadError && <ErrorBanner {...loadError} />}
        {error && <ErrorBanner {...error} />}
        <Field label="Name" htmlFor={`${id}-name`} error={nameError}>
          <TextInput
            id={`${id}-name`}
            value={name}
            maxLength={TEMPLATE_NAME_MAX}
            invalid={Boolean(nameError)}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        {companies === null && !loadError && <FieldSkeleton label="Loading companies…" />}
        {companies !== null && (
          <Field
            label="Company"
            htmlFor={`${id}-company`}
            hint="Into another company, every training file is copied, and every role the settings name must be on its ladder."
          >
            <Select id={`${id}-company`} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              {companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </Select>
          </Field>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving || companies === null}>
            {saving ? 'Saving…' : 'Save template'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        </div>
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
