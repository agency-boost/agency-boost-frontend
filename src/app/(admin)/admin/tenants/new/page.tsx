'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { Page } from '@/components/page';
import { AddSheet, ChoicePill, InfoTip } from '@/components/ui/rows-and-sheets';
import {
  Button, Card, ErrorBanner, Field, ReadOnlyField, Select, TextInput,
} from '@/components/ui/field';
import { useMediaQuery } from '@/lib/use-media-query';
import { useToast } from '@/components/ui/toast';
import { useMessages } from '@/i18n/language-provider';
import { adminKpmOwnerMessages } from '@/i18n/messages/admin-kpm-owner';
import { adminOfficesMessages } from '@/i18n/messages/admin-offices';
import {
  createTenant, insurersOf, listCompanies, type Company, type OwnerInput, type StartFrom,
} from '@/lib/admin';
import { toDisplayError } from '@/lib/api-client';
import { normalisedPhone } from '@/lib/phone-number';
import { templateHref, templateProgress } from '@/lib/template-sections';
import {
  allSources, TemplateSourceSelect, useTemplateSources, type SourceOption,
} from '@/components/kpm-template/template-sources';

const CODE = /^[A-Za-z0-9-]{2,16}$/;
/** A whole email address, as the API's `@IsEmail` reads one closely enough to say so before the round trip. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** An agent code: digits only (`AGENT_CODE_PATTERN`). */
const AGENT_CODE = /^\d{3,32}$/;

/**
 * What the form sends for one *Mulai dari* choice (ADR-0115 §4, ADR-0164 §5, ADR-0185 §5): `empty`, one of the
 * company's own templates, or one of the platform's built-in ones — copied across companies (`templateLibrary`).
 * *AgencyBoost defaults* is not one: the built-in templates hold them, and the API refuses the source (ADR-0168 §2).
 */
function startFromOf(option: SourceOption | null, companyId: string): StartFrom {
  if (!option) return { kind: 'empty' };
  if (option.companyId === companyId) return { kind: 'template', templateId: option.templateId };
  return { kind: 'template', templateLibrary: true, templateId: option.templateId };
}

/**
 * ***KPM baru*, in three steps** (P19.4-T3 AC-6; ADR-0212 §1; SA UI-014, the setup spec's A2 and A5-1):
 *
 * 1. ***Detail KPM***: the company, *Mulai dari*, the code, the branch, the address and the phone, as before — and, below
 *    *Mulai dari*, **SA UI-019's warning** when the chosen template has sections with changes not yet published (AC-14),
 *    with *Buka template*;
 * 2. ***Pemilik KPM***: *Nama\**, *No. WhatsApp\**, *Email*, *Kode agen pemilik*, with *"Lewati, nanti saja"*;
 * 3. **the invitation**: *"Kirim undangan ke pemilik sekarang …"*, on by default.
 *
 * One form, its three steps numbered sections of it, as the mockup draws one form (`superadmin-kpm-setup-2026-11-02.html`,
 * `vNew`): the API makes the KPM and its Owner as one unit, so a wizard that wrote step 1 before step 2 would leave a
 * KPM behind a refused Owner. On success the KPM's page opens with *"KPM dibuat. Undangan dikirim."* — the shell's toast,
 * which stays across the navigation.
 *
 * **Not here** (ADR-0206 §7): SA UI-014's *Import agents* step and the mockup's *Admin KPM* block. The Owner imports, and
 * delegation is the Owner's (roles §3.3); step 3 says so in one line. **The invitation goes by email** (ADR-0212 §4): the
 * mockup's *"Undangan dikirim lewat WhatsApp"* is not built — the number is kept to call (parity I-755).
 *
 * **In the add sheet** (P19.2-T2 AC-3, AC-4; UI-133: *the same pattern for … /admin/tenants/new ("KPM baru")*;
 * `admin-desktop` screen 4's caption): reached from *KPM baru* on the KPMs list, the form opens as a bottom sheet on a
 * phone and a centred modal from 768px, *Batal / Buat KPM* pinned at its foot. **The main button is enabled**: a field
 * left empty says so when it is pressed, and nothing is sent until every one is right. Esc, ✕ and *Batal* close it
 * without saving, back to the KPMs list. **Below 1024px no native select** (UI-134): the company and *Mulai dari* are
 * pills opening their choices; a laptop keeps its two selects.
 */
