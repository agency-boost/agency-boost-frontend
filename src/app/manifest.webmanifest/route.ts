import { manifestFor } from '@/lib/manifest';

/**
 * **`/manifest.webmanifest`** (UI-103; P19.6-T1 AC-16, ADR-0218 §10): a route handler, since a KPM's members get its
 * icons through `?kpm=&v=` — the manifest is fetched without a session. Named *AgencyBoost* whatever the KPM.
 */
export function GET(request: Request): Response {
  const url = new URL(request.url);
  const kpm = url.searchParams.get('kpm');
  const v = url.searchParams.get('v');
  return new Response(JSON.stringify(manifestFor(kpm, v)), {
    headers: {
      'Content-Type': 'application/manifest+json',
      // A versioned KPM manifest never changes; AgencyBoost's is revalidated as any page's file.
      'Cache-Control': kpm && v ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
    },
  });
}
