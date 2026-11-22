'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Page } from '@/components/page';
import { PeoplePicker, type PickerPerson } from '@/components/people/people-picker';
import { PersonName } from '@/components/people/people-parts';
import { Avatar } from '@/components/ui/avatar';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner } from '@/components/ui/field';
import { KpmOwnersList } from '@/components/admin/kpm-owner-admin-section';
import { LineIcon } from '@/components/ui/line-icon';
import { REMOVED_ON_PHONE } from '@/components/ui/phone';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import type { NavIconName } from '@/components/ui/nav-icon';
import { rungShort, useLadder } from '@/components/ui/role-badge';
import { SkeletonCards } from '@/components/ui/skeleton';
import { kept } from '@/i18n/kept';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { adminsMessages } from '@/i18n/messages/admins';
import { kpmOwnersMessages } from '@/i18n/messages/kpm-owners';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatOfficeMonth, OFFICE_TIME_ZONE } from '@/lib/format';
import { grantAdmin, listAdmins, readOrgTree, revokeAdmin, type DelegatedAdmin } from '@/lib/org';
import { firstNameOf, readStewards, type KpmStewards } from '@/lib/people';
import { useCan, useSession } from '@/lib/session';
import { enteredKpmId } from '@/lib/super-admin-kpm';
import { usePhone } from '@/lib/use-phone';

/** A delegated admin, with their photo (P19.20-T4 AC-2). */
type AdminRow = DelegatedAdmin & { photoUrl?: string | null };

/**
 * **KPM admins** (P19.20-T4; ADR-0273 §5; the People mockup's frames 26–28) — who can do what, and who administers the KPM.
 *
 * - **Three tiles** (AC-1): *KPM Owner* (*semua, termasuk tambah / cabut admin*, and who it is), *Admin* (*sama seperti
 *   owner, kecuali tambah / cabut admin*, *n orang*), *Core leader* (*KPM + Pengaturan seperti owner; People hanya
 *   timnya*, *n orang · atur di All members*) — `GET /people/stewards`. The Super Admin is never among them.
 * - ***Admin KPM*** (AC-2): photo, the AB / AAB label and the NAME, *"kode · admin sejak … · diberikan oleh …"*, and a
 *   red-outline *Cabut* that asks once — *"Cabut akses admin …? … tetap anggota KPM, hanya akses admin yang dicabut."* —
 *   red filled. ***+ Tambah admin*** opens the people picker (search, photos, labels; the KPM's tree, so test accounts
 *   never reach it) → *Jadikan admin*.
 * - **Admins read it; only the Owner and the Super Admin inside the KPM add and revoke** (AC-3; ADR-0268 §2): without
 *   `kpm_admin:grant` neither control is drawn, and the API refuses both `PERM_OWNER_ONLY` regardless.
 */
