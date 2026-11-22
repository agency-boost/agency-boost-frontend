'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { ErrorBanner, Switch } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Modal } from '@/components/ui/modal';
import { NavIcon } from '@/components/ui/nav-icon';
import { PhoneField } from '@/components/ui/phone-field';
import { PickerMenu } from '@/components/ui/picker-menu';
import { shortOfRung } from '@/components/ui/role-badge';
import { useMessages } from '@/i18n/language-provider';
import { addUserMessages, type AddUserWords } from '@/i18n/messages/add-user';
import type { MessagesOf } from '@/i18n/catalogue';
import {
  addUser, placeUser, readAddUserOptions, type AddUserOptions, type LeaderChoice, type PlacedKpm,
} from '@/lib/add-user';
import { insurersOf, listCompanies, listTenants, type TenantListRow } from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { nationalDigits, normalisedPhone } from '@/lib/phone-number';
import { useCan } from '@/lib/session';
import { useMediaQuery } from '@/lib/use-media-query';

/** A KPM as the sheet names it. */
export interface SheetKpm {
  id: string;
  branch: string;
  code: string;
  companyName: string;
  companyId?: string;
}

/** Somebody *Masukkan* places: an account that exists and is in no KPM. */
export interface SheetPerson {
  userId: string;
  fullName: string;
  email: string | null;
  avatarUrl?: string | null;
  /** The KPM they registered to, which the sheet prefills (OD-441), or `null`. */
  kpm?: { id: string; branch: string; code: string } | null;
  /** The insurer they registered with: the KPMs and the new KPM's company are that company's. */
  companyId?: string | null;
  /** The row's `hasPhone`: WhatsApp's window is opened in the tap only when there is a number to write to. */
  hasPhone?: boolean;
}

/** What the sheet tells its caller once it saved, for the toast and the list read again. */
export interface AddUserDone {
  kind: 'invited' | 'placed';
  fullName: string;
  kpm: PlacedKpm;
  whatsAppOpened: boolean;
}

type Chosen = { kind: 'kpm'; kpm: SheetKpm } | { kind: 'new' } | null;
type Words = MessagesOf<AddUserWords>;

/*
 * **The sheet's own type scale** (P19.28-T2 AC-7; ADR-0283 §4; `tokens.md`, *The phone type scale*): title 18/800 ·
 * field label 13/600 · field value 16/500 · name 15/700 caps · meta 13/400 grey · chips 14/600 · main button 15/700 ·
 * initials 12/700. Written once, here, and nowhere else in the sheet.
 */
const LABEL = 'mb-1.5 mt-3.5 block text-base font-semibold text-ink first:mt-1';
const VALUE = 'text-lg font-medium';
const META = 'text-base text-muted';
const NAME = 'text-row font-bold uppercase text-ink';
const FIELD = 'flex min-h-12 w-full items-center justify-between gap-2 rounded-pill border border-hairline bg-base px-4 text-left';
/** The sheet's title, 18/800, through the dialog's own heading (`Modal` draws it). */
const TITLE = '[&_[data-modal-head]_h2]:text-xl [&_[data-modal-head]_h2]:font-extrabold [&_[data-modal-head]_h2]:text-ink';

