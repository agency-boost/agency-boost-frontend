'use client';

import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { PersonRow } from '@/components/ui/person-row';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { rungShort, useLadder } from '@/components/ui/role-badge';
import { SkeletonPeople } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { leaderChangeMessages } from '@/i18n/messages/leader-change';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatNumber } from '@/lib/format';
import { requestTransfer } from '@/lib/invites';
import { changeLeader, readLeaderChoices, type LeaderMoveChoice, type Member, type PendingMove } from '@/lib/org';
import { useDebounced } from '@/lib/use-debounced';

/** What the picker did, once it is done: moved at once, or asked of the Owner or an Admin. */
export type LeaderPickerResult =
  | { kind: 'moved'; member: Member; leader: LeaderMoveChoice }
  | { kind: 'requested'; transfer: PendingMove; leader: LeaderMoveChoice };

/**
 * The picker's props — **the contract the member page (`/people/members/[membershipId]`, *Ganti* on *Melapor ke*) and
 * *Tim Anda* (`/user-management/add`, *Pindahkan ke leader lain*) both wire to**:
 *
 * - `open` — drawn while true; the caller owns it.
 * - `membershipId` — whom it moves.
 * - `memberName` — their name, as the title and the confirmation say it.
 * - `downlineCount` — how many active people are below them (`subtreeCount` on a member, `directCount` is not enough):
 *   they all move too, and the confirmation counts them.
 * - `mode` — `'office'` for the Owner and an Admin: every leader is moved under at once, one list with no heading.
 *   `'leader'` for an AB or an AAB: two groups, *Di tim Anda* (at once) and *Leader lain · perlu persetujuan Owner/Admin*
 *   (a request). Which group a leader lands in is the server's (`direct`), never worked out here.
 * - `onDone(result)` — after the write succeeded: `{ kind: 'moved', member, leader }` (the member as they now stand,
 *   from `PUT /members/:id/leader`) or `{ kind: 'requested', transfer, leader }` (`POST /members/:id/transfer-request`).
 *   The picker has already said *Tersimpan ✓* or *Permintaan terkirim ✓* through the shell's toast; the caller reloads
 *   what it shows and closes the picker.
 * - `onClose()` — ✕, Escape, the backdrop.
 */
export interface LeaderPickerProps {
  open: boolean;
  membershipId: string;
  memberName: string;
  downlineCount: number;
  mode: 'office' | 'leader';
  onDone: (result: LeaderPickerResult) => void;
  onClose: () => void;
}

/**
 * **Choosing somebody's new leader** (P19.12-T4; ADR-0247 §2–§3; the client's message of 11 November 2026, item 8).
 *
 * A search over `GET /members/:id/leader-choices` — never the person, nobody below them, not their leader now, nobody who
 * cannot lead a unit — then, once one is chosen, what the move does in one line and an optional reason:
 *
 * - **at once** (`direct`): *{nama} dan {n} orang di bawahnya pindah ke unit {leader} sekarang.* → `PUT /members/:id/leader`
 *   → *Tersimpan ✓*;
 * - **as a request** (a leader's choice outside their tree): *Ini dikirim sebagai permintaan ke Owner/Admin. {nama} tetap
 *   melapor kepada Anda sampai disetujui.* → `POST /members/:id/transfer-request` → *Permintaan terkirim ✓*.
 *
 * The shared sheet (`ResponsiveSheet`): a bottom sheet below 1024px, a centred modal from 1024px, the main action pinned
 * at the foot. Every row is a 44px target and more. A refusal is shown in the sheet, the choice kept; a refusal that
 * says the move may be asked for instead (`details.canRequest`) turns the choice into a request.
 */
export function LeaderPicker(props: LeaderPickerProps) {
  // Mounted afresh each time it opens, and for each person: nothing chosen, nothing typed, no answer to an old search.
  return props.open ? <PickerSheet key={props.membershipId} {...props} /> : null;
}

