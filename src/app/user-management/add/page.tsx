'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserManagementShell } from '@/components/user-management-shell';
import { ComingInPhase } from '@/components/coming-in-phase';
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
  type Invite,
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

      <div className="mt-6">
        <ComingInPhase
          phase={3}
          what="Pulling somebody already in this office into your unit, and managing the people already in it."
          elsewhere={[
            {
              href: '/user-management/pending',
              label: 'Pending requests',
              detail: 'Approving people who asked for you — arrives with the same task.',
            },
          ]}
        />
      </div>
    </UserManagementShell>
  );
}
