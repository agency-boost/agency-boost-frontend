'use client';

import { useEffect, useId, useState } from 'react';
import { ActionMenu } from '@/components/ui/action-menu';
import { Dialog } from '@/components/ui/dialog';
import { Modal } from '@/components/ui/modal';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { archiveTemplate, updateTemplate, type NamedTemplate } from '@/lib/admin';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { TEMPLATE_NAME_MAX } from '@/lib/templates';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';
import { NewTemplateDialog } from './new-template-dialog';

/**
 * **A template's ⋮** (ADR-0185 §3): *Jadikan default*, *Ganti nama*, *Duplikat* and *Arsipkan*, on its checklist's head.
 *
 * *Duplikat* is *Template baru* with this template chosen to copy (ADR-0185 §5). The two questions are the product's
 * `Dialog` (F-72); *Make default* and *Archive* are held, saying why, on the default and on an archived template, as the
 * API refuses them. Every refusal is the API's, shown under the menu.
 */
export function TemplateActions({
  companyId,
  template,
  onChanged,
  onCreated,
}: {
  companyId: string;
  template: NamedTemplate;
  /** Renamed, made the default or archived: the template as the API answered. */
  onChanged: (template: NamedTemplate) => void;
  /** *Duplikat* made a copy. */
  onCreated: (template: NamedTemplate) => void;
}) {
  const words = useMessages(adminTemplateMessages);
  const t = words.menu;
  const [dialog, setDialog] = useState<null | 'rename' | 'default' | 'archive' | 'duplicate'>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const archived = template.status === 'archived';

  async function act(run: () => Promise<NamedTemplate>) {
    setDialog(null);
    setBusy(true);
    setError(null);
    try {
      onChanged(await run());
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <ActionMenu
        label={t.actionsFor({ name: template.name })}
        inert={busy}
        items={[
          {
            label: t.makeDefault,
            disabled: template.isDefault || archived,
            reason: template.isDefault ? t.isDefault : archived ? t.archivedNotDefault : undefined,
            onSelect: () => setDialog('default'),
          },
          { label: t.rename, onSelect: () => setDialog('rename') },
          { label: t.duplicate, onSelect: () => setDialog('duplicate') },
          {
            label: t.archive,
            tone: 'alert',
            disabled: template.isDefault || archived,
            reason: template.isDefault ? t.defaultNotArchived : archived ? t.isArchived : undefined,
            onSelect: () => setDialog('archive'),
          },
        ]}
      />
      {error && <div className="w-full max-w-[36rem]"><ErrorBanner {...error} /></div>}

      <RenameDialog
        open={dialog === 'rename'}
        template={template}
        onClose={() => setDialog(null)}
        onSubmit={(name) => updateTemplate(companyId, template.id, { name })}
        onSaved={(saved) => { setDialog(null); onChanged(saved); }}
      />
      <NewTemplateDialog
        open={dialog === 'duplicate'}
        companyId={companyId}
        copyOf={template}
        onClose={() => setDialog(null)}
        onCreated={(made) => { setDialog(null); onCreated(made); }}
      />
      <Dialog
        open={dialog === 'default'}
        message={t.makeDefaultQuestion({ name: template.name })}
        confirmLabel={t.makeDefault}
        cancelLabel={words.cancel}
        onCancel={() => setDialog(null)}
        onConfirm={() => void act(() => updateTemplate(companyId, template.id, { isDefault: true }))}
      />
      <Dialog
        open={dialog === 'archive'}
        message={t.archiveQuestion({ name: template.name })}
        confirmLabel={t.archiveTemplate}
        cancelLabel={words.cancel}
        tone="danger"
        onCancel={() => setDialog(null)}
        onConfirm={() => void act(() => archiveTemplate(companyId, template.id))}
      />
    </div>
  );
}

/** *Ganti nama*: the name, refused under the field when another active template of the company has it. */
function RenameDialog({
  open,
  template,
  onClose,
  onSubmit,
  onSaved,
}: {
  open: boolean;
  template: NamedTemplate;
  onClose: () => void;
  onSubmit: (name: string) => Promise<NamedTemplate>;
  onSaved: (saved: NamedTemplate) => void;
}) {
  const words = useMessages(adminTemplateMessages);
  const id = useId();
  const [name, setName] = useState(template.name);
  const [nameError, setNameError] = useState<string | undefined>();
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  // Opened again, it starts from what is saved, with no old refusal on it.
  useEffect(() => {
    if (!open) return;
    setName(template.name);
    setNameError(undefined);
    setError(null);
  }, [open, template.name]);

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
      onSaved(await onSubmit(name.trim()));
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
      title={words.menu.renameTitle}
      description={template.name}
      onClose={onClose}
      className="max-w-[30rem]"
      footer={(
        <div className="flex flex-wrap gap-2">
          <Button type="submit" form={`${id}-form`} disabled={saving}>{saving ? words.saving : words.save}</Button>
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
      </form>
    </Modal>
  );
}
