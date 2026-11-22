import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import {
  answerIntakeQuestion, confirmIntakeCard, intakeFileLink, publishIllustration, readIntake, readIntakes, readIllustrations,
  rejectIntakeCard, saveIllustration, uploadIllustration, uploadIntake,
} from './product-data-intake';

afterEach(() => vi.unstubAllGlobals());

/** **P19.15-T2, T3 — the client's routes**: each call the screens make, on the path and verb the API serves. */
describe('P19.15-T3 the Unggah file client', () => {
  it('lists, uploads and reads on the company’s routes, or on Perusahaan’s without one', async () => {
    const { calls } = stubFetch({ '/product-data/': { body: {} } });
    await readIntakes('co-1');
    await readIntakes(null);
    await uploadIntake('co-1', [new File(['x'], 'a.xlsx'), new File(['y'], 'b.pdf')]);
    await uploadIntake(null, [new File(['x'], 'a.pdf')]);
    await readIntake('in-1');
    await intakeFileLink('in-1', 2);
    expect(calls.map((c) => `${c.init.method ?? 'GET'} ${new URL(c.url).pathname.replace(/^\/api\/v1/, '')}`)).toEqual([
      'GET /product-data/companies/co-1/intakes',
      'GET /product-data/intakes',
      'POST /product-data/companies/co-1/intakes',
      'POST /product-data/intakes',
      'GET /product-data/intakes/in-1',
      'GET /product-data/intakes/in-1/files/2',
    ]);
    expect((calls[2].init.body as FormData).getAll('files')).toHaveLength(2);
  });

  it('answers, confirms and rejects a card', async () => {
    const { calls } = stubFetch({ '/product-data/intakes/': { body: {} } });
    await answerIntakeQuestion('in-1', 'it-1', 'q-1', '2026-12-01');
    await confirmIntakeCard('in-1', 'it-1');
    await rejectIntakeCard('in-1', 'it-1');
    expect(calls.map((c) => [c.init.method, c.url.split('/product-data')[1]])).toEqual([
      ['POST', '/intakes/in-1/items/it-1/answers'],
      ['POST', '/intakes/in-1/items/it-1/confirm'],
      ['POST', '/intakes/in-1/items/it-1/reject'],
    ]);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ questionId: 'q-1', answer: '2026-12-01' });
  });
});

describe('P19.15-T2 the Ilustrasi client', () => {
  it('lists, uploads with its date and plan, edits and publishes', async () => {
    const { calls } = stubFetch({ '/product-data/companies/co-1/': { body: {} } });
    await readIllustrations('co-1', 'p-1');
    await uploadIllustration('co-1', 'p-1', new File(['%PDF'], 'i.pdf'), '2026-11-01', 'Silver A');
    await saveIllustration('co-1', 'il-1', []);
    await publishIllustration('co-1', 'il-1');
    expect(calls.map((c) => [c.init.method ?? 'GET', c.url.split('/companies/co-1')[1]])).toEqual([
      ['GET', '/products/p-1/illustrations'],
      ['POST', '/products/p-1/illustrations'],
      ['PATCH', '/illustrations/il-1'],
      ['POST', '/illustrations/il-1/publish'],
    ]);
    const form = calls[1].init.body as FormData;
    expect([form.get('illustrationDate'), form.get('plan')]).toEqual(['2026-11-01', 'Silver A']);
  });
});
