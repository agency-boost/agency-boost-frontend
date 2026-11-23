'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useState } from 'react';
import { MemberName } from '@/components/admin/member-name';
import { OwnerWhatsAppInviteButton } from '@/components/admin/owner-whatsapp-invite';
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu';
import { Avatar } from '@/components/ui/avatar';
import { Dialog } from '@/components/ui/dialog';
import { Button, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Modal } from '@/components/ui/modal';
import { NavIcon } from '@/components/ui/nav-icon';
import { SkeletonCards } from '@/components/ui/skeleton';
import { Toast, useToast } from '@/components/ui/toast';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { adminConsoleMessages } from '@/i18n/messages/admin-console';
import { kpmOwnersMessages } from '@/i18n/messages/kpm-owners';
import { ownerInviteMessages } from '@/i18n/messages/owner-invite';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import type { ConsoleKpmPeople, ConsolePerson } from '@/lib/admin-console';
import { matchesAgent } from '@/lib/agent-search';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatNumber, formatOfficeMonth, OFFICE_TIME_ZONE } from '@/lib/format';
import { addOwner, removeOwner, type KpmOwnerList, type KpmOwnerView } from '@/lib/kpm-owners';
import { readOrgTree, type HierarchyRole } from '@/lib/org';
import { OwnerInviteBlocked, OwnerInviteNoNumber, openOwnerWhatsAppInvite } from '@/lib/owner-invite';
import { firstNameOf } from '@/lib/people';
import { useCan, useSession } from '@/lib/session';
import { usePhone } from '@/lib/use-phone';

/** The orange label's rung, as `MemberName` reads it: the class upper-cased; an Agent has none. */
const rungOf = (role: HierarchyRole | null) => {
  const cls = role ?? 'agent';
  return { code: cls.toUpperCase(), label: cls.toUpperCase(), class: cls };
};
const asRole = (p: ConsolePerson) => rungOf(p.class);
/** *"… tetap anggota (AAB)."*: the person's class as the KPM names it. */
const roleWord = (role: HierarchyRole | null) => (role && role !== 'agent' ? role.toUpperCase() : 'Agent');

/**
 * ***Owner & admin* on the KPM page** (P19.27-T2; ADR-0285; F-2 of the 21 November brief; the stop motion's section C,
 * screens 6–8): moved here from the page whole, so the page holds one line for it (`KpmOwnerAdminSection`) and the phases
 * that share the page never touch the same lines.
 *
 * - **On a phone** (the mockup's screen 6; UI-214): two cards. ***KPM Owner · n*** with *＋ Tambah owner* — a 52px row per
 *   owner: photo, the orange label + NAME, *Owner sejak <Mon YYYY>*, ⋯ — then ***Admin · n*** (*＋ Tambah admin*; *Belum
 *   ada admin*) and ***Core leader · n*** (*Atur*), each title above its names and each action on the right.
 * - **From 768px** the card as it was — *Owner & admin*, *+ Tambah admin*, the *Admin* and *Core leader* rows — with the
 *   *KPM Owner* row become the same owner list (AC-6). Nothing else on the page moves (AC-4).
 *
 * The section's anchor is `#owners`: the KPM list's *Kelola owner* opens it (T3 AC-4).
 */
