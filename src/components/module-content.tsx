'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfigBadge } from '@/components/ui/config-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, Field, TextInput } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { settingsMessages } from '@/i18n/messages/settings';
import { trainingSettingsMessages } from '@/i18n/messages/training-settings';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatFileSize } from '@/lib/recruitment-pitch';
import {
  confirmTrainingUpload, moduleContentUrl, readModuleContent, requestTrainingUpload,
  resetModuleContent, saveModuleContent, signedUploadForm,
  type ContentFile, type ContentLink, type ModuleContent, type ModuleContentView,
} from '@/lib/tenant-config';

/** What the API accepts, mirrored so a file is refused here before it costs anybody's data. */
const ALLOWED = [
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
  'video/mp4',
  'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const MAX_BYTES = 25 * 1024 * 1024;

/** An address's start, shown as the field's example: the same in both languages, never words. */
const ADDRESS_EXAMPLE = 'https://';

/** A working copy that has not been saved is the office's, not the server's. */
const copy = (content: ModuleContent): ModuleContent => ({
  files: content.files.map((f) => ({ ...f })),
  videos: content.videos.map((f) => ({ ...f })),
  links: content.links.map((l) => ({ ...l })),
});

const sameAs = (a: ModuleContent, b: ModuleContent) => JSON.stringify(a) === JSON.stringify(b);

/**
 * A refusal this screen made, shaped like one the server makes.
 *
 * `requestId` is empty because there was no request: the file was refused before it cost anybody
 * their data allowance, and inventing an id would send somebody looking through logs for a call
 * that never happened.
 */
const refusal = (code: string, message: string): ApiError => ({ code, message, requestId: '' });

/**
 * A training module's Files, Videos and Links (P5-T2, `KPM_Owner.html:1618-1630`).
 *
 * **Every edit is held until Save** (AC-6). The prototype attaches a file the moment it is chosen
 * and saves the title only on Save, so closing the modal keeps one edit and discards the other —
 * two different answers to *"did that count?"* on one screen. Here Save means all of it and Cancel
 * means none of it.
 *
 * The upload is the exception it has to be: the bytes go to storage when the file is chosen,
 * because they cannot be held in a form. A file uploaded and then not saved is referenced by
 * nothing and the orphan sweep reports it — which is what that sweep is for.
 *
 * **The office starts on its company's material** and replaces it for itself (ADR-0032). The
 * company's row is never touched, no other office changes, and *Use the company's material again*
 * puts it back.
 */
export function ModuleContentEditor({
  moduleCode,
  canWrite,
}: {
  moduleCode: string;
  canWrite: boolean;
}) {
  const words = useMessages(trainingSettingsMessages);
  const t = words.content;
  const s = useMessages(settingsMessages);
  // A file's size is a figure, in the reader's figures (P18.98-T3).
  const figures = useFigureLanguage();
  const sizeOf = (bytes: number) => formatFileSize(bytes, figures);
  const [server, setServer] = useState<ModuleContentView | null>(null);
  const [draft, setDraft] = useState<ModuleContent | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [link, setLink] = useState({ label: '', url: '' });
  const fileInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const view = await readModuleContent(moduleCode);
      setServer(view);
      setDraft(copy(view.content));
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [moduleCode]);

  useEffect(() => { void load(); }, [load]);

  if (error && server === null) {
    return (
      <EmptyState
        title={t.readFailed({ why: error.message })}
        action={<Button onClick={() => void load()}>{t.tryAgain}</Button>}
      />
    );
  }
  if (server === null || draft === null) return <SkeletonCards count={2} />;

  const dirty = !sameAs(draft, server.content);

  const run = async (action: () => Promise<ModuleContentView>) => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const view = await action();
      setServer(view);
      setDraft(copy(view.content));
      setSaved(true);
      return true;
    } catch (err) {
      setError(toDisplayError(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  /**
   * Choose a file: check it here, upload it to storage, confirm it, then hold it in the draft.
   *
   * Refused here *before* the upload starts, because rejecting a 40 MB file after it has been
   * sent spends somebody's data allowance to say no. The server checks again — and checks what
   * really landed rather than what this browser claimed.
   */
  const choose = async (section: 'files' | 'videos', file: File | undefined) => {
    if (!file) return;
    setError(null);
    setSaved(false);

    if (file.size > MAX_BYTES) {
      setError(refusal('ASSET_TOO_LARGE', t.tooLarge({ name: file.name, size: sizeOf(file.size) })));
      return;
    }
    if (!ALLOWED.includes(file.type)) {
      setError(refusal('ASSET_TYPE_NOT_ALLOWED', t.notAccepted({ name: file.name })));
      return;
    }

    setUploading(file.name);
    try {
      const signed = await requestTrainingUpload({
        filename: file.name, mimeType: file.type, bytes: file.size,
      });
      const sent = await fetch(signed.uploadUrl, { method: 'POST', body: signedUploadForm(signed, file) });
      if (!sent.ok) throw new Error('upload failed');

      const confirmed = await confirmTrainingUpload(signed.storageKey);
      const item: ContentFile = {
        id: '',
        label: file.name,
        storageKey: confirmed.storageKey,
        mimeType: confirmed.mimeType,
        bytes: confirmed.bytes,
      };
      setDraft((now) => (now ? { ...now, [section]: [...now[section], item] } : now));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setUploading(null);
      if (fileInput.current) fileInput.current.value = '';
      if (videoInput.current) videoInput.current.value = '';
    }
  };

  const open = async (storageKey: string) => {
    try {
      const { url } = await moduleContentUrl(moduleCode, storageKey);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(toDisplayError(err));
    }
  };

  const rename = (section: 'files' | 'videos' | 'links', id: string, label: string) =>
    setDraft((now) => (now ? {
      ...now,
      [section]: (now[section] as (ContentFile | ContentLink)[])
        .map((i) => (i.id === id ? { ...i, label } : i)),
    } : now));

  const remove = (section: 'files' | 'videos' | 'links', index: number) =>
    setDraft((now) => (now ? {
      ...now,
      [section]: (now[section] as unknown[]).filter((_, i) => i !== index),
    } : now));

  const fileSection = (
    section: 'files' | 'videos',
    heading: string,
    hint: string,
    input: React.RefObject<HTMLInputElement | null>,
    accept: string,
  ) => (
    <Card className="p-0">
      <div className="flex flex-wrap items-baseline gap-2 border-b border-hairline px-4 py-3 sm:px-5">
        <h2 className="font-display text-lg font-bold text-navy">{heading}</h2>
        <span className="ml-auto">
          <ConfigBadge tone={draft[section].length > 0 ? 'won' : 'open'}>
            {s.items({ n: draft[section].length })}
          </ConfigBadge>
        </span>
      </div>
      <p className="px-4 pt-3 text-sm text-muted sm:px-5">{hint}</p>

      {draft[section].length === 0 ? (
        <p className="px-4 py-3 text-md text-muted sm:px-5">{t.nothingHere}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-hairline">
          {draft[section].map((item, index) => (
            <li key={item.storageKey} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <Field
                label={s.name}
                htmlFor={`${section}-${item.storageKey}`}
                className="min-w-60 flex-1"
              >
                <TextInput
                  id={`${section}-${item.storageKey}`}
                  value={item.label}
                  disabled={!canWrite || busy}
                  onChange={(e) => rename(section, item.id, e.target.value)}
                />
              </Field>
              <p className="text-sm text-muted">{sizeOf(item.bytes)}</p>
              <Button variant="inline" onClick={() => void open(item.storageKey)}>{t.open}</Button>
              {canWrite && (
                <Button variant="inlineDanger" disabled={busy} onClick={() => remove(section, index)}>
                  {s.remove}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <div className="px-4 pb-4 pt-2 sm:px-5">
          <input
            ref={input}
            type="file"
            accept={accept}
            aria-label={t.addTo({ heading })}
            disabled={busy || uploading !== null}
            onChange={(e) => void choose(section, e.target.files?.[0])}
          />
        </div>
      )}
    </Card>
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        {server.overridden ? (
          <>
            <p className="text-md text-navy">
              <strong>{t.ownMaterial}</strong>{' '}
              <span className="text-muted">
                {t.ownMaterialLine}
              </span>
            </p>
            {canWrite && (
              <Button
                variant="secondary"
                className="mt-3"
                disabled={busy}
                title={t.putsBack({
                  files: server.companyContent.files.length + server.companyContent.videos.length,
                  links: server.companyContent.links.length,
                })}
                onClick={() => void run(() => resetModuleContent(moduleCode))}
              >
                {t.useCompanyAgain}
              </Button>
            )}
          </>
        ) : (
          <p className="text-md text-navy">
            <strong>{t.companyMaterial}</strong>{' '}
            <span className="text-muted">
              {t.companyMaterialLine}
            </span>
          </p>
        )}
      </Card>

      {error && (
        <div role="alert" className="rounded-md border border-amber bg-card p-4">
          <p className="text-md text-navy">{error.message}</p>
        </div>
      )}
      {uploading && (
        <p role="status" className="text-md text-muted">{t.uploading({ name: uploading })}</p>
      )}

      {fileSection(
        'files', t.files,
        t.filesHint,
        fileInput,
        '.pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx',
      )}
      {fileSection(
        'videos', t.videos,
        t.videosHint,
        videoInput,
        '.mp4',
      )}

      <Card className="p-0">
        <div className="flex flex-wrap items-baseline gap-2 border-b border-hairline px-4 py-3 sm:px-5">
          <h2 className="font-display text-lg font-bold text-navy">{t.links}</h2>
          <span className="ml-auto">
            <ConfigBadge tone={draft.links.length > 0 ? 'won' : 'open'}>
              {t.linkCount({ n: draft.links.length })}
            </ConfigBadge>
          </span>
        </div>

        {draft.links.length === 0 ? (
          <p className="px-4 py-3 text-md text-muted sm:px-5">{t.nothingHere}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {draft.links.map((item, index) => (
              <li key={item.url} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <Field label={t.linkName} htmlFor={`link-${index}`} className="min-w-60 flex-1">
                  <TextInput
                    id={`link-${index}`}
                    value={item.label}
                    disabled={!canWrite || busy}
                    onChange={(e) => rename('links', item.id, e.target.value)}
                  />
                </Field>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-md font-semibold text-navy underline"
                >
                  {t.open}
                </a>
                {canWrite && (
                  <Button variant="inlineDanger" disabled={busy} onClick={() => remove('links', index)}>
                    {s.remove}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canWrite && (
          <div className="flex flex-wrap items-start gap-3 px-4 pb-4 pt-3 sm:px-5">
            <Field label={t.linkName} htmlFor="add-link-label" className="min-w-48 flex-1">
              <TextInput
                id="add-link-label"
                value={link.label}
                disabled={busy}
                onChange={(e) => setLink((now) => ({ ...now, label: e.target.value }))}
              />
            </Field>
            <Field
              label={t.address}
              htmlFor="add-link-url"
              hint={t.addressHint}
              className="min-w-60 flex-1"
            >
              <TextInput
                id="add-link-url"
                value={link.url}
                disabled={busy}
                placeholder={ADDRESS_EXAMPLE}
                onChange={(e) => setLink((now) => ({ ...now, url: e.target.value }))}
              />
            </Field>
            <Button
              disabled={busy || !link.label.trim() || !link.url.trim()}
              onClick={() => {
                setDraft((now) => (now ? {
                  ...now,
                  links: [...now.links, { id: '', label: link.label.trim(), url: link.url.trim() }],
                } : now));
                setLink({ label: '', url: '' });
              }}
            >
              {t.addLink}
            </Button>
          </div>
        )}
      </Card>

      {canWrite && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={busy || !dirty}
            onClick={() => void run(() => saveModuleContent(moduleCode, draft))}
          >
            {busy ? s.saving : t.saveContent}
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !dirty}
            onClick={() => { setDraft(copy(server.content)); setSaved(false); }}
          >
            {t.undoEdits}
          </Button>
          {saved && !dirty && (
            <p role="status" className="text-md font-semibold text-success">
              {words.module.savedToOffice}
            </p>
          )}
          {dirty && (
            <p className="text-md text-muted">
              {t.notSavedYet}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
