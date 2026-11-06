'use client';

import { useEffect, useRef, useState } from 'react';
import { ALLOWED, FILE_ACCEPT, MAX_BYTES, sentTypeOf } from '@/components/module-content';
import { useSandboxedDocument } from '@/components/sandboxed-document';
import { Modal } from '@/components/ui/modal';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import {
  confirmTemplateMaterialUpload, requestTemplateMaterialUpload, saveTemplateModuleMaterial, templateMaterialFileUrl,
  type CompanyTemplate, type TemplateMaterial, type TemplateMaterialFile,
} from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { isHtmlDocument } from '@/lib/html-document';
import { formatFileSize } from '@/lib/recruitment-pitch';
import { signedUploadForm } from '@/lib/tenant-config';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';
import { trainingSettingsMessages } from '@/i18n/messages/training-settings';

/** A module's material as a template payload holds it: any of the three lists may be absent. */
export type PayloadMaterial = Partial<TemplateMaterial> | undefined;

/** The three lists, always present, copied so the dialog's edits are its own until saved. */
export const materialOf = (raw: PayloadMaterial): TemplateMaterial => ({
  files: (raw?.files ?? []).map((f) => ({ ...f })),
  videos: (raw?.videos ?? []).map((f) => ({ ...f })),
  links: (raw?.links ?? []).map((l) => ({ ...l })),
});

/** How many items a module's material holds: a module **has material** with one or more (ADR-0208 §1). */
export const materialCount = (raw: PayloadMaterial) =>
  (raw?.files?.length ?? 0) + (raw?.videos?.length ?? 0) + (raw?.links?.length ?? 0);

/** An address's start, shown as the field's example: the same in both languages, never words. */
const ADDRESS_EXAMPLE = 'https://';

/** A refusal made here, before anything was sent: shaped like the server's, with no request to name. */
const refusal = (code: string, message: string): ApiError => ({ code, message, requestId: '' });

/**
 * **One module's material in the template's *Training* section** (ADR-0208 §1; the 11-03 handover's §B6 *Expected 1*):
 * *File* (`.pdf .png .jpg .jpeg .webp .csv .xlsx`, and since P19.6-T2 an HTML lesson, `.html .htm`; up to 25 MB),
 * *Video* (`.mp4`) and *Tautan* (`https://…`), as an
 * office's module holds them — the KPM's own editor's lists and words (`ModuleContentEditor`), in a dialog opened from
 * the module's row (ADR-0062: a dialog from a control that already exists).
 *
 * The bytes go to storage when a file is chosen, signed and confirmed against storage (ADR-0040), as the company's file.
 * **Save** writes the module's whole material into the section's draft, pinned to the revision the editor holds; the
 * answer is the draft as it now stands, which the section takes (`onSaved`). It goes live with *Terbitkan*.
 *
 * **An HTML lesson has *Buka***, the KPM editor's word, which opens it in the sandboxed window — the Super Admin's preview
 * of what an agent will see (P19.6-T2, ADR-0217 §4). Nothing else in the list opens: no other type is previewed here.
 */
