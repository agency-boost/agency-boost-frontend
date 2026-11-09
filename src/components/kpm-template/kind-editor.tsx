'use client';

import dynamic from 'next/dynamic';
import type {
  ActivationChecklistPayload, CampaignKindsPayload, CapabilityLadderPayload,
  EventTypesPayload, PipelinePayload, RatioSetPayload,
  TaxonomyPayload, TrainingEditor as TrainingEditorOf, TrainingTaxonomyPayload,
} from '@/components/template-editor';
import { Card } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import type { ApiError } from '@/lib/api-client';
import type { CompanyTemplate, TemplateKind } from '@/lib/admin';
import type { MetricDefinition } from '@/lib/tenant-config';
import type { AnalyticsHalf } from '@/components/kpm-template/analytics/analytics-editor';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';

/**
 * **Every section's editor loads when its section is opened** (the bundle, 2026-11-06; `performance-and-scale.md`): a
 * section draws one editor, and *Pengaturan perusahaan* draws only the carrier rules' — so none is in a route's first
 * load. `template-editor.tsx` holds eight of them in one module, which was the heaviest thing either route loaded; each
 * part's cards stand in while it arrives, as the section's own loading state draws them.
 */
const editorLoading = () => <SkeletonCards count={4} />;
const TaxonomyEditor = dynamic(
  () => import('@/components/template-editor').then((m) => m.TaxonomyEditor), { loading: editorLoading },
);
const RatioSetEditor = dynamic(
  () => import('@/components/template-editor').then((m) => m.RatioSetEditor), { loading: editorLoading },
);
const PipelineEditor = dynamic(
  () => import('@/components/template-editor').then((m) => m.PipelineEditor), { loading: editorLoading },
);
const ActivationChecklistEditor = dynamic(
  () => import('@/components/template-editor').then((m) => m.ActivationChecklistEditor), { loading: editorLoading },
);
const TrainingEditor = dynamic(
  () => import('@/components/template-editor').then((m) => m.TrainingEditor), { loading: editorLoading },
);
const CapabilityLadderEditor = dynamic(
  () => import('@/components/template-editor').then((m) => m.CapabilityLadderEditor), { loading: editorLoading },
);
const EventTypesEditor = dynamic(
  () => import('@/components/template-editor').then((m) => m.EventTypesEditor), { loading: editorLoading },
);
const CampaignKindsEditor = dynamic(
  () => import('@/components/template-editor').then((m) => m.CampaignKindsEditor), { loading: editorLoading },
);
/** The *Branding* section's (P19.6-T1 AC-11): its logo, colours and mascot. */
const TemplateBrandingEditor = dynamic(
  () => import('@/components/branding/template-branding-editor').then((m) => m.TemplateBrandingEditor),
  { loading: editorLoading },
);

/**
 * **The *Rekrutmen* section's editor loads when it is opened** (P18.10-T6's bundle rule): only that section draws it, and
 * *Pengaturan perusahaan*, which draws this for its carrier rules, never needs it.
 */
const RecruitmentPlaybookEditor = dynamic(
  () => import('@/components/recruitment-playbook-tab').then((m) => m.RecruitmentPlaybookEditor),
  { loading: () => <SkeletonCards count={4} /> },
);

/** **The *Advanced analytics* section's editor, loaded when it is opened** (P19.5-T1), by the same bundle rule. */
const AnalyticsEditor = dynamic(
  () => import('@/components/kpm-template/analytics/analytics-editor').then((m) => m.AnalyticsEditor),
  { loading: () => <SkeletonCards count={4} /> },
);

/**
 * **One part of a section, through its existing editor** (`template-editor.tsx`, untouched by ADR-0185): the kind's
 * payload and the half the part draws. A `switch` with an explicit default, so a kind added without an editor says so
 * rather than drawing one payload through another's editor (the old screen's lesson).
 */
