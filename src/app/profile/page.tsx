'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { describeDevice, SessionList } from '@/components/session-list';
import { RoleShell } from '@/components/role-shell';
import { Avatar } from '@/components/ui/person-row';
import { DateField } from '@/components/ui/date-field';
import { Button, ErrorBanner, Field, Switch, TextInput } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { PasswordInput } from '@/components/ui/password-input';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { rungShort, useLadder } from '@/components/ui/role-badge';
import {
  FLOATING_SAVE_ROOM, FloatingSavePill, SaveStateLabel, useSaveState,
} from '@/components/ui/save-state';
import { Toast, useToast } from '@/components/ui/toast';
import { useChooseLanguage } from '@/i18n/choose-language';
import { messagesIn } from '@/i18n/catalogue';
import { LANGUAGE_NAMES, LANGUAGES, type Language } from '@/i18n/language';
import { useLanguage, useLanguageChoice, useMessages } from '@/i18n/language-provider';
import { accountMessages } from '@/i18n/messages/account';
import { api, toDisplayError, type ApiError } from '@/lib/api-client';
import { readCalendarSettings, saveCalendarSettings } from '@/lib/calendar';
import { cn } from '@/lib/cn';
import { heldBecause } from '@/lib/disabled-reason';
import { myLeaderCode } from '@/lib/join';
import { genderLabels, workStatusLabels, type Gender, type WorkStatus } from '@/lib/personal';
import {
  normalisedPhone, PHONE_COUNTRY_PREFIX, PHONE_NATIONAL_DIGITS, phoneFieldValue,
} from '@/lib/phone-number';
import { CORE_LEADER_LABEL } from '@/lib/profile-line';
import { readProfileFacts, type ProfileFacts } from '@/lib/profile';
import { listSessions } from '@/lib/sessions';
import { useCan, useSession, type Me } from '@/lib/session';
import { useSignOut } from '@/lib/use-sign-out';

/** The photo sheet, loaded the first time it opens (common.md: a sheet costs nothing until then). */
const PhotoSheet = dynamic(() => import('@/components/profile/photo-sheet').then((m) => m.PhotoSheet), { ssr: false });

/**
 * ***Profil saya*** — `/profile` (UI V1, 2026-10-30; UI-111; `profile-mobile`): **one page for your photo, your details
 * and your settings**, at every width — the phone's single column, centred at 560px on a tablet and a desktop.
 *
 * - **The photo card**: the 84px photo (the initials until one is set) with its camera badge, the name, *AB · Core
 *   Leader · AGUS01*, *Ubah foto*; the photo and *Ubah foto* open *Foto profil* (`PhotoSheet`).
 * - ***Data diri***: the sign-up form's fields, prefilled — *Nama lengkap*, *Tanggal lahir* (DD / MM / YYYY), *Jenis
 *   kelamin* and *Status* as segments, *Perusahaan asuransi* and *Kode agen* locked, *Bergabung…* (MM / YYYY), *Email*
 *   — a field: a changed one asks for the password and sends a link to the new address, which is the account's once
 *   opened (`POST /auth/me/email`, ADR-0181) — and **Nomor WhatsApp** (+62, the number every WhatsApp button that
 *   points at you uses). *Nama panggilan* and *Kata ganti* are not on it any more; what is stored stays. **Belum
 *   disimpan · Simpan** floats after a change, and only then (`FloatingSavePill`; from 1024px the same line closes the
 *   card).
 * - ***KPM dan peran***, read-only: the office, the rung with its *Core Leader* pill, *Leader Anda*, the informal
 *   groups, *Grup Anda* › (the group tree) and *Kode leader* with *Salin*. Changes go through User Management.
 * - ***Pengaturan***: *Bahasa* › — a small sheet saving at once, the same choice as the *ID | EN* switch (ADR-0180 §3) —
 *   and *Sembunyikan aktivitas calendar*, moved here from Calendar (D-30; `PUT /calendar/settings`).
 * - ***Keamanan***: *Ubah kata sandi* › and *Perangkat tempat Anda masuk* ›, today's two forms in sheets.
 * - **Keluar**, last, red outline.
 *
 * **In a support session it is shown and not offered** (ADR-0162 §4): the person's details, photo, language and
 * calendar privacy are theirs, and the API refuses every write in one regardless.
 */
export default function ProfilePage() {
  return <Profile />;
}

function Profile() {
  const t = useMessages(accountMessages);
  return (
    <RoleShell
      title={t.v1.title}
      // Everybody may read their own account, and the matrix says so at `own` in all six columns. Naming it here
      // overrides the chrome's own gate, which is about the application that chrome belongs to, not this route.
      permission="profile:read_self"
    >
      <ProfileContent />
    </RoleShell>
  );
}

