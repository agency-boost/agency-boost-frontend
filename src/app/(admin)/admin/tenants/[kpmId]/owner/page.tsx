'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { Button, ButtonLink, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { useMessages } from '@/i18n/language-provider';
import { adminOfficesMessages } from '@/i18n/messages/admin-offices';
import { assignOwner, readTenant, type TenantRow } from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { LeaderLimitNotice, isLeaderLimit } from '@/components/leader-limit-notice';

export default function AssignOwnerPage({ params }: { params: Promise<{ kpmId: string }> }) {
  const { kpmId } = use(params);
  const router = useRouter();
  const { owner: t, saving, cancel } = useMessages(adminOfficesMessages);
  const [kpm, setKpm] = useState<TenantRow | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
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
    <Page
      title={transferring ? t.transferTitle : t.assignTitle}
      subtitle={kpm ? `${kpm.code} · ${kpm.branchName}` : undefined}
    >
      <Card className="max-w-xl">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {/*
            An unknown address is explained on the field, so the banner would announce
            the same failure a second time — a screen reader reads both. The banner is
            for failures that belong to no single field.
          */}
          {error && !unknownAddress && (isLeaderLimit(error)
            // P13.2-T4 AC-5: a new Owner is made the office's root AB, which its limit counts.
            ? <LeaderLimitNotice error={error} audience="platform" action="owner" />
            : <ErrorBanner {...error} />)}

          {transferring && (
            <p className="rounded-md border border-hairline bg-base p-3 text-md text-navy">
              {t.current({
                name: <strong>{kpm?.ownerName}</strong>,
                email: kpm?.ownerEmail ? ` (${kpm.ownerEmail})` : null,
              })}
            </p>
          )}

          <Field
            label={t.email}
            htmlFor="email"
            hint={t.emailHint}
            error={unknownAddress ? t.unknown : undefined}
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
            {t.noAccount({
              link: (words) => <Link href="/register" className="underline">{words}</Link>,
            })}
          </p>

          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !email.trim()}>
              {busy ? saving : transferring ? t.transfer : t.assign}
            </Button>
            <ButtonLink href={`/admin/tenants/${kpmId}`} variant="secondary">
              {cancel}
            </ButtonLink>
          </div>
        </form>
      </Card>
    </Page>
  );
}
