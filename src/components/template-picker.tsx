'use client';

import dynamic from 'next/dynamic';
import { useEffect, useId, useState } from 'react';
import { ActionMenu } from '@/components/ui/action-menu';
import { Dialog } from '@/components/ui/dialog';
import { Modal } from '@/components/ui/modal';
import { Button, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import {
  archiveTemplate, createTemplate, updateTemplate, type NamedTemplate,
} from '@/lib/admin';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { TEMPLATE_NAME_MAX } from '@/lib/templates';
import { useOpenedOnce } from '@/lib/use-opened-once';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';

/** *Import*'s dialog, downloaded when it is first opened and mounted from then on (`useOpenedOnce`; P18.99-T16). */
const ImportTemplateDialog = dynamic(
  () => import('@/components/import-template-dialog').then((m) => m.ImportTemplateDialog),
  { ssr: false },
);

/** How a new template starts (ADR-0115 §5): empty, the AgencyBoost defaults, or a copy of the one shown. */
type NewFrom = 'empty' | 'defaults' | 'copy';

/**
 * **The company's templates, at the head of its template screen** (ADR-0115 §3, §7; P13.2-T6 AC-6).
 *
 * A picker of the company's templates — the active ones, the default marked, then the archived ones,
 * still readable because offices record that they started from them — the offices the one shown
 * answers for, **New template** (empty, the AgencyBoost defaults, or *Copy of* the template shown —
 * P13.2-T7), **Import from another company** (P13.2-T7), and *Rename*, *Make default* and *Archive* for
 * the template shown.
 *
 * `Superadmin.html` draws no template screen (*KPM template* is a *Soon* item, `:179`), so every control
 * here is an addition the client asked for on 2026-10-07 (parity row, *Improve*). The two forms are the
 * product's titled `Modal`; the two questions are its `Dialog` (F-72). Every refusal is the API's,
 * shown where it arose: a taken name under the name, the default's under the menu.
 */
export function TemplatePicker({
  companyId,
  templates,
  selectedId,
  onSelect,
  onChanged,
  disabled = false,
}: {
  companyId: string;
  templates: NamedTemplate[];
  selectedId: string;
  /** The reader picked another template. The page decides whether unsaved edits allow it. */
  onSelect: (templateId: string) => void;
  /** A template was made, renamed, made the default or archived: here is it, as the API answered. */
  onChanged: (template: NamedTemplate, select: boolean) => void;
  disabled?: boolean;
}) {
  const words = useMessages(adminTemplateMessages);
  const t = words.picker;
  const id = useId();
  const selected = templates.find((row) => row.id === selectedId) ?? templates[0];
  const active = templates.filter((row) => row.status === 'active');
  const archived = templates.filter((row) => row.status === 'archived');

  const [dialog, setDialog] = useState<null | 'new' | 'import' | 'rename' | 'default' | 'archive'>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const importOpened = useOpenedOnce(dialog === 'import');

  async function act(run: () => Promise<NamedTemplate>, select: boolean) {
    setBusy(true);
    setError(null);
    try {
      const saved = await run();
      setDialog(null);
      onChanged(saved, select);
    } catch (err) {
      setDialog(null);
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!selected) return null;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t.template} htmlFor={`${id}-pick`} className="min-w-[14rem]">
          <Select
            id={`${id}-pick`}
            value={selected.id}
            disabled={disabled}
            onChange={(e) => onSelect(e.target.value)}
          >
            {active.map((row) => (
              <option key={row.id} value={row.id}>{row.isDefault ? t.withDefault({ name: row.name }) : row.name}</option>
            ))}
            {archived.length > 0 && (
              <optgroup label={t.archived}>
                {archived.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </optgroup>
            )}
          </Select>
        </Field>
        <p className="pb-2.5 text-sm text-muted" aria-live="polite">
          {t.offices({ n: selected.officeCount, archived: selected.status === 'archived' })}
        </p>
        <Button variant="secondary" disabled={disabled || busy} onClick={() => setDialog('new')}>
          {t.newTemplate}
        </Button>
        <Button variant="secondary" disabled={disabled || busy} onClick={() => setDialog('import')}>
          {t.importTemplate}
        </Button>
        <ActionMenu
          label={t.actionsFor({ name: selected.name })}
          inert={disabled || busy}
          items={[
            { label: t.rename, onSelect: () => setDialog('rename') },
            {
              label: t.makeDefault,
              disabled: selected.isDefault || selected.status === 'archived',
              reason: selected.isDefault
                ? t.isDefault
                : selected.status === 'archived' ? t.archivedNotDefault : undefined,
              onSelect: () => setDialog('default'),
            },
            {
              label: t.archive,
              tone: 'alert',
              disabled: selected.isDefault || selected.status === 'archived',
              reason: selected.isDefault
                ? t.defaultNotArchived
                : selected.status === 'archived' ? t.isArchived : undefined,
              onSelect: () => setDialog('archive'),
            },
          ]}
        />
      </div>
      {error && <div className="w-full max-w-[36rem]"><ErrorBanner {...error} /></div>}

      <NameDialog
        open={dialog === 'new'}
        title={t.newTitle}
        description={t.newLead}
        confirmLabel={t.create}
        withStart
        copyOf={selected.name}
        busy={busy}
        onClose={() => setDialog(null)}
        onSubmit={(name, from) => createTemplate(companyId, {
          name,
          // *Copy of* copies the template shown, as Rename, Make default and Archive act on it.
          from: from === 'copy' ? { templateId: selected.id } : from!,
        })}
        onSaved={(saved) => { setDialog(null); onChanged(saved, true); }}
      />
      {importOpened && (
        <ImportTemplateDialog
          open={dialog === 'import'}
          companyId={companyId}
          onClose={() => setDialog(null)}
          onImported={(saved) => { setDialog(null); onChanged(saved, true); }}
        />
      )}
      <NameDialog
        open={dialog === 'rename'}
        title={t.renameTitle}
        description={selected.name}
        confirmLabel={words.save}
        initialName={selected.name}
        busy={busy}
        onClose={() => setDialog(null)}
        onSubmit={(name) => updateTemplate(companyId, selected.id, { name })}
        onSaved={(saved) => { setDialog(null); onChanged(saved, true); }}
      />
      <Dialog
        open={dialog === 'default'}
        message={t.makeDefaultQuestion({ name: selected.name })}
        confirmLabel={t.makeDefault}
        cancelLabel={words.cancel}
        onCancel={() => setDialog(null)}
        onConfirm={() => void act(() => updateTemplate(companyId, selected.id, { isDefault: true }), true)}
      />
      <Dialog
        open={dialog === 'archive'}
        message={t.archiveQuestion({ name: selected.name })}
        confirmLabel={t.archiveTemplate}
        cancelLabel={words.cancel}
        tone="danger"
        onCancel={() => setDialog(null)}
        onConfirm={() => void act(() => archiveTemplate(companyId, selected.id), true)}
      />
    </div>
  );
}

/** *New template* and *Rename*: a name, and for a new one where it starts. */
function NameDialog({
  open,
  title,
  description,
  confirmLabel,
  initialName = '',
  withStart = false,
  copyOf,
  busy,
  onClose,
  onSubmit,
  onSaved,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  initialName?: string;
  withStart?: boolean;
  /** The template shown, which *Copy of* copies. */
  copyOf?: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (name: string, from?: NewFrom) => Promise<NamedTemplate>;
  onSaved: (saved: NamedTemplate) => void;
}) {
  const words = useMessages(adminTemplateMessages);
  const t = words.picker;
  const id = useId();
  const [name, setName] = useState(initialName);
  const [from, setFrom] = useState<NewFrom>('empty');
  const [nameError, setNameError] = useState<string | undefined>();
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  // Opened again, it starts from what is saved, with no old refusal on it.
  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setFrom('empty');
    setNameError(undefined);
    setError(null);
  }, [open, initialName]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setNameError(undefined);
    setError(null);
    if (!name.trim()) {
      setNameError(words.nameMissing);
      return;
    }
    setSaving(true);
    try {
      onSaved(await onSubmit(name.trim(), withStart ? from : undefined));
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
      title={title}
      description={description}
      onClose={onClose}
      className="max-w-[30rem]"
      footer={(
        <div className="flex flex-wrap gap-2">
          <Button type="submit" form={`${id}-form`} disabled={busy || saving}>{saving ? words.saving : confirmLabel}</Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>{words.cancel}</Button>
        </div>
      )}
    >
      <form id={`${id}-form`} onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error && <ErrorBanner {...error} />}
        <Field label={words.name} htmlFor={`${id}-name`} error={nameError}>
          <TextInput
            id={`${id}-name`}
            value={name}
            maxLength={TEMPLATE_NAME_MAX}
            invalid={Boolean(nameError)}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        {withStart && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-navy">{t.startWith}</legend>
            {([
              ['empty', t.empty, t.emptyHint],
              ['defaults', t.defaults, t.defaultsHint],
              ...(copyOf ? [['copy', t.copyOf({ name: copyOf }), t.copyHint] as const] : []),
            ] as const).map(([value, label, hint]) => (
              <label key={value} className="flex items-start gap-2 text-md text-navy">
                <input
                  type="radio"
                  name={`${id}-from`}
                  value={value}
                  checked={from === value}
                  onChange={() => setFrom(value)}
                  className="mt-1 accent-navy"
                  aria-describedby={`${id}-${value}-hint`}
                />
                <span>
                  {label}
                  <span id={`${id}-${value}-hint`} className="block text-sm text-muted">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
      </form>
    </Modal>
  );
}