export function KpmOwnerAdminSection({ people, onChanged }: { people: ConsoleKpmPeople; onChanged: () => void }) {
  const t = useMessages(adminConsoleMessages).inside;
  const o = useMessages(kpmOwnersMessages);
  const fig = useFigureLanguage();
  const phone = usePhone();
  const n = (v: number) => formatNumber(v, {}, fig);
  const kpmId = people.kpm.kpmId;
  // The owner named with no email, waiting (ADR-0212 §3), while the KPM has no owner: named, with *Kirim undangan*.
  const pending = people.owners.owners.length === 0 && people.owner.pendingName
    ? { name: people.owner.pendingName, invited: people.owner.state === 'invited' }
    : null;
  const owners = <KpmOwnersList list={people.owners} kpmId={kpmId} pending={pending} onChanged={onChanged} />;
  // *Kelola owner* on the KPM list lands here (`#owners`): the section comes into view once the page has drawn it.
  useEffect(() => {
    if (window.location.hash === '#owners') document.getElementById('owners')?.scrollIntoView?.({ block: 'start' });
  }, [phone]);
  const names = (list: ConsolePerson[], none: string) => (list.length === 0
    ? <span className="text-base text-muted">{none}</span>
    : list.map((p) => <MemberName key={p.membershipId} name={p.fullName} role={asRole(p)} className="flex text-base" />));

  if (phone) {
    const heading = (title: string, action: { href: string; label: string; icon?: boolean }) => (
      <div className="flex min-h-11 items-center justify-between gap-2">
        <h2 className="text-row font-bold text-navy">{title}</h2>
        <Link href={action.href} className="inline-flex min-h-11 items-center gap-1 text-base font-semibold text-primary-ink">
          {action.icon && <LineIcon name="plus" className="h-[18px] w-[18px]" />}
          {action.label}
          {!action.icon && <LineIcon name="chevronRight" className="h-[18px] w-[18px]" />}
        </Link>
      </div>
    );
    return (
      <>
        <section id="owners" aria-label={o.title({ n: n(people.owners.owners.length) })} className="scroll-mt-4 rounded-xl bg-card px-3.5 py-2" data-owners-card="">
          {owners}
        </section>
        <section aria-label={t.owners} className="rounded-xl bg-card px-3.5 py-2" data-admins-card="">
          {heading(o.admins({ n: n(people.admins.length) }), { href: '/people/admins', label: t.addAdmin, icon: true })}
          <div className="flex min-h-11 flex-col justify-center gap-1 border-b border-divider pb-1">{names(people.admins, o.noAdmins)}</div>
          {heading(o.core({ n: n(people.coreLeaders.length) }), { href: '/people/admins', label: t.manage })}
          {people.coreLeaders.length > 0 && <div className="flex min-h-11 flex-col justify-center gap-1">{names(people.coreLeaders, t.noneYet)}</div>}
        </section>
      </>
    );
  }

  const row = (role: string, who: React.ReactNode, action: { href: string; label: string }) => (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-start gap-2 border-b border-divider py-2.5 last:border-b-0">
      <span className="text-sm text-muted">{role}</span>
      <span className="flex min-w-0 flex-col gap-1 text-sm">{who}</span>
      <Link href={action.href} className="inline-flex min-h-10 items-center text-sm font-bold text-primary-ink">{action.label}</Link>
    </div>
  );
  return (
    <section id="owners" aria-labelledby="owners-heading" className="scroll-mt-4 rounded-xl bg-card p-4" data-owners-card="">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 id="owners-heading" className="text-md font-bold text-navy">{t.owners}</h2>
        <Link href="/people/admins" className="inline-flex h-10 items-center gap-1.5 rounded-pill border border-hairline px-3.5 text-sm font-semibold text-navy">
          <NavIcon name="ti-plus" className="h-4 w-4" />
          {t.addAdmin}
        </Link>
      </div>
      <div className="border-b border-divider pb-1">{owners}</div>
      {row(t.adminRole, names(people.admins, t.noneYet), { href: '/people/admins', label: t.change })}
      {row(t.coreRole, names(people.coreLeaders, t.noneYet), { href: '/people/admins', label: t.manage })}
    </section>
  );
}

/**
 * ***KPM Owner · n*** (P19.27-T2 AC-1 to AC-5, T4 AC-1; ADR-0285): the KPM's owners in order of `since`, the title with
 * *＋ Tambah owner*, one row each with its ⋯ — *Lihat profil*, *Kirim ulang undangan* while invited (the Super Admin's,
 * `kpm:assign_owner`), *Hapus sebagai owner* in red. Asked before it is done; greyed out on the last owner with *"Tambah
 * owner lain dulu"*; never on the reader's own row. The controls follow `canManage`, the server's answer — an Admin reads
 * the list alone, and the API refuses them besides (`PERM_OWNER_ONLY`). Used by the KPM page and by People › *KPM admins*.
 */
