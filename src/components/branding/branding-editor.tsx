'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button, Card, ColorInput, TextInput } from '@/components/ui/field';
import { LineIcon, type LineIconName } from '@/components/ui/line-icon';
import { NavIcon } from '@/components/ui/nav-icon';
import { useFigureLanguage } from '@/i18n/language-provider';
import { brandingMessages } from '@/i18n/messages/branding';
import { DEFAULT_SYSTEM_NAME } from '@/i18n/system-name';
import { toDisplayError } from '@/lib/api-client';
import {
  brandingApi, paletteStyle, uploadBrandingImage, type BrandingOwner, type BrandingPreview, type BrandingView, type UploadKind,
} from '@/lib/branding';
import { cn } from '@/lib/cn';
import { formatNumber, formatPercent, formatRupiahCompact } from '@/lib/format';
import type { BrandingPalette } from '@/lib/session';
import { useMessagesAsWritten } from './as-written';

/** One picture of a draft: its folder, a preview link where the page has one, and the wide logo's size. */
export interface DraftImage { key: string; url?: string | null; width?: number; height?: number }
export type Pose = 'thinking' | 'celebrating' | 'pointing' | 'phone';
export const POSES: readonly Pose[] = ['thinking', 'celebrating', 'pointing', 'phone'];

/** **The page's working copy**: what *Simpan* sends, each group whole (ADR-0218 §3). */
export interface BrandingDraft {
  logo: DraftImage | null;
  logoSquare: DraftImage | null;
  primary: string | null;
  secondary: string | null;
  mascot: { default: DraftImage; poses: Partial<Record<Pose, DraftImage>> } | null;
}

export const EMPTY_DRAFT: BrandingDraft = { logo: null, logoSquare: null, primary: null, secondary: null, mascot: null };

/** The KPM's own branding as the editor's working copy; nothing set when it has none. */
export function draftOf(view: BrandingView | null): BrandingDraft {
  if (!view) return EMPTY_DRAFT;
  const poses: Partial<Record<Pose, DraftImage>> = {};
  for (const pose of POSES) {
    const img = view.mascot?.poses[pose];
    if (img) poses[pose] = { key: img.key, url: img.url };
  }
  return {
    logo: view.logo ? { key: view.logo.key, url: view.logo.url, width: view.logo.width, height: view.logo.height } : null,
    logoSquare: view.logoSquare ? { key: view.logoSquare.key, url: view.logoSquare.url } : null,
    primary: view.primary,
    secondary: view.secondary,
    mascot: view.mascot ? { default: { key: view.mascot.default.key, url: view.mascot.default.url }, poses } : null,
  };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** A colour token's value as the document paints it now, `#rrggbb`; `null` where none can be read (a spec's jsdom). */
function tokenValue(name: string): string | null {
  if (typeof window === 'undefined') return null;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim().toLowerCase();
  return HEX.test(value) ? value : null;
}

/**
 * What the preview answered for the two colours: the palette, with each colour's fill. No colour is refused
 * (P19.12-T3; ADR-0246): `invalid` is a colour that is not `#rrggbb`, or one set without the other.
 */
export type ColourCheck =
  | { state: 'idle' }
  | { state: 'ok'; preview: BrandingPreview }
  | { state: 'invalid' };

/** The longest *Nama sistem* (`BRANDING.SYSTEM_NAME_MAX_LENGTH` in the API, which refuses a longer one). */
export const SYSTEM_NAME_MAX_LENGTH = 40;

/**
 * ***Tampilan KPM*'s rows and its live phone** (P19.6-T1 AC-3 to AC-9; *redrawn 2026-11-20 by P19.21-T4 AC-1, AC-2,
 * ADR-0274*, frame 24 of `data-upload-pengaturan-*`): one white card of rows — *Nama sistem* (the KPM's page only),
 * *Logo*, *Logo persegi*, *Maskot*, *Warna utama*, *Warna kedua*, each an icon, its name, its line and its control —
 * and beside it (under it on a phone) *Pratinjau langsung*.
 *
 * Every colour is the API's: the preview asks `…/branding/preview` as the colours are typed and sets the palette it
 * answers **on the phone alone**, so the page around it does not change before *Simpan*. `onCheck` tells the page
 * whether *Simpan* may go. The KPM's page and a template's *Tampilan* section share it; a template has no name.
 */
