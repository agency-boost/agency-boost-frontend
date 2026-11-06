'use client';

import { useState } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { useMessages } from '@/i18n/language-provider';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { markSettingsReviewed, type ReviewedPage } from '@/lib/kpm-overview';
import { useCan, useSession } from '@/lib/session';

/**
 * ***Sudah sesuai*** (P19.3-T2 AC-5; UI-149, Overview R2, Appendix A: *"on each settings page 'Sudah sesuai'"*; the
 * glossary's *Reviewed*) — on the title row of *Branch info*, *Activity types*, *Activation checklist* and *Products*,
 * the four settings pages of the KPM setup card: **the page is right as it is**, the company's defaults included. One tap
 * ticks the page's step on the Overview and **changes nothing of the page** (`PUT /kpm/settings/:page/reviewed`); saving
 * the page ticks it too, on the server.
 *
 * - **The smallest form** (ADR-0062's list, item 2): a secondary button in the title row the page already has, and after
 *   the tap its words, *Sudah sesuai ✓*, with one line for a screen reader saying what happened.
 * - **The Owner's and an Admin's** (`tenant_config:mark_reviewed`). A read-only support session sees the member's button
 *   **disabled** (roles §3.13: the member's screen as they see it, nothing written), as the Overview's *Ubah* is; anybody
 *   else sees nothing. The server refuses every other reader regardless.
 * - A tap on a page already marked answers as it stands: the button says *Sudah sesuai ✓* either way.
 */
export function SettingsReviewed({ page }: { page: ReviewedPage }) {
  const t = useMessages(kpmOverviewMessages);
  const { me } = useSession();
  const holds = useCan('tenant_config:mark_reviewed');
  const readOnly = !!me?.impersonationReadOnly;
  const shown = holds || (readOnly && !!(me?.membership?.isKpmOwner || me?.membership?.isKpmAdmin));
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<ApiError | null>(null);
  if (!shown) return null;

  const mark = async () => {
    setState('busy');
    setError(null);
    try {
      await markSettingsReviewed(page);
      setState('done');
    } catch (err) {
      setError(toDisplayError(err));
      setState('idle');
    }
  };

  return (
    <span data-settings-reviewed={page} className="inline-flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        onClick={mark}
        disabled={readOnly || state !== 'idle'}
        // 44px below 1024px (UI-142's rule for the settings pages' own controls).
        className="max-lg:h-11"
      >
        {state === 'done' ? t.reviewedDone : t.reviewedAction}
      </Button>
      {state === 'done' && <span role="status" className="sr-only">{t.reviewedNote}</span>}
      {error && <span className="max-w-xs text-left"><ErrorBanner {...error} /></span>}
    </span>
  );
}