export default function NewTenantPage() {
  const router = useRouter();
  const { create: t } = useMessages(adminOfficesMessages);
  const o = useMessages(adminKpmOwnerMessages);
  const { show } = useToast();
  const belowLaptop = useMediaQuery(['phone', 'tablet']);
  /** `null` while the companies are read: neither the sheet nor *Create a company first* until they are. */
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [form, setForm] = useState({
    companyId: '',
    code: '',
    branchName: '',
    address: '',
    contactPhone: '',
  });
  const [owner, setOwner] = useState({ fullName: '', phone: '', email: '', agentCode: '' });
  /** *"Lewati, nanti saja"*: no Owner now — the KPM is made without one and *Perlu perhatian Anda* lists it. */
  const [skipOwner, setSkipOwner] = useState(false);
  const [sendInvitation, setSendInvitation] = useState(true);
  /** A field is said to be wrong once it has been left, or once *Buat KPM* was pressed. */
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const ids = { invite: useId() };
  /**
   * **Mulai dari** (ADR-0115 §4, ADR-0168 §2, ADR-0185 §5): the one picker *Template baru* uses — the company's active
   * templates under its name, the default first and chosen; *Template bawaan AgencyBoost*; and *Kosong*. Read again
   * whenever the company changes; nothing is chosen, and the form cannot be sent, until it has been read (P13.2's exit
   * review, finding 7: choosing for the reader made an office from something they were never shown).
   */
  const sources = useTemplateSources(Boolean(form.companyId), { companyId: form.companyId, others: false, archived: false });
  const options = allSources(sources.groups);
  const [startFrom, setStartFrom] = useState('');
  useEffect(() => { setStartFrom(''); }, [form.companyId]);
  // The reader's pick; else the company's default; else — a company with no template of its own — the platform's.
  const fallback = sources.groups === null ? '' : (options[0]?.value ?? 'empty');
  const chosen = startFrom === 'empty' || options.some((o) => o.value === startFrom) ? startFrom : fallback;
  const option = options.find((o) => o.value === chosen) ?? null;
  const hint = chosen === 'empty' ? 'empty' : option && option.companyId !== form.companyId ? 'library' : 'template';
  // SA UI-019 (AC-14): the sections of the chosen template with a change waiting, counted as the template's card counts.
  const waiting = option ? templateProgress(option.template).waiting : 0;
  // The insurers: the built-in templates' company holds no office (ADR-0164 §3), and the API refuses one.
  const insurers = insurersOf(companies ?? []);

  useEffect(() => {
    void listCompanies()
      .then((cos) => {
        setCompanies(cos);
        setForm((f) => (f.companyId ? f : { ...f, companyId: insurersOf(cos)[0]?._id ?? '' }));
      })
      .catch(() => setCompanies([]));
  }, []);

  const badCode = form.code.length > 0 && !CODE.test(form.code);
  const pressed = Boolean(touched.submit);
  const codeIssue = badCode ? t.codeError : pressed && !form.code ? t.required : undefined;
  const branchIssue = pressed && !form.branchName.trim() ? t.required : undefined;
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });
  const setO = (k: keyof typeof owner) => (e: { target: { value: string } }) =>
    setOwner({ ...owner, [k]: e.target.value });
  const leave = (k: string) => () => setTouched((was) => ({ ...was, [k]: true }));

  // *Pemilik KPM*'s own checks, the API's again (it refuses each, naming `owner.<field>`).
  const ownerIssues = skipOwner ? {} : {
    fullName: owner.fullName.trim().length < 2 ? o.owner.nameError : undefined,
    phone: normalisedPhone(owner.phone) === null ? o.owner.phoneError : undefined,
    email: owner.email.trim() && !EMAIL.test(owner.email.trim()) ? o.owner.emailError : undefined,
    agentCode: owner.agentCode.trim() && !AGENT_CODE.test(owner.agentCode.trim()) ? t.codeError : undefined,
  } as Record<string, string | undefined>;
  const ownerOk = Object.values(ownerIssues).every((issue) => !issue);
  const shown = (k: string) => (touched[k] || touched.submit ? ownerIssues[k] : undefined);
  const hasEmail = Boolean(owner.email.trim());

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched((was) => ({ ...was, submit: true }));
    // Nothing is sent until every field is right — the main button stays enabled (UI-133) and each says what it needs.
    if (!ownerOk || busy || badCode || !form.code || !form.branchName.trim() || !chosen) return;
    setBusy(true);
    setError(null);
    const named: OwnerInput | undefined = skipOwner ? undefined : {
      fullName: owner.fullName.trim(),
      phone: owner.phone.trim(),
      ...(owner.email.trim() ? { email: owner.email.trim() } : {}),
      ...(owner.agentCode.trim() ? { agentCode: owner.agentCode.trim() } : {}),
    };
    try {
      const kpm = await createTenant({
        companyId: form.companyId,
        code: form.code,
        branchName: form.branchName,
        ...(form.address ? { address: form.address } : {}),
        ...(form.contactPhone ? { contactPhone: form.contactPhone } : {}),
        startFrom: startFromOf(option, form.companyId),
        ...(named ? { owner: named, sendInvitation } : {}),
      });
      // A5-1: *"KPM dibuat. Undangan dikirim."* — said only when it went; the shell's toast outlives the navigation.
      show(kpm.invitationSent ? o.created : o.createdNoInvitation);
      router.push(`/admin/tenants/${kpm._id}`);
    } catch (err) {
      setError(toDisplayError(err));
      setBusy(false);
    }
  }

  /*
   * **What *Mulai dari* does, and the code's rule** (P19.2-T2 AC-7; UI-136, Appendix A's `/admin/tenants/new` row: *ⓘ ·
   * Show · Show*, wording unchanged): written out from 768px, behind an ⓘ on a phone — the first beside *Mulai dari*,
   * inside the sheet, where the reader is.
   */
  const total = skipOwner ? 2 : 3;

  /** *Mulai dari*'s choices as the pill offers them below 1024px: the select's, in its order, each under whose it is. */
  const sourceChoices = sources.groups === null
    ? [{ key: '', label: sources.error ? t.notLoaded : t.loading }]
    : [
      ...sources.groups.flatMap((g) => g.options.map((o) => ({ key: o.value, label: o.label, hint: g.label }))),
      { key: 'empty', label: t.empty },
    ];

  return (
    <Page title={t.title}>
      {companies !== null && insurers.length === 0 && (
        <Card className="max-w-2xl">
          <p className="text-md text-navy">{t.noCompany}</p>
          <Link href="/admin/companies" className="mt-2 inline-block text-md text-navy underline">
            {t.createCompany}
          </Link>
        </Card>
      )}
      <AddSheet
        open={insurers.length > 0}
        title={t.title}
        submitLabel={busy ? t.creating : t.submit}
        busy={busy}
        wide
        onClose={() => router.push('/admin/tenants')}
        onSubmit={submit}
      >
        <p data-explains="start-from" className="text-md text-muted max-md:hidden">{t.subtitle}</p>
        {error && <ErrorBanner {...error} />}

        <StepHeading n={1} of={total} title={o.steps.details} />

        <Field label={t.company} htmlFor="companyId">
          {belowLaptop ? (
            <ChoicePill
              id="companyId"
              name={t.company}
              options={insurers.map((c) => ({ key: c._id, label: c.name }))}
              value={form.companyId}
              onChange={(companyId) => setForm((f) => ({ ...f, companyId }))}
              narrows={false}
              shows="value"
              className="self-start"
            />
          ) : (
            <Select id="companyId" required value={form.companyId} onChange={set('companyId')}>
              {insurers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="flex flex-col gap-1">
          <div className="flex items-start gap-1">
            <Field
              label={t.startFrom}
              htmlFor="startFrom"
              hint={sources.error ? undefined : t.hint[hint]}
              error={sources.error ? t.templatesFailed({ message: sources.error.message }) : undefined}
              className="min-w-0 flex-1"
            >
              {belowLaptop ? (
                <ChoicePill
                  id="startFrom"
                  name={t.startFrom}
                  options={sourceChoices}
                  value={sources.groups === null ? '' : chosen}
                  onChange={setStartFrom}
                  narrows={false}
                  shows="value"
                  disabled={sources.groups === null}
                  className="self-start"
                />
              ) : (
                // One element throughout, so the control a reader is on is never replaced under them.
                <TemplateSourceSelect
                  id="startFrom"
                  groups={sources.groups ?? []}
                  value={chosen}
                  onChange={setStartFrom}
                  disabled={sources.groups === null}
                  invalid={Boolean(sources.error)}
                >
                  {sources.groups === null
                    ? <option value="">{sources.error ? t.notLoaded : t.loading}</option>
                    : <option value="empty">{t.empty}</option>}
                </TemplateSourceSelect>
              )}
            </Field>
            <InfoTip about={t.title} tip={t.subtitle} className="mt-0.5 md:hidden" />
          </div>
          {/* Outside the field, which links its hint and error to one control only. */}
          {sources.error && (
            <Button variant="inline" className="self-start" onClick={sources.retry}>
              {t.tryAgain}
            </Button>
          )}
          {/* SA UI-019 (AC-14; SA case 10): the warning, below *Mulai dari*, while the chosen template has drafts. */}
          {option && waiting > 0 && (
            <p data-warns="drafts" className="rounded-md border border-pill-amber-ink/30 bg-primary/12 p-3 text-md text-navy">
              {o.drafts({ n: waiting })}{' '}
              <Link href={templateHref(option.companyId, option.templateId)} className="font-semibold underline">
                {o.openTemplate}
              </Link>
            </p>
          )}
        </div>

        <div className="flex items-start gap-1">
          <Field
            label={t.code}
            htmlFor="code"
            hint={t.codeHint}
            hintOnPhone={false}
            error={codeIssue}
            className="min-w-0 flex-1"
          >
            <TextInput id="code" required value={form.code} onChange={set('code')} invalid={Boolean(codeIssue)} />
          </Field>
          <InfoTip about={t.code} tip={t.codeHint} className="mt-0.5 md:hidden" />
        </div>

        <Field label={t.branchName} htmlFor="branchName" error={branchIssue}>
          <TextInput
            id="branchName" required minLength={2} value={form.branchName} onChange={set('branchName')}
            invalid={Boolean(branchIssue)}
          />
        </Field>

        <Field label={t.address} htmlFor="address" hint={t.optional}>
          <TextInput id="address" value={form.address} onChange={set('address')} />
        </Field>

        <Field label={t.contactPhone} htmlFor="contactPhone" hint={t.optional}>
          <TextInput id="contactPhone" value={form.contactPhone} onChange={set('contactPhone')} />
        </Field>

        {/* Shown, not asked for. This was a free-text box: `Asia/Jakata` was
            accepted by both halves, and every day boundary in that office then
            resolved to an Invalid DateTime for ever, with nothing raised at
            creation (ADR-0016). */}
        <ReadOnlyField
          label={t.timeZone}
          value="Asia/Jakarta"
          reason={t.timeZoneReason}
        />

        <StepHeading n={2} of={total} title={o.steps.owner} />
        {skipOwner ? (
          <div className="flex flex-col gap-2">
            <p className="text-md text-muted">{o.owner.skipped}</p>
            <Button variant="inline" className="self-start max-lg:min-h-11" onClick={() => setSkipOwner(false)}>
              {o.owner.undoSkip}
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={o.owner.name} htmlFor="ownerName" hint={o.owner.required} error={shown('fullName')}>
              <TextInput
                id="ownerName" required autoComplete="off" value={owner.fullName}
                onChange={setO('fullName')} onBlur={leave('fullName')} invalid={Boolean(shown('fullName'))}
              />
            </Field>
            <Field label={o.owner.phone} htmlFor="ownerPhone" hint={o.owner.phoneHint} error={shown('phone')}>
              <TextInput
                id="ownerPhone" required inputMode="tel" autoComplete="off" value={owner.phone}
                onChange={setO('phone')} onBlur={leave('phone')} invalid={Boolean(shown('phone'))}
              />
            </Field>
            <Field label={o.owner.email} htmlFor="ownerEmail" hint={o.owner.emailHint} error={shown('email')}>
              <TextInput
                id="ownerEmail" type="email" autoComplete="off" value={owner.email}
                onChange={setO('email')} onBlur={leave('email')} invalid={Boolean(shown('email'))}
              />
            </Field>
            <Field label={o.owner.agentCode} htmlFor="ownerCode" hint={o.owner.agentCodeHint} error={shown('agentCode')}>
              <TextInput
                id="ownerCode" inputMode="numeric" autoComplete="off" value={owner.agentCode}
                onChange={setO('agentCode')} onBlur={leave('agentCode')} invalid={Boolean(shown('agentCode'))}
              />
            </Field>
            <Button variant="inline" className="self-start max-lg:min-h-11 md:col-span-2" onClick={() => setSkipOwner(true)}>
              {o.owner.skip}
            </Button>
          </div>
        )}

        {!skipOwner && (
          <>
            <StepHeading n={3} of={total} title={o.steps.invitation} />
            <div>
              {/* The box's line 44px tall below 1024px (UI-135: ≥ 44px on a phone and a tablet). */}
              <label className="flex items-start gap-2 text-md text-navy max-lg:min-h-11 max-lg:items-center">
                <input
                  type="checkbox"
                  className="mt-1 max-lg:mt-0"
                  checked={sendInvitation}
                  onChange={(e) => setSendInvitation(e.target.checked)}
                  aria-describedby={ids.invite}
                />
                {o.invitation.send}
              </label>
              <p id={ids.invite} className="mt-1 text-sm text-muted">
                {hasEmail ? o.invitation.importLine : o.invitation.noEmail}
              </p>
            </div>
          </>
        )}
      </AddSheet>
    </Page>
  );
}

/** A step's heading: its number and name, the number said whole to a screen reader (*Langkah 2 dari 3*). */
function StepHeading({ n, of, title }: { n: number; of: number; title: string }) {
  const o = useMessages(adminKpmOwnerMessages);
  return (
    <h2 className="mt-2 flex items-center gap-2 border-t border-hairline pt-4 font-display text-md font-bold text-navy first-of-type:mt-0 first-of-type:border-t-0 first-of-type:pt-0">
      <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-secondary text-xs text-secondary-contrast">
        {n}
      </span>
      <span className="sr-only">{o.steps.stepOf({ n, of })}: </span>
      {title}
    </h2>
  );
}
