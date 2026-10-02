import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { createLead, LEAD_PAGE_CAP, listEveryLead, listLeads, type Lead } from './leads';

const rows = (n: number, from = 0) =>
  Array.from({ length: n }, (_, i) => ({ id: `l${from + i}` }) as Lead);

/** A `fetch` answering `GET /leads` by page, from a list of pages, at the page size it states. */
function serve(pages: { rows: Lead[]; total: number }[], pageSize = LEAD_PAGE_CAP) {
  const asked: URLSearchParams[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const q = new URL(url).searchParams;
    asked.push(q);
    const n = Number(q.get('page'));
    const body = { ...(pages[n - 1] ?? { rows: [], total: pages[0].total }), page: n, pageSize };
    return { ok: true, status: 200, json: async () => body } as Response;
  }));
  return asked;
}

/**
 * Every lead, page after page (P10.1-T4 AC-4, ADR-0063 §3). The screen's tests walk it through a
 * table; these pin the three ways it stops.
 */
describe('listEveryLead', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks at the server’s cap until it holds the total, and no further', async () => {
    const asked = serve([
      { rows: rows(200), total: 450 },
      { rows: rows(200, 200), total: 450 },
      { rows: rows(50, 400), total: 450 },
    ]);
    const seen: [number, number, boolean][] = [];

    await listEveryLead({ outcome: 'open' }, (r, total, first) => seen.push([r.length, total, first]), () => true);

    expect(seen).toEqual([[200, 450, true], [200, 450, false], [50, 450, false]]);
    expect(asked.map((q) => [q.get('page'), q.get('pageSize'), q.get('outcome')]))
      .toEqual([['1', '200', 'open'], ['2', '200', 'open'], ['3', '200', 'open']]);
  });

  it('stops on a short page, so a lead deleted meanwhile cannot keep it asking', async () => {
    const asked = serve([{ rows: rows(200), total: 401 }, { rows: rows(150, 200), total: 401 }]);

    await listEveryLead({}, () => {}, () => true);

    expect(asked).toHaveLength(2);
  });

  it('delivers nothing, and asks nothing more, once it is no longer current', async () => {
    const asked = serve([{ rows: rows(200), total: 450 }, { rows: rows(200, 200), total: 450 }]);
    const onPage = vi.fn();

    await listEveryLead({}, onPage, () => false);

    expect(onPage).not.toHaveBeenCalled();
    expect(asked).toHaveLength(1);
  });

  it('counts a lead that arrives on two pages once, so a tie cannot end the list a page early', async () => {
    // Pages of three, as the server states them. `l2` ties with its neighbours and comes back on
    // page 2 as well — six rows delivered, five leads held — so there is a page still to ask for.
    const asked = serve([
      { rows: rows(3), total: 6 },
      { rows: [...rows(1, 2), ...rows(2, 3)], total: 6 },
      { rows: rows(1, 5), total: 6 },
    ], 3);
    const seen: string[] = [];

    await listEveryLead({}, (r) => seen.push(...r.map((l) => l.id)), () => true);

    expect(asked.map((q) => q.get('page'))).toEqual(['1', '2', '3']);
    expect(new Set(seen)).toEqual(new Set(['l0', 'l1', 'l2', 'l3', 'l4', 'l5']));
  });

  it('stops on a full page that brings no lead it does not already hold', async () => {
    const asked = serve([
      { rows: rows(3), total: 9 },
      { rows: rows(3), total: 9 },
      { rows: rows(3, 3), total: 9 },
    ], 3);

    await listEveryLead({}, () => {}, () => true);

    expect(asked).toHaveLength(2);
  });

  it('asks for the cap the service states — two hundred', () => {
    // `LeadService.list` clamps a larger request to this; here it only sets the request count.
    expect(LEAD_PAGE_CAP).toBe(200);
  });
});

describe('a coachee’s leads (P11-T8 AC-7, ADR-0076)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P11-T8 AC-7 reads and creates through ?owner=, and the reader’s own without it', async () => {
    const { calls } = stubFetch({ '/leads': { body: { rows: [], total: 0, page: 1, pageSize: 200 } } });
    await listLeads({ outcome: 'open', owner: 'mem-rina' });
    await createLead({ name: 'Pak Joko' }, 'mem-rina');
    await createLead({ name: 'Pak Joko' });
    expect(calls.map((c) => [c.init.method ?? 'GET', c.url.replace('http://api.test/api/v1', '')])).toEqual([
      ['GET', '/leads?outcome=open&owner=mem-rina'],
      ['POST', '/leads?owner=mem-rina'],
      ['POST', '/leads'],
    ]);
  });
});
