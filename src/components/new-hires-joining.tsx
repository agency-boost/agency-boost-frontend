'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { WaitingToJoin } from '@/components/waiting-to-join';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import type { WaitingSummary } from '@/components/new-hires';
import { Toast, useToast } from '@/components/ui/toast';
import { useMessages } from '@/i18n/language-provider';
import { addAgentMessages } from '@/i18n/messages/add-agent';
import { newHiresMessages } from '@/i18n/messages/new-hires';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { confirmationMessages } from '@/i18n/messages/confirmations';
import { withDetail } from '@/lib/confirmations';
import { dayInZone, OFFICE_TIME_ZONE } from '@/lib/format';
import {
  askedFor, readInvites, readMyTransfers, type AddAgentResult, type InviteView, type RequestedTransferView,
} from '@/lib/invites';
import { readInbox } from '@/lib/join';
import { useCan, useSession } from '@/lib/session';
import { useOpenedOnce } from '@/lib/use-opened-once';
import { usePhone } from '@/lib/use-phone';

/*
 * **The form and the inbox are fetched on the tap that opens them** (P18.99-T16, the bundle): *+ Tambah agent*'s dialog,
 * its share step and QR, and the request inbox were a fifth of `/new-hires`' first load, for two things most visits never
 * open. Once loaded they are what they were; the form stays mounted from its first opening (`useOpenedOnce`).
 */
const AddAgentDialog = dynamic(() => import('@/components/add-agent-form').then((m) => m.AddAgentDialog), { ssr: false });
const RequestInbox = dynamic(() => import('@/components/request-inbox').then((m) => m.RequestInbox), { ssr: false });

/** What `/new-hires`'s header and *Waiting to join* share: one read of each, the dialogs' state, the toast. */
export interface NewHiresJoiningState {
  actions: ReactNode;
  /** The title row's control below 1024px (UI-004, UI-024): *+ Tambah agent* — and *Tinjau permintaan (n)* while any wait. */
  control: ReactNode;
  /** *Menunggu bergabung*'s sheet (UI-024), below 768px. */
  waitingOpen: boolean;
  setWaitingOpen: (open: boolean) => void;
  mayAdd: boolean;
  invites: InviteView[];
  transfers: RequestedTransferView[];
  today: string;
  adding: boolean;
  reviewing: boolean;
  error: ApiError | null;
  setAdding: (open: boolean) => void;
  setReviewing: (open: boolean) => void;
  setInvites: (update: (list: InviteView[]) => InviteView[]) => void;
  setRequestCount: (n: number) => void;
  onAdded: (result: AddAgentResult) => void;
  toast: ReturnType<typeof useToast>['toast'];
  show: (message: string) => void;
  reader: string | null | undefined;
  /** Bumped when somebody may have joined the roster — linked, or let in from the inbox — so it reads again. */
  rosterKey: number;
  closeInbox: () => void;
}

/**
 * **`/new-hires`'s joining half** (P18.96-T3 AC-1, AC-2, AC-3, AC-5): *+ Add agent* for a reader who may add
 * (`member:invite`), *Review requests (n)* while join requests wait on one who decides them (`leader_request:read_inbox`),
 * and *Waiting to join* — the reader's invites and transfer requests. Each read only for a reader its grant names, so a
 * reader without one is asked nothing; each guarded by the API besides.
 *
 * Its words — the header's *Review requests (n)*, what *+ Add agent* did — are the catalogue's (`new-hires.ts`'
 * `joining`, `add-agent.ts`; P18.98-T4); the confirmation before them is `lib/confirmations.ts`'.
 */