export function TemplateModuleMaterialDialog({
  open,
  companyId,
  templateId,
  module,
  revision,
  beforeSave,
  onSaved,
  onClose,
}: {
  open: boolean;
  companyId: string;
  templateId: string;
  module: { code: string; title: string; content?: PayloadMaterial } | null;
  /** The `revision` of the section's draft the editor holds. */
  revision: number;
  /** Saves whatever the section's editor still holds, so the material is pinned past it. `false`: it was refused. */
  beforeSave: () => Promise<boolean>;
  onSaved: (view: CompanyTemplate) => void;
  onClose: () => void;
}) {
  const words = useMessages(adminTemplateMessages).material;
  const c = useMessages(trainingSettingsMessages).content;
  const figures = useFigureLanguage();
  const [draft, setDraft] = useState<TemplateMaterial>(materialOf(undefined));
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [link, setLink] = useState({ label: '', url: '' });
  const fileInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const lesson = useSandboxedDocument();

  useEffect(() => {
    if (!open) return;
    setDraft(materialOf(module?.content));
    setError(null);
    setLink({ label: '', url: '' });
  }, [open, module]);

  if (!module) return null;

  const choose = async (section: 'files' | 'videos', file: File | undefined) => {
    if (!file) return;
    setError(null);
    // Refused here before the upload starts: rejecting a 40 MB file after it was sent spends somebody's data to say no.
    if (file.size > MAX_BYTES) {
      setError(refusal('ASSET_TOO_LARGE', c.tooLarge({ name: file.name, size: formatFileSize(file.size, figures) })));
      return;
    }
    const mimeType = sentTypeOf(file);
    if (!ALLOWED.includes(mimeType) || (section === 'videos' && mimeType !== 'video/mp4')) {
      setError(refusal('ASSET_TYPE_NOT_ALLOWED', c.notAccepted({ name: file.name })));
      return;
    }
    setUploading(file.name);
    try {
      const signed = await requestTemplateMaterialUpload(companyId, templateId, {
        filename: file.name, mimeType, bytes: file.size,
      });
      const sent = await fetch(signed.uploadUrl, { method: 'POST', body: signedUploadForm(signed, file) });
      if (!sent.ok) throw new Error('upload failed');
      const confirmed = await confirmTemplateMaterialUpload(companyId, templateId, signed.storageKey);
      const item: TemplateMaterialFile = { id: '', label: file.name, ...confirmed };
      setDraft((now) => ({ ...now, [section]: [...now[section], item] }));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setUploading(null);
      if (fileInput.current) fileInput.current.value = '';
      if (videoInput.current) videoInput.current.value = '';
    }
  };

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (!(await beforeSave())) return;
      onSaved(await saveTemplateModuleMaterial(companyId, templateId, module!.code, draft, revision));
      onClose();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  const remove = (section: keyof TemplateMaterial, index: number) =>
    setDraft((now) => ({ ...now, [section]: (now[section] as unknown[]).filter((_, i) => i !== index) }));

  const fileList = (section: 'files' | 'videos', heading: string, hint: string, accept: string, input: typeof fileInput) => (
    <section className="mt-4">
      <h3 className="font-display text-md font-bold text-navy">{heading}</h3>
      <p className="text-sm text-muted">{hint}</p>
      {draft[section].length === 0 ? <p className="mt-1 text-md text-muted">{c.nothingHere}</p> : (
        <ul className="mt-1 divide-y divide-divider">
          {draft[section].map((item, index) => (
            <li key={item.storageKey} className="flex flex-wrap items-center gap-3 py-2">
              <span className="min-w-0 flex-1 text-md text-navy">{item.label}</span>
              <span className="text-sm text-muted">{formatFileSize(item.bytes, figures)}</span>
              {isHtmlDocument(item.mimeType) && (
                <Button
                  variant="inline"
                  onClick={() => {
                    void lesson.open(item.label, async () => (await templateMaterialFileUrl(companyId, templateId, item.storageKey)).url)
                      .catch((err: unknown) => setError(toDisplayError(err)));
                  }}
                >
                  {c.open}
                </Button>
              )}
              <Button variant="inlineDanger" disabled={busy} onClick={() => remove(section, index)}>{words.remove}</Button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={input}
        type="file"
        accept={accept}
        aria-label={c.addTo({ heading })}
        className="mt-2 max-lg:min-h-11"
        disabled={busy || uploading !== null}
        onChange={(e) => void choose(section, e.target.files?.[0])}
      />
    </section>
  );

  return (
    <Modal
      open={open}
      title={words.title({ title: module.title })}
      description={words.lead}
      onClose={onClose}
      className="max-w-[36rem]"
      footer={(
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void save()} disabled={busy || uploading !== null}>{busy ? words.saving : words.save}</Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>{words.cancel}</Button>
        </div>
      )}
    >
      {error && <ErrorBanner {...error} />}
      {uploading && <p role="status" className="text-md text-muted">{c.uploading({ name: uploading })}</p>}
      {fileList('files', c.files, c.filesHint, FILE_ACCEPT, fileInput)}
      {fileList('videos', c.videos, c.videosHint, '.mp4', videoInput)}

      <section className="mt-4">
        <h3 className="font-display text-md font-bold text-navy">{c.links}</h3>
        {draft.links.length === 0 ? <p className="mt-1 text-md text-muted">{c.nothingHere}</p> : (
          <ul className="mt-1 divide-y divide-divider">
            {draft.links.map((item, index) => (
              <li key={`${item.url}-${index}`} className="flex flex-wrap items-center gap-3 py-2">
                <span className="min-w-0 flex-1 text-md text-navy">{item.label}</span>
                <span className="break-all text-sm text-muted">{item.url}</span>
                <Button variant="inlineDanger" disabled={busy} onClick={() => remove('links', index)}>{words.remove}</Button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap items-start gap-3">
          <Field label={c.linkName} htmlFor="template-material-link-label" className="min-w-40 flex-1">
            <TextInput
              id="template-material-link-label"
              value={link.label}
              disabled={busy}
              onChange={(e) => setLink((now) => ({ ...now, label: e.target.value }))}
            />
          </Field>
          <Field label={c.address} htmlFor="template-material-link-url" hint={c.addressHint} className="min-w-48 flex-1">
            <TextInput
              id="template-material-link-url"
              value={link.url}
              disabled={busy}
              placeholder={ADDRESS_EXAMPLE}
              onChange={(e) => setLink((now) => ({ ...now, url: e.target.value }))}
            />
          </Field>
          <Button
            variant="secondary"
            disabled={busy || !link.label.trim() || !link.url.trim()}
            onClick={() => {
              setDraft((now) => ({ ...now, links: [...now.links, { id: '', label: link.label.trim(), url: link.url.trim() }] }));
              setLink({ label: '', url: '' });
            }}
          >
            {c.addLink}
          </Button>
        </div>
      </section>
      {lesson.dialog}
    </Modal>
  );
}
