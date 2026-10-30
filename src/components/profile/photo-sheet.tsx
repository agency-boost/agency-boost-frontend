'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { useMessages } from '@/i18n/language-provider';
import { accountMessages } from '@/i18n/messages/account';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  AvatarUploadFailed, clampPlacement, coverScale, cropToJpeg, PHOTO_ZOOM, removeAvatar, uploadAvatar,
  type PhotoPlacement,
} from '@/lib/profile';

/** The preview circle: 220px, as the mockup draws it. */
const PREVIEW_PX = 220;

/** How far an arrow key moves the picture. */
const NUDGE_PX = 8;

const CENTRED: PhotoPlacement = { x: 0, y: 0, zoom: 1 };

/**
 * ***Foto profil*** (UI V1, UI-111; `profile-mobile`'s photo sheet): a 220px circle with the picture in it — **dragged
 * to move it, the slider to zoom it** — *Kamera* and *Galeri* to choose one, *Simpan foto* (grey until a picture is
 * chosen) and *Hapus foto* when there is one to remove.
 *
 * *Simpan foto* crops what the circle shows to a 256 × 256 JPEG on a canvas (`cropToJpeg`) and uploads it straight to
 * storage before attaching it (`uploadAvatar`); the session is then read again (`onChanged`), so the title row's avatar
 * and the *Lainnya* sheet show it at once. The picture never leaves the device until then. Keyboard: the circle takes
 * the arrow keys to move the picture, the slider zooms.
 *
 * Its own module, loaded the first time the sheet opens (common.md: a sheet costs nothing until then).
 */
