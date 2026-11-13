'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState, type ReactNode } from 'react';
import { LeaderLimitNotice, LeaderLimitWaiting, isLeaderLimit } from '@/components/leader-limit-notice';
import { LeaderPicker } from '@/components/leader-picker';
import { blankPersonalFields, MemberPersonalDialog } from '@/components/member-personal-dialog';
import { MemberDashboardLink, MemberTiles } from '@/components/member-tiles';
import { Page } from '@/components/page';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { RoleBadge, classOfRung, rungLabel, rungShort, useLadder } from '@/components/ui/role-badge';
import { SkeletonCards } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { useToast } from '@/components/ui/toast';
import { kept } from '@/i18n/kept';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { memberMessages } from '@/i18n/messages/member';
import { orgMessages } from '@/i18n/messages/org';
import { cn } from '@/lib/cn';
import { displayName } from '@/lib/display-name';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatCalendarDay, formatNumber } from '@/lib/format';
import { notRecorded, personalLines } from '@/lib/personal';
import { whatsAppLink } from '@/lib/phone-number';
import { useCan } from '@/lib/session';
import {
  askLeaderLimitApproval, cancelLeaderLimitRequest, pendingFor, readLeaderLimitRequests, requestedChange,
  type LeaderLimitRequestRow,
} from '@/lib/leader-limit-requests';
import {
  changeRole,
  isRemovalConfirmed,
  listGroups,
  listReports,
  MEMBER_STATE_TONE,
  memberStateOf,
  readMember,
  readTags,
  removeMember,
  REMOVAL_CONFIRMATION,
  roleChangeExplanation,
  setTags,
  type GroupSummary,
  type Member,
  type MemberTags,
} from '@/lib/org';

/**
 * One member — the prototype's person modal (`KPM_Owner.html`, Org Tree), as a page.
 *
 * A page rather than a modal because it has a URL worth sharing: "look at this person"
 * is a thing an Owner says to an Admin, and a modal cannot be linked to.
 *
 * **Its order since P19.12-T5** (ADR-0248 §1; the client's message of 11 November 2026, item 9; provisional until the
 * client's mockup, OD-318): the name with its state — *Diundang* or *Belum diundang* for an active member who never
 * signed in (AC-4) — and *Lihat dashboard ›*; **one compact row of four figures**; ***Posisi di tim***, one card, a line
 * each — *Peran* · **Ubah**, *Melapor ke* · **Ganti**, *Grup informal* · **Ubah**, and the unit in one line — each control
 * opening its form over the page; ***Data pribadi*** folded, its summary counting what is not recorded, *No. WhatsApp*
 * among it (AC-2) and ***Lengkapi data*** for the blanks (AC-3); *Yang melapor kepadanya*; and ***Keluarkan dari KPM***
 * last. The long explanations are gone; a confirmation keeps the one sentence that says what it does.
 */
/**
 * **A link or a box's line, 44px tall below 1024px** (P19.2-T3 AC-4; UI-142: *the measurement script finds no target
 * under 44px in `main` at 375 and 768*): *‹ All members*, a report's name, a group's or *Core Leader*'s tick, a
 * removal's choice. Its words centred in the height; from 1024px it sits on its line as before. A link inside a
 * sentence keeps its line (WCAG 2.5.8's inline exception).
 */
const TAP_LINE = 'max-lg:inline-flex max-lg:min-h-11 max-lg:items-center';

/** A box's line — a label that is a flex line already — 44px tall below 1024px, as `TAP_LINE`. */
const TAP_BOX = 'max-lg:min-h-11';

/** Which form is open over the page. */
type Open = null | 'role' | 'leader' | 'tags' | 'complete' | 'remove';