/**
 * ***Tambah user* · *Masukkan ke KPM*** (P19.28-T2; ADR-0286; F-1 (21 Nov); stop motion A frames 1–8, B frames 1–7;
 * side-by-side screens 2, 4, 4b, 4c): **one shared sheet**, opened from Anggota's floating *＋ Tambah user*, a KPM page's
 * *Anggota* card and *All members*' *Undang anggota* (the KPM fixed), and as *Masukkan ke KPM* from a *Belum ada KPM* row.
 *
 * - **Fields in order**: *Nama lengkap* · *Nomor WhatsApp* (`+62` fixed, the numeric keypad) · *Email · opsional* · *KPM*
 *   · *Peran* chips (the selected one navy) · *Leader*, hidden for the senior rung, its list opening right under the field
 *   · *Jadikan KPM Owner*, off. Pinned *Tambah & kirim undangan WhatsApp*. *Masukkan* is the same without name and phone:
 *   the person as NAME and email, the KPM prefilled when it is known (OD-441), *Masukkan ke <KPM>*.
 * - ***Pilih KPM* replaces the content** (‹ back), never a second sheet: search by name or code, *＋ KPM baru* first.
 * - ***＋ KPM baru***: an orange-outlined box *KPM baru · Ganti* holding *Nama KPM* and *Perusahaan*, *Peran* set to the
 *   senior rung, no *Leader*, the owner switch a fixed row *KPM Owner · Owner pertama KPM ini · Ya*, and *Buat KPM &
 *   jadikan owner*.
 * - **Below 768px a bottom sheet; from 768px the same fields in a centred dialog** (AC-8).
 * - **Saving** opens the reader's own WhatsApp with the link or the notice (OD-359, OD-442), in a window opened inside the
 *   press; the caller shows the toast *"<Nama> ditambahkan ke <KPM> · Lihat"*. The server refuses whatever this does not:
 *   an Owner or a KPM Admin outside their KPM, a KPM Admin's owner switch, anybody's *KPM baru* but the Super Admin's.
 */
