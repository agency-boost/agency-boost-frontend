'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { assignOwner, readTenant, type Kpm } from '@/lib/admin';
import { toDisplayError } from '@/lib/api-client';

export default function AssignOwnerPage({ params }: { params: Promise<{ kpmId: string }> }) {
  const { kpmId } = use(params);
  const router = useRouter();
  const [kpm, setKpm] = useState<Kpm | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void readTenant(kpmId).then(setKpm).catch(() => setKpm(null));
  }, [kpmId]);

  const transferring = Boolean(kpm?.ownerUserId);
  const unknownAddress = error?.code === 'NOT_FOUND';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await assignOwner(kpmId, { email: email.trim() });
      router.push(`/admin/tenants/${kpmId}`);
    } catch (err) {
      setError(toDisplayError(err));
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
          {/*
            An unknown address is explained on the field, so the banner would announce
            the same failure a second time — a screen reader reads both. The banner is
            for failures that belong to no single field.
          */}
          {error && !unknownAddress && <ErrorBanner {...error} />}

          {transferring && (
            <p className="rounded-md border border-hairline bg-base p-3 text-md text-navy">
              The current owner is <code className="text-sm">{kpm?.ownerUserId}</code>. A
              transfer is audited with both the outgoing and incoming person, and takes
              the office&apos;s administration rights away from the outgoing one.
            </p>
          )}

          <Field
            label="Email"
            htmlFor="email"
            hint="The account must already exist. If it does not, send them to Create an account first."
            error={unknownAddress ? 'No account uses that address.' : undefined}
          >
            <TextInput
              id="email"
              type="email"
              autoComplete="off"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              invalid={unknownAddress}
            />
          </Field>

          <p className="text-sm text-muted">
            No account yet?{' '}
            <Link href="/register" className="underline">
              Create one
            </Link>{' '}
            — the office cannot be owned by someone who has not registered.
          </p>

          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !email.trim()}>
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
