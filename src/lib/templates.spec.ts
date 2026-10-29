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

/**
 * **P18.98-T6: the sentence in the reader's language** — the words `admin-template.tsx`'s, the template's and the
 * company's names as stored and each reason the API's, in the language it was written in; English when no language is
 * passed, so the office page reads as before until it passes its own.
 */
describe('P18.98-T6 savedTemplateSentence in Indonesian', () => {
  const template = {
    id: 't', companyId: 'co-1', name: 'BSD City settings', isDefault: false, status: 'active' as const,
    archivedAt: null, origin: { kind: 'office' as const }, officeCount: 0, publishedVersions: {} as never,
    createdAt: '', updatedAt: '', dropped: [],
  };

  it('says what was made, the names as stored', () => {
    expect(savedTemplateSentence(template, 'Prudential', 'id')).toBe('Tersimpan sebagai BSD City settings, templat milik Prudential.');
    expect(savedTemplateSentence(template, 'Prudential', 'en')).toBe(savedTemplateSentence(template, 'Prudential'));
  });

  it('says what was left out in one form for one and many, each reason the API’s', () => {
    const one = [{ kind: 'ratio_set' as const, code: 'R1', reason: 'Ratio R1 tidak disertakan.' }];
    const two = [...one, { kind: 'activation_checklist' as const, code: 'A1', reason: 'Item A1 menjadi item manual.' }];
    expect(savedTemplateSentence({ ...template, dropped: one }, 'Prudential', 'id')).toBe(
      'Tersimpan sebagai BSD City settings, templat milik Prudential. Tidak disertakan atau diubah, karena menyebut '
        + 'sesuatu yang diarsipkan: Ratio R1 tidak disertakan.',
    );
    expect(savedTemplateSentence({ ...template, dropped: two }, 'Prudential', 'id')).toBe(
      'Tersimpan sebagai BSD City settings, templat milik Prudential. Tidak disertakan atau diubah, karena menyebut '
        + 'sesuatu yang diarsipkan: Ratio R1 tidak disertakan. Item A1 menjadi item manual.',
    );
  });
});
