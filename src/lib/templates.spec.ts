import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { savedTemplateSentence, TEMPLATE_NAME_MAX } from './templates';

/**
 * P13.2's exit review — **a template name's longest is the backend's**, read from its own source as
 * `production.spec.ts` reads the production template's: a bound changed on one side fails here rather
 * than as a name the field accepts and the API refuses.
 */
const BACKEND = join(__dirname, '..', '..', '..', 'backend', 'src', 'domain', 'constants', 'templates.ts');

describe('template names (P13.2 exit review)', () => {
  it('stops a name where the API does', () => {
    const declared = /NAME_MAX_LENGTH:\s*(\d+)/.exec(readFileSync(BACKEND, 'utf8'));
    expect(declared).not.toBeNull();
    expect(TEMPLATE_NAME_MAX).toBe(Number(declared![1]));
  });
});

describe('savedTemplateSentence (P13.2 exit review, finding 2)', () => {
  const template = {
    id: 't', companyId: 'co-1', name: 'BSD City settings', isDefault: false, status: 'active' as const,
    archivedAt: null, origin: { kind: 'office' as const }, officeCount: 0, publishedVersions: {} as never,
    createdAt: '', updatedAt: '', dropped: [],
  };

  it('says what was made, and nothing more when nothing was left out', () => {
    expect(savedTemplateSentence(template, 'Prudential')).toBe('Saved as BSD City settings, a template of Prudential.');
  });

  it('says each thing left out or changed, in the API’s words', () => {
    expect(savedTemplateSentence({
      ...template,
      dropped: [
        { kind: 'ratio_set', code: 'LEADS_PER_ACTIVITY', reason: 'Ratio LEADS_PER_ACTIVITY was left out.' },
        { kind: 'activation_checklist', code: 'A1', reason: 'Checklist item A1 is kept as a manual item.' },
      ],
    }, 'Prudential')).toBe(
      'Saved as BSD City settings, a template of Prudential. Left out or changed, because they name something '
        + 'archived: Ratio LEADS_PER_ACTIVITY was left out. Checklist item A1 is kept as a manual item.',
    );
  });
});
