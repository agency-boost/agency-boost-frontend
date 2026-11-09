import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { kindView, RATIOS } from '@test/kpm-template-fixtures';
import { settleDraftSaves, useTemplateDrafts } from './use-template-drafts';

/** A section holding the ratio set, changed once the read has landed. */
function Section({ onReady }: { onReady: (change: (payload: Record<string, unknown>) => void) => void }) {
  const drafts = useTemplateDrafts({ companyId: 'c1', templateId: 't-default', kinds: ['ratio_set'] });
  if (drafts.ready) onReady((payload) => drafts.change('ratio_set', payload));
  return null;
}

const reply = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

/**
 * **A section left with an edit on its way, then *Terbitkan semua*** (P19.4-T5 AC-9; the 11-03 handover's B1-10, *"a
 * Sequis ratio-set publish didn't stick the first time"*). The section sends its waiting edit as it closes; nobody waited
 * for it, so a publish pressed straight after could go out first, and the edit then started a new draft over the
 * version just published. Every save is tracked now, and `settleDraftSaves` — which *Terbitkan semua* and the checklist's
 * read await — resolves only once it has landed.
 */
describe('P19.4-T5 AC-9 a publish waits for every draft save on its way', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.4-T5 AC-9 the save a section sends as it closes is waited for, so the publish carries the edit', async () => {
    const order: string[] = [];
    let land: (r: Response) => void = () => undefined;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      if (method === 'GET') return reply(kindView('ratio_set', RATIOS, { revision: 1 }));
      order.push(`${method} sent`);
      return new Promise<Response>((resolve) => {
        land = (r) => { order.push(`${method} landed`); resolve(r); };
      });
    }));

    let change: ((payload: Record<string, unknown>) => void) | null = null;
    const view = render(<Section onReady={(c) => { change = c; }} />);
    await vi.waitFor(() => expect(change).not.toBeNull());
    expect(order).toEqual([]);
    act(() => change!({ ratios: [{ ...RATIOS.ratios[0], benchmark: 0.42 }] }));
    // Left before the pause that would have saved it: the edit goes out as the section closes.
    view.unmount();
    expect(order).toEqual(['PUT sent']);

    let settled = false;
    const waiting = settleDraftSaves().then(() => { settled = true; order.push('publish may go'); });
    await Promise.resolve();
    expect(settled).toBe(false);
    land(reply(kindView('ratio_set', RATIOS, { status: 'draft', version: 2, revision: 2 })));
    await waiting;
    expect(order).toEqual(['PUT sent', 'PUT landed', 'publish may go']);
  });

  it('P19.4-T5 AC-9 with nothing on its way, it answers at once', async () => {
    await expect(settleDraftSaves()).resolves.toBeUndefined();
  });
});
