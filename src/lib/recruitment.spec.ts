import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { plan, VOCABULARY } from '@test/recruitment-plan-fixtures';
import {
  briefFromQuery, briefQuery, codesOf, completeBrief, labels, OWN_COPY, planHref, PROTOTYPE_COPY, readRecruitmentPlan,
} from './recruitment';

/** The plan's address, the brief's rule and the read (P17-T3; D-urls, D-vocabulary). */
describe('the brief in the address (D-urls)', () => {
  it('reads a whole brief, the lists split on commas, in the order given', () => {
    expect(briefFromQuery({ type: 'retiree', motivation: 'leadership,side-income', hesitation: 'time' }))
      .toEqual({ type: 'retiree', motivations: ['leadership', 'side-income'], hesitations: ['time'] });
  });

  it('ignores what is not the brief’s: the server is asked for the three alone', () => {
    expect(briefFromQuery({ type: 'retiree', motivation: 'flexibility', hesitation: 'time', utm: 'x' }))
      .toEqual({ type: 'retiree', motivations: ['flexibility'], hesitations: ['time'] });
  });

  it.each([
    ['nothing', {}],
    ['no type', { motivation: 'flexibility', hesitation: 'time' }],
    ['no motivation', { type: 'retiree', hesitation: 'time' }],
    ['no hesitation', { type: 'retiree', motivation: 'flexibility' }],
    ['an empty type', { type: '', motivation: 'flexibility', hesitation: 'time' }],
    ['an empty list', { type: 'retiree', motivation: '', hesitation: 'time' }],
    ['an empty code', { type: 'retiree', motivation: 'flexibility,,leadership', hesitation: 'time' }],
    ['a code twice', { type: 'retiree', motivation: 'flexibility', hesitation: 'time,time' }],
    ['two types', { type: 'retiree,fresh-grad', motivation: 'flexibility', hesitation: 'time' }],
    ['a parameter given twice', { type: ['retiree', 'fresh-grad'], motivation: 'flexibility', hesitation: 'time' }],
  ])('P17-T3 AC-5 %s is no brief: step 1, nothing chosen', (_name, query) => {
    expect(briefFromQuery(query)).toBeNull();
  });

  it('writes the lists with commas, not %2C, and each code encoded', () => {
    expect(briefQuery({ type: 'fresh-grad', motivations: ['side-income', 'leadership'], hesitations: ['a b'] }))
      .toBe('type=fresh-grad&motivation=side-income,leadership&hesitation=a%20b');
    expect(planHref({ type: 'retiree', motivations: ['flexibility'], hesitations: ['time'] }))
      .toBe('/recruitment/attack-plan?type=retiree&motivation=flexibility&hesitation=time');
  });

  it('round-trips: an address written here reads back as the same brief', () => {
    const brief = { type: 'other-insurer', motivations: ['side-income', 'full-career'], hesitations: ['stable-job', 'reputation'] };
    expect(briefFromQuery(Object.fromEntries(new URLSearchParams(briefQuery(brief))))).toEqual(brief);
  });
});

describe('a complete brief (D-vocabulary)', () => {
  it('needs a type, a motivation and a hesitation the vocabulary has', () => {
    expect(completeBrief(VOCABULARY, 'retiree', ['flexibility'], ['time'])).not.toBeNull();
    expect(completeBrief(VOCABULARY, null, ['flexibility'], ['time'])).toBeNull();
    expect(completeBrief(VOCABULARY, 'retiree', [], ['time'])).toBeNull();
    expect(completeBrief(VOCABULARY, 'retiree', ['flexibility'], [])).toBeNull();
    expect(completeBrief(null, 'retiree', ['flexibility'], ['time'])).toBeNull();
  });

  it('a code the vocabulary does not have is not an answer', () => {
    expect(completeBrief(VOCABULARY, 'astronaut', ['flexibility'], ['time'])).toBeNull();
    expect(completeBrief(VOCABULARY, 'retiree', ['moonlighting'], ['time'])).toBeNull();
    expect(completeBrief(VOCABULARY, 'retiree', ['moonlighting', 'flexibility'], ['time']))
      .toEqual({ type: 'retiree', motivations: ['flexibility'], hesitations: ['time'] });
  });

  it('puts several answers in the chips’ order, not the order clicked (`:521`)', () => {
    expect(completeBrief(VOCABULARY, 'retiree', ['leadership', 'side-income'], ['time', 'no-experience']))
      .toEqual({ type: 'retiree', motivations: ['side-income', 'leadership'], hesitations: ['no-experience', 'time'] });
  });

  it('takes a brief the server read back to its codes, and joins its labels as the summary does', () => {
    expect(codesOf(plan().brief)).toEqual({
      type: 'fresh-grad', motivations: ['side-income', 'leadership'], hesitations: ['no-experience', 'time'],
    });
    expect(labels(plan().brief.motivations)).toBe('Side income, Lead a team');
  });
});

describe('the read', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks for the vocabulary alone with no brief, and for the plan with one', async () => {
    const { calls } = stubFetch({ 'GET /recruitment/attack-plan': { body: {} } });
    await readRecruitmentPlan(null);
    await readRecruitmentPlan({ type: 'retiree', motivations: ['flexibility', 'leadership'], hesitations: ['time'] });
    expect(calls.map((c) => c.url)).toEqual([
      'http://api.test/api/v1/recruitment/attack-plan',
      'http://api.test/api/v1/recruitment/attack-plan?type=retiree&motivation=flexibility,leadership&hesitation=time',
    ]);
  });
});

describe('the words (D-copy)', () => {
  it('P18.95-T7 AC-1 the prototype’s, verbatim (`:278-350`, `:586-619`), but for the client’s brief hint (grey text row 9)', () => {
    expect(PROTOTYPE_COPY.subtitle).toBe('Build the pitch on the fly, or pull the ready-made materials to show a candidate.');
    expect(PROTOTYPE_COPY.briefHint).toBe('Answer 3 questions to get your pitch.');
    expect([PROTOTYPE_COPY.candidateType, PROTOTYPE_COPY.motivation, PROTOTYPE_COPY.hesitation])
      .toEqual(['Candidate type', 'What\'s driving them', 'Their biggest hesitation']);
    expect([PROTOTYPE_COPY.build, PROTOTYPE_COPY.profileTag, PROTOTYPE_COPY.planReady])
      .toEqual(['Build recruitment plan', 'Candidate profile', 'Plan ready']);
  });

  it('ADR-0084’s rule: the strings this screen writes itself use none of the six words, and name no phase', () => {
    for (const text of Object.values(OWN_COPY)) {
      expect([text, /\b(office|kpm|reports? to|tagged to|untagged|unassigned)\b/i.test(text)]).toEqual([text, false]);
      expect([text, /\bphase\b/i.test(text)]).toEqual([text, false]);
    }
  });
});