export function KpmOwnersList({
  list, kpmId, pending = null, onChanged, className,
}: {
  list: KpmOwnerList;
  /** The owner named with no email who waits, on a KPM with no owner yet (the Super Admin's KPM page). */
  pending?: { name: string; invited: boolean } | null;
  /** The KPM, for the Super Admin's *Kirim ulang undangan*; the reader's own KPM on People › *KPM admins*. */
  kpmId: string | null;
  onChanged: () => void;
  className?: string;
}) {
  const o = useMessages(kpmOwnersMessages);
  const invite = useMessages(ownerInviteMessages);
  const fig = useFigureLanguage();
  const router = useRouter();
  const { me } = useSession();
  const mayInvite = useCan('kpm:assign_owner');
  const { toast, show } = useToast();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<KpmOwnerView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const owners = list.owners;
  const last = owners.length <= 1;

  async function remove(owner: KpmOwnerView) {
    if (!owner.membershipId) return;
    setBusy(true);
    setError(null);
    try {
      await removeOwner(owner.membershipId);
      setRemoving(null);
      onChanged();
    } catch (err) {
      setRemoving(null);
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  async function resend(owner: KpmOwnerView) {
    if (!kpmId) return;
    setError(null);
    try {
      const sent = await openOwnerWhatsAppInvite(kpmId, owner.userId);
      show(invite.sent({ name: sent.ownerName }));
      onChanged();
    } catch (err) {
      const message = err instanceof OwnerInviteBlocked ? invite.blocked
        : err instanceof OwnerInviteNoNumber ? invite.noNumber({ name: err.ownerName })
          : null;
      setError(message ? { code: 'OWNER_INVITE', message, requestId: '' } : toDisplayError(err));
    }
  }

  const menuOf = (owner: KpmOwnerView): ActionMenuItem[] => [
    ...(owner.membershipId ? [{ label: o.menu.profile, onSelect: () => router.push(`/people/members/${encodeURIComponent(owner.membershipId!)}`) }] : []),
    ...(mayInvite && kpmId && owner.state !== 'active'
      ? [{ label: owner.state === 'invited' ? o.menu.resend : o.menu.invite, onSelect: () => void resend(owner) }]
      : []),
    ...(list.canManage && owner.userId !== me?.user.id && owner.membershipId
      ? [{
        label: o.menu.remove, tone: 'alert' as const, danger: true, disabled: last, reason: last ? o.menu.lastOne : undefined,
        onSelect: () => setRemoving(owner),
      }]
      : []),
  ];

  return (
    <div className={className} data-kpm-owners="">
      <div className="flex min-h-11 items-center justify-between gap-2">
        <h2 className="text-row font-bold text-navy md:text-md">{o.title({ n: formatNumber(owners.length, {}, fig) })}</h2>
        {list.canManage && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex min-h-11 items-center gap-1 text-base font-semibold text-primary-ink md:text-sm"
            data-add-owner=""
          >
            <LineIcon name="plus" className="h-[18px] w-[18px]" />
            {o.add}
          </button>
        )}
      </div>
      {error && <div className="mb-2"><ErrorBanner {...error} /></div>}
      {owners.length === 0 && pending ? (
        <div className="flex min-h-[52px] flex-wrap items-center gap-2.5 py-1.5" data-pending-owner="">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-bold uppercase text-ink">{pending.name}</span>
            <span className="block text-base text-muted">{pending.invited ? o.invited : o.notInvited}</span>
          </span>
          {mayInvite && kpmId && <OwnerWhatsAppInviteButton kpmId={kpmId} ownerName={pending.name} variant="outline" onSent={onChanged} />}
        </div>
      ) : owners.length === 0 ? (
        <p className="flex min-h-11 items-center text-base text-muted">{o.none}</p>
      ) : (
        <ul>
          {owners.map((owner) => {
            const items = menuOf(owner);
            return (
              <li key={owner.userId} className="flex min-h-[52px] items-center gap-2.5 border-b border-divider py-1.5 last:border-b-0" data-owner-row={owner.userId}>
                <Avatar name={owner.fullName} photoUrl={owner.photoUrl} seed={owner.userId} size={36} />
                <span className="min-w-0 flex-1">
                  <MemberName name={owner.fullName} role={rungOf(owner.role)} className="flex text-base" />
                  <span className="block truncate text-base text-muted">
                    {[
                      o.since({ month: formatOfficeMonth(owner.since, OFFICE_TIME_ZONE, fig) }),
                      owner.state === 'invited' ? o.invited : owner.state === 'not_invited' ? o.notInvited : null,
                    ].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {items.length > 0 && (
                  <ActionMenu
                    label={o.actionsFor({ name: owner.fullName })}
                    items={items}
                    glyph={<LineIcon name="more" className="h-5 w-5" />}
                    triggerClassName="h-11 w-11 shrink-0"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Dialog
        open={removing !== null}
        message={removing ? o.confirm.question({ name: firstNameOf(removing.fullName) }) : ''}
        detail={removing ? o.confirm.line({ name: firstNameOf(removing.fullName), role: roleWord(removing.role) }) : undefined}
        confirmLabel={o.confirm.remove}
        cancelLabel={o.confirm.cancel}
        tone="dangerFill"
        onConfirm={() => { if (removing && !busy) void remove(removing); }}
        onCancel={() => setRemoving(null)}
      />
      {adding && (
        <AddOwnerSheet
          owners={owners}
          onClose={() => setAdding(false)}
          onAdded={(name) => {
            setAdding(false);
            show(o.sheet.done({ name }));
            onChanged();
          }}
        />
      )}
      <Toast toast={toast} />
    </div>
  );
}

/** One member *Tambah owner* offers. */
interface Candidate {
  membershipId: string;
  fullName: string;
  preferredName: string | null;
  agentCode: string;
  role: HierarchyRole;
  photoUrl?: string | null;
}

/**
 * ***Tambah owner*** (P19.27-T2 AC-2; the mockup's screen 7; stop motion C frames 2–3): search this KPM's members — the
 * owners left out — one radio row each, and *Jadikan owner* pinned at the foot. Nothing else: a person who is not a member
 * yet becomes an owner through *Tambah user* with *Jadikan KPM Owner* on. **A bottom sheet on a phone, a centred dialog
 * from 768px** (AC-6). The members are the KPM's tree (`GET /members/tree?view=kpm`): active, test accounts left out by the
 * server.
 */
function AddOwnerSheet({
  owners, onClose, onAdded,
}: {
  owners: readonly KpmOwnerView[];
  onClose: () => void;
  onAdded: (name: string) => void;
}) {
  const o = useMessages(kpmOwnersMessages);
  const ui = useMessages(uiV1Messages);
  const phone = usePhone();
  const radio = useId();
  const searchId = useId();
  const [people, setPeople] = useState<Candidate[] | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Once, as the sheet opens: the KPM's members, the owners left out.
  useEffect(() => {
    let live = true;
    const owned = new Set(owners.map((w) => w.membershipId));
    readOrgTree(undefined, 'kpm')
      .then((tree) => live && setPeople(tree.nodes
        .filter((node) => !owned.has(node.membershipId))
        .map((node) => ({
          membershipId: node.membershipId, fullName: node.fullName, preferredName: node.preferredName,
          agentCode: node.agentCode, role: node.role, photoUrl: node.photoUrl,
        }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName))))
      .catch((err) => {
        if (!live) return;
        setError(toDisplayError(err));
        setPeople([]);
      });
    return () => { live = false; };
    // The owners as the sheet opened: a sheet open is one read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(() => (people ?? []).filter((p) => !query.trim()
    || matchesAgent(query, { fullName: p.fullName, preferredName: p.preferredName, agentCode: p.agentCode })), [people, query]);

  async function save() {
    const person = people?.find((p) => p.membershipId === picked);
    if (!person) return;
    setBusy(true);
    setError(null);
    try {
      await addOwner(person.membershipId);
      onAdded(person.fullName);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={o.sheet.title}
      onClose={onClose}
      placement={phone ? 'sheet' : 'center'}
      handle={phone}
      closeLabel={ui.close}
      className="md:max-w-[32rem]"
      footer={(
        <Button className="min-h-11 w-full rounded-pill text-row font-bold md:text-md" disabled={busy || picked === null} onClick={() => void save()} data-make-owner="">
          {busy ? o.sheet.busy : o.sheet.action}
        </Button>
      )}
    >
      {error && <div className="mb-2"><ErrorBanner {...error} /></div>}
      <label htmlFor={searchId} className="mb-2 flex h-11 items-center gap-2 rounded-pill border border-hairline bg-base px-3.5 text-muted focus-within:outline focus-within:outline-2 focus-within:outline-focus-ring">
        <LineIcon name="search" className="h-[18px] w-[18px]" />
        <span className="sr-only">{o.sheet.search}</span>
        <input
          id={searchId}
          type="search"
          value={query}
          placeholder={o.sheet.search}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[1rem] text-ink placeholder:text-muted focus:outline-none md:text-md"
        />
      </label>
      {people === null ? (
        <SkeletonCards count={2} label={o.sheet.loading} />
      ) : shown.length === 0 ? (
        <p role="status" className="py-4 text-center text-row text-muted md:text-md">{o.sheet.empty}</p>
      ) : (
        <fieldset className="flex flex-col gap-2 pb-1">
          <legend className="sr-only">{o.sheet.title}</legend>
          {shown.map((p) => (
            <label
              key={p.membershipId}
              className={cn(
                'flex min-h-14 cursor-pointer items-center gap-2.5 rounded-row border px-3 py-1.5',
                picked === p.membershipId ? 'border-primary bg-primary-50' : 'border-hairline bg-card hover:bg-hover-row',
              )}
            >
              <input
                type="radio"
                name={radio}
                value={p.membershipId}
                checked={picked === p.membershipId}
                onChange={() => setPicked(p.membershipId)}
                className="h-5 w-5 shrink-0 accent-primary"
              />
              <Avatar name={p.fullName} photoUrl={p.photoUrl} seed={p.membershipId} size={36} />
              <MemberName name={p.preferredName?.trim() || p.fullName} role={rungOf(p.role)} className="flex-1 text-row md:text-md" />
            </label>
          ))}
        </fieldset>
      )}
    </Modal>
  );
}
