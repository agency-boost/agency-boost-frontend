'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { Button, ButtonLink, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { useMessages } from '@/i18n/language-provider';
import { adminKpmOwnerMessages } from '@/i18n/messages/admin-kpm-owner';
import { adminOfficesMessages } from '@/i18n/messages/admin-offices';
import {
  assignOwner, readTenant, searchAccounts, type AccountChoice, type AccountOffice, type TenantRow,
} from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { normalisedPhone } from '@/lib/phone-number';
import { LeaderLimitNotice, isLeaderLimit } from '@/components/leader-limit-notice';

/** A whole email address: the fallback the client kept (UI-168 point 2), and what *Kirim undangan* invites. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * *Tetapkan Owner* · *Ganti Owner* (`/admin/tenants/[kpmId]/owner`).
 *
 * **P19-T3 AC-5 (ADR-0191 §5; UI-168 point 2, the client's explicit request).** A searchable picker of existing
 * accounts — name, email, company and the offices each already owns or belongs to — instead of an exact email the
 * owner had to ask for. Typing a whole address still finds it. An account that cannot own this office says why on its
 * row (another company, no agent code, an unverified address — ADR-0190 §4); the server refuses each anyway.
 *
 * **With no account for a typed address, *Jadikan pemilik dan undang*** (P19.4-T3 AC-6; ADR-0212 §2, §3): the person's
 * name, WhatsApp number and agent code beside the address, sent as `owner`; the API makes their account and emails them
 * the one-time link to choose a password. It replaces the `mailto:` *Kirim undangan* (UI-168 point 2) that asked them to
 * register first: the invitation it stood in for now exists (parity I-756). **A KPM's pending Owner** — named with no
 * email at *KPM baru* — is said at the top, and their name, number and code are filled in.
 */
