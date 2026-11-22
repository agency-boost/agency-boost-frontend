'use client';

import Link from 'next/link';
import { use, useEffect, useId, useState, type ReactNode } from 'react';
import { CompanyFrame, useCompany } from '@/components/kpm-template/company-frame';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { SkeletonCards } from '@/components/ui/skeleton';
import { listTemplates, readTemplate, type NamedTemplate, type NamedTemplateKind } from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { campaignsHref, sectionHref, type SectionSlug } from '@/lib/template-sections';
import { useMessages } from '@/i18n/language-provider';
import { adminCompaniesConsoleMessages } from '@/i18n/messages/admin-companies-console';

/** One row of *Pengaturan template*: its section of the default template (or the company's *Campaigns*), its kinds. */
type RowKey =
  | 'activity_types' | 'lead_statuses' | 'activation_checklist' | 'training' | 'capability_mapping' | 'events'
  | 'campaigns' | 'recruitment_pitch' | 'objection_handling';

const ROWS: Record<RowKey, { section: SectionSlug | null; kinds: (NamedTemplateKind | 'campaign_kinds')[] }> = {
  activity_types: { section: 'activity', kinds: ['activity_taxonomy', 'ratio_set'] },
  lead_statuses: { section: 'leads', kinds: ['lead_pipeline'] },
  activation_checklist: { section: 'activation', kinds: ['activation_checklist'] },
  training: { section: 'training', kinds: ['training_taxonomy'] },
  capability_mapping: { section: 'capability', kinds: ['capability_ladder'] },
  events: { section: 'events', kinds: ['event_types'] },
  campaigns: { section: null, kinds: ['campaign_kinds'] },
  // OD-424: the template holds no pitch files; both rows open the recruitment playbook — the pitch words per candidate
  // type, and the answers to each hesitation.
  recruitment_pitch: { section: 'recruitment', kinds: ['recruitment_playbook'] },
  objection_handling: { section: 'recruitment', kinds: ['recruitment_playbook'] },
};

type GroupKey = 'activity' | 'newAgents' | 'events' | 'products';

/** The owner hub's groups (P19.21-T2), *Tampilan* left out, objection handling under *Produk & rekrut* (AC-4). */
const GROUPS: Record<GroupKey, RowKey[]> = {
  activity: ['activity_types', 'lead_statuses'],
  newAgents: ['activation_checklist', 'training', 'capability_mapping'],
  events: ['events', 'campaigns'],
  products: ['recruitment_pitch', 'objection_handling'],
};
const COLUMNS: GroupKey[][] = [['activity', 'newAgents'], ['events', 'products']];

/**
 * **A company's page, tab *Pengaturan template*** (`/admin/companies/[companyId]/settings`; P19.23-T4 AC-4; ADR-0278 §1,
 * §5; frame 35): the owner hub's groups — *Aktivitas & leads*, *Agent baru & training*, *Event & campaign*, *Produk &
 * rekrut* — over the company's **default template**, each row opening its section's editor (the editors are ADR-0185's)
 * and saying ***Belum diterbitkan*** while a draft of it waits; nothing for a row that is fine. No *Tampilan* group. Under
 * them: *Sama dengan Pengaturan owner, tapi untuk template: KPM baru menyalin ini*.
 *
 * Replaces *Pengaturan perusahaan* (*Produk · Campaign*): products are *Produk & proposal*'s, and *Campaigns* is a row
 * here (`…/settings/campaigns`). Super Admin only (`company_template:read`).
 */
export default function TemplateSettingsPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = use(params);
  const t = useMessages(adminCompaniesConsoleMessages);
  const company = useCompany(companyId);
  const [template, setTemplate] = useState<NamedTemplate | null | undefined>(undefined);
  const [campaignDraft, setCampaignDraft] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    void listTemplates(companyId)
      .then((rows) => { if (live) setTemplate(rows.find((r) => r.isDefault) ?? null); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    // The carrier rules are the company's, under no template: whether a draft of them waits.
    void readTemplate(companyId, 'campaign_kinds', null)
      .then((view) => { if (live) setCampaignDraft(view.status === 'draft' && view.id !== ''); })
      .catch(() => { if (live) setCampaignDraft(false); });
    return () => { live = false; };
  }, [companyId, attempt]);

  const waiting = (row: RowKey) => ROWS[row].kinds.some((kind) => (kind === 'campaign_kinds'
    ? campaignDraft : Boolean(template?.sections?.[kind]?.hasDraft)));
  const hrefOf = (row: RowKey) => {
    const { section } = ROWS[row];
    return section === null || !template ? campaignsHref(companyId) : sectionHref(companyId, template.id, section);
  };

  let body: ReactNode;
  if (error) {
    body = (
      <div className="flex flex-col gap-2">
        <ErrorBanner {...error} />
        <Button variant="secondary" className="self-start" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button>
      </div>
    );
  } else if (template === undefined) {
    body = (
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCards count={2} label={t.frame.settings} />
        <SkeletonCards count={2} />
      </div>
    );
  } else if (template === null) {
    body = <div className="rounded-lg border border-card-edge bg-card"><EmptyState title={t.settings.noTemplate} /></div>;
  } else {
    body = (
      <>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {COLUMNS.map((column) => (
            <div key={column.join()} className="flex flex-col gap-4">
              {column.map((group) => (
                <Group key={group} heading={t.settings.groups[group]}>
                  {GROUPS[group].map((row) => (
                    <li
                      key={row}
                      data-setting-row={row}
                      className={cn(
                        'relative flex min-h-12 items-center gap-3 px-4 py-2 lg:hover:bg-hover-row',
                        'has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-primary',
                      )}
                    >
                      <Link
                        href={hrefOf(row)}
                        className="min-w-0 flex-1 text-md font-bold text-navy after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                      >
                        {t.settings.names[row]}
                      </Link>
                      {waiting(row) && (
                        <span data-setting-status="unpublished" className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-bold text-navy">
                          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-pill bg-signal-amber" />
                          {t.settings.unpublished}
                        </span>
                      )}
                      <LineIcon name="chevronRight" className="h-5 w-5 shrink-0 text-signal-grey" />
                    </li>
                  ))}
                </Group>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">{t.settings.note}</p>
      </>
    );
  }

  return (
    <CompanyFrame companyId={companyId} company={company} permission="company_template:read" active="settings">
      {body}
    </CompanyFrame>
  );
}

/** One group: its heading in capitals, then its rows on a white card (the owner hub's `HubGroup`). */
function Group({ heading, children }: { heading: string; children: ReactNode }) {
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