export function KindEditor({
  kind,
  half,
  view,
  payload,
  onChange,
  disabled,
  available,
  modules,
  metrics,
  material,
  refusal,
  template,
}: {
  kind: TemplateKind;
  half?: string;
  /** The server's last answer for the kind: the checklist's link registry comes with it. */
  view: CompanyTemplate;
  payload: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled: boolean;
  /** `ratio_set`: the activity types a formula may name — the taxonomy the reader is editing beside it. */
  available?: { code: string; label: string }[];
  /** `activation_checklist`: the template's training modules, for the link picker. */
  modules?: { code: string; title: string }[];
  /** `campaign_kinds`: the platform's metrics (P5-T9), read rather than listed again here. */
  metrics?: MetricDefinition[];
  /** `training_taxonomy`: each module row's *Materi (n)* (ADR-0208 §1). */
  material?: Parameters<typeof TrainingEditorOf>[0]['material'];
  /** `recruitment_playbook`: the section's last publish refused, its violations put beside their fields (ADR-0210). */
  refusal?: ApiError | null;
  /** `advanced_analytics`: whose template, for the code check and the open runs it reads as it is used (ADR-0214 §1). */
  template?: { companyId: string; templateId: string };
}) {
  const t = useMessages(adminTemplateMessages).editor;
  const change = (next: unknown) => onChange(next as Record<string, unknown>);
  switch (kind) {
    case 'activity_taxonomy':
      return <TaxonomyEditor payload={payload as unknown as TaxonomyPayload} disabled={disabled} onChange={change} />;
    case 'ratio_set':
      return (
        <RatioSetEditor
          payload={payload as unknown as RatioSetPayload}
          available={available ?? []}
          disabled={disabled}
          onChange={change}
        />
      );
    case 'lead_pipeline':
      return (
        <PipelineEditor
          payload={payload as unknown as PipelinePayload}
          pipeline={half as 'sales' | 'recruitment'}
          disabled={disabled}
          onChange={change}
        />
      );
    case 'activation_checklist':
      return (
        <ActivationChecklistEditor
          payload={payload as unknown as ActivationChecklistPayload}
          modules={modules ?? []}
          linkKinds={view.linkKinds ?? null}
          disabled={disabled}
          onChange={change}
        />
      );
    case 'training_taxonomy':
      return (
        <TrainingEditor
          payload={payload as unknown as TrainingTaxonomyPayload}
          section={half as 'categories' | 'skills' | 'modules'}
          disabled={disabled}
          onChange={change}
          material={material}
        />
      );
    case 'capability_ladder':
      return (
        <CapabilityLadderEditor
          payload={payload as unknown as CapabilityLadderPayload}
          section={half as 'ladder' | 'skills'}
          disabled={disabled}
          onChange={change}
        />
      );
    case 'event_types':
      return <EventTypesEditor payload={payload as unknown as EventTypesPayload} disabled={disabled} onChange={change} />;
    case 'campaign_kinds':
      return (
        <CampaignKindsEditor
          payload={payload as unknown as CampaignKindsPayload}
          metrics={(metrics ?? []).map((m) => ({ key: m.key, label: m.name, unit: m.unit }))}
          section={half as 'production_club' | 'moc' | 'promotion_path'}
          disabled={disabled}
          onChange={change}
        />
      );
    case 'recruitment_playbook':
      return (
        <RecruitmentPlaybookEditor
          payload={payload}
          playbook={view.playbook}
          disabled={disabled}
          onChange={onChange}
          refusal={refusal ?? null}
        />
      );
    case 'advanced_analytics':
      return template ? (
        <AnalyticsEditor
          half={half as AnalyticsHalf}
          view={view}
          payload={payload}
          onChange={onChange}
          disabled={disabled}
          companyId={template.companyId}
          templateId={template.templateId}
        />
      ) : <Card><p className="text-md text-navy">{t.noEditor}</p></Card>;
    case 'branding':
      // P19.6-T1 AC-11 (ADR-0218 §3): the KPMs' default logo, colours and mascot.
      return template ? (
        <Card>
          <TemplateBrandingEditor
            payload={payload} onChange={onChange} disabled={disabled}
            companyId={template.companyId} templateId={template.templateId}
          />
        </Card>
      ) : <Card><p className="text-md text-navy">{t.noEditor}</p></Card>;
    default:
      return <Card><p className="text-md text-navy">{t.noEditor}</p></Card>;
  }
}
