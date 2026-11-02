import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { catalogueTexts, SRC } from '@test/copy-scan';
import { planMessages } from '@/i18n/messages/plan';
import { recruitmentPlanMessages } from '@/i18n/messages/recruitment-plan';
import { OWN_COPY, PROTOTYPE_COPY } from './recruitment';

/**
 * **P18.98-T4, Recruitment's words in both languages** (field selling): `lib/recruitment.ts`' copy objects are the
 * catalogue's English, so the English reads as before (`recruitment.spec.ts`), and the area holds OD-39's six words and
 * *kantor* to each language. The playbook's words are the company's, never a message.
 */
describe('P18.98-T4 Recruitment’s words, language by language', () => {
  it('AC-1 the English is the source, unchanged: the views the specs read are the catalogue’s English', () => {
    expect(PROTOTYPE_COPY.title).toBe(recruitmentPlanMessages.en.title);
    expect(PROTOTYPE_COPY.goodFitFor).toBe(planMessages.en.goodFitFor);
    expect([PROTOTYPE_COPY.openingLine, PROTOTYPE_COPY.openingLines]).toEqual(['Opening line', 'Opening lines']);
    expect(OWN_COPY.steps).toBe(planMessages.en.steps);
    expect(OWN_COPY.noPlaybook).toBe('No recruitment plan can be built yet.');
  });

  it('AC-2 the Indonesian keeps Recruitment, Attack Plan and Pitch Materials English', () => {
    const id = recruitmentPlanMessages.id;
    expect([id.title, id.tabs, id.tabAttackPlan, id.tabPitchMaterials]).toEqual(['Recruitment', 'Recruitment', 'Attack Plan', 'Pitch Materials']);
    expect([id.stepPlan, id.build, id.toPitchMaterials]).toEqual(['Rencana recruitment', 'Susun rencana recruitment', 'Buka Pitch Materials']);
  });

  describe('OD-39’s six words, held in each language’s messages (ADR-0084’s rule; P18.98-T1 AC-6)', () => {
    const SIX_WORDS = /\boffice\b|\bKPM\b|reports? to|tagged to|untagged|unassigned/i;
    const AREA = 'i18n/messages/recruitment-plan.ts';
    const texts = catalogueTexts(AREA, readFileSync(join(SRC, AREA), 'utf8'));

    it('reads both languages, so a silent zero cannot pass', () => {
      expect(texts.en.map((t) => t.text)).toEqual(expect.arrayContaining(['Candidate brief', 'Plan ready']));
      expect(texts.id.map((t) => t.text)).toEqual(expect.arrayContaining(['Gambaran kandidat', 'Rencana siap']));
    });

    it.each(['en', 'id'] as const)('writes none of them in %s, and names no phase', (language) => {
      expect(texts[language].filter((t) => SIX_WORDS.test(t.text)).map((t) => `${t.line}: ${t.text}`)).toEqual([]);
      expect(texts[language].filter((t) => /\b(phase|fase)\b/i.test(t.text))).toEqual([]);
    });

    it('writes no kantor in Indonesian', () => {
      expect(texts.id.filter((t) => /\bkantor\b/i.test(t.text))).toEqual([]);
    });
  });
});
