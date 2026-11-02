'use client';

import {
  ActivationChecklistEditor, CampaignKindsEditor, CapabilityLadderEditor, EventTypesEditor,
  PipelineEditor, RatioSetEditor, TaxonomyEditor, TrainingEditor,
  type ActivationChecklistPayload, type CampaignKindsPayload, type CapabilityLadderPayload,
  type EventTypesPayload, type PipelinePayload, type RatioSetPayload,
  type TaxonomyPayload, type TrainingTaxonomyPayload,
} from '@/components/template-editor';
import { Card } from '@/components/ui/field';
import type { CompanyTemplate, TemplateKind } from '@/lib/admin';
import type { MetricDefinition } from '@/lib/tenant-config';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';

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
    default:
      return <Card><p className="text-md text-navy">{t.noEditor}</p></Card>;
  }
}