export function useNewHiresJoining(): NewHiresJoiningState {
  const t = useMessages(newHiresMessages).joining;
  const add = useMessages(addAgentMessages);
  const confirmed = useMessages(confirmationMessages);
  const { me } = useSession();
  const readOnly = !!me?.impersonationReadOnly;
  const mayAdd = useCan('member:invite') && !readOnly;
  const mayReview = useCan('leader_request:read_inbox');
  const [invites, setInviteRows] = useState<InviteView[]>([]);
  const [transfers, setTransfers] = useState<RequestedTransferView[]>([]);
  const [today, setToday] = useState(() => dayInZone(OFFICE_TIME_ZONE, new Date()));
  const [requestCount, setRequestCount] = useState(0);
  const [adding, setAdding] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [waitingOpen, setWaitingOpen] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [rosterKey, setRosterKey] = useState(0);
  const { toast, show } = useToast();

  const reload = useCallback(async () => {
    if (!mayAdd) return;
    try {
      const [list, mine] = await Promise.all([readInvites(), readMyTransfers()]);
      setInviteRows(list.invites);
      setToday(list.today);
      setTransfers(mine);
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [mayAdd]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (!mayReview) return;
    // A join request's notice opens the inbox here (`/new-hires?review=requests`, ADR-0170 §5): read once, on arrival.
    if (new URLSearchParams(window.location.search).get('review') === 'requests') setReviewing(true);
    let live = true;
    // A failed count shows no button, never a second error: the inbox itself is one tap away on User management.
    readInbox().then((rows) => { if (live) setRequestCount(rows.length); }).catch(() => undefined);
    return () => { live = false; };
  }, [mayReview]);

  const onAdded = useCallback((result: AddAgentResult) => {
    // An invite is confirmed once the leader sends it from the share step (`AddAgentDialog`'s `onSent`, UI-024).
    if (result.outcome === 'linked') {
      show(withDetail(confirmed.agentAdded, t.linked({ name: result.member.fullName })));
      setRosterKey((n) => n + 1);
    }
    if (result.outcome === 'transfer_requested') {
      show(withDetail(confirmed.transferRequested, t.transfer({ name: askedFor(result.transfer) })));
    }
    void reload();
  }, [reload, show, t, confirmed]);

  const actions = (mayAdd || (mayReview && requestCount > 0)) ? (
    <div className="flex flex-wrap gap-2">
      {mayReview && requestCount > 0 && (
        <Button variant="secondary" onClick={() => setReviewing(true)}>{t.review({ n: requestCount })}</Button>
      )}
      {mayAdd && <Button onClick={() => setAdding(true)}>{add.open}</Button>}
    </div>
  ) : null;

  const control = (mayAdd || (mayReview && requestCount > 0)) ? (
    <div className="flex items-center gap-1.5">
      {mayReview && requestCount > 0 && (
        <Button variant="secondary" onClick={() => setReviewing(true)}>{t.review({ n: requestCount })}</Button>
      )}
      {mayAdd && <Button onClick={() => setAdding(true)} className="max-md:min-h-11">{add.open}</Button>}
    </div>
  ) : null;

  return {
    actions, control, waitingOpen, setWaitingOpen,
    mayAdd, invites, transfers, today, adding, reviewing, error, setAdding, setReviewing,
    setInvites: (update) => setInviteRows((list) => update(list)),
    setRequestCount, onAdded, toast, show, reader: me?.membership?.membershipId,
    rosterKey,
    closeInbox: () => { setReviewing(false); setRosterKey((n) => n + 1); },
  };
}

/**
 * **What `/new-hires` lends the roster** (UI-024): *Menunggu bergabung*'s count, the sheet it opens, and the list for the
 * right column from 768px — `null` for a reader who adds nobody, who has no invitations to wait on.
 */
export function waitingSummary(state: NewHiresJoiningState): WaitingSummary | null {
  if (!state.mayAdd) return null;
  return {
    count: state.invites.length + state.transfers.length,
    open: () => state.setWaitingOpen(true),
    list: <WaitingList {...state} />,
  };
}

function WaitingList(state: NewHiresJoiningState) {
  return (
    <WaitingToJoin
      invites={state.invites}
      transfers={state.transfers}
      reader={state.reader}
      onInvites={state.setInvites}
      onToast={state.show}
    />
  );
}

/** The form, *Menunggu bergabung*'s sheet, the inbox and the toast, under the header `useNewHiresJoining` drew. */
export function NewHiresJoining(state: NewHiresJoiningState) {
  const t = useMessages(newHiresMessages);
  const phone = usePhone();
  const addOpened = useOpenedOnce(state.adding);
  return (
    <>
      {state.error && <div className="mb-4"><ErrorBanner {...state.error} /></div>}
      {state.mayAdd && addOpened && (
        <AddAgentDialog
          open={state.adding}
          today={state.today}
          onClose={() => state.setAdding(false)}
          onAdded={state.onAdded}
          onSent={(name) => state.show(t.invite.sent({ name }))}
        />
      )}
      {state.mayAdd && (
        <ResponsiveSheet open={state.waitingOpen} title={t.list.waiting} onClose={() => state.setWaitingOpen(false)}>
          {state.invites.length + state.transfers.length === 0
            ? <p className="py-2 text-sm text-muted">{t.list.noWaiting}</p>
            : <WaitingList {...state} />}
        </ResponsiveSheet>
      )}
      <Modal
        open={state.reviewing}
        title={t.joining.inboxTitle}
        description={t.joining.inboxLine}
        onClose={state.closeInbox}
        placement={phone ? 'sheet' : 'center'}
        className="max-w-[34rem]"
        footer={<Button variant="secondary" onClick={state.closeInbox}>{t.joining.close}</Button>}
      >
        <RequestInbox today={state.today} onCount={state.setRequestCount} />
      </Modal>
      <Toast toast={state.toast} />
    </>
  );
}