function PickerSheet({ membershipId, memberName, downlineCount, mode, onDone, onClose }: LeaderPickerProps) {
  const t = useMessages(leaderChangeMessages).picker;
  const saved = useMessages(uiV1Messages).save.saved;
  const figures = useFigureLanguage();
  const ladder = useLadder();
  const { show } = useToast();
  const [query, setQuery] = useState('');
  const settled = useDebounced(query);
  const [choices, setChoices] = useState<LeaderMoveChoice[] | null>(null);
  const [chosen, setChosen] = useState<LeaderMoveChoice | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    // Cleared first, so an answer to the previous search is never acted on as this one's.
    setChoices(null);
    readLeaderChoices(membershipId, settled || undefined)
      .then((rows) => { if (live) setChoices(rows); })
      .catch((err) => {
        if (!live) return;
        setError(toDisplayError(err));
        setChoices([]);
      });
    return () => { live = false; };
  }, [membershipId, settled]);

  async function confirm() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      if (chosen.direct) {
        const member = await changeLeader(membershipId, chosen.membershipId, reason);
        show(saved);
        onDone({ kind: 'moved', member, leader: chosen });
      } else {
        const transfer = await requestTransfer(membershipId, chosen.membershipId, reason);
        show(t.requestSent);
        onDone({ kind: 'requested', transfer, leader: chosen });
      }
    } catch (err) {
      const shown = toDisplayError(err);
      setError(shown);
      // The tree changed since the list was read: the server says it may be asked for instead.
      if (chosen.direct && shown.details?.canRequest === true) setChosen({ ...chosen, direct: false });
    } finally {
      setBusy(false);
    }
  }

  const count = (n: number) => formatNumber(n, {}, figures);
  const meta = (choice: LeaderMoveChoice) =>
    `${rungShort(choice.orgLevelCode || choice.role.toUpperCase(), ladder)} · ${choice.agentCode} · ${t.unitSize({ n: count(choice.unitSize), count: choice.unitSize })}`;
  const direct = choices?.filter((c) => c.direct) ?? [];
  const asked = choices?.filter((c) => !c.direct) ?? [];

  const list = (rows: LeaderMoveChoice[], heading: string | null, key: string) => rows.length === 0 ? null : (
    <section aria-labelledby={heading ? `leader-picker-${key}` : undefined} className="mt-3 first:mt-0">
      {heading && <h3 id={`leader-picker-${key}`} className="mb-1 text-sm font-semibold text-muted">{heading}</h3>}
      <ul className="flex flex-col" data-testid={`leader-choices-${key}`}>
        {rows.map((choice) => (
          <li key={choice.membershipId} className="border-t border-divider first:border-t-0">
            <PersonRow
              name={choice.fullName}
              seed={choice.membershipId}
              height={64}
              avatarSize={40}
              className="px-0"
              nameClassName="text-md"
              meta={<span className="truncate">{meta(choice)}</span>}
              onSelect={() => { setChosen(choice); setError(null); }}
              chevron
            />
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <ResponsiveSheet
      open
      title={t.title({ name: memberName })}
      onClose={onClose}
      footer={chosen ? (
        <Button className="w-full" disabled={busy} onClick={() => void confirm()}>
          {chosen.direct ? (busy ? t.moving : t.moveConfirm) : (busy ? t.sending : t.sendRequest)}
        </Button>
      ) : undefined}
    >
      {error && <div className="mb-3"><ErrorBanner {...error} /></div>}
      {chosen ? (
        <div data-testid="leader-picker-confirm">
          <PersonRow
            name={chosen.fullName}
            seed={chosen.membershipId}
            height={64}
            avatarSize={40}
            className="px-0"
            nameClassName="text-md"
            meta={<span className="truncate">{meta(chosen)}</span>}
          />
          <p className="mt-2 text-md text-navy">
            {chosen.direct
              ? t.moveNow({ name: memberName, n: count(downlineCount), count: downlineCount, leader: chosen.fullName })
              : t.asRequest({ name: memberName })}
          </p>
          <Field label={t.why} htmlFor="leader-move-reason" hint={t.whyHint} className="mt-3">
            <TextInput
              id="leader-move-reason"
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <Button variant="secondary" className="mt-3 min-h-11" disabled={busy} onClick={() => { setChosen(null); setError(null); }}>
            {t.chooseAnother}
          </Button>
        </div>
      ) : (
        <div>
          <Field label={t.search} htmlFor="leader-picker-search">
            <TextInput
              id="leader-picker-search"
              value={query}
              placeholder={t.searchPlaceholder}
              autoComplete="off"
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          <div className="mt-3">
            {choices === null && <SkeletonPeople count={3} label={t.loading} />}
            {choices?.length === 0 && !error && (
              <EmptyState variant={settled ? 'filtered' : 'empty'} title={settled ? t.noMatch : t.none} />
            )}
            {mode === 'office'
              ? list(choices ?? [], null, 'office')
              : (
                <>
                  {list(direct, t.inYourTeam, 'direct')}
                  {list(asked, t.otherLeaders, 'request')}
                </>
              )}
          </div>
        </div>
      )}
    </ResponsiveSheet>
  );
}
