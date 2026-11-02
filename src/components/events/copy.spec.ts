import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { catalogueTexts, parse, renderable, sourceFiles, SRC } from '@test/copy-scan';
import { NPS } from '@test/events-fixtures';
import {
  audienceLine, cancelledToast, goingToast, OWN_COPY, pickScoreToast, PROTOTYPE_COPY, refusalOf, scaleHighLine, scaleLowLine,
  scoredLine,
} from '@/lib/events';
import {
  ADMIN_COPY, attendedWords, awaitingLine, chosenCount, leftRow, markLabel, npsFormula, OWNER_PROTOTYPE_COPY, responsesLine,
  summaryTitle,
} from '@/lib/events-admin';
import { ApiRequestError } from '@/lib/api-client';

/**
 * **The events screens' own words** (P18.5-T5, T6; the build contract's *Module strings*): none of OD-39's six
 * words — *office*, *KPM*, *reports to*, *tagged to*, *untagged*, *unassigned* — no phase, and no internal id
 * or permission code.
 *
 * **Two of the prototype's verbatim strings carry *KPM*** and are allowed by name: the title's sub-line
 * (`Overall.html:10413`) and the audience line's issuer *KPM* (`:8532`, the event's data). The title was the
 * third, *KPM Events*, until P18.95-T9 AC-2 gave the page its nav item's words, *Event List*.
 * They go to the client with OD-39, as every such string has since ADR-0084. Anything else that says one
 * fails here.
 *
 * Read off the syntax tree, as the phase and permission scans are, so a comment never counts.
 */
const SIX_WORDS = /\boffice\b|\bKPM\b|reports? to|tagged to|untagged|unassigned|\bphase\s*(\d|\{)/i;

/** The prototype's own, verbatim, with OD-39 (`Overall.html:10413`, `:8532`). */
const VERBATIM_KPM = new Set<string>([PROTOTYPE_COPY.title, PROTOTYPE_COPY.sub, 'KPM']);

const MINE = [
  'components/events/',
  'lib/events.ts',
  'lib/events-admin.ts',
  'app/(agent)/events/',
];

function renderedStrings(file: string): string[] {
  const sf = parse(file, readFileSync(join(SRC, file), 'utf8'));
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    // An import's path is not copy.
    if (ts.isImportDeclaration(node)) return;
    const text = renderable(node);
    if (text !== null && text.trim()) found.push(text.replace(/\s+/g, ' ').trim());
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** A literal with no space in it is a code, a path or a class, not copy — unless it is one of the verbatim ones. */
const offends = (text: string) => !VERBATIM_KPM.has(text) && SIX_WORDS.test(text) && (/\s/.test(text) || /\bKPM\b/.test(text));

describe('the events screens’ own copy (P18.5-T5, T6)', () => {
  const files = sourceFiles().filter((f) => MINE.some((m) => f.startsWith(m)));

  it('finds the module’s files, so a silent zero cannot pass', () => {
    expect(files).toEqual(expect.arrayContaining([
      'components/events/events-screen.tsx',
      'components/events/event-card.tsx',
      'components/events/event-modal.tsx',
      'components/events/event-feedback.tsx',
      'components/events/feedback-dialog.tsx',
      'components/events/feedback-summary.tsx',
      'components/events/roll-call.tsx',
      'components/events/audience-picker.tsx',
      'lib/events.ts',
      'lib/events-admin.ts',
      'app/(agent)/events/layout.tsx',
      'app/(agent)/events/page.tsx',
      'app/(agent)/events/[eventId]/page.tsx',
    ]));
    expect(files.flatMap(renderedStrings).length).toBeGreaterThan(80);
  });

  it('catches a sentence that names one, and lets a code and the verbatim title through', () => {
    expect(offends('Ask your office')).toBe(true);
    expect(offends('Events from your KPM')).toBe(true);
    expect(offends('Arrives in phase 18')).toBe(true);
    expect(offends('/kpm/settings/events')).toBe(false);
    // The title is the nav item's *Event List* since P18.95-T9 AC-2, so the prototype's *KPM Events* is no longer allowed.
    expect(offends('KPM Events')).toBe(true);
    expect(offends(PROTOTYPE_COPY.title)).toBe(false);
  });

  it.each(MINE)('%s: none of the six words, no phase', (root) => {
    const hits = files.filter((f) => f.startsWith(root))
      .flatMap((f) => renderedStrings(f).filter(offends).map((t) => `src/${f}: ${JSON.stringify(t)}`));
    expect(hits).toEqual([]);
  });

  it('every word the module composes, with its values in, says none of them either', () => {
    const composed = [
      ...Object.values(OWN_COPY), ...Object.values(ADMIN_COPY).flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v))),
      ...Object.values(OWNER_PROTOTYPE_COPY),
      goingToast('{title}'), cancelledToast('{title}'), pickScoreToast(NPS), scaleLowLine(NPS), scaleHighLine(NPS),
      scoredLine({ score: 9, why: '{why}' }, NPS), summaryTitle('{title}'), npsFormula(NPS), responsesLine(3), awaitingLine(2),
      attendedWords(true), attendedWords(false), chosenCount(2), markLabel('attended', '{name}'), leftRow(1), leftRow(3),
      responsesLine(1),
      ...['EVENT_RSVP_CLOSED', 'EVENT_NOT_ENDED'].map((code) => refusalOf(new ApiRequestError(409, { code, message: '', requestId: 'r' })).message),
      audienceLine({ issuer: 'company', scope: 'leaders' }, '{company}'),
    ];
    expect(composed.filter(offends)).toEqual([]);
    // No internal id or permission code reaches a reader.
    expect(composed.filter((t) => /[a-z_]+:[a-z_]+|EVENT_[A-Z_]+|mem-/.test(t))).toEqual([]);
  });
});

/**
 * **P18.98-T4: the events' words are the catalogue's now** (`i18n/messages/events.ts`, `events-office.ts`), so the rule is
 * held there too, language by language (P18.98-T1 AC-6, `catalogueTexts`): in English none of the six words beyond the
 * prototype's verbatim *KPM*; in Indonesian *KPM* is ID mode's word for *office* (§B.9), so only *kantor* is held.
 */
describe('P18.98-T4 the events’ catalogue, language by language', () => {
  const AREAS = ['i18n/messages/events.ts', 'i18n/messages/events-office.ts'];
  const texts = AREAS.map((area) => catalogueTexts(area, readFileSync(join(SRC, area), 'utf8')));
  const all = (language: 'en' | 'id') => texts.flatMap((t) => t[language].map((x) => x.text));

  it('reads both languages, so a silent zero cannot pass', () => {
    expect(all('en')).toEqual(expect.arrayContaining(['Going', 'Roll call']));
    expect(all('id')).toEqual(expect.arrayContaining(['Ikut', 'Daftar hadir']));
  });

  it('writes none of OD-39’s six words in English beyond the prototype’s own', () => {
    expect(all('en').filter((t) => !VERBATIM_KPM.has(t) && SIX_WORDS.test(t) && (/\s/.test(t) || /\bKPM\b/.test(t)))).toEqual([]);
  });

  it('writes no *kantor* in Indonesian', () => {
    expect(all('id').filter((t) => /\bkantor\b/i.test(t))).toEqual([]);
  });
});
