'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/field';
import { ReorderArrows } from '@/components/ui/reorder-arrows';
import { readOpenSurveyRuns } from '@/lib/admin';
import type { SectionKode } from '@/lib/advanced-analytics';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateAnalyticsMessages } from '@/i18n/messages/admin-template-analytics';
import { Kode, NamedSwitch, RowHead, Tag, type AnalyticsTabProps } from './analytics-shared';

/**
 * **Bagian** (P19.5-T1 AC-4; AA UI-022): which of the six sections a KPM's *Advanced analytics* page shows, and in what
 * order — each row its name, kode, description and *Butuh: …* tags, ↑ / ↓ a keyboard can use, and a switch.
 *
 * **Nothing about hiding Data upload** (ADR-0214 §13, decision 1(a)): it stays in the KPM's menu whatever these say, so
 * the mockup's *"Data upload disembunyikan di KPM"* banner is not drawn (a parity row).
 *
 * **Turning NPS or *Analitik kualitatif* off while a run is open asks first** (AA UI-022, Case 9), from the `open-runs`
 * read: the run finishes and keeps its results; the tab leaves the KPM after it ends.
 */
export function AnalyticsSectionsTab({ config, onChange, disabled, companyId, templateId }: AnalyticsTabProps) {
  const words = useMessages(adminTemplateAnalyticsMessages);
  const t = words.sections;
  const [asking, setAsking] = useState<{ index: number; kpms: number } | null>(null);
  const on = config.sections.filter((s) => s.enabled).length;

  const set = (index: number, enabled: boolean) => onChange({
    ...config,
    sections: config.sections.map((s, i) => (i === index ? { ...s, enabled } : s)),
  });

  async function toggle(index: number, enabled: boolean) {
    const kode = config.sections[index].kode;
    if (!enabled && (kode === 'NPS' || kode === 'QUAL')) {
      // A read that fails asks nothing: turning a section off loses no data, and the run finishes either way.
      const runs = await readOpenSurveyRuns(companyId, templateId).catch(() => null);
      const open = runs ? (kode === 'NPS' ? runs.nps : runs.qual) : null;
      if (open && open.runs > 0) {
        setAsking({ index, kpms: open.kpms });
        return;
      }
    }
    set(index, enabled);
  }

  const move = (index: number, by: -1 | 1) => {
    const next = [...config.sections];
    const [row] = next.splice(index, 1);
    next.splice(index + by, 0, row);
    onChange({ ...config, sections: next });
  };

  const name = (kode: SectionKode) => t.names[kode];
  return (
    <>
      <RowHead title={t.heading} hint={t.hint}>
        <span className="text-sm text-muted">{t.on({ n: on, of: config.sections.length })}</span>
      </RowHead>
      <ul className="divide-y divide-divider overflow-hidden rounded-lg border border-card-edge bg-card">
        {config.sections.map((section, i) => (
          <li key={section.kode} className="flex items-start gap-3 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-md font-semibold text-navy">
                {name(section.kode)} <Kode>{section.kode}</Kode>
              </p>
              <p className="mt-0.5 text-sm text-muted">{t.descriptions[section.kode]}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.values(t.requires[section.kode]).map((what) => <Tag key={what}>{t.needs({ what })}</Tag>)}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ReorderArrows
                label={name(section.kode)}
                index={i}
                count={config.sections.length}
                onMove={(by) => move(i, by)}
                disabled={disabled}
              />
              <NamedSwitch
                id={`analytics-section-${section.kode}`}
                name={t.show({ name: name(section.kode) })}
                checked={section.enabled}
                disabled={disabled}
                onChange={(next) => void toggle(i, next)}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted">{t.kept}</p>

      <Modal
        open={asking !== null}
        title={asking ? t.hideTitle({ name: name(config.sections[asking.index].kode) }) : ''}
        onClose={() => setAsking(null)}
        className="max-w-[30rem]"
        footer={(
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setAsking(null)}>
              {words.publish.cancel}
            </Button>
            <Button onClick={() => { if (asking) set(asking.index, false); setAsking(null); }}>{t.hide}</Button>
          </div>
        )}
      >
        <p className="text-md text-navy">{asking ? t.hideRunning({ kpms: asking.kpms }) : ''}</p>
      </Modal>
    </>
  );
}
