import type { SignedUpload } from '@/lib/tenant-config';

/**
 * **A signed upload as the API answers it since Phase 18.7** (P18.7-T2, ADR-0153): a GCS V4 signed POST
 * policy. Every spec that signs, sends and attaches a file builds its answer here, so the shape the
 * browser is tested against is the one storage accepts, and a vendor change is one edit.
 *
 * The fields are in the order `generateSignedPostPolicyV4` returns them — the pinned conditions first,
 * then the key, the credential triple, the policy and its signature — because `signedUploadForm` sends
 * them in the order given. The values are shaped like real ones and are not: no bucket is ever reached
 * from a test, and `fetch` is stubbed.
 */
export const GCS_UPLOAD_URL = 'https://storage.googleapis.com/agencyboost-staging-assets/';

export function gcsSignedUpload(
  storageKey: string,
  { mimeType = 'application/pdf', ...rest }: Partial<SignedUpload> & { mimeType?: string } = {},
): SignedUpload {
  const signature = '7d5e0c3b9a41f2e8b6c0d4a1e93f5b27c8d6a0e4f1b3c5d7e9f0a2b4c6d8e0f1';
  return {
    uploadUrl: GCS_UPLOAD_URL,
    storageKey,
    signature,
    expiresAt: '2026-10-09T03:10:00.000Z',
    fields: {
      'Content-Type': mimeType,
      key: storageKey,
      'x-goog-date': '20261009T030500Z',
      'x-goog-credential':
        'api-runtime@agencyboost-staging.iam.gserviceaccount.com/20261009/auto/storage/goog4_request',
      'x-goog-algorithm': 'GOOG4-RSA-SHA256',
      policy: 'eyJjb25kaXRpb25zIjpbWyJjb250ZW50LWxlbmd0aC1yYW5nZSIsMSwyNjIxNDQwMF1dfQ==',
      'x-goog-signature': signature,
    },
    ...rest,
  };
}