export default function AdminsPage() {
  const t = useMessages(adminsMessages);
  const o = useMessages(kpmOwnersMessages);
  const { me } = useSession();
  const figures = useFigureLanguage();
  const ladder = useLadder();
  const manages = useCan('kpm_admin:grant');
  const phone = usePhone();
  const [admins, setAdmins] = useState<AdminRow[] | null>(null);
  const [stewards, setStewards] = useState<KpmStewards | null>(null);
  const [candidates, setCandidates] = useState<PickerPerson[]>([]);
  const [picking, setPicking] = useState(false);
  const [revoking, setRevoking] = useState<AdminRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [delegated, tiles] = await Promise.all([listAdmins(), readStewards()]);
      if (!mounted.current) return;
      setAdmins(delegated);
      setStewards(tiles);
    } catch (err) {
      if (!mounted.current) return;
      setError(toDisplayError(err));
      setAdmins([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function openPicker() {
    setPicking(true);
    try {
      // The KPM's active members, test accounts left out by the server; never the reader, nobody already an admin.
      const tree = await readOrgTree(undefined, 'kpm');
      const already = new Set((admins ?? []).map((a) => a.membershipId));
      setCandidates(tree.nodes
        // Never an owner (ADR-0285: any of them) — an owner's rights are the KPM's own, not a grant.
        .filter((n) => !n.isSelf && !already.has(n.membershipId) && !(stewards?.owners ?? []).some((w) => w.membershipId === n.membershipId)
          && n.membershipId !== stewards?.owner?.membershipId)
        .map((n) => ({ membershipId: n.membershipId, fullName: n.fullName, preferredName: n.preferredName, agentCode: n.agentCode, role: n.role, photoUrl: n.photoUrl }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName)));
    } catch (err) {
      setError(toDisplayError(err));
    }
  }

  async function act(write: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await write();
      setPicking(false);
      setRevoking(null);
      await load();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title={kept('KPM admins')} permission="kpm_admin:list">
      {error && !picking && <div className="mb-3"><ErrorBanner {...error} /></div>}

      <div className="mb-5 grid gap-2 md:grid-cols-3">
        {/*
          * No name at the tile's foot: *KPM Owner · n* below names every owner, and the tile named the first a second time
          * (the integration round's walk, 2026-11-22; F-2 keeps the list). The tile keeps its title and what an owner may do.
          */}
        <Tile icon="building" title={t.tiles.owner} line={t.tiles.ownerLine} about={o.about} foot={null} />
        <Tile icon="shield" title={t.tiles.admin} line={t.tiles.adminLine} about={o.about}
          foot={stewards ? t.tiles.people({ n: stewards.admins }) : null} />
        <Tile icon="star" title={t.tiles.core} line={t.tiles.coreLine} about={o.about}
          foot={stewards ? `${t.tiles.people({ n: stewards.coreLeaders })} · ${t.tiles.coreWhere}` : null} />
      </div>

      {/*
        * ***KPM Owner · n*** (P19.27-T4 AC-1; ADR-0285): every owner, the same list as the KPM page's. An owner adds and
        * removes the others, never the last and never themselves; an Admin reads it without the controls, and the API
        * refuses them besides (`PERM_OWNER_ONLY`).
        */}
      {stewards && (
        <section aria-label={o.title({ n: String(stewards.owners.length) })} className="mb-5 rounded-lg bg-card px-4 py-2" data-owners-card="">
          <KpmOwnersList
            list={{ owners: stewards.owners, canManage: stewards.canManageOwners }}
            kpmId={me?.membership?.kpmId ?? enteredKpmId()}
            onChanged={() => void load()}
          />
        </section>
      )}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-md font-bold text-navy">{t.listTitle}</h2>
        {manages && (
          <Button className="min-h-11 rounded-pill" onClick={() => void openPicker()}>
            <LineIcon name="userPlus" className="h-4 w-4" />{t.add}
          </Button>
        )}
      </div>

      {admins === null && !error && <SkeletonCards count={2} label={t.loading} />}
      {admins?.length === 0 && !error && (
        // On a phone *Belum ada admin* alone (mockup screen 6; UI-213 (21 Nov)): who looks after the KPM then is the tile's ⓘ.
        <div className="rounded-lg border border-card-edge bg-card"><EmptyState title={phone ? o.noAdmins : t.empty} /></div>
      )}
      {admins && admins.length > 0 && (
        <ul aria-label={t.caption} className="flex flex-col gap-2">
          {admins.map((admin) => (
            <li key={admin.membershipId} data-row={admin.membershipId}
              className="flex items-center gap-3 rounded-lg bg-card px-4 py-3">
              <Avatar name={admin.fullName} photoUrl={admin.photoUrl} seed={admin.membershipId} size={36} />
              <div className="min-w-0 flex-1">
                <PersonName name={admin.fullName} role={admin.role} className="text-md" />
                <p className="truncate text-sm text-muted">
                  {t.line({
                    code: admin.agentCode,
                    since: admin.grantedAt ? formatOfficeMonth(admin.grantedAt, OFFICE_TIME_ZONE, figures) : null,
                    by: admin.grantedByName?.toUpperCase() ?? null,
                  })}
                </p>
              </div>
              {manages && admin.canRevoke && (
                <Button variant="danger" className="min-h-11 shrink-0 rounded-pill" disabled={busy}
                  aria-label={t.revokeWhose({ name: admin.fullName })} onClick={() => setRevoking(admin)}>
                  {t.revoke}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-sm text-muted">
        {!manages && <>{t.readOnly}<span className={REMOVED_ON_PHONE}> · </span></>}
        {/* Not on a phone (P19.27-T4 AC-2; UI-213 (21 Nov)). */}
        <span className={REMOVED_ON_PHONE}>{t.coreNote}</span>
      </p>

      {picking && (
        <PeoplePicker
          title={t.pickTitle}
          people={candidates}
          actionLabel={t.pickAction}
          busyLabel={t.picking}
          note={t.pickNote}
          busy={busy}
          error={error}
          onPick={(id) => void act(() => grantAdmin(id))}
          onClose={() => { setPicking(false); setError(null); }}
        />
      )}
      <Dialog
        open={revoking !== null}
        message={revoking ? t.revokeQuestion({ name: revoking.fullName.toUpperCase() }) : ''}
        detail={revoking ? t.revokeLine({ first: firstNameOf(revoking.fullName), role: rungShort(revoking.role.toUpperCase(), ladder) }) : undefined}
        confirmLabel={t.revoke}
        tone="dangerFill"
        onConfirm={() => { if (revoking) void act(() => revokeAdmin(revoking.membershipId)); }}
        onCancel={() => setRevoking(null)}
      />
    </Page>
  );
}

/**
 * One of the three tiles: its icon, who, what they may do, and the line at its foot. *On a phone the description is
 * behind ⓘ beside the title* (P19.27-T4 AC-2; UI-213 (21 Nov)); from 768px it reads under the title as before.
 */
function Tile({ icon, title, line, foot, about }: { icon: NavIconName; title: string; line: string; foot: React.ReactNode; about: string }) {
  return (
    <div className="flex gap-3 rounded-lg bg-card p-4">
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-base text-navy')}>
        <LineIcon name={icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h2 className="flex items-center gap-1 text-md font-bold text-navy">
          {title}
          <TippedGlyph
            glyph={<LineIcon name="info" className="h-[18px] w-[18px]" />}
            name={`${about}: ${title}`}
            tip={line}
            align="fit"
            className="md:hidden"
          />
        </h2>
        <p className={cn('text-sm text-muted', REMOVED_ON_PHONE)}>{line}</p>
        {foot && <p className="mt-1 text-sm font-bold text-navy">{foot}</p>}
      </div>
    </div>
  );
}
