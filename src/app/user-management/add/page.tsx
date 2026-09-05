'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserManagementShell } from '@/components/user-management-shell';
import { CopyableValue } from '@/components/ui/copyable-value';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { StatusPill } from '@/components/ui/status-pill';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  INVITE_STATE_LABEL,
  issueInvite,
  listInvites,
  revokeInvite,
  searchUntagged,
  tagUntagged,
  type Invite,
  type UntaggedMember,
} from '@/lib/join';

/**
 * Add new agents → Invite (`Overall.html:3574-3596`).
 *
 * The prototype shows three tiles — link, leader code, QR — as if they were three
 * things. Its own copy says otherwise: *"any of the three registers your KPM and tags
 * you to them in one step"*. So there is one invite, shown two ways, and withdrawing it
 * withdraws both. The QR is the link rendered, which is a picture of a string we already
 * show; it is not drawn until somebody asks for it rather than shipped as the dead
 * button the prototype has.
 *
 * Anyone who uses one joins **with no approval**, which is why issuing offers a limit
 * and an expiry, and why the list keeps withdrawn ones.
 */
const NEVER = '';

export default function AddAgentsPage() {
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [label, setLabel] = useState('');
  const [maxUses, setMaxUses] = useState(NEVER);
  const [expiresInDays, setExpiresInDays] = useState(NEVER);
  const [untagged, setUntagged] = useState<UntaggedMember[] | null>(null);
  const [pool, setPool] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setInvites(await listInvites());
    } catch (err) {
      setError(toDisplayError(err));
      setInvites([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void searchUntagged(pool || undefined)
      .then(setUntagged)
      .catch((err) => {
        setError(toDisplayError(err));
        setUntagged([]);
      });
  }, [pool]);

  async function add(membershipId: string) {
    setBusy(membershipId);
    setError(null);
    try {
      setUntagged(await tagUntagged(membershipId));
      setConfirming(null);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  }

  async function issue(event: React.FormEvent) {
    event.preventDefault();
    setBusy('issue');
    setError(null);
    try {
      await issueInvite({
        ...(label.trim() ? { label: label.trim() } : {}),
        ...(maxUses ? { maxUses: Number(maxUses) } : {}),
        ...(expiresInDays ? { expiresInDays: Number(expiresInDays) } : {}),
      });
      setLabel('');
      setMaxUses(NEVER);
      setExpiresInDays(NEVER);
      await load();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  }

  async function withdraw(inviteId: string) {
    setBusy(inviteId);
    setError(null);
    try {
      await revokeInvite(inviteId);
      await load();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  }

  const live = invites?.filter((i) => i.state === 'active') ?? [];

  return (
    <UserManagementShell
      title="User management"
      subtitle="Bring people into your unit."
    >
      {error && <ErrorBanner {...error} />}

      <Card className="mb-4">
        <h2 className="font-display text-lg font-bold text-navy">Invite someone</h2>
        <p className="mt-1 text-md text-muted">
          Anyone who uses one of your invites joins this office tagged to you, straight away.
          Nobody approves it — which is why an invite can be limited, given an end date, and
          withdrawn.
        </p>

        <form onSubmit={issue} className="mt-4 flex flex-wrap items-end gap-3">
          <Field
            label="What is it for"
            htmlFor="label"
            hint="A note for you. Whoever uses it never sees this."
            className="min-w-56 flex-1"
          >
            <TextInput
              id="label"
              placeholder="Hiring push, September"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </Field>

          <Field label="How many people" htmlFor="maxUses" className="w-44">
            <Select id="maxUses" value={maxUses} onChange={(e) => setMaxUses(e.target.value)}>
              <option value={NEVER}>No limit</option>
              <option value="1">Just one</option>
              <option value="5">Up to 5</option>
              <option value="25">Up to 25</option>
            </Select>
          </Field>

          <Field label="Stops working" htmlFor="expiresInDays" className="w-44">
            <Select
              id="expiresInDays"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
            >
              <option value={NEVER}>Until I withdraw it</option>
              <option value="1">Tomorrow</option>
              <option value="7">In a week</option>
              <option value="30">In a month</option>
            </Select>
          </Field>

          <Button type="submit" disabled={busy !== null}>
            {busy === 'issue' ? 'Creating…' : 'Create an invite'}
          </Button>
        </form>
      </Card>

      {live.length > 0 && (
        <Card className="mb-4">
          <h2 className="font-display text-lg font-bold text-navy">Share it</h2>
          <p className="mt-1 text-md text-muted">
            The code and the link are the same invite. Withdrawing it stops both.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <CopyableValue label="Leader code" value={live[0].code} mono />
            <CopyableValue label="Invite link" value={live[0].url} />
          </div>
        </Card>
      )}

      <h2 className="mb-3 font-display text-lg font-bold text-navy">Your invites</h2>

      {invites === null && (
        <p role="status" className="text-md text-muted">
          Loading…
        </p>
      )}

      {invites?.length === 0 && (
        <div className="rounded-lg border border-hairline bg-card">
          <EmptyState title="You have not made an invite yet." />
        </div>
      )}

      {invites && invites.length > 0 && (
        <DataTable
          caption="Invites you have issued"
          columns={['Code', 'What for', 'Used', 'Ends', 'State', { label: 'Actions', visuallyHidden: true }]}
        >
          {invites.map((invite) => (
            <Row key={invite.inviteId}>
              <Cell>
                <code className="text-sm font-semibold">{invite.code}</code>
              </Cell>
              <Cell className="text-muted">{invite.label ?? '—'}</Cell>
              <Cell className="text-muted">
                {invite.useCount}
                {invite.maxUses === null ? '' : ` of ${invite.maxUses}`}
              </Cell>
              <Cell className="text-muted">
                {invite.expiresAt
                  ? new Date(invite.expiresAt).toLocaleDateString('en-GB')
                  : 'When you withdraw it'}
              </Cell>
              <Cell>
                <StatusPill
                  status={invite.state === 'active' ? 'success' : 'neutral'}
                  label={INVITE_STATE_LABEL[invite.state]}
                />
              </Cell>
              <Cell>
                {invite.state === 'active' ? (
                  <Button
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => void withdraw(invite.inviteId)}
                  >
                    {busy === invite.inviteId ? 'Withdrawing…' : 'Withdraw'}
                  </Button>
                ) : (
                  // Kept rather than removed: what has been out there is worth seeing,
                  // not only what still works.
                  <span className="text-sm text-muted">—</span>
                )}
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}

      <Card className="mt-6">
        <h2 className="font-display text-lg font-bold text-navy">Find someone already here</h2>
        <p className="mt-1 text-md text-muted">
          People registered in this office who report to nobody. Adding them puts them in your unit
          right away — they do not have to approve it, because the office has already let them in.
        </p>

        <Field label="Search by name" htmlFor="untagged-search" className="mt-3">
          <TextInput
            id="untagged-search"
            placeholder="Name"
            value={pool}
            onChange={(e) => setPool(e.target.value)}
          />
        </Field>

        {untagged === null && (
          <p role="status" className="mt-3 text-md text-muted">
            Loading…
          </p>
        )}

        {untagged?.length === 0 && (
          <EmptyState
            variant={pool ? 'filtered' : 'empty'}
            title={
              pool
                ? 'Nobody untagged matches that name.'
                : 'Everybody in this office already reports to somebody.'
            }
          />
        )}

        <ul className="mt-3 flex flex-col gap-2">
          {untagged?.map((member) => (
            <li
              key={member.membershipId}
              className="flex flex-wrap items-center gap-3 rounded-md border border-hairline p-3"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-md font-bold text-card">
                {member.initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-md font-semibold text-navy">{member.fullName}</span>
                <span className="block text-sm text-muted">
                  {member.agentCode} · reports to nobody
                </span>
              </span>

              {confirming === member.membershipId ? (
                // Inline, as the prototype does it — a modal for one row is heavier than
                // the decision.
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-md text-navy">Add them to your unit?</span>
                  <Button
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => setConfirming(null)}
                  >
                    Cancel
                  </Button>
                  <Button disabled={busy !== null} onClick={() => void add(member.membershipId)}>
                    {busy === member.membershipId ? 'Adding…' : 'Confirm'}
                  </Button>
                </span>
              ) : (
                <Button
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => setConfirming(member.membershipId)}
                >
                  Add to my unit
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </UserManagementShell>
  );
}