export default function AssignOwnerPage({ params }: { params: Promise<{ kpmId: string }> }) {
  const { kpmId } = use(params);
  const router = useRouter();
  const { owner: t, saving, cancel, office } = useMessages(adminOfficesMessages);
  const o = useMessages(adminKpmOwnerMessages);
  const { show } = useToast();
  /** The person to make for a typed address nobody holds (ADR-0212 §3): filled from a pending Owner when there is one. */
  const [person, setPerson] = useState({ fullName: '', phone: '', agentCode: '' });
  const [sendInvitation, setSendInvitation] = useState(true);
  const [kpm, setKpm] = useState<TenantRow | null>(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<AccountChoice[] | null>(null);
  const [chosen, setChosen] = useState<AccountChoice | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void readTenant(kpmId).then((read) => {
      setKpm(read);
      if (read.pendingOwner) {
        const p = read.pendingOwner;
        setPerson({ fullName: p.fullName, phone: p.phone, agentCode: p.agentCode ?? '' });
      }
    }).catch(() => setKpm(null));
  }, [kpmId]);

  // The search, a moment after the last keystroke, once there are two characters to search by.
  useEffect(() => {
    const term = q.trim();
    setFound(null);
    if (term.length < 2) return;
    let live = true;
    const timer = setTimeout(() => {
      searchAccounts(term)
        .then((rows) => { if (live) setFound(rows); })
        .catch((err) => { if (live) { setFound([]); setError(toDisplayError(err)); } });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [q]);

  const transferring = Boolean(kpm?.ownerUserId);
  const term = q.trim();
  const typedAddress = EMAIL.test(term) ? term.toLowerCase() : null;
  const nobodyAtAddress = typedAddress !== null && found !== null
    && !found.some((a) => a.email.toLowerCase() === typedAddress);

  /** Why this account cannot own this office, or `null` when it can. */
  function blocker(account: AccountChoice): string | null {
    if (account.status === 'deactivated') return t.deactivated;
    if (!account.companyId || !account.hasAgentCode) return t.noCompany;
    if (kpm && account.companyId !== kpm.companyId) return t.otherCompany({ company: account.companyName ?? '—' });
    if (!account.emailVerified) return t.unverified;
    return null;
  }

  function holding(o: AccountOffice): string {
    const named = `${office({ code: o.code, branch: o.branchName })} (${o.companyName})`;
    if (o.isOwner) return t.ownerOf({ office: named });
    return o.membershipStatus === 'pending' ? t.pendingIn({ office: named }) : t.memberOf({ office: named });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      await assignOwner(kpmId, { userId: chosen.userId });
      router.push(`/admin/tenants/${kpmId}`);
    } catch (err) {
      setError(toDisplayError(err));
      setBusy(false);
    }
  }

  const personReady = person.fullName.trim().length >= 2 && normalisedPhone(person.phone) !== null;

  /** *Jadikan pemilik dan undang*: the person named here becomes the Owner, an account made for the address (ADR-0212 §3). */
  async function makeAndInvite() {
    if (!typedAddress || !personReady) return;
    setBusy(true);
    setError(null);
    try {
      const next = await assignOwner(kpmId, {
        owner: {
          fullName: person.fullName.trim(),
          phone: person.phone.trim(),
          email: typedAddress,
          ...(person.agentCode.trim() ? { agentCode: person.agentCode.trim() } : {}),
        },
        sendInvitation,
      });
      // Said only when it went: an account that has signed in already is sent none.
      show(sendInvitation && next.ownerState === 'invited' ? o.newPerson.invited : o.newPerson.set);
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
      <Card className="max-w-2xl">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && (isLeaderLimit(error)
            // P13.2-T4 AC-5: a new Owner is made the office's root AB, which its limit counts.
            ? <LeaderLimitNotice error={error} audience="platform" action="owner" />
            : <ErrorBanner {...error} />)}

          {!transferring && kpm?.pendingOwner && (
            <p className="rounded-md border border-hairline bg-base p-3 text-md text-navy">
              {o.newPerson.pending({ name: kpm.pendingOwner.fullName })}
            </p>
          )}

          {transferring && (
            <p className="rounded-md border border-hairline bg-base p-3 text-md text-navy">
              {t.current({
                name: <strong>{kpm?.ownerName}</strong>,
                email: kpm?.ownerEmail ? ` (${kpm.ownerEmail})` : null,
              })}
            </p>
          )}

          <Field label={t.search} htmlFor="account" hint={t.searchHint}>
            <TextInput
              id="account"
              type="search"
              autoComplete="off"
              value={q}
              onChange={(e) => { setQ(e.target.value); setChosen(null); setError(null); }}
            />
          </Field>

          {found && found.length > 0 && (
            <ul className="flex flex-col gap-2" aria-label={t.search}>
              {found.map((account) => {
                const why = blocker(account);
                const picked = chosen?.userId === account.userId;
                return (
                  <li key={account.userId}>
                    <button
                      type="button"
                      disabled={why !== null}
                      aria-pressed={picked}
                      aria-label={picked ? t.chosen({ name: account.fullName }) : t.choose({ name: account.fullName })}
                      onClick={() => setChosen(account)}
                      className={cn(
                        'w-full rounded-md border p-3 text-left',
                        picked ? 'border-secondary bg-base' : 'border-hairline bg-card',
                        why !== null && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      <span className="block text-md font-semibold text-navy">{account.fullName}</span>
                      <span className="block text-sm text-muted">
                        {account.email}{account.companyName ? ` · ${account.companyName}` : ''}
                      </span>
                      <span className="block text-sm text-muted">
                        {account.offices.length > 0 ? account.offices.map(holding).join(' · ') : t.noOffice}
                      </span>
                      {why && <span className="mt-1 block text-sm text-alert">{why}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {found && found.length === 0 && !nobodyAtAddress && (
            <p className="text-md text-muted">{t.noMatch}</p>
          )}

          {nobodyAtAddress && (
            // ADR-0212 §3: with no account, the person is named here, an account made for the address, and invited.
            <div className="flex flex-col gap-3 rounded-md border border-hairline p-3" data-new-owner="">
              <p className="text-md text-navy">{t.unknown}</p>
              <h2 className="font-display text-md font-bold text-navy">{o.newPerson.heading}</h2>
              <p className="text-sm text-muted">{o.newPerson.line}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label={o.owner.name} htmlFor="newOwnerName" hint={o.owner.required}>
                  <TextInput
                    id="newOwnerName" autoComplete="off" value={person.fullName}
                    onChange={(e) => setPerson({ ...person, fullName: e.target.value })}
                  />
                </Field>
                <Field label={o.owner.phone} htmlFor="newOwnerPhone" hint={o.owner.phoneHint}>
                  <TextInput
                    id="newOwnerPhone" inputMode="tel" autoComplete="off" value={person.phone}
                    onChange={(e) => setPerson({ ...person, phone: e.target.value })}
                  />
                </Field>
                <Field label={o.owner.agentCode} htmlFor="newOwnerCode" hint={o.owner.agentCodeHint}>
                  <TextInput
                    id="newOwnerCode" inputMode="numeric" autoComplete="off" value={person.agentCode}
                    onChange={(e) => setPerson({ ...person, agentCode: e.target.value })}
                  />
                </Field>
              </div>
              <label className="flex items-start gap-2 text-md text-navy">
                <input
                  type="checkbox" className="mt-1" checked={sendInvitation}
                  onChange={(e) => setSendInvitation(e.target.checked)}
                />
                {o.newPerson.send}
              </label>
              <Button
                variant="secondary" className="self-start" disabled={busy || !personReady}
                onClick={() => void makeAndInvite()}
              >
                {busy ? saving : o.newPerson.submit}
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !chosen}>
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
