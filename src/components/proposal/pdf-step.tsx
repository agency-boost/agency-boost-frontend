'use client';

import { useEffect, useState } from 'react';
import { Button, ErrorBanner, Switch } from '@/components/ui/field';
import { FLOATING_BAR_BUTTON, FLOATING_BAR_ROOM, FloatingBar } from '@/components/ui/floating-bar';
import { useToast } from '@/components/ui/toast';
import { useMessages } from '@/i18n/language-provider';
import { proposalMessages } from '@/i18n/messages/proposal';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { finishProposal, patchProposal, proposalPdf, type Proposal } from '@/lib/proposals';
import { saveFile } from '@/lib/save-file';
import { A4Placeholder, PdfPages } from './pdf-pages';
import { SaveLine, StepHeading } from './proposal-frame';
import type { ProposalEditor } from './use-proposal';

/**
 * **Hand the saved file to the phone's share sheet, where it has one** (ADR-0222 §5, §7): the agent passes it on
 * themselves; AgencyBoost sends nothing. A share cancelled, or refused by the browser once the save is done, is silent —
 * the file is already saved.
 */
async function offerShare(file: Blob, name: string): Promise<void> {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function' || typeof File === 'undefined') return;
  const shared = new File([file], name, { type: 'application/pdf' });
  if (!navigator.canShare({ files: [shared] })) return;
  try {
    await navigator.share({ files: [shared] });
  } catch {
    // Cancelled, or refused: the file is saved either way.
  }
}

/**
 * **Step 3, *Lihat PDF*** (P19.7-T3 AC-1 to AC-3; Acc. 15, 19, 20; ADR-0222 §4, §5).
 *
 * - **The pages are the file itself** (AC-1): `GET /proposals/:id/pdf`, fetched with the session and drawn by `pdf.js`.
 *   The step keeps that blob; *Simpan PDF* saves those very bytes and fetches nothing again.
 * - ***Simpan PDF***, the floating pill (AC-2): first `POST …/done` — refused, nothing is saved and the refusal says what
 *   is missing — then the blob saved as the proposal's `fileName`, then the share sheet where the phone has one.
 * - ***Ubah*** goes back to step 2. ***Tampilkan total premi*** is one switch, off by default: a change is saved first,
 *   and the pages are fetched again.
 * - **No send button, no WhatsApp, no link** (AC-3; decision 3): the only ways out are the phone's own save and share.
 * - **A view-only session** (the Super Admin's view-as, Acc. 22) draws no page: it says *"Pratinjau PDF tidak tersedia
 *   dalam sesi hanya melihat."*, and *Simpan PDF* is disabled with that reason. The server refuses the file too.
 */
export function PdfStep({
  editor, proposal, viewOnly, readOnly, onEdit,
}: {
  editor: ProposalEditor;
  proposal: Proposal;
  /** A view-only session, or a reader without `proposal:download`: no page, no file. */
  viewOnly: boolean;
  /** No `proposal:update`, or a view-only session: the switch is shown, not changed. */
  readOnly: boolean;
  onEdit: () => void;
}) {
  const t = useMessages(proposalMessages).pdf;
  const { show } = useToast();
  const [file, setFile] = useState<Blob | null>(null);
  /** The file was refused or never arrived (the API's words), or arrived and could not be drawn here (`'draw'`). */
  const [failed, setFailed] = useState<ApiError | 'draw' | null>(null);
  /** Bumped to fetch the pages again: after *Tampilkan total premi* changed, or *Coba lagi*. */
  const [generation, setGeneration] = useState(0);
  const [saving, setSaving] = useState(false);
  const id = proposal.id;

  useEffect(() => {
    if (viewOnly) return;
    let live = true;
    setFile(null);
    setFailed(null);
    proposalPdf(id)
      .then((blob) => { if (live) setFile(blob); })
      .catch((err) => { if (live) setFailed(toDisplayError(err)); });
    return () => { live = false; };
  }, [id, generation, viewOnly]);

  const toggleTotal = async (next: boolean) => {
    const written = await editor.write((version) => patchProposal(id, version, { showTotal: next }));
    if (written) setGeneration((g) => g + 1);
  };

  const save = async () => {
    if (!file || saving) return;
    setSaving(true);
    try {
      const done = await editor.write((version) => finishProposal(id, version));
      if (!done) return;
      saveFile(file, done.fileName);
      show(t.saved);
      await offerShare(file, done.fileName);
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || editor.save === 'saving';
  const totalLabel = proposal.channel === 'syariah' ? t.showTotalSyariah : t.showTotal;
  return (
    <section data-proposal-pdf={id} aria-labelledby="proposal-pdf" className={FLOATING_BAR_ROOM}>
      <StepHeading id="proposal-pdf">{t.heading}</StepHeading>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card px-4 py-2">
        <Switch
          id="proposal-show-total"
          label={totalLabel}
          checked={proposal.showTotal}
          disabled={readOnly || busy}
          onChange={(next) => { void toggleTotal(next); }}
          phoneTarget
          tabletTarget
        />
        <Button variant="secondary" className="min-h-12 rounded-pill px-5" onClick={onEdit}>{t.edit}</Button>
      </div>

      {editor.refusal
        ? <div className="mb-3"><ErrorBanner {...editor.refusal} /></div>
        : <SaveLine save={editor.save} conflict={editor.conflict} onRetry={editor.retry} />}

      {viewOnly && (
        <p id="proposal-pdf-view-only" role="status" className="rounded-lg bg-card p-4 text-md text-muted">{t.viewOnly}</p>
      )}
      {!viewOnly && failed && (
        <div className="flex flex-col items-start gap-3">
          {failed === 'draw'
            ? <p role="alert" className="text-md font-semibold text-alert">{t.unreadable}</p>
            : <ErrorBanner {...failed} />}
          <Button variant="secondary" className="min-h-12 rounded-pill px-5" onClick={() => setGeneration((g) => g + 1)}>
            {t.retry}
          </Button>
        </div>
      )}
      {!viewOnly && !failed && !file && <A4Placeholder label={t.loading} />}
      {!viewOnly && !failed && file && (
        <PdfPages file={file} onFailed={() => setFailed('draw')} />
      )}

      <FloatingBar wide="pill" pillClassName="justify-end">
        <button
          type="button"
          className={cn(FLOATING_BAR_BUTTON, 'min-h-12 flex-1 disabled:opacity-50')}
          disabled={viewOnly || !file || busy}
          aria-describedby={viewOnly ? 'proposal-pdf-view-only' : undefined}
          onClick={() => { void save(); }}
        >
          {saving ? t.saving : t.save}
        </button>
      </FloatingBar>
    </section>
  );
}
