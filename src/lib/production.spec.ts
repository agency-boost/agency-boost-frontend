import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KODE_OF, V1_COLUMNS } from '@test/data-upload-fixtures';
import {
  APE_KODE, cellKey, columnHeading, columnLabel, correctionKey, workbookFilename, ytdColumns,
} from './production';

/**
 * **The screen and the server agree** (P13.1-T7 AC-3; since P19.5-T2 the columns are the template's), read from the
 * backend's own source as `contract.spec.ts` reads its OpenAPI document: a rule moved on one side fails here rather than
 * in an operator's spreadsheet.
 */
const BACKEND = join(__dirname, '..', '..', '..', 'backend', 'src');
const source = (file: string) => readFileSync(join(BACKEND, file), 'utf8');

describe('P19.5-T2 the Data upload’s columns, by kode, as the backend writes them', () => {
  it('P19.5-T2 AC-1 version 1’s seven columns: the fixtures’ kodes, labels, units and years to date are the backend’s', () => {
    const config = source('modules/config/analytics-config.ts');
    const kodes = source('modules/config/analytics-config.ts').match(/KODE_OF_CELL = \{([^}]*)\}/s)![1];
    for (const [name, kode] of Object.entries(KODE_OF)) expect(kodes).toContain(`${name}: '${kode}'`);
    for (const c of V1_COLUMNS) {
      const name = Object.keys(KODE_OF).find((k) => KODE_OF[k] === c.kode)!;
      expect(config).toContain(`field('${name}', { id: '${c.label.id}', en: '${c.label.en}' }, '${c.unit}', '${c.ytd}'`);
    }
  });

  it('P19.5-T2 the kode the phone row reads, APE, is a system column: renamed, never deleted (R1)', () => {
    expect(source('domain/constants/advanced-analytics.ts'))
      .toMatch(new RegExp(`ANALYTICS_SYSTEM_KODES = \\[[^\\]]*'${APE_KODE}'`));
  });

  it('P19.5-T2 names an uploaded year to date’s cell as the backend does: <KODE>_YTD', () => {
    expect(source('modules/production/upload-columns.ts')).toContain("export const YTD_SUFFIX = '_YTD';");
    expect(cellKey('KOMISI', true)).toBe('KOMISI_YTD');
    expect(cellKey('APE', false)).toBe('APE');
  });

  it('P19.5-T2 names a ticked correction as the commit reads it: membershipId:KODE, held:<CODE>:KODE', () => {
    const service = source('modules/production/production-import.service.ts');
    expect(service).toContain('`held:${heldCodeOf(r.agentCode)}`');
    expect(correctionKey({ status: 'ready', membershipId: 'm1', agentCode: 'A' }, { kode: 'APE', ytd: false })).toBe('m1:APE');
    expect(correctionKey({ status: 'held', membershipId: null, agentCode: 'abc' }, { kode: 'FYP', ytd: false })).toBe('held:ABC:FYP');
  });

  it('P19.5-T2 AC-1 saves the workbook named as the CSV is: <kpmCode>-agent-data-<YYYY-MM>.xlsx', () => {
    expect(source('modules/production/production-template.ts'))
      .toContain('return `${officeCode}-agent-data-${month}.${extension}`;');
    expect(workbookFilename({ filename: '0417-agent-data-2026-09.csv' })).toBe('0417-agent-data-2026-09.xlsx');
  });
});

describe('P19.5-T2 a column on the screen', () => {
  it('P19.5-T2 names a column in the reader’s language, the ID label standing in for an empty EN one (ADR-0214 §2)', () => {
    const persistency = V1_COLUMNS.find((c) => c.kode === 'PERSISTENCY')!;
    expect(columnLabel(persistency, 'id')).toBe('Persistensi rolling');
    expect(columnLabel(persistency, 'en')).toBe('Rolling persistency');
    expect(columnLabel({ label: { id: 'Komisi', en: ' ' } }, 'en')).toBe('Komisi');
  });

  /*
   * *Changed 2026-11-05 (P19.5-T2; ADR-0214 §5):* P18.10-T3 AC-4 held the file's header in no language. The template's
   * header is now `<label> (<unit>) [KODE]` in the reader's language — the `[KODE]` is what an import matches, whatever
   * the label says — so a header in Indonesian reads *Rp juta*, in English *Rp M*. The table still names no money unit:
   * its figures are written in full.
   */
  it('P19.5-T2 heads the table by the column’s name, (%) for a percentage and no unit for money, which is shown in full', () => {
    expect(source('modules/production/production-template.ts')).toContain("return language === 'id' ? 'Rp juta' : 'Rp M';");
    expect(V1_COLUMNS.map((c) => columnHeading(c, 'en'))).toEqual([
      'APE', 'Rolling persistency (%)', 'Recruitment', 'New active agents', 'FYP', '# of policy (case issued)', 'Unit persistency (%)',
    ]);
    for (const c of V1_COLUMNS) expect(columnHeading(c, 'id')).not.toMatch(/Rp|IDR/);
  });

  it('P19.5-T2 AC-7 the YTD side holds the columns with a year to date: five of version 1, never a persistency (R4)', () => {
    expect(ytdColumns(V1_COLUMNS).map((c) => c.kode)).toEqual(['APE', 'RECRUITMENT', 'NEW_ACTIVE_AGENTS', 'FYP', 'POLICY_COUNT']);
  });
});
