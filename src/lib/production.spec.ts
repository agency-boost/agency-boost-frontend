import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatMoneyUnit } from './format';
import {
  CADENCE_GROUP_LABEL, FIGURE_COLUMNS, METRIC_COLUMN_LABEL, PRODUCTION_METRICS,
} from './production';

/**
 * P13.1-T7 AC-3 — **the screen and the template agree**, read from the backend's own source.
 *
 * The month table's figures and the file's columns are drawn from two copies of one list — this
 * repository's `PRODUCTION_METRICS` and the backend's. A test that stubbed the template would compare the
 * screen with the stub; this reads what the API is built from, as `contract.spec.ts` reads its
 * OpenAPI document, so a column moved on one side fails here rather than in an operator's spreadsheet.
 */
const BACKEND = join(__dirname, '..', '..', '..', 'backend', 'src', 'modules', 'production');
const source = (file: string) => readFileSync(join(BACKEND, file), 'utf8');

/** The quoted strings of the first `NAME = [ … ]` array literal in a source file. */
function arrayLiteral(src: string, name: string): string[] {
  const body = new RegExp(`${name}\\s*=\\s*\\[([^\\]]*)\\]`, 's').exec(src);
  if (!body) throw new Error(`no array ${name}`);
  return [...body[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
}

/** `key: 'value'` pairs of the first `NAME … = { … }` object literal in a source file. */
function objectLiteral(src: string, name: string): Record<string, string> {
  const body = new RegExp(`${name}[^=]*=\\s*\\{([^}]*)\\}`, 's').exec(src);
  if (!body) throw new Error(`no object ${name}`);
  return Object.fromEntries([...body[1].matchAll(/(\w+):\s*'([^']*)'/g)].map((m) => [m[1], m[2]]));
}

describe('the month table and the template, side by side (P13.1-T7)', () => {
  it('AC-3: lists the six metrics in the backend’s order', () => {
    expect([...PRODUCTION_METRICS]).toEqual(arrayLiteral(source('monthly-agent-data.schema.ts'), 'PRODUCTION_METRICS'));
  });

  it('AC-3: heads each column as the file does, less the file’s Rp M — the table shows rupiah in full', () => {
    const file = objectLiteral(source('production-template.ts'), 'METRIC_FILE_LABEL');
    expect(Object.keys(file)).toEqual([...PRODUCTION_METRICS]);
    for (const m of PRODUCTION_METRICS) expect(METRIC_COLUMN_LABEL[m]).toBe(file[m].replace(' (Rp M)', ''));
  });

  it('AC-3: draws this month’s six, then the year’s — the file’s two runs, in the file’s order', () => {
    const header = source('production-template.ts');
    expect(header.indexOf('— This Month`')).toBeLessThan(header.indexOf('— YTD`'));
    expect(FIGURE_COLUMNS.map((f) => `${f.metric} ${CADENCE_GROUP_LABEL[f.cadence]}`)).toEqual([
      ...PRODUCTION_METRICS.map((m) => `${m} This Month`),
      ...PRODUCTION_METRICS.map((m) => `${m} YTD`),
    ]);
  });
});

/**
 * **P18.98-T3 AC-4: a file is not words.** The production file's header *APE (Rp M)* is the carrier's **million** and
 * the import's contract, so it reads the same whatever language the person downloading it reads — and it is not the
 * screens' header unit (*Rp M* a *miliar* on a screen, *IDR B* in English), which the template never asks for.
 */
describe('P18.98-T3 AC-4 the production file’s header is a file format, in no language', () => {
  it('P18.98-T3 AC-4 keeps APE (Rp M) and FYP (Rp M) as the template writes them, with nothing that takes a language', () => {
    const template = source('production-template.ts');
    const file = objectLiteral(template, 'METRIC_FILE_LABEL');
    expect(file.ape).toBe('APE (Rp M)');
    expect(file.fyp).toBe('FYP (Rp M)');
    // The template imports only the metrics' list: no formatter, no language.
    expect([...template.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1])).toEqual(['./monthly-agent-data.schema']);
  });

  it('P18.98-T3 AC-4 is not the screens’ unit: a screen’s M is a miliar, IDR B in English; the file’s is a million', () => {
    expect(formatMoneyUnit('M', 'id')).toBe('Rp M');
    expect(formatMoneyUnit('M', 'en')).toBe('IDR B');
    expect(formatMoneyUnit('jt', 'en')).toBe('IDR M');
    // The table drops the file's unit from its headings, in either language: its figures are written in full.
    for (const m of PRODUCTION_METRICS) expect(METRIC_COLUMN_LABEL[m]).not.toMatch(/Rp|IDR/);
  });
});
