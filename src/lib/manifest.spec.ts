import { describe, expect, it } from 'vitest';
import { GET } from '@/app/manifest.webmanifest/route';
import { manifestFor } from './manifest';
import { PWA_ICONS } from './pwa';

const KPM = '66f0000000000000000005a5';

describe('P19.6-T1 AC-16 the manifest (ADR-0218 §10; the owner’s app name)', () => {
  it('P19.6-T1 AC-16 is AgencyBoost’s without a KPM: today’s icons', () => {
    expect(manifestFor()).toMatchObject({ name: 'AgencyBoost', short_name: 'AgencyBoost', start_url: '/', display: 'standalone' });
    expect(manifestFor().icons).toEqual(PWA_ICONS.map((icon) => ({ ...icon })));
  });

  it('P19.6-T1 AC-16 names the home-screen app AgencyBoost for every KPM; only its icons are the KPM’s, by version', () => {
    const m = manifestFor(KPM, 'abc123def456');
    expect([m.name, m.short_name]).toEqual(['AgencyBoost', 'AgencyBoost']);
    expect(m.icons!.map((i) => i.src)).toEqual([
      'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png',
    ].map((f) => expect.stringMatching(new RegExp(`/api/v1/kpm-branding/${KPM}/files/${f.replace('.', '\\.')}\\?v=abc123def456$`))));
    expect(m.icons!.map((i) => i.purpose)).toEqual(['any', 'any', 'maskable', 'maskable']);
  });

  it('P19.6-T1 AC-16 ignores a kpm that is not an id, or a version that is not one', () => {
    expect(manifestFor('0417', 'abc').icons).toEqual(manifestFor().icons);
    expect(manifestFor(KPM, '../x').icons).toEqual(manifestFor().icons);
  });

  it('P19.6-T1 AC-16 is served as a manifest at /manifest.webmanifest, the KPM’s by its query', async () => {
    const plain = await GET(new Request('https://app.test/manifest.webmanifest'));
    expect(plain.headers.get('content-type')).toBe('application/manifest+json');
    expect(await plain.json()).toEqual(JSON.parse(JSON.stringify(manifestFor())));
    const branded = await GET(new Request(`https://app.test/manifest.webmanifest?kpm=${KPM}&v=abc123def456`));
    expect((await branded.json()).name).toBe('AgencyBoost');
    expect(branded.headers.get('cache-control')).toContain('immutable');
  });
});
