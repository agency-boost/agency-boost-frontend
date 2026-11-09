'use client';

import { SaveStateLabel, type SaveState } from '@/components/ui/save-state';
import { Button, Card, ErrorBanner } from '@/components/ui/field';
import type { ApiError } from '@/lib/api-client';
import type { CompanyTemplate } from '@/lib/admin';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';

/**
 * What one kind's draft stands at, in words (ADR-0185 §3): *Draf v4 · v3 terbit*, *Terbit v3*, or *Kosong* with what
 * an office made from the template gets of it — none of it, or AgencyBoost's standard ladder (ADR-0116).
 */
export function useVersionWords(view: CompanyTemplate | undefined, companyKind = false): string {
  const t = useMessages(adminTemplateMessages);
  if (!view) return '';
  if (view.status === 'draft' && view.id !== '') {
    return t.editor.stateDraft({ next: view.version, published: view.publishedVersion });
  }
  if (view.publishedVersion !== null) return t.editor.statePublished({ v: view.publishedVersion });
  if (companyKind) return t.settings.campaignEmpty;
  return view.kind === 'capability_ladder' ? t.editor.stateEmptyLadder : t.editor.stateEmpty;
}

/**
 * **The section's one bar** (ADR-0185 §3): the save state the shared label speaks (*Tersimpan ✓ · Menyimpan… · Belum
 * disimpan*, UI-019), what the draft stands at, and *Terbitkan* — held, saying why, while nothing has changed since the
 * last publish. A save the server refused is said here in its words, with *Coba lagi*; the editor keeps the reader's.
 * An archived template has no *Terbitkan*: it is read only.
 *
 * **Somebody else saved first** (`409 VERSION_CONFLICT`, P19-T6 AC-2): trying again would be refused the same, so the
 * bar says so in its own words and offers *Muat ulang* (`onReload`) — the section read again as it is now stored, the
 * reader's unsaved words given up for it — in the place of *Coba lagi*.
 */
export function DraftBar({
  state,
  version,
  archived,
  publishable,
  publishing,
  saveError,
  publishError,
  onRetry,
  onReload,
  onPublish,
}: {
  state: SaveState;
  version: string;
  archived: boolean;
  publishable: boolean;
  publishing: boolean;
  saveError: ApiError | null;
  publishError: ApiError | null;
  onRetry: () => void;
  /** The section read again from the server, for a save refused because somebody else saved first. */
  onReload: () => void;
  onPublish: () => void;
}) {
  const t = useMessages(adminTemplateMessages).editor;
  const stale = saveError?.code === 'VERSION_CONFLICT';
  return (
    <div className="mb-4 flex flex-col gap-2">
      <Card density="compact" className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
          {archived ? <span className="text-md font-semibold text-navy">{t.archived}</span> : <SaveStateLabel state={state} />}
          <span className="text-md text-muted">{version}</span>
        </div>
        {!archived && (
          <Button
            disabled={publishing || !publishable || state === 'saving'}
            title={!publishable ? t.nothingToPublish : state === 'saving' ? t.saveFirst : undefined}
            onClick={onPublish}
          >
            {publishing ? t.publishing : t.publish}
          </Button>
        )}
      </Card>
      {saveError && (
        <div className="flex flex-col gap-2">
          <ErrorBanner {...saveError} message={stale ? t.savedElsewhere : saveError.message} />
          {stale
            ? <Button variant="secondary" className="self-start" onClick={onReload}>{t.reload}</Button>
            : <Button variant="secondary" className="self-start" onClick={onRetry}>{t.retry}</Button>}
        </div>
      )}
      {publishError && <ErrorBanner {...publishError} />}
    </div>
  );
}
