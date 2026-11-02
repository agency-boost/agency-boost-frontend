import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import {
  attachPitchDocument, formatFileSize, PDF_MAX_BYTES, PITCH_COPY, PITCH_OWN_COPY, pitchDocumentUrl,
  readPitchMaterials, requestPitchUpload, setPitchConfirmation, UNDER_A_KILOBYTE,
} from './recruitment-pitch';

const SIX_WORDS = /\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i;

describe('the pitch documents’ client (P17-T4 routes)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the four slots from the one route both screens use', async () => {
    const { calls } = stubFetch({ '/recruitment/pitch-materials': { body: { slots: [], summary: {} } } });
    await readPitchMaterials();
    expect(calls[0].url).toMatch(/\/api\/v1\/recruitment\/pitch-materials$/);
    expect(calls[0].init.method).toBe('GET');
  });

  it('asks for a document’s link by its slot code, and nothing else', async () => {
    const { calls } = stubFetch({ '/url': { body: { url: 'https://cdn.test/x', expiresAt: '2026-10-09T00:05:00Z' } } });
    await pitchDocumentUrl('howtojoin');
    expect(calls[0].url).toMatch(/\/recruitment\/pitch-materials\/howtojoin\/url$/);
  });

  it('P18.97-T5 AC-2 asks for an optional document’s link and attaches one by the same routes, its code in the address', async () => {
    const { calls } = stubFetch({
      '/url': { body: { url: 'https://cdn.test/x', expiresAt: '2026-10-09T00:05:00Z' } },
      '/kpm/settings/recruitment-pitch/': { body: {} },
    });
    await pitchDocumentUrl('company');
    await attachPitchDocument('agency', 'dev/kpm-1/recruitment-pitch/01B');
    expect(calls.map((c) => [c.init.method ?? 'GET', c.url.replace(/^.*\/api\/v1/, '')])).toEqual([
      ['GET', '/recruitment/pitch-materials/company/url'],
      ['PUT', '/kpm/settings/recruitment-pitch/agency'],
    ]);
  });

  it('asks for a signature with the file’s name, type and size', async () => {
    const { calls } = stubFetch({ '/kpm/settings/recruitment-pitch/uploads': { body: {} } });
    await requestPitchUpload({ filename: 'faq.pdf', mimeType: 'application/pdf', bytes: 1024 });
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ filename: 'faq.pdf', mimeType: 'application/pdf', bytes: 1024 });
  });

  it('attaches by storage key alone', async () => {
    const { calls } = stubFetch({ '/kpm/settings/recruitment-pitch/faq': { body: {} } });
    await attachPitchDocument('faq', 'dev/kpm-1/recruitment-pitch/01A');
    expect(calls[0].init.method).toBe('PUT');
    expect(calls[0].url).toMatch(/\/kpm\/settings\/recruitment-pitch\/faq$/);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ storageKey: 'dev/kpm-1/recruitment-pitch/01A' });
  });

  it('pins a tick to the version of the file it was made against', async () => {
    const { calls } = stubFetch({ '/confirmations/': { body: {} } });
    await setPitchConfirmation('opportunity', 'income', false, 3);
    expect(calls[0].init.method).toBe('PUT');
    expect(calls[0].url).toMatch(/\/kpm\/settings\/recruitment-pitch\/opportunity\/confirmations\/income$/);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ ticked: false, version: 3 });
  });
});

describe('formatFileSize', () => {
  it('writes a megabyte file as the prototype does, to one decimal, with a comma (ADR-0167 §1)', () => {
    expect(formatFileSize(2.4 * 1024 * 1024)).toBe('2,4 MB');
    expect(formatFileSize(1024 * 1024)).toBe('1,0 MB');
  });

  it('writes a small file in KB rather than as 0.0 MB, and never as 0 KB', () => {
    expect(formatFileSize(14_336)).toBe('14 KB');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1535)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('2 KB');
  });

  it('P18.97-T5 AC-4 writes a file under 1 KB as “< 1 KB”, never rounded up to 1 KB (UI-029; I-521)', () => {
    expect(UNDER_A_KILOBYTE).toBe('< 1 KB');
    // The seed's one-page demonstration PDFs are a few hundred bytes; storage's figure, as the server serves it.
    for (const bytes of [0, 1, 10, 640, 1023]) expect([bytes, formatFileSize(bytes)]).toEqual([bytes, '< 1 KB']);
    expect(formatFileSize(1024)).toBe('1 KB');
  });

  it('names the bound the API signs up to', () => {
    expect(formatFileSize(PDF_MAX_BYTES)).toBe('25,0 MB');
  });
});

describe('the pitch’s words', () => {
  it('P18.97-T5 AC-1, AC-2 a partial document reads “Uploaded · needs confirmation”, and an optional one is tagged “Optional”', () => {
    expect(PITCH_COPY.needsConfirmation).toBe('Uploaded · needs confirmation');
    expect(PITCH_COPY.optional).toBe('Optional');
    // The office's "{n}/{m} confirmed" is gone: nothing but the ring has the shape x/y (ADR-0177).
    expect(PITCH_COPY).not.toHaveProperty('confirmed');
    expect([PITCH_COPY.missing, PITCH_COPY.uploaded, PITCH_COPY.complete]).toEqual(['Missing', 'Uploaded', 'Complete']);
  });

  it('P18.95-T7 AC-1 are the prototype’s (`Recruitment_Section.html:681-818`), but for the client’s two lines', () => {
    // P18.95-T7 AC-1 (grey text rows 11 and 12): the client's words where the prototype's were.
    expect(PITCH_COPY.noFile).toBe('Not uploaded yet');
    expect(PITCH_COPY.updated('2.4 MB', '12 Sep 2026')).toBe('2.4 MB · updated 12 Sep 2026');
    expect(PITCH_COPY.completeLine(4))
      .toBe('All 4 documents are uploaded and fully confirmed — ready to show or send to a candidate.');
    expect(PITCH_COPY.incompleteLine([PITCH_COPY.notUploaded(2), PITCH_COPY.notConfirmed(1)])).toBe('2 missing, 1 needs checking.');
    expect(PITCH_COPY.incompleteLine([PITCH_COPY.notUploaded(4)])).toBe('4 missing.');
  });

  it('the module’s own use none of OD-39’s six words (D-copy)', () => {
    const own = [
      ...(Object.values(PITCH_OWN_COPY).filter((v) => typeof v === 'string') as string[]),
      PITCH_OWN_COPY.ringName(2, 4), PITCH_OWN_COPY.viewName('FAQ'), PITCH_OWN_COPY.uploadName('FAQ'),
      PITCH_OWN_COPY.replaceName('FAQ'), PITCH_OWN_COPY.attached('a.pdf', true), PITCH_COPY.settingsTitle,
      PITCH_COPY.needsConfirmation, PITCH_COPY.optional, UNDER_A_KILOBYTE,
    ];
    for (const text of own) expect(text).not.toMatch(SIX_WORDS);
  });
});
