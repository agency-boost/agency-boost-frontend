'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { applyPalette, brandingApi, brandingFileUrl, kpmIdFromLink, type PublicBranding } from '@/lib/branding';
import { inviteTokenOf, readInviteBanner } from '@/lib/invites';

type Shown = PublicBranding & { kpmId: string };

/**
 * **The KPM a link carries, on the sign-in, registration and invitation pages** (P19.6-T1 AC-13; ADR-0218 §9):
 * `?kpm=<id>` reads `GET /kpm-branding/:kpmId`, and `?invite=…` the invitation's own `branding`. Its colours are set on
 * the page while it is open and taken off when it closes, and its logo stands above the form. **A link without the KPM,
 * an id that is not one, or a KPM that is not live shows AgencyBoost's**, unchanged — the boot script paints nothing on
 * these pages, so no other KPM's cached colours appear either.
 */
export function LinkBranding() {
  const params = useSearchParams();
  const kpmId = kpmIdFromLink(params.get('kpm'));
  const invite = inviteTokenOf(params);
  const [shown, setShown] = useState<Shown | null>(null);

  useEffect(() => {
    let live = true;
    const read: Promise<Shown | null> = invite
      ? readInviteBanner(invite).then((b) => (b.branding ? { ...b.branding } : null))
      : kpmId
        ? brandingApi.publicRead(kpmId).then((b) => (b.version ? { ...b, kpmId } : null))
        : Promise.resolve(null);
    read.then((b) => { if (live) setShown(b); }).catch(() => { if (live) setShown(null); });
    return () => { live = false; };
  }, [kpmId, invite]);

  useEffect(() => {
    applyPalette(shown?.palette ?? null);
    return () => applyPalette(null);
  }, [shown]);

  if (!shown?.logo || !shown.version) return null;
  return (
    <div className="mb-4 flex w-full justify-center" data-link-branding="">
      {/* eslint-disable-next-line @next/next/no-img-element -- a public, versioned API file */}
      <img
        src={brandingFileUrl(shown.kpmId, 'logo.png', shown.version)}
        alt={shown.name ?? ''}
        className="max-h-8 max-w-[160px] object-contain"
      />
    </div>
  );
}