/** Inside the shell, so its toasts are the shell's region where it has one (`useToast`), and its own where not. */
function ProfileContent() {
  const t = useMessages(accountMessages);
  const { signOut, busy } = useSignOut();
  const { toast, show } = useToast();
  return (
    <>
      <div className={cn('mx-auto flex w-full max-w-[560px] flex-col', FLOATING_SAVE_ROOM)} data-profile="">
        <ProfileBody say={show} />
        <button
          type="button"
          disabled={busy}
          onClick={() => void signOut()}
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-1.5 rounded-pill border border-pill-red-ink/40 bg-card text-md font-bold text-pill-red-ink hover:bg-pill-red disabled:opacity-40"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
            <path d="M14 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2M9 12h12l-3-3m0 6 3-3" />
          </svg>
          {busy ? t.signingOut : t.signOut}
        </button>
      </div>
      <Toast toast={toast} />
    </>
  );
}

type Say = (message: string) => void;

function ProfileBody({ say }: { say: Say }) {
  const { me } = useSession();
  const [facts, setFacts] = useState<ProfileFacts | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const t = useMessages(accountMessages).v1;
  const userId = me?.user.id;
  const leads = (me?.membership?.directCount ?? 0) > 0;

  useEffect(() => {
    if (!userId) return undefined;
    let live = true;
    // The facts are a line each: a failed read leaves those lines out rather than the page.
    readProfileFacts().then((answer) => { if (live) setFacts(answer); }).catch(() => undefined);
    return () => { live = false; };
  }, [userId]);

  // *Kode leader*: the code a leader shares (`GET /join/my-code`), for somebody who leads anybody.
  useEffect(() => {
    if (!userId || !leads) return undefined;
    let live = true;
    myLeaderCode().then((answer) => { if (live) setCode(answer.code); }).catch(() => undefined);
    return () => { live = false; };
  }, [userId, leads]);

  if (!me) return null;
  return (
    <>
      <PhotoCard me={me} facts={facts} code={code} say={say} />
      <SectionHead>{t.personal}</SectionHead>
      <PersonalForm me={me} facts={facts} say={say} />
      {me.membership && (
        <>
          <SectionHead>{t.kpmAndRole}</SectionHead>
          <KpmAndRole me={me} facts={facts} code={code} say={say} />
        </>
      )}
      <Settings me={me} say={say} />
      <SectionHead>{t.security}</SectionHead>
      <Security />
    </>
  );
}

/** A section's name over its card (`profile-mobile`'s `.sh`): 13px bold grey. */
function SectionHead({ children }: { children: ReactNode }) {
  return <h2 className="mx-1 mb-1.5 mt-4 text-base font-bold text-muted">{children}</h2>;
}

/** A white card with no border, its rows divided (`.card`). */
function CardBox({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('overflow-hidden rounded-lg bg-card', className)}>{children}</div>;
}

/** The reader's rung as its short name, from the office's ladder: *AB*. */
function useShortRung(me: Me): string {
  const ladder = useLadder();
  const code = me.membership?.orgLevelCode ?? '';
  return code ? rungShort(code, ladder) : '';
}

/* ── The photo card ───────────────────────────────────────────────────────────────────────── */