export function PhotoSheet({
  open,
  onClose,
  current,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  /** Their saved photo's link, or `null`: *Hapus foto* is offered only when there is one. */
  current: string | null;
  /** After a save or a removal: read the session again, and say so. */
  onChanged: (said: string) => Promise<void> | void;
}) {
  const t = useMessages(accountMessages).v1;
  const hintId = useId();
  const [source, setSource] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [placement, setPlacement] = useState<PhotoPlacement>(CENTRED);
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const drag = useRef<{ x: number; y: number; from: PhotoPlacement } | null>(null);

  // A picture chosen is an object URL the tab holds; it is let go when another is chosen or the sheet goes.
  useEffect(() => () => { if (source) URL.revokeObjectURL(source); }, [source]);
  useEffect(() => {
    if (open) return;
    setSource(null);
    setImage(null);
    setPlacement(CENTRED);
    setError(null);
  }, [open]);

  const choose = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError({ code: 'ASSET_TYPE_NOT_ALLOWED', message: t.notAnImage, requestId: 'local' });
      return;
    }
    const url = URL.createObjectURL(file);
    const loaded = new Image();
    loaded.onload = () => {
      setSource(url);
      setImage(loaded);
      setPlacement(CENTRED);
    };
    loaded.onerror = () => {
      URL.revokeObjectURL(url);
      setError({ code: 'ASSET_TYPE_NOT_ALLOWED', message: t.notAnImage, requestId: 'local' });
    };
    loaded.src = url;
  };

  const place = (next: PhotoPlacement) => {
    if (!image) return;
    setPlacement(clampPlacement(next, { width: image.naturalWidth, height: image.naturalHeight }, PREVIEW_PX));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!image) return;
    drag.current = { x: e.clientX, y: e.clientY, from: placement };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const from = drag.current;
    if (!from) return;
    place({ ...from.from, x: from.from.x + e.clientX - from.x, y: from.from.y + e.clientY - from.y });
  };
  const onPointerUp = () => { drag.current = null; };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const by = { ArrowLeft: [-NUDGE_PX, 0], ArrowRight: [NUDGE_PX, 0], ArrowUp: [0, -NUDGE_PX], ArrowDown: [0, NUDGE_PX] }[e.key];
    if (!by || !image) return;
    e.preventDefault();
    place({ ...placement, x: placement.x + by[0], y: placement.y + by[1] });
  };

  const save = async () => {
    if (!image || busy) return;
    setBusy('save');
    setError(null);
    try {
      const photo = await cropToJpeg(image, placement, PREVIEW_PX);
      if (!photo) throw new AvatarUploadFailed('canvas');
      await uploadAvatar(photo);
      await onChanged(t.photoSaved);
      onClose();
    } catch (err) {
      setError(err instanceof AvatarUploadFailed
        ? { code: 'UPLOAD_FAILED', message: t.photoFailed, requestId: 'local' }
        : toDisplayError(err));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy('remove');
    setError(null);
    try {
      await removeAvatar();
      await onChanged(t.photoRemoved);
      onClose();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  };

  const scale = image ? coverScale(image.naturalWidth, image.naturalHeight, PREVIEW_PX) * placement.zoom : 1;
  const shown = source ?? current;

  return (
    <ResponsiveSheet open={open} title={t.photoTitle} onClose={onClose}>
      <div className="flex flex-col items-center">
        <div
          role={image ? 'img' : undefined}
          aria-label={image ? t.move : undefined}
          aria-describedby={image ? undefined : hintId}
          tabIndex={image ? 0 : -1}
          data-crop=""
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          className={cn(
            'relative mt-1 flex h-[220px] w-[220px] touch-none select-none items-center justify-center overflow-hidden rounded-full bg-hover-row',
            image && 'cursor-grab active:cursor-grabbing',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber',
          )}
        >
          {image && source ? (
            // A picture on this device, before it is saved: no optimisation pipeline stands between the reader and it.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={source}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
              style={{
                width: image.naturalWidth,
                height: image.naturalHeight,
                transform: `translate(-50%, -50%) translate(${placement.x}px, ${placement.y}px) scale(${scale})`,
              }}
            />
          ) : shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : (
            <p id={hintId} className="px-8 text-center text-base text-signal-grey">{t.photoHint}</p>
          )}
        </div>

        <div className="mt-3.5 flex w-full items-center gap-2.5 px-2 text-muted">
          <span aria-hidden="true"><LineIcon name="minus" className="h-4 w-4" /></span>
          <input
            type="range"
            aria-label={t.zoom}
            min={PHOTO_ZOOM.min}
            max={PHOTO_ZOOM.max}
            step={PHOTO_ZOOM.step}
            value={placement.zoom}
            disabled={!image}
            onChange={(e) => place({ ...placement, zoom: Number(e.target.value) })}
            className="h-11 min-w-0 flex-1 accent-amber disabled:opacity-40"
          />
          <span aria-hidden="true"><LineIcon name="plus" className="h-4 w-4" /></span>
        </div>

        <div className="mt-3 grid w-full grid-cols-2 gap-2">
          <PickButton label={t.camera} icon="camera" capture onPick={choose} />
          <PickButton label={t.gallery} icon="gallery" onPick={choose} />
        </div>

        {error && <div className="mt-3 w-full"><ErrorBanner {...error} /></div>}

        <button
          type="button"
          onClick={() => void save()}
          disabled={!image || busy !== null}
          className="mt-3 flex min-h-12 w-full items-center justify-center rounded-pill bg-amber text-md font-bold text-navy hover:bg-amber-dark disabled:cursor-not-allowed disabled:bg-hover-row disabled:text-muted"
        >
          {busy === 'save' ? t.savingPhoto : t.savePhoto}
        </button>
        {current && (
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy !== null}
            className="mt-1 flex min-h-11 w-full items-center justify-center rounded-pill text-md font-semibold text-pill-red-ink hover:bg-pill-red disabled:opacity-40"
          >
            {t.removePhoto}
          </button>
        )}
      </div>
    </ResponsiveSheet>
  );
}

/** *Kamera* / *Galeri*: a file input behind a 44px outlined button; *Kamera* asks for the front camera. */
function PickButton({
  label, icon, capture = false, onPick,
}: { label: string; icon: 'camera' | 'gallery'; capture?: boolean; onPick: (file: File | undefined) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex min-h-11 items-center justify-center gap-1.5 rounded-pill border border-line bg-card text-md font-semibold text-ink hover:bg-hover-row"
      >
        <span aria-hidden="true">{icon === 'camera' ? <CameraGlyph /> : <GalleryGlyph />}</span>
        {label}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        {...(capture ? { capture: 'user' as const } : {})}
        hidden
        tabIndex={-1}
        aria-hidden="true"
        data-pick={icon}
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </>
  );
}

/** A camera, in the line icons' stroke (no emoji as icons, UI-057). */
export function CameraGlyph({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function GalleryGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M20.5 16l-5-5-8 8.5" />
    </svg>
  );
}
