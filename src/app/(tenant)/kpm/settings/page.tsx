'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { Page } from '@/components/page';
import { Button, Card, ErrorBanner } from '@/components/ui/field';
import { LineIcon, type LineIconName } from '@/components/ui/line-icon';
import { SkeletonCards } from '@/components/ui/skeleton';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { settingsHubMessages } from '@/i18n/messages/settings-hub';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatMonthLong } from '@/lib/format';
import { useCan } from '@/lib/session';
import {
  publishConfig, readSettingsOverview, SETTING_HREF, type HubCounts, type HubSetting, type HubStatus,
  type SettingsOverview,
} from '@/lib/tenant-config';

/** Each row's glyph — the mockup's Tabler icons, from the one line-icon set. */
const ICONS: Record<HubSetting, LineIconName> = {
  activity_types: 'ti-list-check',
  lead_statuses: 'arrowsRight',
  activation_checklist: 'ti-clipboard-check',
  training: 'ti-school',
  capability_mapping: 'stairs',
  events: 'ti-calendar-event',
  campaigns: 'ti-trophy',
  products: 'box',
  recruitment_pitch: 'ti-presentation',
  branch_info: 'building',
  branding: 'palette',
};

type GroupKey = 'activity' | 'newAgents' | 'events' | 'products' | 'kpm';

/** The five groups and their settings (AC-1). */
const GROUPS: Record<GroupKey, HubSetting[]> = {
  activity: ['activity_types', 'lead_statuses'],
  newAgents: ['activation_checklist', 'training', 'capability_mapping'],
  events: ['events', 'campaigns'],
  products: ['products', 'recruitment_pitch'],
  kpm: ['branch_info', 'branding'],
};

/**
 * Two columns from a tablet held sideways — left *Aktivitas & leads*, *Agent baru & training*; right *Event & campaign*,
 * *Produk & rekrut*, *KPM* — and on a phone the same groups in one column, left's first: the same content in the same
 * order at 390, 1024 and 1280.
 */
const COLUMNS: GroupKey[][] = [['activity', 'newAgents'], ['events', 'products', 'kpm']];

/**
 * ***Pengaturan*, the hub** (`/kpm/settings`; P19.21-T2 AC-1, AC-2; ADR-0274 §6; mockup
 * `data-upload-pengaturan-*-stopmotion-2026-11-19`, frames 11–12).
 *
 * The eleven settings behind one menu item. **An orange bar only while a setting has changes agents do not see** —
 * one named with *Terbitkan*, several counted with *Terbitkan semua*, each publishing exactly those settings — then
 * five groups as white list cards, each row its icon, its name, one line, **a status only when the owner must act**
 * (*Belum diterbitkan*, *n menunggu*, *n belum ada*, *Logo belum ada*; nothing for a setting that is fine) and a ›.
 *
 * One read, `GET /kpm/settings/overview`: a steward's — the Owner, an Admin, a core leader, the Super Admin inside the
 * KPM. Anybody else is answered 404, said here as the page not being theirs.
 */