export function BrandingEditor({ owner, draft, onChange, disabled, onCheck, name, preview }: {
  owner: BrandingOwner;
  draft: BrandingDraft;
  onChange: (next: BrandingDraft) => void;
  disabled: boolean;
  onCheck?: (check: ColourCheck) => void;
  /** *Nama sistem*, the KPM's page only: what is typed, `''` for AgencyBoost. */
  name?: { value: string; onChange: (value: string) => void };
  /** The phone's header and greeting: the branch, and the reader's first name. */
  preview?: { branch: string | null; firstName: string | null };
}) {
  const t = useMessagesAsWritten(brandingMessages);
  const [check, setCheck] = useState<ColourCheck>({ state: 'idle' });
  const ownerKey = JSON.stringify(owner);
  const nameId = useId();

  // The two colours, checked by the API as they are typed (AC-7, AC-9). Both or neither: a group is saved whole.
  useEffect(() => {
    const { primary, secondary } = draft;
    if (!primary && !secondary) {
      setCheck({ state: 'idle' });
      return;
    }
    if (!primary || !secondary || !HEX.test(primary) || !HEX.test(secondary)) {
      setCheck({ state: 'invalid' });
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      brandingApi.preview(JSON.parse(ownerKey) as BrandingOwner, primary, secondary)
        .then((answer) => { if (live) setCheck({ state: 'ok', preview: answer }); })
        // A preview that did not arrive paints nothing and blocks nothing: *Simpan* answers for itself.
        .catch(() => { if (live) setCheck({ state: 'idle' }); });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [draft, ownerKey]);

  useEffect(() => { onCheck?.(check); }, [check, onCheck]);

  const figures = useFigureLanguage();
  const palette = check.state === 'ok' ? check.preview.palette : null;
  // The field's one note: how its words read, and — where the colour was moved to a shade they read on — to which
  // (P19.12-T3 AC-3; ADR-0246 §5).
  const colourNote = (field: 'primary' | 'secondary') => {
    if (check.state !== 'ok') return null;
    const c = check.preview[field];
    const ratio = formatNumber(c.ratio, { decimals: 2 }, figures);
    return c.adjusted ? t.adjusted({ fill: c.fill, ratio, side: c.contrast }) : t.contrast({ ratio, side: c.contrast });
  };
  const setColour = (field: 'primary' | 'secondary', value: string) => {
    const next = { ...draft, [field]: value.trim() === '' ? null : value.trim() };
    // Both or neither (ADR-0218 §3): the other starts from the colour the app paints now, read from its token.
    if (next.primary && !next.secondary) next.secondary = tokenValue('--color-secondary');
    if (next.secondary && !next.primary) next.primary = tokenValue('--color-primary');
    onChange(next);
  };
  const [squareChanged, setSquareChanged] = useState(false);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" data-branding-editor="">
      <Card density="compact" className="flex min-w-0 flex-col px-4 py-1">
        {name && (
          <Row
            icon={<RowIcon name="letterCase" />}
            label={t.systemName}
            hint={t.systemNameHint}
            htmlFor={nameId}
            dataRow="system-name"
          >
            <TextInput
              id={nameId}
              value={name.value}
              maxLength={SYSTEM_NAME_MAX_LENGTH}
              placeholder={DEFAULT_SYSTEM_NAME}
              disabled={disabled}
              onChange={(e) => name.onChange(e.target.value)}
              className="w-44 sm:w-56"
            />
          </Row>
        )}
        <ImageRow
          owner={owner} kind="logo" label={t.logo} hint={t.logoHint} accept="image/png,image/jpeg,image/svg+xml"
          value={draft.logo} disabled={disabled}
          onSet={(img) => onChange({ ...draft, logo: img })}
          onRemove={() => onChange({ ...draft, logo: null, logoSquare: null })}
        />
        <ImageRow
          owner={owner} kind="logo_square" label={t.logoSquare} hint={t.logoSquareHint} accept="image/png"
          value={draft.logoSquare} disabled={disabled || !draft.logo}
          note={squareChanged ? t.homeIcon : null}
          onSet={(img) => { setSquareChanged(true); onChange({ ...draft, logoSquare: img }); }}
          onRemove={() => { setSquareChanged(true); onChange({ ...draft, logoSquare: null }); }}
        />
        <ImageRow
          owner={owner} kind="mascot" label={t.mascot} hint={t.mascotHint} accept="image/png"
          value={draft.mascot?.default ?? null} disabled={disabled}
          onSet={(img) => onChange({ ...draft, mascot: { default: img, poses: draft.mascot?.poses ?? {} } })}
          onRemove={() => onChange({ ...draft, mascot: null })}
        />
        {draft.mascot && (
          <fieldset className="m-0 flex flex-col border-0 border-b border-divider p-0 pb-2 pl-12" data-row="poses">
            <legend className="pt-2 text-sm font-semibold text-navy">{t.poses}</legend>
            {POSES.map((pose) => (
              <ImageRow
                key={pose} owner={owner} kind="mascot" label={t.pose[pose]} accept="image/png" compact
                value={draft.mascot!.poses[pose] ?? null} disabled={disabled}
                onSet={(img) => onChange({ ...draft, mascot: { ...draft.mascot!, poses: { ...draft.mascot!.poses, [pose]: img } } })}
                onRemove={() => {
                  const poses = { ...draft.mascot!.poses };
                  delete poses[pose];
                  onChange({ ...draft, mascot: { ...draft.mascot!, poses } });
                }}
              />
            ))}
          </fieldset>
        )}
        <ColourRow label={t.primary} hint={t.primaryHint} value={draft.primary} disabled={disabled}
          note={colourNote('primary')} onChange={(v) => setColour('primary', v)} />
        <ColourRow label={t.secondary} hint={t.secondaryHint} value={draft.secondary} disabled={disabled}
          note={colourNote('secondary')} onChange={(v) => setColour('secondary', v)} />
      </Card>
      <PhonePreview
        palette={palette}
        logo={draft.logo}
        name={name?.value.trim() || DEFAULT_SYSTEM_NAME}
        branch={preview?.branch ?? null}
        firstName={preview?.firstName ?? null}
      />
    </div>
  );
}

/** A row of the card: an icon, the setting's name and its one line, and its control on the right (frame 24). */
function Row({ icon, label, hint, htmlFor, children, note, dataRow, compact = false }: {
  icon?: ReactNode; label: string; hint?: string; htmlFor?: string; children: ReactNode;
  note?: ReactNode; dataRow?: string; compact?: boolean;
}) {
  const hintId = useId();
  return (
    <div className={cn('flex flex-col gap-1 border-b border-divider py-3 last:border-b-0', compact && 'border-b-0 py-1.5')} data-row={dataRow}>
      <div className="flex items-center gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          {htmlFor ? (
            <label htmlFor={htmlFor} className={cn('block font-semibold text-navy', compact ? 'text-base' : 'text-md')}>{label}</label>
          ) : (
            <span className={cn('block font-semibold text-navy', compact ? 'text-base' : 'text-md')}>{label}</span>
          )}
          {hint && <p id={hintId} className="m-0 text-sm text-muted">{hint}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{children}</div>
      </div>
      {note}
    </div>
  );
}