function PhotoCard({ me, facts, code, say }: { me: Me; facts: ProfileFacts | null; code: string | null; say: Say }) {
  const t = useMessages(accountMessages).v1;
  const { reload } = useSession();
  const [open, setOpen] = useState(false);
  const shortRung = useShortRung(me);
  const leads = (me.membership?.directCount ?? 0) > 0;
  const locked = me.isImpersonating;

  // *AB · Core Leader · AGUS01*: the rung, the tag, and the code a leader shares — an agent's own agent code otherwise.
  const meta = [
    shortRung,
    me.membership?.isCoreLeader ? CORE_LEADER_LABEL : null,
    leads ? code : facts?.agentCode ?? null,
  ].filter((part): part is string => !!part).join(' · ');

  return (
    <div className="mt-1 flex items-center gap-3.5 rounded-lg bg-card p-4" data-photo-card="">
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={locked}
        aria-label={t.photoButton}
        className="relative shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber disabled:cursor-default"
      >
        <Avatar name={me.user.fullName} photoUrl={me.user.avatarUrl ?? null} seed={me.user.id} size={84} className="text-[1.625rem] font-extrabold" />
        {!locked && (
          <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-card bg-navy text-white">
            <CameraIcon />
          </span>
        )}
      </button>
      <div className="min-w-0">
        <p className="break-words text-lg font-extrabold leading-tight text-navy">{me.user.fullName}</p>
        {meta && <p className="mt-0.5 text-sm leading-snug text-muted">{meta}</p>}
        {!locked && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="-ml-1 mt-1 inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-base font-bold text-amber-ink hover:underline"
          >
            {t.changePhoto}
          </button>
        )}
      </div>
      {open && (
        <PhotoSheet
          open={open}
          onClose={() => setOpen(false)}
          current={me.user.avatarUrl ?? null}
          onChanged={async (said) => {
            await reload();
            say(said);
          }}
        />
      )}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[15px] w-[15px]">
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

/* ── Data diri ───────────────────────────────────────────────────────────────────────────── */

interface Details {
  fullName: string;
  dateOfBirth: string;
  gender: Gender | '';
  companyJoinMonth: string;
  workStatus: WorkStatus | '';
  /** The national digits after +62, as the field holds them. */
  phone: string;
  /** As typed; it is the account's only once the link sent to it is opened (ADR-0181). */
  email: string;
}

const PERSONAL_FIELDS = ['dateOfBirth', 'companyJoinMonth', 'workStatus', 'gender'] as const;

function detailsOf(me: Me): Details {
  return {
    fullName: me.user.fullName ?? '',
    dateOfBirth: me.user.dateOfBirth ?? '',
    gender: me.user.gender ?? '',
    companyJoinMonth: me.user.companyJoinMonth ?? '',
    workStatus: me.user.workStatus ?? '',
    phone: phoneFieldValue(me.user.phone),
    email: me.user.email ?? '',
  };
}

/** An address as the account stores it — lower-cased and trimmed, as the API compares it (`normalisedEmail`). */
const emailKey = (email: string) => email.trim().toLowerCase();
/** Something that can be an address: a name, an @, a domain with a dot. The API checks it properly. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `1995-03-18` as *18 / 03 / 1995*; `2020-09` as *09 / 2020* (UI-111: the dates as sign-up shows them). */
const dayShape = (day: string) => {
  const [y, m, d] = day.split('-');
  return `${d} / ${m} / ${y}`;
};
const monthShape = (month: string) => {
  const [y, m] = month.split('-');
  return y && m ? `${m} / ${y}` : '';
};

const FORM_ID = 'profile-details';
const EMAIL_FORM_ID = 'profile-email-password';

function PersonalForm({ me, facts, say }: { me: Me; facts: ProfileFacts | null; say: Say }) {
  const { reload } = useSession();
  const language = useLanguage();
  const all = useMessages(accountMessages);
  const t = all.v1;
  const genders = genderLabels(language);
  const workStatuses = workStatusLabels(language);
  const saved = detailsOf(me);
  const [details, setDetails] = useState<Details>(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  /** The password sheet a changed email opens, its password and its refusal (UI-111, ADR-0181). */
  const [asking, setAsking] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [sheetError, setSheetError] = useState<ApiError | null>(null);
  /** The address the last link went to: said under the field until the page is loaded again. */
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { state, dirty, guard } = useSaveState(details, saved, { saving: busy });

  // A saved change is read back from the session; the form follows it.
  useEffect(() => { setDetails(detailsOf(me)); }, [me]);

  /*
   * A Super Admin sells for nobody and is nobody's member: their name, email and number only. In a support session
   * nothing is offered (ADR-0162 §4) — the API refuses `PATCH /auth/me` in any session.
   */
  const recordsPersonal = me.user.platformRole !== 'super_admin';
  const locked = me.isImpersonating;
  const set = <K extends keyof Details>(key: K, value: Details[K]) => setDetails((d) => ({ ...d, [key]: value }));
  const refusedField = error?.details?.field as string | undefined;
  const fieldError = (f: string) => (refusedField === f ? error?.message : undefined);

  const emailChanged = emailKey(details.email) !== emailKey(saved.email);

  /** What `PATCH /auth/me` is sent — the fields that changed — or `null` when one of them cannot be sent. */
  function changes(): Record<string, unknown> | null {
    const body: Record<string, unknown> = {};
    if (details.fullName !== saved.fullName) body.fullName = details.fullName.trim();
    if (recordsPersonal) {
      for (const f of PERSONAL_FIELDS) {
        if (details[f] !== '' && details[f] !== saved[f]) body[f] = details[f];
      }
    }
    if (details.phone !== saved.phone) {
      const typed = details.phone.trim();
      const phone = typed === '' ? null : normalisedPhone(typed);
      if (typed !== '' && phone === null) {
        setPhoneError(t.phoneInvalid(PHONE_NATIONAL_DIGITS));
        return null;
      }
      body.phone = phone;
    }
    return body;
  }

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (!dirty || busy || locked) return;
    setError(null);
    setPhoneError(null);
    setEmailError(null);
    const body = changes();
    if (body === null) return;
    if (emailChanged) {
      // A changed email is sent only with the password again (ADR-0181 §1): nothing is saved until the sheet is.
      if (!EMAIL_SHAPE.test(details.email.trim())) {
        setEmailError(t.emailInvalid);
        return;
      }
      setCurrentPassword('');
      setSheetError(null);
      setAsking(true);
      return;
    }
    if (Object.keys(body).length === 0) {
      // Only the email's case or spaces changed: the same address, so there is nothing to send.
      set('email', saved.email);
      return;
    }
    await save(body);
  }

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await api('/auth/me', { method: 'PATCH', body });
      await reload();
      say(t.saved);
    } catch (err) {
      const shown = toDisplayError(err);
      if (shown.details?.field === 'phone') setPhoneError(shown.message);
      else setError(shown);
    } finally {
      setBusy(false);
    }
  }

  /**
   * ***Kirim tautan***: the email change asked for with the password (`POST /auth/me/email`), then whatever else
   * changed saved as ever. The field goes back to the address the account still has, and the line under it says where
   * the link went. A refusal about the address is said under the field; any other — a wrong password — in the sheet.
   */
  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    // The sheet is drawn outside the details form, but React carries a submit up through the portal.
    event.stopPropagation();
    if (busy || !currentPassword) return;
    const body = changes();
    if (body === null) {
      setAsking(false);
      return;
    }
    const newEmail = details.email.trim();
    setBusy(true);
    setSheetError(null);
    try {
      await api('/auth/me/email', { method: 'POST', body: { newEmail, currentPassword } });
    } catch (err) {
      const shown = toDisplayError(err);
      setBusy(false);
      if (shown.details?.field === 'newEmail') {
        setAsking(false);
        setEmailError(shown.message);
      } else {
        setSheetError(shown);
      }
      return;
    }
    setAsking(false);
    setCurrentPassword('');
    setSentTo(newEmail);
    setBusy(false);
    set('email', saved.email);
    if (Object.keys(body).length > 0) await save(body);
  }

  const held = !details.fullName.trim();

  return (
    <CardBox>
      {guard}
      <form id={FORM_ID} onSubmit={submit} noValidate>
        {locked && <p className="border-b border-divider px-3.5 py-2.5 text-sm text-muted">{all.details.locked}</p>}
        {error && !refusedField && <div className="px-3.5 pt-3"><ErrorBanner {...error} /></div>}

        <Row>
          <Field label={all.details.fullName} htmlFor="fullName">
            <TextInput id="fullName" required value={details.fullName} disabled={locked} onChange={(e) => set('fullName', e.target.value)} autoComplete="name" />
          </Field>
        </Row>

        {recordsPersonal && (
          <>
            <Row>
              <Field label={all.details.dateOfBirth} htmlFor="dateOfBirth" error={fieldError('dateOfBirth')}>
                <DateField
                  id="dateOfBirth"
                  autoComplete="bday"
                  value={details.dateOfBirth}
                  onChange={(value) => set('dateOfBirth', value)}
                  disabled={locked}
                  invalid={refusedField === 'dateOfBirth'}
                  format={dayShape}
                  emptyText={t.dayShape}
                  className="w-full"
                />
              </Field>
            </Row>
            <Row>
              <ChoiceSegments
                label={all.details.gender}
                options={(Object.keys(genders) as Gender[]).map((g) => ({ value: g, label: genders[g] }))}
                value={details.gender}
                disabled={locked}
                onChange={(g) => set('gender', g)}
                error={fieldError('gender')}
              />
            </Row>
            <Row>
              <LockedValue label={t.companyName} value={facts?.companyName ?? null} />
            </Row>
            <Row>
              <LockedValue label={t.agentCode} value={facts?.agentCode ?? null} hint={t.agentCodeHint} />
            </Row>
            <Row>
              <MonthShapeField
                id="companyJoinMonth"
                label={all.details.joined}
                value={details.companyJoinMonth}
                disabled={locked}
                onChange={(v) => set('companyJoinMonth', v)}
                error={fieldError('companyJoinMonth')}
              />
            </Row>
            <Row>
              <ChoiceSegments
                label={all.details.status}
                options={(Object.keys(workStatuses) as WorkStatus[]).map((w) => ({ value: w, label: workStatuses[w] }))}
                value={details.workStatus}
                disabled={locked}
                onChange={(w) => set('workStatus', w)}
                error={fieldError('workStatus')}
              />
            </Row>
          </>
        )}

        <Row>
          <Field label={t.email} htmlFor="email" hint={t.emailHint} error={emailError ?? undefined}>
            <TextInput
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={details.email}
              disabled={locked}
              invalid={!!emailError}
              onChange={(e) => set('email', e.target.value)}
            />
          </Field>
          {sentTo && <p role="status" className="mt-1 text-sm font-semibold text-success">{t.emailSent({ email: sentTo })}</p>}
        </Row>
        <Row>
          <Field label={t.whatsapp} htmlFor="whatsapp" error={phoneError ?? undefined}>
            <div className={cn(
              'flex min-h-12 items-center overflow-hidden rounded-md border bg-card focus-within:border-amber focus-within:ring-1 focus-within:ring-amber md:min-h-10',
              phoneError ? 'border-alert' : 'border-line',
              locked && 'bg-base',
            )}>
              <span aria-hidden="true" className="border-r border-divider px-2.5 text-md font-semibold text-ink">{PHONE_COUNTRY_PREFIX}</span>
              <input
                id="whatsapp"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="812 3456 7890"
                value={details.phone}
                disabled={locked}
                aria-invalid={phoneError ? true : undefined}
                onChange={(e) => set('phone', e.target.value)}
                className="min-w-0 flex-1 bg-transparent px-2.5 text-[16px] text-ink outline-none disabled:text-muted"
              />
            </div>
          </Field>
        </Row>

        {/* From 1024px the pill's line closes the card, after a change only. */}
        {!locked && (dirty || busy) && (
          <div className="hidden items-center justify-end gap-3 border-t border-divider px-3.5 py-2.5 lg:flex">
            <SaveStateLabel state={state} />
            <Button type="submit" disabled={busy || held} aria-describedby={held ? 'profile-held' : undefined}>
              {busy ? all.details.saving : all.details.save}
            </Button>
          </div>
        )}
        {held && dirty && (
          <p id="profile-held" className="px-3.5 pb-2.5 text-sm text-muted">
            {heldBecause({ missing: [all.details.fullName], fix: null }, language)}
          </p>
        )}
      </form>
      {!locked && (dirty || busy) && (
        <FloatingSavePill state={state} label={all.details.save} form={FORM_ID} disabled={held} />
      )}
      {/* Outside the details form: a form inside a form is not one. */}
      <ResponsiveSheet
        open={asking}
        title={t.emailSheetTitle}
        onClose={() => setAsking(false)}
        footer={(
          <Button type="submit" form={EMAIL_FORM_ID} disabled={busy || !currentPassword} className="w-full">
            {busy ? t.emailSending : t.emailSend}
          </Button>
        )}
      >
        <form id={EMAIL_FORM_ID} onSubmit={(e) => void sendLink(e)} className="flex flex-col gap-4" noValidate>
          <p className="text-md text-muted">{t.emailSheetLine({ email: details.email.trim() })}</p>
          {sheetError && <ErrorBanner {...sheetError} />}
          <Field label={all.password.current} htmlFor="emailCurrentPassword">
            <PasswordInput
              id="emailCurrentPassword"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </Field>
        </form>
      </ResponsiveSheet>
    </CardBox>
  );
}