export default function SettingsHubPage() {
  const t = useMessages(settingsHubMessages);
  const language = useFigureLanguage();
  const canPublish = useCan('tenant_config:write');
  const [view, setView] = useState<SettingsOverview | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [publishError, setPublishError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setView(await readSettingsOverview());
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const publish = async () => {
    if (!view) return;
    setBusy(true);
    setPublishError(null);
    try {
      await publishConfig(view.unpublished);
      await load();
    } catch (err) {
      setPublishError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  };

  const lineOf = (setting: HubSetting, c: HubCounts): string => {
    const n = (v: number | null) => v ?? 0;
    switch (setting) {
      case 'activity_types': return t.lines.activityTypes({ activities: n(c.activities), categories: n(c.categories) });
      case 'lead_statuses': return t.lines.leadStatuses;
      case 'activation_checklist': return t.lines.activation({ days: n(c.windowDays), version: c.version });
      case 'training': return t.lines.training({ categories: n(c.categories), skills: n(c.skills), modules: n(c.modules) });
      case 'capability_mapping': return t.lines.capability({ stages: n(c.stages), groups: n(c.skillGroups) });
      case 'events': return t.lines.events;
      case 'campaigns': return t.lines.campaigns;
      case 'products': return t.lines.products({ products: n(c.products), sold: n(c.sold) });
      case 'recruitment_pitch': return t.lines.pitch({ n: n(c.materials) });
      case 'branch_info': {
        const month = c.fiscalYearStartMonth ? formatMonthLong(`2000-${String(c.fiscalYearStartMonth).padStart(2, '0')}`, language) : '';
        return t.lines.branchInfo({ code: c.kpmCode ?? '', month });
      }
      case 'branding': return t.lines.branding;
    }
  };

  const statusOf = (status: HubStatus | null): ReactNode => {
    if (!status) return null;
    const [words, red] = status.kind === 'unpublished' ? [t.status.unpublished, false]
      : status.kind === 'waiting' ? [t.status.waiting({ n: status.count }), true]
        : status.kind === 'missing' ? [t.status.missing({ n: status.count }), true]
          : [t.status.noLogo, false];
    return (
      <span data-hub-status={status.kind} className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-bold text-navy">
        <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-pill', red ? 'bg-signal-red' : 'bg-signal-amber')} />
        {words}
      </span>
    );
  };

  let body: ReactNode;
  if (error?.code === 'NOT_FOUND') {
    body = <Card><p className="text-md text-navy">{t.denied}</p></Card>;
  } else if (error) {
    body = (
      <div className="space-y-3">
        <ErrorBanner {...error} />
        <Button variant="secondary" onClick={() => { setError(null); void load(); }}>{t.tryAgain}</Button>
      </div>
    );
  } else if (!view) {
    body = (
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCards count={2} label={t.title} />
        <SkeletonCards count={3} />
      </div>
    );
  } else {
    const rows = new Map(view.settings.map((s) => [s.setting, s]));
    const [first] = view.unpublished;
    body = (
      <>
        {view.unpublished.length > 0 && (
          <div
            role="status"
            data-hub-bar=""
            className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-primary-50 p-3"
          >
            <LineIcon name="alert" className="h-5 w-5 text-primary-ink" />
            <p className="min-w-0 flex-1 text-md text-navy">
              <strong>
                {view.unpublished.length === 1 ? t.bar.one({ name: t.names[first] }) : t.bar.several({ n: view.unpublished.length })}
              </strong>{' '}
              {t.bar.stillPrevious}
            </p>
            {canPublish && (
              <Button disabled={busy} onClick={() => { void publish(); }}>
                {busy ? t.bar.publishing : view.unpublished.length === 1 ? t.bar.publish : t.bar.publishAll}
              </Button>
            )}
            {publishError && <p className="w-full text-md text-alert">{publishError.message}</p>}
          </div>
        )}
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {COLUMNS.map((column) => (
            <div key={column.join()} className="flex flex-col gap-4">
              {column.map((group) => (
                <HubGroup key={group} heading={t.groups[group]}>
                  {GROUPS[group].map((setting) => {
                    const row = rows.get(setting);
                    return (
                      <HubRow
                        key={setting}
                        setting={setting}
                        name={t.names[setting]}
                        line={row ? lineOf(setting, row.counts) : ''}
                        status={statusOf(row?.status ?? null)}
                      />
                    );
                  })}
                </HubGroup>
              ))}
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <Page title={t.title} permission="tenant_config:read">
      {body}
    </Page>
  );
}

/** One group: its heading in capitals, then its rows on a white card. */
function HubGroup({ heading, children }: { heading: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-lg bg-card">
      <h2 id={id} className="border-b border-divider px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-muted">
        {heading}
      </h2>
      <ul role="list" className="[&>li+li]:border-t [&>li+li]:border-divider">{children}</ul>
    </section>
  );
}

/** One setting: icon, name, one line, a status only when the owner must act, and a ›. The whole row opens it. */
function HubRow({ setting, name, line, status }: { setting: HubSetting; name: string; line: string; status: ReactNode }) {
  return (
    <li
      data-hub-row={setting}
      className={cn(
        'relative flex min-h-16 items-center gap-3 px-4 py-2.5 lg:hover:bg-hover-row',
        // The keyboard's ring is the row's, drawn when its link has the focus (`ListRow`'s rule).
        'has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-primary',
      )}
    >
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-row bg-secondary-50 text-navy">
        <LineIcon name={ICONS[setting]} className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <Link
          href={SETTING_HREF[setting]}
          className="block text-md font-bold text-navy after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
        >
          {name}
        </Link>
        <p className="mt-0.5 text-sm text-muted">{line}</p>
      </div>
      {status}
      <LineIcon name="chevronRight" className="h-5 w-5 shrink-0 text-signal-grey" />
    </li>
  );
}
