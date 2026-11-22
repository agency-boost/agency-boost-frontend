'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { useMessages } from '@/i18n/language-provider';
import { settingsMessages } from '@/i18n/messages/settings';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useCan } from '@/lib/session';
import {
  publishConfig, readPublishState, settingOfPath, type PublishedSetting, type PublishState,
} from '@/lib/tenant-config';

/**
 * What agents are working against, and whether it is what you are looking at (P4-T6) — **for this page's setting**
 * since P19.21-T2 (AC-3; ADR-0274 §5).
 *
 * **The settings screens edit rows; agents read a published copy.** An Owner restructuring
 * a taxonomy does it in steps — archive three, add four, rebind two ratios — and between
 * those steps a ratio can name a type archived a minute ago that nobody can log against.
 * The gate is why agents do not watch that happen; this bar is how an Owner knows the gate
 * is there at all.
 *
 * **Each setting is published on its own.** The bar reads `setting`, or the page's address when none is given
 * (`settingOfPath`: Activity types and its Ratio benchmarks tab, Lead statuses, Activation checklist, Training and a
 * module's page, Capability Mapping, Events), so a page that draws `<PublishBar />` without knowing of settings gets its
 * own; on a page saved live — Campaigns, Products — it draws nothing and asks nothing. *"Draf. Agent masih memakai versi
 * n."* + *Terbitkan ke agent*, which publishes this setting and no other.
 *
 * **It says nothing when there is nothing to say.** A permanent "everything is published"
 * banner is chrome an Owner learns to stop reading, and then misses the one time it
 * matters.
 */
export function PublishBar({
  refreshKey,
  setting: given,
}: {
  refreshKey?: number;
  /** The setting this bar publishes; absent, the page's (`settingOfPath`), and `null` draws nothing. */
  setting?: PublishedSetting | null;
}) {
  const t = useMessages(settingsMessages).publish;
  const pathname = usePathname();
  const setting = given !== undefined ? given : settingOfPath(pathname);
  const canPublish = useCan('tenant_config:write');
  const [state, setState] = useState<PublishState | null>(null);
  /*
   * Two failures, two states. They are not the same thing: one means *I cannot tell you
   * what your agents are seeing*, the other means *your change did not go out* — and they
   * recover differently. Sharing one field is what let the first hide behind the early
   * return below.
   */
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!setting) return;
    try {
      setState(await readPublishState());
      setLoadError(null);
    } catch (err) {
      setLoadError(toDisplayError(err));
    }
  }, [setting]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  if (!setting) return null;

  /*
   * The error is rendered **before** the early return.
   *
   * `!mine?.hasUnpublishedChanges` is true both when there is nothing to publish and
   * when the read failed — `state` stays null on a failure — so the component returned
   * `null` and the error it had just set was never shown. An Owner whose publish state
   * could not be read saw a screen that looked entirely normal and had no way to learn
   * the gate existed.
   */
  if (loadError) {
    return (
      <div role="alert" className="mb-4 rounded-md border border-alert bg-card p-3">
        <p className="text-md text-navy">
          <strong>{t.cannotCheck}</strong>{' '}
          <span className="text-muted">{loadError.message}</span>
        </p>
        <Button variant="secondary" className="mt-2" onClick={() => { setLoadError(null); void load(); }}>
          {t.tryAgain}
        </Button>
      </div>
    );
  }

  // An answer from before per-setting publishing carries no `settings`: the office's own state stands in for each.
  const mine = state?.settings?.find((s) => s.setting === setting)
    ?? (state && !state.settings
      ? { version: state.publishedVersion, hasUnpublishedChanges: state.hasUnpublishedChanges }
      : null);
  if (!mine?.hasUnpublishedChanges) return null;

  return (
    <div
      role="status"
      data-publish-bar={setting}
      className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-primary-50 p-3"
    >
      <LineIcon name="alert" className="h-5 w-5 text-primary-ink" />
      <p className="min-w-0 flex-1 text-md text-navy">
        <strong>{t.draft}</strong>{' '}
        {mine.version === 0 ? t.nothingPublished : t.stillOnVersion({ version: mine.version })}
      </p>
      {canPublish && (
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              setState(await publishConfig([setting]));
            } catch (err) {
              setError(toDisplayError(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? t.publishing : t.publishToAgents}
        </Button>
      )}
      {error && <p className="w-full text-md text-alert">{error.message}</p>}
    </div>
  );
}