export default function MemberPage({ params }: { params: Promise<{ membershipId: string }> }) {
  const t = useMessages(memberMessages);
  const status = useMessages(orgMessages).status;
  const language = useLanguage();
  const figures = useFigureLanguage();
  // The company's ladder, so a rung's label comes from it rather than a map (P4-T9).
  const ladder = useLadder();
  const { show } = useToast();
  // *Lengkapi data* is the Owner's and the Admins' (`member:complete_personal`); the API refuses anybody else.
  const mayComplete = useCan('member:complete_personal');
  const { membershipId } = use(params);
  const [member, setMember] = useState<Member | null>(null);
  const [reports, setReports] = useState<Member[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [tags, setLocalTags] = useState<MemberTags | null>(null);
  const [draft, setDraft] = useState<{ groupIds: string[]; isCoreLeader: boolean } | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState(false);
  // P3.1-T13. Both controls live here rather than on a roster row, which is where the
  // prototype puts them (`KPM_Owner.html:4515-4522`) — a bare `onchange` and a `Remove`
  // link, no confirmation and no reason. There is no room on a row to ask why.
  // A rung of the company's ladder, by its code lower-cased — `aab`, or a rung the company added (OD-50).
  const [toRole, setToRole] = useState('');
  const [roleReason, setRoleReason] = useState('');
  const [removeWord, setRemoveWord] = useState('');
  const [removeReason, setRemoveReason] = useState('');
  const [disposition, setDisposition] = useState<'reassign' | 'orphan'>('orphan');
  const [error, setError] = useState<ApiError | null>(null);
  /** A refusal of one form's write: said in that form, the page behind it still true. */
  const [formError, setFormError] = useState<ApiError | null>(null);
  /** The office's leader limit refused the role change (P13.2-T4): said in the role form, not over the page. */
  const [limit, setLimit] = useState<ApiError | null>(null);
  /** The office's leader-limit requests (ADR-0157), for whether one about this person waits. */
  const [asks, setAsks] = useState<LeaderLimitRequestRow[] | null>(null);
  const [asking, setAsking] = useState(false);

  /** P3.1-T13. A role change and a removal both alter this page, so both re-read it. */
  const load = useCallback(async () => {
    try {
      const [one, theirs, mine, all] = await Promise.all([
        readMember(membershipId),
        listReports(membershipId),
        readTags(membershipId),
        listGroups(),
      ]);
      setMember(one);
      setReports(theirs);
      setLocalTags(mine);
      setGroups(all);
      // Only for somebody whose role this reader may change: they are the ones who may have asked. A failed read
      // shows no waiting line rather than a second error over the page.
      if (one.canChangeRole) setAsks(await readLeaderLimitRequests().catch(() => []));
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [membershipId]);

  useEffect(() => {
    void load();
  }, [load]);

  function close() {
    setOpen(null);
    setFormError(null);
    setLimit(null);
    setDraft(null);
  }

  /** ADR-0157 §1: the change the limit refused, asked of AgencyBoost instead — the same rung, the same reason. */
  async function askApproval() {
    if (!member || !toRole) return;
    setAsking(true);
    setFormError(null);
    try {
      await askLeaderLimitApproval(member.membershipId, {
        action: 'promote', orgLevelCode: toRole, ...(roleReason.trim() ? { reason: roleReason.trim() } : {}),
      });
      setLimit(null);
      setToRole('');
      setRoleReason('');
      setAsks(await readLeaderLimitRequests().catch(() => []));
    } catch (err) {
      setFormError(toDisplayError(err));
    } finally {
      setAsking(false);
    }
  }

  async function cancelAsk(requestId: string) {
    setAsking(true);
    setFormError(null);
    try {
      setAsks(await cancelLeaderLimitRequest(requestId));
    } catch (err) {
      setFormError(toDisplayError(err));
    } finally {
      setAsking(false);
    }
  }

  async function submitRoleChange(event: React.FormEvent) {
    event.preventDefault();
    if (!member || !toRole || toRole === currentRung(member)) return;
    setBusy(true);
    setFormError(null);
    setLimit(null);
    try {
      await changeRole(member.membershipId, toRole, roleReason.trim() || undefined);
      setToRole('');
      setRoleReason('');
      close();
      await load();
    } catch (err) {
      const shown = toDisplayError(err);
      // The limit is a refusal of this one change, and the page behind it is still true.
      if (isLeaderLimit(shown)) setLimit(shown);
      else setFormError(shown);
    } finally {
      setBusy(false);
    }
  }

  async function saveTags() {
    if (!draft) return;
    setBusy(true);
    setFormError(null);
    try {
      setLocalTags(await setTags(membershipId, draft.groupIds, draft.isCoreLeader));
      close();
    } catch (err) {
      setFormError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitRemoval(event: React.FormEvent) {
    event.preventDefault();
    if (!member || !isRemovalConfirmed(removeWord)) return;
    setBusy(true);
    setFormError(null);
    try {
      await removeMember(member.membershipId, {
        confirmation: removeWord,
        reason: removeReason.trim() || undefined,
        // Only when they actually lead people — the server refuses a disposition for
        // somebody who leads nobody, so sending one anyway would be a 400 the reader
        // could not act on.
        //
        // `reassign` moves them to **this person's own leader**, one level up. The
        // leader's version of this screen offers "my unit", which is right there because
        // the caller *is* a leader; here the caller may be an Owner who leads nobody, and
        // moving a unit under somebody who has never led it would be a reorganisation
        // dressed up as a removal. `leaderId` is never null on a removable person — the
        // office root cannot be removed at all.
        ...(member.directCount > 0
          ? {
              subtree:
                disposition === 'reassign' && member.leaderId
                  ? ({ action: 'reassign', toMembershipId: member.leaderId } as const)
                  : ({ action: 'orphan' } as const),
            }
          : {}),
      });
      setRemoveWord('');
      setRemoveReason('');
      close();
      // Re-read rather than trusting the response: it answers with the *caller's* team,
      // and this page is about one person who is now on the Removed list.
      await load();
    } catch (err) {
      setFormError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <Page title={kept('Member')}>
        <ErrorBanner {...error} />
        <p className="mt-3 text-md text-muted">{t.hidden}</p>
        <Link href="/people/members" className={cn('mt-3 inline-block text-md text-navy underline', TAP_LINE)}>
          {t.back}
        </Link>
      </Page>
    );
  }

  if (!member) {
    return (
      <Page title={kept('Member')}>
        <SkeletonCards count={3} label={t.loading} />
      </Page>
    );
  }

  const state = memberStateOf(member);
  const waiting = pendingFor(asks, member.membershipId);
  const number = (n: number) => formatNumber(n, {}, figures);

  return (
    <Page
      title={displayName(member)}
      subtitle={member.agentCode}
      actions={
        <>
          {/* *Lihat dashboard ›* on the title row from 1024px (`kpm-owner-desktop` screen 3); below, after the figures. */}
          <MemberDashboardLink member={member} variant="primary" className="max-lg:hidden" />
          {/* P19.12-T5 AC-4 (ADR-0248 §4): an active member who never signed in is *Diundang* or *Belum diundang*. */}
          <StatusPill status={MEMBER_STATE_TONE[state]} label={status[state]} />
        </>
      }
    >
      {/* OWN UI-020 (ADR-0205 §1), one row since ADR-0248 §1: how they are doing, under the name. */}
      <MemberTiles member={member} />

      {/* ── Posisi di tim (P19.12-T5 AC-1; ADR-0248 §1) ── */}
      <Card data-position-card="">
        <h2 className="font-display text-lg font-bold text-navy">{t.position}</h2>
        <dl className="mt-1 divide-y divide-divider">
          <PositionLine
            term={t.role}
            action={member.canChangeRole && (
              <LineAction label={t.edit} name={t.editRole} onClick={() => { setToRole(''); setRoleReason(''); setOpen('role'); }} />
            )}
          >
            <RoleBadge role={member.role} short={false} />
          </PositionLine>
          <PositionLine
            term={t.reportsTo}
            action={member.canChangeLeader && (
              <LineAction label={t.change} name={t.changeLeader} onClick={() => setOpen('leader')} />
            )}
          >
            {member.leaderName ?? t.topOfTree}
          </PositionLine>
          <PositionLine
            term={t.informalGroups}
            action={tags && (
              <LineAction
                label={t.edit}
                name={t.editGroups}
                onClick={() => { setDraft({ groupIds: tags.groupIds, isCoreLeader: tags.isCoreLeader }); setOpen('tags'); }}
              />
            )}
          >
            <GroupChips tags={tags} groups={groups} />
          </PositionLine>
          {/* The unit in one line (ADR-0248 §1): *Kedalaman* is gone, and so is the long sentence for one who leads nobody. */}
          <PositionLine term={t.unit}>
            {member.isLeader
              ? t.unitLine({ direct: number(member.directCount), whole: number(member.subtreeCount) })
              : t.noTeam}
          </PositionLine>
        </dl>
        {/* ADR-0157: a change past the limit, asked of AgencyBoost, waits — said on the card, cancellable here. */}
        {waiting && (
          <div className="mt-2">
            <LeaderLimitWaiting
              what={requestedChange(waiting, (code) => rungShort(code, ladder), language)}
              cancelling={asking}
              onCancel={() => void cancelAsk(waiting.requestId)}
            />
          </div>
        )}
      </Card>

      {/* ── Data pribadi, folded (P19.12-T5 AC-1 to AC-3; ADR-0248 §1–§3) ── */}
      <PersonalData member={member} mayComplete={mayComplete} onComplete={() => setOpen('complete')} />

      <h2 className="mb-3 mt-6 font-display text-lg font-bold text-navy">{t.reports}</h2>
      {reports.length === 0 ? (
        <div className="rounded-lg border border-card-edge bg-card">
          <EmptyState title={t.noReports} />
        </div>
      ) : (
        <DataTable caption={t.reports} columns={[t.name, t.agentCode, t.role, t.unit]}>
          {reports.map((r) => (
            <Row key={r.membershipId}>
              <Cell className="font-semibold">
                <Link href={`/people/members/${r.membershipId}`} className={cn('underline', TAP_LINE)}>
                  {displayName(r)}
                </Link>
              </Cell>
              <Cell className="whitespace-nowrap">
                <code className="text-sm">{r.agentCode}</code>
              </Cell>
              <Cell>
                <RoleBadge role={r.role} />
              </Cell>
              {/* The directory's words for one who leads nobody (P18.9-T4 AC-3; UI-024): *No team*. */}
              <Cell className="text-muted">
                {r.isLeader ? t.direct({ n: r.directCount }) : t.noTeam}
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}

      <Link href="/people/members" className={cn('mt-6 inline-block text-md text-navy underline', TAP_LINE)}>
        {t.back}
      </Link>

      {/* ── Keluarkan dari KPM, the very last thing on the page (ADR-0248 §1) ── */}
      {member.canRemove && (
        <div className="mt-6 border-t border-divider pt-4">
          <Button variant="danger" onClick={() => { setRemoveWord(''); setRemoveReason(''); setOpen('remove'); }}>
            {t.remove}
          </Button>
        </div>
      )}

      {/* ── The forms the card's controls open ── */}
      {member.canChangeRole && (
        <ResponsiveSheet
          open={open === 'role'}
          title={t.changeRole}
          onClose={close}
          footer={(
            <div className="flex justify-end gap-2">
              <Button variant="secondary" disabled={busy} onClick={close}>{t.cancel}</Button>
              <Button type="submit" form="role-form" disabled={busy || !toRole || toRole === currentRung(member)}>
                {busy ? t.saving : t.changeRoleButton}
              </Button>
            </div>
          )}
        >
          <form id="role-form" onSubmit={submitRoleChange} className="flex flex-col gap-4 pb-2" noValidate>
            {formError && <ErrorBanner {...formError} />}
            {limit && (
              <LeaderLimitNotice error={limit} audience="office" action="role" asking={asking} onAsk={() => void askApproval()} />
            )}
            <Field label={t.newRole} htmlFor="to-role">
              <Select id="to-role" value={toRole} onChange={(e) => setToRole(e.target.value)}>
                {/* The ladder listed to choose from, so each rung by the ladder's own label (P18.7-T9 AC-1). */}
                <option value="">{t.noChange({ rung: rungLabel(currentRung(member), ladder) })}</option>
                {rungsOffered(member, ladder).map((l) => (
                  <option key={l.code} value={l.code.toLowerCase()}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </Field>

            {/* What the change does — the confirmation's one sentence, the prototype's own words. */}
            {toRole && toRole !== currentRung(member) && (
              <p className="rounded-md border border-hairline bg-base p-3 text-md text-navy">
                {roleChangeExplanation(
                  displayName(member),
                  currentRung(member),
                  toRole,
                  // The office may be acting on somebody who reports to a third
                  // person, so "they keep reporting to you" would be untrue.
                  'the-office',
                  ladder,
                  language,
                )}
              </p>
            )}

            <Field label={t.why} htmlFor="role-reason">
              <TextInput id="role-reason" maxLength={300} value={roleReason} onChange={(e) => setRoleReason(e.target.value)} />
            </Field>
          </form>
        </ResponsiveSheet>
      )}

      {/* *Ganti* on *Melapor ke* (P19.12-T4's picker; ADR-0247 §2): the office moves anybody at once. */}
      {member.canChangeLeader && (
        <LeaderPicker
          open={open === 'leader'}
          membershipId={member.membershipId}
          memberName={displayName(member)}
          downlineCount={member.subtreeCount}
          mode="office"
          onDone={() => { close(); void load(); }}
          onClose={close}
        />
      )}

      {tags && draft && (
        <ResponsiveSheet
          open={open === 'tags'}
          title={t.informalGroups}
          onClose={close}
          footer={(
            <div className="flex justify-end gap-2">
              <Button variant="secondary" disabled={busy} onClick={close}>{t.cancel}</Button>
              <Button disabled={busy} onClick={() => void saveTags()}>{busy ? t.saving : t.saveTags}</Button>
            </div>
          )}
        >
          <div className="pb-2">
            {formError && <ErrorBanner {...formError} />}
            {groups.length === 0 ? (
              <p className="text-md text-muted">
                {t.noGroups({
                  where: (
                    <Link href="/people/members" className="underline">
                      {`${kept('All members')} → ${kept('Groups')}`}
                    </Link>
                  ),
                })}
              </p>
            ) : (
              <fieldset>
                <legend className="text-sm font-semibold text-navy">{t.groups}</legend>
                {groups.map((group) => (
                  <label key={group.groupId} className={cn('mt-1 flex items-center gap-2 text-md text-navy', TAP_BOX)}>
                    <input
                      type="checkbox"
                      checked={draft.groupIds.includes(group.groupId)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          groupIds: e.target.checked
                            ? [...draft.groupIds, group.groupId]
                            : draft.groupIds.filter((id) => id !== group.groupId),
                        })
                      }
                    />
                    {group.name}
                  </label>
                ))}
              </fieldset>
            )}

            {/* A leader's tag (ADR-0159 §1): on a member whose rung leads nobody the box cannot be ticked — the API
                refuses it `CORE_LEADER_NOT_A_LEADER` — and a tag kept from before can still be cleared. Why it is held is
                said only then. */}
            <label className={cn('mt-3 flex items-center gap-2 text-md text-navy', TAP_BOX)}>
              <input
                type="checkbox"
                checked={draft.isCoreLeader}
                disabled={tags.canBeCoreLeader === false && !draft.isCoreLeader}
                aria-describedby={tags.canBeCoreLeader === false ? 'core-leader-hint' : undefined}
                onChange={(e) => setDraft({ ...draft, isCoreLeader: e.target.checked })}
              />
              {kept('Core Leader')}
            </label>
            {tags.canBeCoreLeader === false && (
              <p id="core-leader-hint" className="mt-1 text-sm text-muted">{t.coreLeaderOnlyLeaders}</p>
            )}
          </div>
        </ResponsiveSheet>
      )}

      {member.personal && (
        <MemberPersonalDialog
          open={open === 'complete'}
          member={member}
          onDone={(answer) => {
            setMember((m) => (m ? { ...m, personal: { ...m.personal, ...answer.personal } } : m));
            close();
            show(t.completed);
          }}
          onStale={() => void load()}
          onClose={close}
        />
      )}

      {member.canRemove && (
        <ResponsiveSheet
          open={open === 'remove'}
          title={t.removeName({ name: displayName(member) })}
          // What the removal does — the confirmation's one consequence (P3-T7): nothing is deleted.
          description={t.removeLine}
          onClose={close}
          footer={(
            <div className="flex justify-end gap-2">
              <Button variant="secondary" disabled={busy} onClick={close}>{t.cancel}</Button>
              <Button type="submit" form="remove-form" disabled={busy || !isRemovalConfirmed(removeWord)}>
                {busy ? t.removing : t.removeThem}
              </Button>
            </div>
          )}
        >
          <form id="remove-form" onSubmit={submitRemoval} className="flex flex-col gap-4 pb-2" noValidate>
            {formError && <ErrorBanner {...formError} />}
            {/* AC-3. Removing a leader without saying this would leave their people
                reporting to somebody who has left. */}
            {member.directCount > 0 && (
              <fieldset className="rounded-md border border-hairline p-3">
                <legend className="px-1 text-sm font-semibold text-navy">{t.reportCount({ n: member.directCount })}</legend>
                <p className="text-sm text-muted">{t.sayWhere}</p>
                <label className={cn('mt-2 flex items-center gap-2 text-md text-navy', TAP_BOX)}>
                  <input
                    type="radio"
                    name="disposition"
                    value="reassign"
                    checked={disposition === 'reassign'}
                    onChange={() => setDisposition('reassign')}
                  />
                  {t.moveUp({ to: member.leaderName ?? null })}
                </label>
                <label className={cn('mt-1 flex items-center gap-2 text-md text-navy', TAP_BOX)}>
                  <input
                    type="radio"
                    name="disposition"
                    value="orphan"
                    checked={disposition === 'orphan'}
                    onChange={() => setDisposition('orphan')}
                  />
                  {t.leaveUnassigned}
                </label>
              </fieldset>
            )}

            <Field label={t.why} htmlFor="remove-reason">
              <TextInput id="remove-reason" maxLength={300} value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} />
            </Field>

            <Field label={t.typeToConfirm({ word: REMOVAL_CONFIRMATION })} htmlFor="remove-word">
              <TextInput
                id="remove-word"
                value={removeWord}
                onChange={(e) => setRemoveWord(e.target.value)}
                invalid={removeWord.length > 0 && !isRemovalConfirmed(removeWord)}
              />
            </Field>
          </form>
        </ResponsiveSheet>
      )}
    </Page>
  );
}

/** One line of *Posisi di tim*: the term, what it is, and its control at the end. */
function PositionLine({ term, action, children }: { term: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center gap-3 py-2">
      <dt className="w-28 shrink-0 text-md text-muted lg:w-36">{term}</dt>
      <dd className="flex min-w-0 flex-1 items-center justify-between gap-2 text-md text-navy">
        <span className="min-w-0 break-words">{children}</span>
        {action || null}
      </dd>
    </div>
  );
}

/** *Ubah* or *Ganti*: the word drawn, the whole action named (WCAG 2.5.3: the name starts with the word shown). */
function LineAction({ label, name, onClick }: { label: string; name: string; onClick: () => void }) {
  return (
    <Button variant="secondary" aria-label={name} className="shrink-0" onClick={onClick}>
      {label}
    </Button>
  );
}

/** *Grup informal*: the groups and *Core Leader* as chips, *Tidak ada* when none. A retired group keeps its chip. */
function GroupChips({ tags, groups }: { tags: MemberTags | null; groups: GroupSummary[] }) {
  const t = useMessages(memberMessages);
  if (!tags) return null;
  if (!tags.isCoreLeader && tags.groupIds.length === 0) return <span className="text-muted">{t.noTags}</span>;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {tags.isCoreLeader && (
        <span className="rounded-full bg-primary px-2 py-0.5 text-sm font-semibold text-primary-contrast">{kept('Core Leader')}</span>
      )}
      {tags.groupIds.map((id) => {
        const group = groups.find((g) => g.groupId === id);
        return (
          <span key={id} className="rounded-full border border-hairline px-2 py-0.5 text-sm text-navy">
            {/* A tag on a retired group is kept — it is the record that the cohort existed. */}
            {group ? group.name : t.retiredGroup}
          </span>
        );
      })}
    </span>
  );
}

/**
 * ***Data pribadi***, folded (P19.12-T5 AC-1 to AC-3; ADR-0248 §1–§3): closed by default, its summary counting what the
 * person has not recorded — *3 belum dicatat* — when the read carries it (ADR-0158 §6: the Owner, the Admins, the person).
 * Opened: the name, the email, ***No. WhatsApp*** (a link that opens the chat), the two join dates, the birth date, the
 * gender and the work status — then ***Lengkapi data*** for the blank ones, to a reader who may fill them.
 */
function PersonalData({ member, mayComplete, onComplete }: { member: Member; mayComplete: boolean; onComplete: () => void }) {
  const t = useMessages(memberMessages);
  const figures = useFigureLanguage();
  const language = useLanguage();
  const lines = personalLines(member.personal, language, figures);
  const blank = blankPersonalFields(member.personal);
  const phone = member.personal?.phone ?? null;
  const chat = whatsAppLink(phone);
  return (
    <details className="group mt-4 rounded-lg border border-card-edge bg-card" data-personal-data="">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-4 py-3 [&::-webkit-details-marker]:hidden">
        <h2 className="min-w-0 flex-1 font-display text-lg font-bold text-navy">{t.personalData}</h2>
        {blank.length > 0 && <span className="text-sm text-muted">{t.missing({ n: blank.length })}</span>}
        <LineIcon name="chevronDown" className="h-4 w-4 shrink-0 text-signal-grey group-open:rotate-180" />
      </summary>
      <div className="border-t border-divider px-4 pb-4 pt-3">
        <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-md lg:grid-cols-[12rem_1fr]">
          <Detail term={t.fullName} detail={member.fullName} />
          <Detail term={t.email} detail={member.email} />
          {member.personal && (
            <Detail
              term={t.whatsapp}
              detail={chat
                ? (
                  <a href={chat} target="_blank" rel="noopener noreferrer" className={cn('text-navy underline', TAP_LINE)}>
                    {phone}
                  </a>
                )
                : notRecorded(language)}
            />
          )}
          {/* *Bergabung di AgencyBoost* (OWN UI-025, ADR-0205 §4): the day their leader gave, an office date. */}
          <Detail term={t.joinDate} detail={member.joinDate ? formatCalendarDay(member.joinDate, figures) : '—'} />
          {member.personal && (
            <>
              <Detail term={t.companyJoinMonth({ company: member.personal.companyName ?? null })} detail={lines.companyJoinMonth} />
              <Detail term={t.dateOfBirth} detail={lines.dateOfBirth} />
              <Detail term={t.gender} detail={lines.gender} />
              <Detail term={t.workStatus} detail={lines.workStatus} />
            </>
          )}
        </dl>
        {mayComplete && blank.length > 0 && (
          <Button className="mt-4" onClick={onComplete}>{t.complete}</Button>
        )}
      </div>
    </details>
  );
}

function Detail({ term, detail }: { term: string; detail: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{term}</dt>
      <dd className="break-words text-navy">{detail}</dd>
    </>
  );
}

/** The rung they stand on, by its code lower-cased — the select's own spelling. The class's, for a row read before the field. */
function currentRung(member: Pick<Member, 'orgLevelCode' | 'role'>): string {
  return (member.orgLevelCode ?? member.role).toLowerCase();
}

/**
 * **The rungs the role form offers**, junior first, by the ladder's labels: the server's `roleChoices` when the read
 * carries them (P19.12-T4, ADR-0247 §1 — the one rule the write enforces), else the ladder's active rungs with a senior
 * one only where `canPromoteToAb` says so (OD-50). Never their own rung, which is the *no change* option.
 */
function rungsOffered(member: Member, ladder: ReturnType<typeof useLadder>) {
  const own = currentRung(member);
  const sorted = [...ladder].filter((l) => l.status === 'active').sort((a, b) => a.displayOrder - b.displayOrder);
  if (member.roleChoices) {
    const allowed = new Set(member.roleChoices.map((code) => code.toLowerCase()));
    return sorted.filter((l) => allowed.has(l.code.toLowerCase()) && l.code.toLowerCase() !== own);
  }
  return sorted
    .filter((l) => l.code.toLowerCase() !== own)
    .filter((l) => (classOfRung(l) === 'ab' || member.role === 'ab' ? member.canPromoteToAb : true));
}
