'use client';

import { api } from './api-client';
import { signedUploadForm, type SignedUpload } from './tenant-config';

/**
 * ***Profil saya*'s reads and writes** (UI V1, UI-111): the read-only facts beside `GET /auth/me`, and the photo.
 *
 * `GET /auth/me/profile` — the insurer and the agent code sign-up recorded, the reader's leader in this office and the
 * group they lead, counted by role. The photo is uploaded straight to storage with a signed form, as every upload is
 * (ADR-0153), then attached: `POST /auth/me/avatar/upload` → the form → `PUT /auth/me/avatar`; `DELETE` removes it.
 */
export interface ProfileFacts {
  companyName: string | null;
  agentCode: string | null;
  leader: { name: string; orgLevelCode: string } | null;
  group: { people: number; ab: number; aab: number; agents: number } | null;
}

export const readProfileFacts = () => api<ProfileFacts>('/auth/me/profile');

/** The photo as every avatar of the reader draws it: a signed link, or `null` for the initials. */
export interface AvatarAnswer {
  avatarUrl: string | null;
}

/** The side of the square the crop is saved as (`AVATAR.SIDE_PX` on the server, 256): what *Simpan foto* sends. */
export const AVATAR_SIDE_PX = 256;

/** The JPEG the crop is encoded as. The server accepts this type alone (`AVATAR.MIME_TYPES`). */
export const AVATAR_MIME_TYPE = 'image/jpeg';

export const removeAvatar = () => api<AvatarAnswer>('/auth/me/avatar', { method: 'DELETE' });

/** Storage refused the bytes, or never answered: said like the server's refusals, so `ErrorBanner` can show it. */
export class AvatarUploadFailed extends Error {}

/**
 * **The whole of *Simpan foto*** for one cropped JPEG: sign, send it to storage, attach it. Each step's refusal is
 * thrown as it came (`ApiRequestError`), and storage's own as `AvatarUploadFailed`.
 */
export async function uploadAvatar(photo: Blob): Promise<AvatarAnswer> {
  const signed = await api<SignedUpload>('/auth/me/avatar/upload', {
    method: 'POST', body: { mimeType: AVATAR_MIME_TYPE, bytes: photo.size },
  });
  let sent: Response;
  try {
    sent = await fetch(signed.uploadUrl, { method: 'POST', body: signedUploadForm(signed, photo) });
  } catch {
    throw new AvatarUploadFailed('storage');
  }
  if (!sent.ok) throw new AvatarUploadFailed('storage');
  return api<AvatarAnswer>('/auth/me/avatar', { method: 'PUT', body: { storageKey: signed.storageKey } });
}


/**
 * **Where the picture sits in the circle**: its offset from the centre in the preview's pixels, and the zoom over the
 * size that just covers the circle (1 to 3, the mockup's slider). Shared by the preview and the crop, so what is saved
 * is what was shown.
 */
export interface PhotoPlacement {
  x: number;
  y: number;
  zoom: number;
}

export const PHOTO_ZOOM = { min: 1, max: 3, step: 0.05 } as const;

/** The scale that makes the picture's shorter side just fill a square of `side` px. */
export const coverScale = (width: number, height: number, side: number) => side / Math.min(width, height);

/**
 * **The offset kept inside the picture**: the circle never shows past the photo's edge, whichever way it is dragged or
 * however far it is zoomed out again.
 */
export function clampPlacement(
  placement: PhotoPlacement,
  image: { width: number; height: number },
  side: number,
): PhotoPlacement {
  const zoom = Math.min(PHOTO_ZOOM.max, Math.max(PHOTO_ZOOM.min, placement.zoom));
  const scale = coverScale(image.width, image.height, side) * zoom;
  const maxX = Math.max(0, (image.width * scale - side) / 2);
  const maxY = Math.max(0, (image.height * scale - side) / 2);
  return {
    zoom,
    x: Math.min(maxX, Math.max(-maxX, placement.x)),
    y: Math.min(maxY, Math.max(-maxY, placement.y)),
  };
}

/**
 * **The square the circle shows, in the picture's own pixels** (`drawImage`'s source rectangle), for a preview of
 * `side` px: what is cropped and scaled to `AVATAR_SIDE_PX`.
 */
export function cropRect(
  placement: PhotoPlacement,
  image: { width: number; height: number },
  side: number,
): { sx: number; sy: number; size: number } {
  const scale = coverScale(image.width, image.height, side) * placement.zoom;
  const size = side / scale;
  return {
    sx: image.width / 2 - placement.x / scale - size / 2,
    sy: image.height / 2 - placement.y / scale - size / 2,
    size,
  };
}

/** The crop as a 256 × 256 JPEG, drawn on a canvas. `null` where the browser cannot draw one. */
export async function cropToJpeg(
  image: HTMLImageElement,
  placement: PhotoPlacement,
  previewSide: number,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIDE_PX;
  canvas.height = AVATAR_SIDE_PX;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const { sx, sy, size } = cropRect(placement, { width: image.naturalWidth, height: image.naturalHeight }, previewSide);
  // A transparent PNG's background becomes white in a JPEG, never black.
  context.fillStyle = 'white';
  context.fillRect(0, 0, AVATAR_SIDE_PX, AVATAR_SIDE_PX);
  context.drawImage(image, sx, sy, size, size, 0, 0, AVATAR_SIDE_PX, AVATAR_SIDE_PX);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), AVATAR_MIME_TYPE, 0.85));
}
