'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { proposalMessages } from '@/i18n/messages/proposal';
import { createProposal, patchProposal, proposalCatalog, proposalHref, PROPOSAL_HREF } from '@/lib/proposals';
import { useCan, useSession } from '@/lib/session';
import { ClientStep } from './client-step';
import { ProductsStep } from './products-step';
import { PdfStep } from './pdf-step';
import { ProposalSteps, SaveLine } from './proposal-frame';
import { useProposal } from './use-proposal';

/** A view-only session: the Super Admin's view-as (ADR-0206 §4). */
function useViewOnly(): boolean {
  const { me } = useSession();
  return !!me?.impersonationReadOnly;
}

/**
 * **Whether this reader writes here** (AC-14; Acc. 22; ADR-0221 §2): a view-only session — the Super Admin's view-as —
 * opens a proposal and changes nothing, every control disabled. The server refuses each write too (`403
 * IMPERSONATION_READ_ONLY`); this only keeps the controls honest. `may` is the grant the screen checks (`useCan`).
 */
function useReadOnly(may: boolean): boolean {
  const viewOnly = useViewOnly();
  return !may || viewOnly;
}

/**
 * **`/proposal/new`: step 1 with nothing stored** (AC-3, AC-4; ADR-0221 §3). *Lanjut* saves the lead first — a *Klien
 * baru* as a Sales lead, a lead's missing age and gender to it — then creates the draft (`POST /proposals`) and goes on
 * to its step 2 in place of this address, so *Kembali* from there is step 1 of the stored proposal.
 */
export function NewProposal({ leadId }: { leadId: string | null }) {
  const router = useRouter();
  const readOnly = useReadOnly(useCan('proposal:create'));
  return (
    <div data-proposal-new="">
      <ProposalSteps current={1} backHref={PROPOSAL_HREF} />
      <ClientStep
        initialLeadId={leadId}
        remember
        readOnly={readOnly}
        onContinue={async (lead) => {
          const created = await createProposal(lead.id);
          router.replace(proposalHref(created.id, 2));
        }}
      />
    </div>
  );
}

/**
 * **`/proposal/[proposalId]`: the three steps of a stored proposal** (AC-2; Acc. 18). `?step=` chooses one; every change
 * from here is saved on the server, pinned, so the draft survives closing the app and opens on another device.
 *
 * - **Step 1** changes the client: a lead chosen again takes the client's copy again (`PATCH … { leadId }`), after asking
 *   when the new age would take products out.
 * - **Step 2** is the products (`ProductsStep`).
 * - **Step 3** is the PDF (`PdfStep`, P19.7-T3): the file's own pages, *Simpan PDF*, *Ubah* and *Tampilkan total premi*.
 */
export function ProposalScreen({ id, step }: { id: string; step: 1 | 2 | 3 }) {
  const t = useMessages(proposalMessages);
  const router = useRouter();
  const editor = useProposal(id);
  const readOnly = useReadOnly(useCan('proposal:update'));
  // The file: refused in a view-only session (`403 PERM_DENIED`), so step 3 draws no page there (ADR-0222 §4).
  const noFile = useReadOnly(useCan('proposal:download'));
  const [asking, setAsking] = useState<number | null>(null);
  const answer = useRef<((go: boolean) => void) | null>(null);

  const backHref = step === 1 ? PROPOSAL_HREF : proposalHref(id, step === 3 ? 2 : 1);

  if (editor.error) {
    return (
      <div>
        <ProposalSteps current={step} backHref={PROPOSAL_HREF} />
        <ErrorBanner {...editor.error} />
      </div>
    );
  }
  const proposal = editor.proposal;
  if (!proposal) {
    return (
      <div>
        <ProposalSteps current={step} backHref={backHref} />
        <Skeleton label={t.products.loading}>
          <div className="flex flex-col gap-3">
            <div className="rounded-lg bg-card p-4"><SkeletonBar className="w-1/2" /><SkeletonBar className="mt-3 w-2/3" /></div>
            <div className="grid grid-cols-2 gap-2">
              {[0, 1].map((i) => <div key={i} className="h-28 rounded-lg bg-card" />)}
            </div>
          </div>
        </Skeleton>
      </div>
    );
  }

  /** Ask before a new client's age takes products out (ADR-0221 §3); answers whether to go on. */
  const confirmRemoval = (n: number) => new Promise<boolean>((resolve) => {
    answer.current = resolve;
    setAsking(n);
  });

  const continueFrom1 = async (lead: { id: string; age: number }) => {
    const same = lead.id === proposal.leadId && lead.age === proposal.client.age;
    if (!same && !readOnly) {
      if (proposal.items.length > 0) {
        const then = await proposalCatalog(proposal.channel, lead.age);
        const unfit = proposal.items.filter((i) => !then.products.some((p) => p.productId === i.productId)).length;
        if (unfit > 0 && !(await confirmRemoval(unfit))) return;
      }
      const written = await editor.write((v) => patchProposal(proposal.id, v, { leadId: lead.id }));
      if (!written) return;
    }
    router.push(proposalHref(id, 2));
  };

  return (
    <div data-proposal={proposal.id}>
      <ProposalSteps current={step} backHref={backHref} />
      {step === 1 && (
        <>
          <ClientStep
            key={proposal.leadId}
            initialLeadId={proposal.leadId}
            remember={false}
            readOnly={readOnly}
            browseWhenReadOnly
            onContinue={continueFrom1}
          />
          <SaveLine save={editor.save} conflict={editor.conflict} onRetry={editor.retry} />
        </>
      )}
      {step === 2 && <ProductsStep editor={editor} readOnly={readOnly} onNext={() => router.push(proposalHref(id, 3))} />}
      {step === 3 && (
        <PdfStep
          editor={editor}
          proposal={proposal}
          viewOnly={noFile}
          readOnly={readOnly}
          onEdit={() => router.push(proposalHref(id, 2))}
        />
      )}
      <Dialog
        open={asking !== null}
        message={asking === null ? '' : t.products.willRemove({ n: asking })}
        confirmLabel={t.products.continue}
        cancelLabel={t.products.cancel}
        onConfirm={() => { setAsking(null); answer.current?.(true); }}
        onCancel={() => { setAsking(null); answer.current?.(false); }}
      />
    </div>
  );
}
