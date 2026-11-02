import { describe, expect, it } from 'vitest';
import { sections } from '@test/kpm-template-fixtures';
import { sectionOf, sectionOfKind, sectionState, sectionsWaiting, TEMPLATE_SECTIONS, templateProgress } from './template-sections';

const published = { publishedVersion: 2, hasDraft: false };
const empty = { publishedVersion: null, hasDraft: false };

/**
 * **A template's six sections, and where each stands** (ADR-0185 §3): what the card's *x/6 bagian terbit* and *n
 * perubahan belum terbit*, and the checklist's pills, are read from.
 */
describe('ADR-0185 §3 the template’s sections', () => {
  it('groups the seven kinds into six sections, each kind once, the taxonomy before the ratios', () => {
    expect(TEMPLATE_SECTIONS.map((s) => s.slug)).toEqual(['activity', 'leads', 'activation', 'training', 'capability', 'events']);
    const kinds = TEMPLATE_SECTIONS.flatMap((s) => s.kinds);
    expect(kinds).toEqual(['activity_taxonomy', 'ratio_set', 'lead_pipeline', 'activation_checklist', 'training_taxonomy',
      'capability_ladder', 'event_types']);
    expect(new Set(kinds).size).toBe(7);
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
    expect(templateProgress(template)).toEqual({ published: 4, total: 6, waiting: 2 });
    expect(sectionsWaiting(template).map((s) => s.slug)).toEqual(['leads', 'events']);
  });

  it('reads a template with no sections as empty, never as broken', () => {
    expect(templateProgress({ sections: {} as never })).toEqual({ published: 0, total: 6, waiting: 0 });
  });
});