/** One field of a card, on its divider (`.f`). */
function Row({ children }: { children: ReactNode }) {
  return <div className="border-t border-divider px-3.5 py-2.5 first:border-t-0 [&_label]:text-sm">{children}</div>;
}

/** A field shown and never offered: grey, with a lock (*Perusahaan asuransi*, *Kode agen*). */
function LockedValue({ label, value, hint }: { label: string; value: string | null; hint?: string }) {
  const t = useMessages(accountMessages).v1;
  const hintId = useId();
  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-muted">{label}</p>
      <div
        aria-describedby={hint ? hintId : undefined}
        className="flex min-h-12 items-center justify-between gap-2 rounded-md bg-hover-row px-2.5 text-md text-pill-grey-ink md:min-h-10"
      >
        <span className="min-w-0 truncate">{value ?? '—'}</span>
        <span className="shrink-0 text-signal-grey"><LineIcon name="lock" className="h-4 w-4" /></span>
        <span className="sr-only">{t.locked}</span>
      </div>
      {hint && <p id={hintId} className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

/** Two or three choices as one segmented control, a radio group (*Laki-laki | Perempuan*). */
function ChoiceSegments<T extends string>({
  label, options, value, onChange, disabled = false, error,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | '';
  onChange: (value: T) => void;
  disabled?: boolean;
  error?: string;
}) {
  const labelId = useId();
  const move = (from: number, by: number) => onChange(options[(from + by + options.length) % options.length].value);
  return (
    <div>
      <p id={labelId} className="mb-1 text-sm font-semibold text-muted">{label}</p>
      <div role="radiogroup" aria-labelledby={labelId} className="flex min-h-11 rounded-pill bg-hover-row p-[3px]">
        {options.map((option, i) => {
          const on = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              tabIndex={on || (value === '' && i === 0) ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') move(i, 1);
                else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') move(i, -1);
                else return;
                e.preventDefault();
              }}
              className={cn(
                'flex flex-1 items-center justify-center rounded-pill px-2 text-base font-semibold disabled:cursor-not-allowed',
                on ? 'bg-navy text-white' : 'text-muted hover:text-navy',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {error && <p role="alert" className="mt-1 text-sm text-alert">{error}</p>}
    </div>
  );
}

/** *Bergabung di perusahaan asuransi Anda*: *09 / 2020*, the device's month picker on tap. */
function MonthShapeField({
  id, label, value, onChange, disabled, error,
}: { id: string; label: string; value: string; onChange: (value: string) => void; disabled?: boolean; error?: string }) {
  const t = useMessages(accountMessages).v1;
  return (
    <Field label={label} htmlFor={id} error={error}>
      <div className={cn(
        'relative flex min-h-12 items-center justify-between rounded-md border bg-card px-2.5 text-md md:min-h-10',
        error ? 'border-alert' : 'border-line',
        disabled && 'bg-base text-muted',
      )}>
        <span aria-hidden="true" className={value ? 'text-ink' : 'text-signal-grey'}>{monthShape(value) || t.monthShape}</span>
        <span aria-hidden="true" className="text-muted"><LineIcon name="calendarPlus" className="h-[18px] w-[18px]" /></span>
        <input
          id={id}
          type="month"
          value={value}
          disabled={disabled}
          aria-label={t.pickMonth({ label })}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => {
            try { e.currentTarget.showPicker?.(); } catch { /* the focus stays in the field */ }
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
      </div>
    </Field>
  );
}

/* ── KPM dan peran ───────────────────────────────────────────────────────────────────────── */

function KpmAndRole({ me, facts, code, say }: { me: Me; facts: ProfileFacts | null; code: string | null; say: Say }) {
  const t = useMessages(accountMessages).v1;
  const ladder = useLadder();
  const shortRung = useShortRung(me);
  const membership = me.membership!;
  const leads = membership.directCount > 0;
  const groups = (membership.groups ?? []).filter((g) => g.trim() !== '');
  const longName = t.rungNames[membership.orgLevelCode.toUpperCase()];

  const group = facts?.group ?? null;
  const parts = group
    ? [group.ab > 0 ? t.rolesShort.ab({ n: group.ab }) : null, group.aab > 0 ? t.rolesShort.aab({ n: group.aab }) : null,
      group.agents > 0 ? t.rolesShort.agents({ n: group.agents }) : null].filter(Boolean).join(' · ')
    : '';

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      say(t.copied);
    } catch {
      say(t.copyFailed);
    }
  };

  return (
    <CardBox>
      <ul data-kpm-role="">
        <FactRow icon="building" term={t.kpm} value={membership.office?.branch || membership.office?.code || '—'} />
        <FactRow
          icon="badge"
          term={t.role}
          value={longName && longName !== shortRung ? `${shortRung} · ${longName}` : shortRung}
          trailing={membership.isCoreLeader
            ? <span className="shrink-0 whitespace-nowrap rounded-pill bg-navy px-2.5 py-0.5 text-sm font-bold text-white">{CORE_LEADER_LABEL}</span>
            : null}
        />
        {facts?.leader && (
          <FactRow icon="up" term={t.yourLeader} value={`${facts.leader.name} · ${rungShort(facts.leader.orgLevelCode, ladder)}`} />
        )}
        {groups.length > 0 && (
          <FactRow
            icon="group"
            term={t.informalGroup}
            value={(
              <span className="mt-0.5 flex flex-wrap gap-1">
                {groups.map((g) => (
                  <span key={g} className="rounded-pill bg-amber/15 px-2.5 py-0.5 text-sm font-bold text-amber-ink">{g}</span>
                ))}
              </span>
            )}
          />
        )}
        {group && (
          <li className="relative flex min-h-[52px] items-center gap-2.5 border-t border-divider px-3.5 py-1.5">
            <FactIcon icon="tree" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted">{t.yourGroup}</p>
              <p className="text-md font-semibold text-ink">
                <Link href="/group-tree" className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
                  {t.groupLine({ people: group.people, parts })}
                </Link>
              </p>
            </div>
            <LineIcon name="chevronRight" className="h-[18px] w-[18px] shrink-0 text-signal-grey" />
          </li>
        )}
        {leads && code && (
          <FactRow
            icon="key"
            term={t.leaderCode}
            value={code}
            trailing={(
              <button
                type="button"
                onClick={() => void copy()}
                className="flex min-h-11 shrink-0 items-center gap-1 rounded-pill border border-line px-3 text-base font-semibold text-ink hover:bg-hover-row"
              >
                {t.copy}
                <span className="sr-only"> {t.leaderCode}</span>
              </button>
            )}
          />
        )}
      </ul>
    </CardBox>
  );
}

type FactIconName = 'building' | 'badge' | 'up' | 'group' | 'tree' | 'key' | 'language' | 'eye' | 'lock' | 'devices';

/** The row's line icon (`profile-mobile`'s Tabler glyphs, drawn in the line icons' stroke). */
function FactIcon({ icon }: { icon: FactIconName }) {
  const paths: Record<FactIconName, ReactNode> = {
    building: <><path d="M4 20V6l8-3v17M12 9l8 3v8M3 20h18M8 9v.01M8 12v.01M8 15v.01M16 15v.01" /></>,
    badge: <><rect x="5" y="3.5" width="14" height="17" rx="2" /><circle cx="12" cy="10" r="2.5" /><path d="M8.5 16.5c.8-1.5 2-2.2 3.5-2.2s2.7.7 3.5 2.2" /></>,
    up: <><circle cx="9" cy="8" r="3.5" /><path d="M3.5 20c.6-3 2.8-5 5.5-5 1.2 0 2.3.4 3.2 1M18 20v-7M15 16l3-3 3 3" /></>,
    group: <><circle cx="12" cy="8" r="3" /><path d="M6.5 20c.5-3 2.7-5 5.5-5s5 2 5.5 5M5 11.5a2.5 2.5 0 1 1 1-4.8M19 11.5a2.5 2.5 0 1 0-1-4.8" /></>,
    tree: <><rect x="9" y="3" width="6" height="5" rx="1" /><rect x="3" y="16" width="6" height="5" rx="1" /><rect x="15" y="16" width="6" height="5" rx="1" /><path d="M12 8v4M6 16v-4h12v4" /></>,
    key: <><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2 20 3M16 7l2.5 2.5M14 9l2 2" /></>,
    language: <><path d="M4 5h8M8 3v2M6 5c0 4 2.5 7 6 8M10 5c0 3-2.5 6.5-6 8M13 20l4-9 4 9M14.3 17h5.4" /></>,
    eye: <><path d="M3 12s3.5-6 9-6c1.6 0 3 .5 4.2 1.2M21 12s-3.5 6-9 6c-1.6 0-3-.5-4.2-1.2M4 4l16 16" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
    lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
    devices: <><rect x="3" y="5" width="13" height="10" rx="1.5" /><rect x="16" y="9" width="5" height="10" rx="1" /><path d="M7 19h6" /></>,
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-pill-grey-ink">
      {paths[icon]}
    </svg>
  );
}

/** One read-only fact of *KPM dan peran* (`.lr.kr`): the icon, the term over its value, what follows. */
function FactRow({ icon, term, value, trailing }: { icon: FactIconName; term: string; value: ReactNode; trailing?: ReactNode }) {
  return (
    <li className="flex min-h-[52px] items-center gap-2.5 border-t border-divider px-3.5 py-1.5 first:border-t-0" data-fact="">
      <FactIcon icon={icon} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">{term}</p>
        <div className="text-md font-semibold text-ink">{value}</div>
      </div>
      {trailing}
    </li>
  );
}

/* ── Pengaturan ──────────────────────────────────────────────────────────────────────────── */

function Settings({ me, say }: { me: Me; say: Say }) {
  const t = useMessages(accountMessages).v1;
  const { live } = useLanguageChoice();
  const language = useLanguage();
  const choose = useChooseLanguage();
  const readsCalendar = useCan('calendar_entry:read') && me.membership !== null;
  const changesCalendar = useCan('calendar_entry:update');
  const [choosing, setChoosing] = useState(false);
  const [hide, setHide] = useState<boolean | null>(null);
  const [savingHide, setSavingHide] = useState(false);
  const lineId = useId();
  const locked = me.isImpersonating;

  useEffect(() => {
    if (!readsCalendar) return undefined;
    let current = true;
    readCalendarSettings().then((s) => { if (current) setHide(s.hideDetails); }).catch(() => undefined);
    return () => { current = false; };
  }, [readsCalendar]);

  if (!live && !readsCalendar) return null;

  const pick = async (next: Language) => {
    setChoosing(false);
    if (next === language) return;
    // The same preference as the ID | EN switch (ADR-0180 §3): the screen, the browser and the account at once.
    const ok = await choose(next);
    say(ok ? messagesSaved(next) : t.saveFailed);
  };

  const toggle = async (next: boolean) => {
    const before = hide;
    setHide(next);
    setSavingHide(true);
    try {
      const saved = await saveCalendarSettings({ hideDetails: next });
      setHide(saved.hideDetails);
      say(t.saved);
    } catch {
      setHide(before);
      say(t.saveFailed);
    } finally {
      setSavingHide(false);
    }
  };

  return (
    <>
      <SectionHead>{t.settings}</SectionHead>
      <CardBox>
        {live && (
          <button
            type="button"
            onClick={() => setChoosing(true)}
            disabled={locked}
            className="flex min-h-[52px] w-full items-center gap-2.5 px-3.5 py-1.5 text-left lg:hover:bg-hover-row disabled:cursor-default"
          >
            <FactIcon icon="language" />
            <span className="min-w-0 flex-1 text-md text-ink">{t.language}</span>
            <span className="text-md text-muted" lang={language}>{LANGUAGE_NAMES[language]}</span>
            <LineIcon name="chevronRight" className="h-[18px] w-[18px] shrink-0 text-signal-grey" />
          </button>
        )}
        {readsCalendar && (
          <div className={cn('flex min-h-[52px] items-center gap-2.5 px-3.5 py-1.5', live && 'border-t border-divider')}>
            <FactIcon icon="eye" />
            <div className="min-w-0 flex-1">
              <p className="text-md text-ink" aria-hidden="true">{t.hideCalendar}</p>
              <p id={lineId} className="mt-0.5 text-sm leading-snug text-muted">{t.hideCalendarLine}</p>
            </div>
            <Switch
              id="hide-calendar"
              label={t.hideCalendar}
              checked={hide === true}
              disabled={hide === null || savingHide || locked || !changesCalendar}
              describedBy={lineId}
              onChange={(next) => void toggle(next)}
              phoneTarget
              className="[&>label]:sr-only"
            />
          </div>
        )}
      </CardBox>
      {live && (
        <ResponsiveSheet open={choosing} title={t.language} onClose={() => setChoosing(false)}>
          <div role="radiogroup" aria-label={t.language} className="flex flex-col gap-1.5">
            {LANGUAGES.map((code) => {
              const on = code === language;
              return (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  lang={code}
                  onClick={() => void pick(code)}
                  className={cn(
                    'flex min-h-12 items-center gap-2.5 rounded-row px-3 text-left text-md',
                    on ? 'bg-amber/[0.12] font-semibold text-ink ring-[1.5px] ring-inset ring-amber' : 'bg-hover-row text-ink',
                  )}
                >
                  <span aria-hidden="true" className={cn('h-[18px] w-[18px] shrink-0 rounded-full border-2', on ? 'border-[5px] border-amber' : 'border-line')} />
                  {LANGUAGE_NAMES[code]}
                </button>
              );
            })}
          </div>
        </ResponsiveSheet>
      )}
    </>
  );
}

/** *Tersimpan* in the language just chosen: the toast speaks the reader's new language. */
function messagesSaved(language: Language): string {
  return messagesIn(accountMessages, language).v1.saved;
}

/* ── Keamanan ────────────────────────────────────────────────────────────────────────────── */

function Security() {
  const t = useMessages(accountMessages);
  const language = useLanguage();
  const [open, setOpen] = useState<'password' | 'devices' | null>(null);
  const [devices, setDevices] = useState<{ n: number; current: string | null } | null>(null);

  useEffect(() => {
    let live = true;
    listSessions()
      .then((rows) => {
        if (!live) return;
        const mine = rows.find((s) => s.current);
        setDevices({ n: rows.length, current: mine ? describeDevice(mine.userAgent, language) : null });
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, [language, open]);

  return (
    <>
      <CardBox>
        <SecurityRow icon="lock" label={t.v1.changePassword} onOpen={() => setOpen('password')} />
        <SecurityRow
          icon="devices"
          label={t.sessions.heading}
          line={devices ? t.v1.devicesLine(devices) : undefined}
          onOpen={() => setOpen('devices')}
          divided
        />
      </CardBox>
      <ResponsiveSheet open={open === 'password'} title={t.v1.changePassword} onClose={() => setOpen(null)}>
        <PasswordForm />
      </ResponsiveSheet>
      <ResponsiveSheet open={open === 'devices'} title={t.sessions.heading} onClose={() => setOpen(null)}>
        {open === 'devices' && <SessionList bare />}
      </ResponsiveSheet>
    </>
  );
}

function SecurityRow({
  icon, label, line, onOpen, divided = false,
}: { icon: FactIconName; label: string; line?: string; onOpen: () => void; divided?: boolean }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn('flex min-h-[52px] w-full items-center gap-2.5 px-3.5 py-1.5 text-left lg:hover:bg-hover-row', divided && 'border-t border-divider')}
    >
      <FactIcon icon={icon} />
      <span className="min-w-0 flex-1">
        <span className="block text-md text-ink">{label}</span>
        {line && <span className="mt-0.5 block text-sm leading-snug text-muted">{line}</span>}
      </span>
      <LineIcon name="chevronRight" className="h-[18px] w-[18px] shrink-0 text-signal-grey" />
    </button>
  );
}

/** *Ubah kata sandi*: today's three fields, in their sheet (P4-T13; P18.95-T7 AC-3, UI-030's held reasons). */
function PasswordForm() {
  const language = useLanguage();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useMessages(accountMessages).password;

  // Only once they have started the second box — an empty field has not disagreed yet.
  const mismatch = confirmNewPassword.length > 0 && confirmNewPassword !== newPassword;
  const tooShort = newPassword.length > 0 && newPassword.length < 10;
  const missing = [
    [!currentPassword, t.current],
    [!newPassword, t.newPassword],
    [!confirmNewPassword, t.confirm],
  ].filter(([empty]) => empty).map(([, label]) => label as string);
  const held = !currentPassword || newPassword.length < 10 || mismatch || !confirmNewPassword;
  const heldWhy = held && !busy
    ? heldBecause({ missing, fix: tooShort ? t.tooShort({ n: 10 }) : mismatch ? t.fix : null }, language)
    : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      // The confirmation is a screen concern. The endpoint takes two fields.
      await api('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setDone(true);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <p className="text-md text-muted">{t.line}</p>
      {error && <ErrorBanner {...error} />}
      {done && <p role="status" className="text-md font-semibold text-success">{t.changed}</p>}
      <Field label={t.current} htmlFor="currentPassword">
        <PasswordInput id="currentPassword" autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      </Field>
      <Field label={t.newPassword} htmlFor="newPassword" hint={t.hint({ n: 10 })}>
        <PasswordInput id="newPassword" autoComplete="new-password" required minLength={10} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </Field>
      <Field label={t.confirm} htmlFor="confirmNewPassword" error={mismatch ? t.mismatch : undefined}>
        <PasswordInput id="confirmNewPassword" autoComplete="new-password" required value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} invalid={mismatch} />
      </Field>
      <div className="flex flex-col gap-1">
        <Button type="submit" disabled={busy || held} aria-describedby={heldWhy ? 'change-password-held' : undefined}>
          {busy ? t.changing : t.change}
        </Button>
        {heldWhy && <p id="change-password-held" className="text-xs text-muted">{heldWhy}</p>}
      </div>
    </form>
  );
}
