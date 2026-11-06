import { describe, expect, it } from 'vitest';
import { sections } from '@test/kpm-template-fixtures';
import { sectionOf, sectionOfKind, sectionState, sectionsWaiting, TEMPLATE_SECTIONS, templateProgress } from './template-sections';

const published = { publishedVersion: 2, hasDraft: false };
const empty = { publishedVersion: null, hasDraft: false };

/**
 * **A template's seven sections, and where each stands** (ADR-0185 §3; ADR-0210 §1): what the card's *x/7 bagian terbit*
 * and *n perubahan belum terbit*, and the checklist's pills, are read from.
 */
describe('ADR-0185 §3 the template’s sections', () => {
  it('P19.5-T1 AC-1, P19.6-T1 AC-11 groups the ten kinds into nine sections, each kind once, Advanced analytics the last', () => {
    expect(TEMPLATE_SECTIONS.map((s) => s.slug))
      .toEqual(['activity', 'leads', 'activation', 'training', 'capability', 'events', 'recruitment', 'branding', 'analytics']);
    const kinds = TEMPLATE_SECTIONS.flatMap((s) => s.kinds);
    expect(kinds).toEqual(['activity_taxonomy', 'ratio_set', 'lead_pipeline', 'activation_checklist', 'training_taxonomy',
      'capability_ladder', 'event_types', 'recruitment_playbook', 'branding', 'advanced_analytics']);
    expect(new Set(kinds).size).toBe(10);
    // Its four pill tabs, the mockup's: Bagian · Data upload · Survei · Ambang & benchmark.
    expect(sectionOf('analytics')!.parts.map((p) => [p.key, p.half]))
      .toEqual([['bagian', 'sections'], ['data', 'upload'], ['survei', 'surveys'], ['ambang', 'thresholds']]);
    expect(sectionOfKind('recruitment_playbook')?.slug).toBe('recruitment');
    expect(sectionOfKind('ratio_set')?.slug).toBe('activity');
    expect(sectionOf('nothing')).toBeNull();
  });

  it('a section is a draft when any kind waits, published when every kind is, partial between, empty with nothing', () => {
    const activity = sectionOf('activity')!;
    expect(sectionState({ sections: sections(published) }, activity).state).toBe('published');
    expect(sectionState({ sections: sections(published, { ratio_set: { publishedVersion: null, hasDraft: true } }) }, activity).state)
      .toBe('draft');
    expect(sectionState({ sections: sections(published, { ratio_set: empty }) }, activity)).toMatchObject({
      state: 'partial', allPublished: false,
      versions: [{ kind: 'activity_taxonomy', version: 2 }, { kind: 'ratio_set', version: null }],
    });
    expect(sectionState({ sections: sections(empty) }, activity).state).toBe('empty');
  });

  it('counts sections, not kinds: published whole whatever waits, and the ones with a change waiting', () => {
    const template = {
      sections: sections(published, {
        ratio_set: empty,
        lead_pipeline: { publishedVersion: 1, hasDraft: true },
        event_types: { publishedVersion: null, hasDraft: true },
      }),
    };
    expect(templateProgress(template)).toEqual({ published: 7, total: 9, waiting: 2 });
    expect(sectionsWaiting(template).map((s) => s.slug)).toEqual(['leads', 'events']);
  });

  it('reads a template with no sections as empty, never as broken', () => {
    expect(templateProgress({ sections: {} as never })).toEqual({ published: 0, total: 9, waiting: 0 });
  });
});
