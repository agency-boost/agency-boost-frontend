import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import {
  AVATAR_MIME_TYPE, AVATAR_SIDE_PX, AvatarUploadFailed, clampPlacement, cropRect, readProfileFacts, removeAvatar,
  uploadAvatar,
} from './profile';

const SIGNED = {
  uploadUrl: 'https://storage.test/bucket',
  storageKey: 'dev/user/u-1/avatar/01JBX0000000000000000000AB',
  signature: 'sig',
  expiresAt: '2026-10-30T10:10:00.000Z',
  fields: { key: 'dev/user/u-1/avatar/01JBX0000000000000000000AB', 'Content-Type': 'image/jpeg', policy: 'p' },
};

afterEach(() => vi.unstubAllGlobals());

describe('UI-111 Profil saya: the photo and the facts', () => {
  it('UI-111 reads the read-only facts from GET /auth/me/profile', async () => {
    const { calls } = stubFetch({ '/auth/me/profile': { body: { companyName: 'Prudential Indonesia', agentCode: '70012345', leader: null, group: null } } });
    expect((await readProfileFacts()).companyName).toBe('Prudential Indonesia');
    expect(calls[0].url).toContain('/auth/me/profile');
  });

  it('UI-111 saves a photo in three steps: sign it as a JPEG of its size, send it to storage last in the form, attach the key', async () => {
    const { calls } = stubFetch({
      'POST /auth/me/avatar/upload': { body: SIGNED },
      'storage.test/bucket': { status: 204, body: null },
      'PUT /auth/me/avatar': { body: { avatarUrl: 'https://signed.test/photo' } },
    });
    const photo = new Blob(['jpeg-bytes'], { type: AVATAR_MIME_TYPE });

    expect(await uploadAvatar(photo)).toEqual({ avatarUrl: 'https://signed.test/photo' });

    expect(JSON.parse(String(calls[0].init.body))).toEqual({ mimeType: 'image/jpeg', bytes: photo.size });
    const form = calls[1].init.body as FormData;
    expect(calls[1].url).toBe('https://storage.test/bucket');
    expect([...form.keys()]).toEqual(['key', 'Content-Type', 'policy', 'file']);
    expect(JSON.parse(String(calls[2].init.body))).toEqual({ storageKey: SIGNED.storageKey });
  });

  it('UI-111 attaches nothing when storage refuses the bytes', async () => {
    const { calls } = stubFetch({
      'POST /auth/me/avatar/upload': { body: SIGNED },
      'storage.test/bucket': { status: 403, body: null },
    });
    await expect(uploadAvatar(new Blob(['x'], { type: AVATAR_MIME_TYPE }))).rejects.toBeInstanceOf(AvatarUploadFailed);
    expect(calls.some((c) => c.init.method === 'PUT')).toBe(false);
  });

  it('UI-111 Hapus foto is DELETE /auth/me/avatar', async () => {
    const { calls } = stubFetch({ 'DELETE /auth/me/avatar': { body: { avatarUrl: null } } });
    expect(await removeAvatar()).toEqual({ avatarUrl: null });
    expect(calls[0].init.method).toBe('DELETE');
  });

  it('UI-111 crops the square the circle shows: centred, a landscape picture’s middle at zoom 1', () => {
    // 400 × 200 in a 220px circle: the short side fills it, so the square is 200 × 200 from x 100.
    const near = (r: { sx: number; sy: number; size: number }) => [r.sx, r.sy, r.size].map((n) => Math.round(n * 1000) / 1000);
    expect(near(cropRect({ x: 0, y: 0, zoom: 1 }, { width: 400, height: 200 }, 220))).toEqual([100, 0, 200]);
    // Zoomed twice, the square is half as wide, still centred.
    expect(near(cropRect({ x: 0, y: 0, zoom: 2 }, { width: 400, height: 200 }, 220))).toEqual([150, 50, 100]);
    expect(AVATAR_SIDE_PX).toBe(256);
  });

  it('UI-111 never lets the circle show past the picture: a drag is held at the edge, the zoom between 1 and 3', () => {
    const image = { width: 400, height: 200 };
    // At zoom 1 the picture is 440 × 220 in the preview: 110px to spare on each side, none above or below.
    const held = clampPlacement({ x: 500, y: 40, zoom: 1 }, image, 220);
    expect(held.x).toBeCloseTo(110);
    expect(held.y).toBeCloseTo(0);
    expect(held.zoom).toBe(1);
    expect(clampPlacement({ x: 0, y: 0, zoom: 9 }, image, 220).zoom).toBe(3);
    expect(clampPlacement({ x: 0, y: 0, zoom: 0.2 }, image, 220).zoom).toBe(1);
  });
});

/**
 * **The mirrors hold the server's values** (invariant §7): `AVATAR_SIDE_PX` and `AVATAR_MIME_TYPE` re-declare
 * `AVATAR.SIDE_PX` and `AVATAR.MIME_TYPES` (backend `domain/constants/assets.ts`, metrics §B.9), so this reads that file
 * from disk, as `i18n/glossary.spec.ts` reads the metric registry, and fails the day one side moves without the other.
 */
describe('UI-111 the avatar bounds mirror the backend constants', () => {
  const source = readFileSync(
    join(__dirname, '..', '..', '..', 'backend', 'src', 'domain', 'constants', 'assets.ts'), 'utf8',
  );
  const block = /export const AVATAR = \{([\s\S]*?)\} as const;/.exec(source)?.[1] ?? '';

  it('UI-111 AVATAR_SIDE_PX is AVATAR.SIDE_PX', () => {
    const side = /SIDE_PX:\s*([\d_]+)/.exec(block)?.[1];
    expect(side).toBeDefined();
    expect(AVATAR_SIDE_PX).toBe(Number(side?.replace(/_/g, '')));
  });

  it('UI-111 AVATAR_MIME_TYPE is the one type AVATAR.MIME_TYPES accepts', () => {
    const list = /MIME_TYPES:\s*\[([^\]]*)\]/.exec(block)?.[1];
    expect(list).toBeDefined();
    const types = [...(list ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(types).toEqual([AVATAR_MIME_TYPE]);
  });
});
