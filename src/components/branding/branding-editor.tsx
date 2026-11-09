'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Boost } from '@/components/boost';
import { Button, ColorInput, Field } from '@/components/ui/field';
import { kept } from '@/i18n/kept';
import { useMessages } from '@/i18n/language-provider';
import { brandingMessages } from '@/i18n/messages/branding';
import { ApiRequestError, toDisplayError } from '@/lib/api-client';
import {
  brandingApi, paletteStyle, uploadBrandingImage, type BrandingOwner, type BrandingPreview, type BrandingView, type UploadKind,
} from '@/lib/branding';
import { cn } from '@/lib/cn';
import type { BrandingPalette } from '@/lib/session';

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

/** What the preview answered for the two colours: the palette, or which one no text reads on (acceptance 2). */
export type ColourCheck =
  | { state: 'idle' }
  | { state: 'ok'; preview: BrandingPreview }
  | { state: 'unreadable'; field: 'primary' | 'secondary' }
  | { state: 'invalid' };

/**
 * ***Tampilan KPM*'s fields and its live preview** (P19.6-T1 AC-3 to AC-9; ADR-0218 §2, §5; `functional/branding.md`),
 * the KPM's page's and the template's section's alike. Every colour is the API's: the preview asks
 * `…/branding/preview` as the colours are typed and sets the palette it answers **on the preview's frame alone**, so the
 * page around it does not change before *Simpan*. `onCheck` tells the page whether *Simpan* may go.
 */