export function AddUserSheet({
  mode = 'add',
  fixedKpm,
  own = false,
  person,
  onClose,
  onDone,
}: {
  mode?: 'add' | 'place';
  fixedKpm?: SheetKpm | null;
  /**
   * **The reader's own KPM, fixed** (UI-203 (21 Nov), *All members*' *Undang anggota*): an Owner's, an Admin's, or the
   * one the Super Admin works inside — the server names it (`GET /user-invitations/options` with no KPM), and the save
   * names none either: it lands where the reader is.
   */
  own?: boolean;
  person?: SheetPerson | null;
  onClose: () => void;
  onDone: (done: AddUserDone) => void;
}) {
  const t = useMessages(addUserMessages);
  const phone = useMediaQuery('phone', { beforePaint: true });
  const canMakeKpm = useCan('kpm:create') && !fixedKpm && !own;
  const formId = useId();
  const ids = {
    name: useId(), phone: useId(), email: useId(), kpm: useId(), role: useId(), leader: useId(), owner: useId(),
    kpmName: useId(), company: useId(), search: useId(),
  };
  const searchRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<'form' | 'pick'>('form');
  const [fullName, setFullName] = useState('');
  const [typedPhone, setTypedPhone] = useState('');
  const [email, setEmail] = useState('');
  const [chosen, setChosen] = useState<Chosen>(fixedKpm ? { kind: 'kpm', kpm: fixedKpm } : null);
  const [newName, setNewName] = useState('');
  const [newCompany, setNewCompany] = useState(person?.companyId ?? '');
  const [role, setRole] = useState('');
  const [leader, setLeader] = useState<LeaderChoice | null>(null);
  const [leaderOpen, setLeaderOpen] = useState(false);
  const [makeOwner, setMakeOwner] = useState(false);
  const [options, setOptions] = useState<AddUserOptions | null>(null);
  const [offices, setOffices] = useState<TenantListRow[] | null>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [query, setQuery] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // The KPMs and the companies to choose from: the Super Admin's lists — an Owner's sheet has its KPM fixed.
  useEffect(() => {
    if (fixedKpm || own) return;
    let live = true;
    listTenants()
      .then((rows) => {
        if (!live) return;
        setOffices(rows);
        // *Masukkan*: the KPM they registered to, prefilled (OD-441).
        const prefill = person?.kpm ? rows.find((r) => r._id === person.kpm!.id) : undefined;
        if (prefill) setChosen((now) => now ?? { kind: 'kpm', kpm: sheetKpmOf(prefill) });
      })
      .catch(() => { if (live) setOffices([]); });
    if (canMakeKpm) {
      listCompanies()
        .then((rows) => { if (live) setCompanies(insurersOf(rows).map((c) => ({ id: c._id, name: c.name }))); })
        .catch(() => undefined);
    }
    return () => { live = false; };
  }, [fixedKpm, own, person, canMakeKpm]);

  // The chosen KPM's ladder and leaders — or, for a new KPM, its company's ladder.
  const optionKey = own ? 'own:'
    : chosen?.kind === 'kpm' ? `kpm:${chosen.kpm.id}` : chosen?.kind === 'new' && newCompany ? `company:${newCompany}` : '';
  useEffect(() => {
    if (!optionKey) { setOptions(null); return; }
    let live = true;
    setOptions(null);
    const [kind, id] = optionKey.split(':') as ['own' | 'kpm' | 'company', string];
    readAddUserOptions(kind === 'kpm' ? { kpmId: id } : kind === 'company' ? { companyId: id } : {})
      .then((read) => {
        if (!live) return;
        setOptions(read);
        if (kind === 'company') setRole(read.seniorCode ?? '');
        // The reader's own KPM, as the server names it.
        if (kind === 'own' && read.kpm) {
          const k = read.kpm;
          setChosen({ kind: 'kpm', kpm: { id: k.id, branch: k.branch, code: k.code, companyName: k.company.name, companyId: k.company.id } });
        }
      })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [optionKey]);

  const isNew = chosen?.kind === 'new';
  const senior = options?.seniorCode ?? null;
  const showLeader = !isNew && role !== '' && role !== senior;
  const place = mode === 'place';
  const problems = {
    fullName: !place && fullName.trim().length < 1 ? t.problems.fullName : undefined,
    phone: !place && !normalisedPhone(typedPhone) ? 'bad' : undefined,
    kpm: !chosen ? t.problems.kpm : undefined,
    kpmName: isNew && newName.trim().length < 1 ? t.problems.kpmName : undefined,
    company: isNew && !newCompany ? t.problems.company : undefined,
    role: !isNew && !role ? t.problems.role : undefined,
    leader: showLeader && !leader ? t.problems.leader : undefined,
  };
  const shown = (key: keyof typeof problems) => (tried ? problems[key] : undefined);

  const chooseKpm = (kpm: SheetKpm) => {
    setChosen({ kind: 'kpm', kpm });
    setRole('');
    setLeader(null);
    setView('form');
  };
  const chooseNew = () => {
    setChosen({ kind: 'new' });
    setLeader(null);
    setMakeOwner(false);
    setView('form');
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTried(true);
    if (Object.values(problems).some(Boolean)) return;
    setBusy(true);
    setError(null);
    const where = isNew
      ? { newKpm: { branchName: newName.trim(), companyId: newCompany } }
      : {
        // The reader's own KPM is the server's to name (`own`): nothing is sent for it.
        ...(own ? {} : { kpmId: (chosen as { kpm: SheetKpm }).kpm.id }),
        role,
        ...(showLeader && leader ? { leaderMembershipId: leader.membershipId } : {}),
        makeOwner: options?.mayMakeOwner ? makeOwner : false,
      };
    try {
      if (place && person) {
        const answer = await placeUser(person.userId, where, { hasPhone: person.hasPhone === true });
        onDone({ kind: 'placed', fullName: answer.person.fullName, kpm: answer.kpm, whatsAppOpened: answer.whatsAppOpened });
      } else {
        const answer = await addUser({
          fullName: fullName.trim(),
          phone: `+62${nationalDigits(typedPhone)}`,
          ...(email.trim() ? { email: email.trim() } : {}),
          ...where,
        });
        onDone({ kind: 'invited', fullName: answer.invitation.fullName, kpm: answer.kpm, whatsAppOpened: answer.whatsAppOpened });
      }
    } catch (err) {
      setError(toDisplayError(err));
      setBusy(false);
    }
  }

  const kpmName = chosen?.kind === 'kpm' ? chosen.kpm.branch : newName.trim();
  const submitWords = busy ? t.saving : isNew ? t.submitNewKpm : place ? t.submitPlace({ kpm: kpmName || t.kpm }) : t.submit;
  const placement = phone ? 'sheet' : 'center';

  if (view === 'pick') {
    return (
      <Modal
        open
        title={t.pickTitle}
        onClose={onClose}
        initialFocus={searchRef}
        placement={placement}
        handle
        className={cn(TITLE, '[&_[data-modal-head]_h2]:pl-9')}
        eyebrow={(
          <button
            type="button"
            onClick={() => setView('form')}
            aria-label={t.back}
            className="absolute bottom-2 left-3 flex h-11 w-11 items-center justify-center rounded-pill text-ink hover:bg-hover-row"
          >
            <LineIcon name="chevronLeft" className="h-[22px] w-[22px]" />
          </button>
        )}
      >
        <KpmPicker
          offices={offices}
          companyId={place ? person?.companyId ?? null : null}
          query={query}
          onQuery={setQuery}
          searchId={ids.search}
          searchRef={searchRef}
          canMakeKpm={canMakeKpm}
          onPick={chooseKpm}
          onNew={chooseNew}
        />
      </Modal>
    );
  }

  return (
    <Modal
      open
      title={place ? t.placeTitle : t.title}
      onClose={onClose}
      closeLabel={t.close}
      placement={placement}
      handle
      className={TITLE}
      footer={(
        <button
          type="submit"
          form={formId}
          disabled={busy}
          aria-busy={busy || undefined}
          data-add-user-submit=""
          className="flex min-h-11 w-full items-center justify-center rounded-pill bg-primary px-4 text-row font-bold text-primary-contrast disabled:opacity-60"
        >
          {submitWords}
        </button>
      )}
    >
      <form id={formId} noValidate onSubmit={(e) => void submit(e)} className="flex flex-col" data-add-user={mode}>
        {place && person ? (
          <div className="flex items-center gap-3 pb-0.5 pt-1.5" data-add-user-person={person.userId}>
            <Avatar name={person.fullName} photoUrl={person.avatarUrl ?? null} seed={person.userId} size={36} />
            <span className="flex min-w-0 flex-col">
              <span className={cn(NAME, 'truncate')}>{person.fullName}</span>
              {person.email && <span className={cn(META, 'truncate')}>{person.email}</span>}
            </span>
          </div>
        ) : (
          <>
            <label htmlFor={ids.name} className={LABEL}>{t.fullName}</label>
            <input
              id={ids.name}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t.fullNamePlaceholder}
              maxLength={120}
              autoComplete="off"
              aria-invalid={Boolean(shown('fullName')) || undefined}
              className={cn(FIELD, VALUE, 'text-ink placeholder:font-normal placeholder:text-muted', shown('fullName') && 'border-alert')}
            />
            <Problem text={shown('fullName')} />
            <label htmlFor={ids.phone} className={LABEL}>{t.phone}</label>
            <PhoneField id={ids.phone} value={typedPhone} onChange={setTypedPhone} invalid={Boolean(shown('phone'))} look="pill" />
            <label htmlFor={ids.email} className={LABEL}>
              {t.email} <span className="font-normal text-muted">· {t.optional}</span>
            </label>
            <input
              id={ids.email}
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              autoComplete="off"
              className={cn(FIELD, VALUE, 'text-ink placeholder:font-normal placeholder:text-muted')}
            />
          </>
        )}

        {isNew ? (
          <NewKpmBox
            t={t}
            ids={ids}
            name={newName}
            onName={setNewName}
            companyId={newCompany}
            onCompany={setNewCompany}
            companies={person?.companyId ? companies.filter((c) => c.id === person.companyId) : companies}
            problems={{ name: shown('kpmName'), company: shown('company') }}
            onChange={() => setView('pick')}
          />
        ) : (
          <>
            <span id={ids.kpm} className={LABEL}>{t.kpm}</span>
            {fixedKpm || own ? (
              <div className={cn(FIELD, 'cursor-default')} aria-labelledby={ids.kpm} data-add-user-kpm={chosen?.kind === 'kpm' ? chosen.kpm.id : ''}>
                {chosen?.kind === 'kpm' ? <KpmValue kpm={chosen.kpm} t={t} /> : <span className={META}>{t.loadingOptions}</span>}
              </div>
            ) : (
              <button
                type="button"
                aria-labelledby={ids.kpm}
                aria-haspopup="dialog"
                onClick={() => setView('pick')}
                data-add-user-kpm={chosen?.kind === 'kpm' ? chosen.kpm.id : ''}
                className={cn(FIELD, shown('kpm') && 'border-alert')}
              >
                {chosen?.kind === 'kpm'
                  ? <KpmValue kpm={chosen.kpm} t={t} />
                  : <span className="text-lg font-normal text-muted">{t.chooseKpm}</span>}
                <LineIcon name="chevronDown" className="h-[18px] w-[18px] shrink-0 text-muted" />
              </button>
            )}
            <Problem text={shown('kpm')} />
          </>
        )}

        {chosen && (
          <>
            <span id={ids.role} className={LABEL}>{t.role}</span>
            {options === null ? (
              <span className={cn(META, 'min-h-11 py-2.5')}>{t.loadingOptions}</span>
            ) : (
              <div role="radiogroup" aria-labelledby={ids.role} className="flex gap-1.5" data-add-user-roles="">
                {options.roles.map((r) => {
                  const on = r.code === role;
                  const locked = isNew && r.code !== senior;
                  return (
                    <button
                      key={r.code}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={locked}
                      onClick={() => { setRole(r.code); if (r.code === senior) setLeader(null); }}
                      className={cn(
                        'flex min-h-11 flex-1 items-center justify-center rounded-pill border px-2 text-md font-semibold',
                        on ? 'border-secondary bg-secondary text-secondary-contrast' : 'border-hairline bg-card text-ink',
                        locked && 'opacity-40',
                      )}
                    >
                      {shortOfRung(r)}
                    </button>
                  );
                })}
              </div>
            )}
            <Problem text={shown('role')} />

            {showLeader && options && (
              <>
                <span id={ids.leader} className={LABEL}>{t.leader}</span>
                <button
                  type="button"
                  aria-labelledby={ids.leader}
                  aria-expanded={leaderOpen}
                  onClick={() => setLeaderOpen((open) => !open)}
                  className={cn(FIELD, leaderOpen && 'border-primary', shown('leader') && 'border-alert')}
                  data-add-user-leader=""
                >
                  {leader ? <LeaderName leader={leader} /> : <span className="text-lg font-normal text-muted">{t.chooseLeader}</span>}
                  <LineIcon name={leaderOpen ? 'chevronUp' : 'chevronDown'} className="h-[18px] w-[18px] shrink-0 text-muted" />
                </button>
                {leaderOpen && (
                  <ul className="mt-1.5 rounded-lg bg-card px-3 py-1 shadow-modal" aria-label={t.leader}>
                    {options.leaders.length === 0 && <li className={cn(META, 'py-3')}>{t.noLeaders}</li>}
                    {options.leaders.map((l) => (
                      <li key={l.membershipId} className="border-b border-divider last:border-b-0">
                        <button
                          type="button"
                          onClick={() => { setLeader(l); setLeaderOpen(false); }}
                          className="flex min-h-[52px] w-full items-center gap-2.5 text-left"
                        >
                          <Avatar name={l.fullName} photoUrl={l.photoUrl} seed={l.membershipId} size={36} />
                          <span className="flex min-w-0 flex-col">
                            <LeaderName leader={l} />
                            {l.isOwner && <span className={META}>{t.ownerTag}</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <Problem text={shown('leader')} />
              </>
            )}

            {isNew ? (
              <div className="mt-3.5 flex min-h-14 items-center gap-3 border-t border-hairline px-1 pt-2" data-add-user-first-owner="">
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-primary-50 text-primary-ink">
                  <NavIcon name="ti-crown" className="h-[18px] w-[18px]" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-row font-bold text-ink">{t.ownerRow}</span>
                  <span className={META}>{t.firstOwner}</span>
                </span>
                <span className="inline-flex h-[26px] items-center gap-1 rounded-pill bg-pill-green px-2.5 text-base font-semibold text-pill-green-ink">
                  <LineIcon name="check" className="h-3.5 w-3.5" />
                  {t.yes}
                </span>
              </div>
            ) : options?.mayMakeOwner ? (
              <div className="mt-3 flex min-h-11 items-center justify-between">
                <Switch
                  id={ids.owner}
                  label={t.makeOwner}
                  checked={makeOwner}
                  onChange={setMakeOwner}
                  phoneTarget
                  tabletTarget
                  className="w-full flex-row-reverse justify-between text-row font-semibold"
                />
              </div>
            ) : null}
          </>
        )}
        {error && <div className="mt-3"><ErrorBanner {...error} /></div>}
      </form>
    </Modal>
  );
}

function sheetKpmOf(row: TenantListRow): SheetKpm {
  return { id: row._id, branch: row.branchName, code: row.code, companyName: row.companyName, companyId: row.companyId };
}

function Problem({ text }: { text?: string }) {
  if (!text || text === 'bad') return null;
  return <p role="alert" className="mt-1 text-base text-alert">{text}</p>;
}

function KpmValue({ kpm, t }: { kpm: SheetKpm; t: Words }) {
  return (
    <span className="flex min-w-0 flex-col py-1">
      <span className="truncate text-lg font-medium text-ink">{kpm.branch}</span>
      <span className="truncate text-base text-muted">{t.kpmLine({ company: kpm.companyName, code: kpm.code })}</span>
    </span>
  );
}

function LeaderName({ leader }: { leader: LeaderChoice }) {
  return (
    <span className="inline-flex min-w-0 items-baseline gap-1.5">
      {leader.role.class !== 'agent' && (
        <span className="shrink-0 text-sm font-extrabold text-primary-ink">{shortOfRung(leader.role)}</span>
      )}
      <span className="min-w-0 truncate text-base font-bold uppercase text-ink">{leader.fullName}</span>
    </span>
  );
}

/** ***Pilih KPM*** (screen 4b): the sheet's content, replaced. *＋ KPM baru* is always the first row. */
function KpmPicker({
  offices, companyId, query, onQuery, searchId, searchRef, canMakeKpm, onPick, onNew,
}: {
  offices: TenantListRow[] | null;
  companyId: string | null;
  query: string;
  onQuery: (q: string) => void;
  searchId: string;
  searchRef: React.RefObject<HTMLInputElement | null>;
  canMakeKpm: boolean;
  onPick: (kpm: SheetKpm) => void;
  onNew: () => void;
}) {
  const t = useMessages(addUserMessages);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (offices ?? [])
      .filter((o) => o.status !== 'archived' && (!companyId || o.companyId === companyId))
      .filter((o) => !q || o.branchName.toLowerCase().includes(q) || o.code.toLowerCase().includes(q))
      .sort((a, b) => a.branchName.localeCompare(b.branchName));
  }, [offices, companyId, query]);
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
  return (
    <div className="flex flex-col pb-4" data-kpm-picker="">
      <label htmlFor={searchId} className="sr-only">{t.pickSearch}</label>
      <span className="relative mb-1.5 mt-1 flex items-center">
        <NavIcon name="ti-search" className="pointer-events-none absolute left-3.5 h-[18px] w-[18px] text-muted" />
        <input
          ref={searchRef}
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t.pickSearch}
          className="h-11 w-full rounded-pill border border-hairline bg-base pl-10 pr-4 text-lg text-ink placeholder:text-muted"
        />
      </span>
      <ul>
        {canMakeKpm && (
          <li className="border-b border-divider">
            <button type="button" onClick={onNew} className="flex min-h-14 w-full items-center gap-2.5 text-left" data-kpm-new="">
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-primary-50 text-primary-ink">
                <NavIcon name="ti-plus" className="h-[18px] w-[18px]" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-row font-bold text-primary-ink">{t.newKpm}</span>
                <span className="text-base text-muted">{t.newKpmLine}</span>
              </span>
            </button>
          </li>
        )}
        {offices !== null && shown.length === 0 && <li className="py-3 text-base text-muted">{t.noKpms}</li>}
        {shown.map((o) => (
          <li key={o._id} className="border-b border-divider last:border-b-0">
            <button
              type="button"
              onClick={() => onPick(sheetKpmOf(o))}
              className="flex min-h-14 w-full items-center gap-2.5 text-left"
              data-kpm-choice={o._id}
            >
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-sm font-bold text-secondary-contrast">
                {initials(o.branchName)}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-row font-semibold text-ink">{o.branchName}</span>
                <span className="truncate text-base text-muted">{t.kpmLine({ company: o.companyName, code: o.code })}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** ***＋ KPM baru*'s box** (screen 4c): *KPM baru · Ganti*, then *Nama KPM* and *Perusahaan* as white fields, label inside. */
function NewKpmBox({
  t, ids, name, onName, companyId, onCompany, companies, problems, onChange,
}: {
  t: Words;
  ids: { kpmName: string; company: string };
  name: string;
  onName: (v: string) => void;
  companyId: string;
  onCompany: (v: string) => void;
  companies: { id: string; name: string }[];
  problems: { name?: string; company?: string };
  onChange: () => void;
}) {
  return (
    <div data-add-user-new-kpm="">
      <div className="mt-1.5 flex h-10 items-center justify-between">
        <span className="text-base font-semibold text-ink">{t.newKpm}</span>
        <button type="button" onClick={onChange} className="inline-flex min-h-11 items-center px-1 text-base font-semibold text-primary-ink">
          {t.change}
        </button>
      </div>
      <div className="flex flex-col gap-2 rounded-[20px] border border-primary bg-primary-50 p-2">
        {/*
          * The amber ring on the rounded field itself (`focus-within`), as `PhoneField` draws it, never a rectangle around the
          * bare input inside it (the integration round's walk, 2026-11-22).
          */}
        <label htmlFor={ids.kpmName} className="flex min-h-[58px] flex-col justify-center rounded-[20px] bg-card px-4 focus-within:ring-2 focus-within:ring-focus-ring">
          <span className="text-base font-semibold text-muted">{t.kpmName}</span>
          <input
            id={ids.kpmName}
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder={t.kpmNamePlaceholder}
            maxLength={120}
            autoComplete="off"
            aria-invalid={Boolean(problems.name) || undefined}
            className="w-full bg-transparent text-lg font-medium text-ink outline-none focus-visible:outline-none placeholder:font-normal placeholder:text-muted"
          />
        </label>
        <div className="flex min-h-[58px] flex-col justify-center rounded-[20px] bg-card px-4">
          <span id={ids.company} className="text-base font-semibold text-muted">{t.company}</span>
          <PickerMenu
            label={t.company}
            value={companyId}
            buttonLabel={companyId ? undefined : t.chooseCompany}
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
            onChange={onCompany}
            className="w-full"
          />
        </div>
      </div>
      <Problem text={problems.name} />
      <Problem text={problems.company} />
    </div>
  );
}