/** The 38px tile at a row's head: a line icon on the secondary's tint. */
function RowIcon({ name }: { name: LineIconName }) {
  return (
    <span aria-hidden="true" className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-secondary-100 text-navy">
      <LineIcon name={name} className="h-5 w-5" />
    </span>
  );
}

function ColourRow({ label, hint, value, disabled, note, onChange }: {
  label: string; hint: string; value: string | null; disabled: boolean;
  note: string | null; onChange: (value: string) => void;
}) {
  const id = useId();
  const t = useMessagesAsWritten(brandingMessages);
  // The typed colour, through a custom property: the swatch shows what is typed, never a colour of the stylesheet's.
  const swatch = { '--swatch': value && HEX.test(value) ? value : 'transparent' } as CSSProperties;
  return (
    <Row
      icon={<span aria-hidden="true" style={swatch} className="h-[38px] w-[38px] shrink-0 rounded-[11px] border border-hairline bg-[var(--swatch)]" />}
      label={label}
      hint={hint}
      htmlFor={id}
      dataRow="colour"
      note={<p id={`${id}-note`} className="m-0 min-h-5 pl-[50px] text-sm text-muted">{note ?? ''}</p>}
    >
      <ColorInput id={id} value={value ?? ''} disabled={disabled} onChange={onChange} aria-describedby={`${id}-note`} className="w-44" />
      <span className="sr-only">{t.hex({ field: label })}</span>
    </Row>
  );
}