export function BrandingEditor({ owner, draft, onChange, disabled, onCheck }: {
  owner: BrandingOwner;
  draft: BrandingDraft;
  onChange: (next: BrandingDraft) => void;
  disabled: boolean;
  onCheck?: (check: ColourCheck) => void;
}) {
  const t = useMessages(brandingMessages);
  const [check, setCheck] = useState<ColourCheck>({ state: 'idle' });
  const ownerKey = JSON.stringify(owner);

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
        .then((preview) => { if (live) setCheck({ state: 'ok', preview }); })
        .catch((err: unknown) => {
          if (!live) return;
          const field = err instanceof ApiRequestError && err.error.code === 'BRANDING_COLOUR_UNREADABLE'
            ? ((err.error.details as { field?: 'primary' | 'secondary' } | undefined)?.field ?? 'primary')
            : null;
          setCheck(field ? { state: 'unreadable', field } : { state: 'invalid' });
        });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [draft, ownerKey]);

  useEffect(() => { onCheck?.(check); }, [check, onCheck]);

  const palette = check.state === 'ok' ? check.preview.palette : null;
  const colourNote = (field: 'primary' | 'secondary') => {
    if (check.state === 'unreadable' && check.field === field) return { tone: 'alert' as const, text: t.unreadable };
    if (check.state === 'ok') {
      const c = check.preview[field];
      return { tone: 'muted' as const, text: t.contrast({ ratio: c.ratio.toFixed(2), side: c.contrast }) };
    }
    return null;
  };
  const setColour = (field: 'primary' | 'secondary', value: string) => {
    const next = { ...draft, [field]: value.trim() === '' ? null : value.trim() };
    // Both or neither (ADR-0218 §3): the other starts from the colour the app paints now, read from its token.
    if (next.primary && !next.secondary) next.secondary = tokenValue('--color-secondary');
    if (next.secondary && !next.primary) next.primary = tokenValue('--color-primary');
    onChange(next);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" data-branding-editor="">
      <div className="flex min-w-0 flex-col gap-5">
        <ImageField
          owner={owner} kind="logo" label={t.logo} hint={t.logoHint} accept="image/png,image/jpeg,image/svg+xml"
          value={draft.logo} disabled={disabled}
          onSet={(img) => onChange({ ...draft, logo: img })}
          onRemove={() => onChange({ ...draft, logo: null, logoSquare: null })}
        />
        <ImageField
          owner={owner} kind="logo_square" label={t.logoSquare} hint={t.logoSquareHint} accept="image/png"
          value={draft.logoSquare} disabled={disabled || !draft.logo}
          onSet={(img) => onChange({ ...draft, logoSquare: img })}
          onRemove={() => onChange({ ...draft, logoSquare: null })}
        />
        <ColourField label={t.primary} hint={t.primaryHint} value={draft.primary} disabled={disabled}
          note={colourNote('primary')} onChange={(v) => setColour('primary', v)} />
        <ColourField label={t.secondary} hint={t.secondaryHint} value={draft.secondary} disabled={disabled}
          note={colourNote('secondary')} onChange={(v) => setColour('secondary', v)} />
        <ImageField
          owner={owner} kind="mascot" label={t.mascot} hint={t.mascotHint} accept="image/png"
          value={draft.mascot?.default ?? null} disabled={disabled}
          onSet={(img) => onChange({ ...draft, mascot: { default: img, poses: draft.mascot?.poses ?? {} } })}
          onRemove={() => onChange({ ...draft, mascot: null })}
        />
        {draft.mascot && (
          <fieldset className="flex flex-col gap-3 border-0 p-0">
            <legend className="mb-1 text-md font-semibold text-navy">{t.poses}</legend>
            {POSES.map((pose) => (
              <ImageField
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
      </div>
      <BrandingPreviewFrames palette={palette} logo={draft.logo} mascot={draft.mascot?.default ?? null} />
    </div>
  );
}

function ColourField({ label, hint, value, disabled, note, onChange }: {
  label: string; hint: string; value: string | null; disabled: boolean;
  note: { tone: 'alert' | 'muted'; text: string } | null; onChange: (value: string) => void;
}) {
  const id = useId();
  const t = useMessages(brandingMessages);
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <ColorInput id={id} value={value ?? ''} disabled={disabled} onChange={onChange} aria-describedby={`${id}-note`} />
      <span className="sr-only">{t.hex({ field: label })}</span>
      <p id={`${id}-note`} role={note?.tone === 'alert' ? 'alert' : undefined}
        className={cn('mt-1 min-h-5 text-sm', note?.tone === 'alert' ? 'font-semibold text-alert' : 'text-muted')}>
        {note?.text ?? ''}
      </p>
    </Field>
  );
}

function ImageField({ owner, kind, label, hint, accept, value, disabled, onSet, onRemove, compact = false }: {
  owner: BrandingOwner; kind: UploadKind; label: string; hint?: string; accept: string; value: DraftImage | null;
  disabled: boolean; onSet: (img: DraftImage) => void; onRemove: () => void; compact?: boolean;
}) {
  const t = useMessages(brandingMessages);
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

  return (
    <div className={cn('flex flex-col gap-1.5', compact && 'gap-1')} data-image-field={kind}>
      <label htmlFor={id} className={cn('font-semibold text-navy', compact ? 'text-base' : 'text-md')}>{label}</label>
      {hint && <p className="m-0 text-sm text-muted">{hint}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-hairline bg-base',
          kind === 'logo' ? 'h-12 w-40' : 'h-12 w-12')}>
          {value?.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- a signed preview link of an upload
            <img src={value.url} alt={label} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="px-1 text-center text-xs text-muted">{value ? t.set : t.notSet}</span>
          )}
        </span>
        <input
          ref={input} id={id} type="file" accept={accept} disabled={disabled || busy} className="sr-only"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        <Button variant="secondary" disabled={disabled || busy} onClick={() => input.current?.click()}>
          {busy ? t.uploading : value ? t.replace : t.choose}
        </Button>
        {value && !disabled && (
          <Button variant="secondary" onClick={onRemove}>{t.remove}</Button>
        )}
      </div>
      {error && <p role="alert" className="m-0 text-sm font-semibold text-alert">{error}</p>}
    </div>
  );
}

/**
 * **The live preview** (AC-9): a phone and a laptop, each with the navbar, a button, a card and Home's quote with the
 * mascot, drawn in the palette the API answered — set on these frames alone (`paletteStyle`). With no palette yet,
 * AgencyBoost's, as the stylesheet's defaults.
 */
export function BrandingPreviewFrames({ palette, logo, mascot }: {
  palette: BrandingPalette | null; logo: DraftImage | null; mascot: DraftImage | null;
}) {
  const t = useMessages(brandingMessages);
  const frame = (wide: boolean) => (
    <figure className="m-0 flex flex-col gap-1.5" data-preview-frame={wide ? 'laptop' : 'phone'}>
      <figcaption className="text-xs font-semibold text-muted">{wide ? t.laptop : t.phone}</figcaption>
      <div style={paletteStyle(palette)} className={cn('overflow-hidden rounded-lg border border-hairline bg-base', wide ? 'w-full' : 'w-[200px]')}>
        <div className="flex h-10 items-center gap-2 bg-secondary px-3 text-secondary-contrast" data-preview-part="navbar">
          {logo?.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- a signed preview link of an upload
            <img src={logo.url} alt="" className="max-h-6 max-w-[120px] object-contain" />
          ) : (
            <span className="text-md font-extrabold">{kept('AgencyBoost')}</span>
          )}
        </div>
        <div className={cn('flex flex-col gap-2 p-3', wide && 'md:flex-row md:items-start')}>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="rounded-row bg-secondary px-3 py-2 text-sm font-semibold text-secondary-contrast" data-preview-part="card">
              {t.previewCard}
              <span className="mt-1 block h-1.5 overflow-hidden rounded-pill bg-secondary-contrast/20">
                <span className="block h-full w-2/3 rounded-pill bg-primary" />
              </span>
            </div>
            <span className="inline-flex min-h-9 items-center justify-center rounded-pill bg-primary px-4 text-sm font-bold text-primary-contrast" data-preview-part="button">
              {t.previewButton}
            </span>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-row bg-secondary py-2 pl-1 pr-3" data-preview-part="quote">
            {mascot?.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- a signed preview link of an upload
              <img src={mascot.url} alt="" className="h-12 w-12 shrink-0 object-contain" />
            ) : (
              <Boost pose="thinking" size={48} />
            )}
            <p className="m-0 text-xs italic leading-snug text-secondary-contrast">
              <span aria-hidden="true" className="mr-0.5 text-lg font-extrabold not-italic text-primary-on-secondary">“</span>
              {t.previewQuote}
            </p>
          </div>
        </div>
      </div>
    </figure>
  );
  return (
    <section aria-label={t.preview} className="flex min-w-0 flex-col gap-3" data-branding-preview="">
      <h2 className="m-0 text-md font-semibold text-navy">{t.preview}</h2>
      <div className="flex flex-wrap items-start gap-4">
        {frame(false)}
        <div className="min-w-[240px] flex-1">{frame(true)}</div>
      </div>
    </section>
  );
}
