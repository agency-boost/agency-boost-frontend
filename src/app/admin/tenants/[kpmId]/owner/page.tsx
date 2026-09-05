'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { assignOwner, readTenant, type Kpm } from '@/lib/admin';
import { ApiRequestError } from '@/lib/api-client';

export default function AssignOwnerPage({ params }: { params: Promise<{ kpmId: string }> }) {
  const { kpmId } = use(params);
  const router = useRouter();
  const [kpm, setKpm] = useState<Kpm | null>(null);
  const [userId, setUserId] = useState('');
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void readTenant(kpmId).then(setKpm).catch(() => setKpm(null));
  }, [kpmId]);

  const transferring = Boolean(kpm?.ownerUserId);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await assignOwner(kpmId, userId.trim());
      router.push(`/admin/tenants/${kpmId}`);
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.error
          : { code: 'NETWORK', message: 'Could not reach the server.', requestId: 'unknown' },
      );
      setBusy(false);
    }
  }

  return (
    <AdminShell
      title={transferring ? 'Transfer owner' : 'Assign owner'}
      subtitle={kpm ? `${kpm.code} · ${kpm.branchName}` : undefined}
    >
      <Card className="max-w-xl">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <ErrorBanner {...error} />}

          {transferring && (
            <p className="rounded-md border border-hairline bg-base p-3 text-md text-navy">
              The current owner is <code className="text-sm">{kpm?.ownerUserId}</code>. A
              transfer is audited with both the outgoing and incoming person, and takes
              the office&apos;s administration rights away from the outgoing one.
            </p>
          )}

          <Field
            label="User id"
            htmlFor="userId"
            hint="The account must already exist. Register it first, then paste its id here."
          >
            <TextInput
              id="userId"
              required
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              invalid={error?.code === 'NOT_FOUND'}
            />
          </Field>

          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !userId.trim()}>
              {busy ? 'Saving…' : transferring ? 'Transfer' : 'Assign'}
            </Button>
            <Link href={`/admin/tenants/${kpmId}`}>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </AdminShell>
  );
}