function ImageRow({ owner, kind, label, hint, accept, value, disabled, onSet, onRemove, note, compact = false }: {
  owner: BrandingOwner; kind: UploadKind; label: string; hint?: string; accept: string; value: DraftImage | null;
  disabled: boolean; onSet: (img: DraftImage) => void; onRemove: () => void; note?: string | null; compact?: boolean;
}) {
  const t = useMessagesAsWritten(brandingMessages);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const done = await uploadBrandingImage(owner, kind, file);
      onSet({ key: done.storageKey, url: Object.values(done.previews)[0] ?? null, width: done.width, height: done.height });
    } catch (err) {
      setError(toDisplayError(err).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  // The tile is the picture once there is one: the row shows what is set where its icon was.
  const tile = value?.url ? (
    <span className={cn('flex h-[38px] shrink-0 items-center justify-center overflow-hidden rounded-[11px] border border-hairline bg-base',
      kind === 'logo' ? 'w-[76px]' : 'w-[38px]')}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a signed preview link of an upload */}
      <img src={value.url} alt={label} className="max-h-full max-w-full object-contain" />
    </span>
  ) : compact ? null : <RowIcon name="photo" />;

  return (
    <Row
      icon={tile}
      label={label}
      hint={hint}
      htmlFor={id}
      compact={compact}
      dataRow={`image-${kind}`}
      note={(error || note) ? (
        <div className="pl-[50px]">
          {error && <p role="alert" className="m-0 text-sm font-semibold text-alert">{error}</p>}
          {note && <p className="m-0 text-sm text-muted">{note}</p>}
        </div>
      ) : null}
    >
      <input
        ref={input} id={id} type="file" accept={accept} disabled={disabled || busy} className="sr-only"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <Button variant="secondary" disabled={disabled || busy} onClick={() => input.current?.click()} data-image-field={kind}>
        {busy ? t.uploading : value ? t.replace : t.choose}
      </Button>
      {value && !disabled && (
        <Button variant="secondary" onClick={onRemove}>{t.remove}</Button>
      )}
    </Row>
  );
}

/** The phone's sample figures: a picture of the app, said so under it — never this office's numbers. */
const SAMPLE = { clock: '9:41', targetMinor: 59_700_000_000, pctOfTarget: 87, active: 18, recruit: 4, coaching: 6 } as const;

/** The two letters of a name, for the header's tile when there is no logo: *Dynamic Smart System* → *DS*. */
function lettersOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || 'AB';
}

/**
 * ***Pratinjau langsung*** (P19.21-T4 AC-2; frame 24): a phone as a member holds it — the status bar, the header with
 * the logo, the system name and the branch, Home's greeting, the navy target card, the three orange tiles, the main
 * button and the bottom bar — drawn in the palette the API answered, set on this frame alone (`paletteStyle`), and in the
 * name as it is typed. With no palette yet, AgencyBoost's, as the stylesheet's defaults.
 *
 * **Its figures are an example**, and the line under it says so (data honesty): they picture the app, not the office.
 */
export function PhonePreview({ palette, logo, name, branch, firstName }: {
  palette: BrandingPalette | null; logo: DraftImage | null; name: string; branch: string | null; firstName: string | null;
}) {
  const t = useMessagesAsWritten(brandingMessages);
  const figures = useFigureLanguage();
  const headingId = useId();
  return (
    <Card density="compact" className="flex min-w-0 flex-col items-center px-4 py-4">
      <section aria-labelledby={headingId} className="flex w-full flex-col items-center" data-branding-preview="">
        <h2 id={headingId} className="m-0 self-start text-base font-semibold text-muted">{t.preview}</h2>
        <div data-preview-frame="phone" className="mt-2.5">
          <div
            style={paletteStyle(palette)}
            className="flex h-[480px] w-[248px] flex-col overflow-hidden rounded-[34px] border-8 border-ink bg-base shadow-lg"
          >
            <div className="flex items-center justify-between bg-card px-3.5 pb-1 pt-1.5 text-2xs font-bold text-ink" data-preview-part="status">
              <span>{SAMPLE.clock}</span>
              <span aria-hidden="true" className="h-4 w-[60px] rounded-[10px] bg-ink" />
              <span aria-hidden="true" className="flex items-center gap-0.5">
                <LineIcon name="wifi" className="h-3.5 w-3.5" />
                <LineIcon name="battery" className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="flex items-center gap-2 border-b border-divider bg-card px-3 pb-2.5 pt-1.5" data-preview-part="header">
              {logo?.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- a signed preview link of an upload
                <img src={logo.url} alt="" className="h-[26px] max-w-[64px] shrink-0 object-contain" />
              ) : (
                <span aria-hidden="true" className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-secondary text-2xs font-extrabold text-primary-on-secondary">
                  {lettersOf(name)}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-bold leading-tight text-secondary-ink" data-preview-part="name">{name}</span>
                {branch && <span className="block truncate text-2xs text-muted">{branch}</span>}
              </span>
            </div>
            <div className="flex flex-1 flex-col p-3">
              <span className="text-2xs text-muted">{t.previewGreeting}</span>
              {firstName && <span className="mb-2 text-md font-extrabold text-secondary-ink">{firstName}</span>}
              <div className="rounded-2xl bg-secondary p-3 text-secondary-contrast" data-preview-part="card">
                <span className="block text-2xs opacity-80">{t.previewTarget}</span>
                <span className="my-0.5 block text-xl font-extrabold text-primary-on-secondary">
                  {formatRupiahCompact(SAMPLE.targetMinor, {}, figures)}
                </span>
                <span className="text-2xs font-semibold">{t.previewOfTarget({ pct: formatPercent(SAMPLE.pctOfTarget, {}, figures) })}</span>
                <span aria-hidden="true" className="mt-1.5 block h-[5px] overflow-hidden rounded-pill bg-secondary-contrast/20">
                  <span className="block h-full w-[87%] rounded-pill bg-primary" />
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5" data-preview-part="tiles">
                {([[t.previewActive, SAMPLE.active], [t.previewRecruit, SAMPLE.recruit], [t.previewCoaching, SAMPLE.coaching]] as const)
                  .map(([label, value]) => (
                    <span key={label} className="flex min-w-0 flex-col rounded-xl bg-primary-50 p-2">
                      <span className="truncate text-2xs font-bold text-secondary-ink">{label}</span>
                      <span className="text-lg font-extrabold text-secondary-ink">{formatNumber(value, {}, figures)}</span>
                    </span>
                  ))}
              </div>
              <span className="mt-2.5 block rounded-pill bg-primary px-2 py-2 text-center text-2xs font-extrabold text-primary-contrast" data-preview-part="button">
                {t.previewButton}
              </span>
            </div>
            <div aria-hidden="true" className="mx-2.5 mb-2.5 flex items-center justify-around rounded-pill bg-card p-1.5 shadow-md" data-preview-part="nav">
              {(['ti-list-check', 'ti-calendar', 'ti-home', 'ti-chart-bar', 'ti-layout-grid'] as const).map((icon) => (
                <span key={icon} className={cn('flex h-8 w-8 items-center justify-center rounded-full text-muted',
                  icon === 'ti-home' && 'bg-secondary text-secondary-contrast')}>
                  <NavIcon name={icon} className="h-4 w-4" />
                </span>
              ))}
            </div>
          </div>
        </div>
        <p className="m-0 mt-2 text-center text-sm text-muted">{t.previewNote} · {t.previewExample}</p>
      </section>
    </Card>
  );
}
