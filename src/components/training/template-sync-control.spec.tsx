import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithSession, stubFetch } from '@test/harness';
import { TemplateSyncControl } from './template-sync-control';

const URL = '/kpm/settings/training/template-sync';
const PREVIEW = {
  template: { id: 't-1', name: 'Prudential template' },
  templateVersions: { training_taxonomy: 7, capability_ladder: 4 },
  revision: 'abc123def4567890',
  differences: [
    { level: 'skill', code: 'PROSPECTING', field: 'name', from: 'Pencarian prospek', to: 'Leads generation' },
    { level: 'module', code: 'PROSPECT_LIST', field: 'description', from: null, to: 'Daftar 100 nama' },
    { level: 'capability_item', code: 'PERSONAL_SELLING:LEADS_GEN', field: 'name', from: 'Konsistensi pencarian leads', to: 'Leads generation' },
  ],
};

function render(over: { canWrite?: boolean; read?: unknown; apply?: { status?: number; body?: unknown } } = {}) {
  const onApplied = vi.fn();
  const onError = vi.fn();
  const stub = stubFetch({
    [`GET ${URL}`]: { body: over.read ?? PREVIEW },
    [`POST ${URL}`]: over.apply ?? { body: { outcome: 'published', differences: PREVIEW.differences, revision: 'next' } },
  });
  renderWithSession(
    <TemplateSyncControl canWrite={over.canWrite ?? true} refreshKey={0} onApplied={onApplied} onError={onError} />,
  );
  return { stub, onApplied, onError };
}

/** *Sinkron dari template* (P19.6-T4 AC-3, AC-5; ADR-0220 §4; UI-161). */
describe('TemplateSyncControl (P19.6-T4)', () => {
  it('P19.6-T4 AC-3 draws nothing when the KPM’s names are already its template’s', async () => {
    const { stub } = render({ read: { ...PREVIEW, differences: [] } });
    await waitFor(() => expect(stub.calls.some((c) => c.url.includes(URL))).toBe(true));
    expect(screen.queryByRole('button', { name: 'Sync from template' })).toBeNull();
  });

  it('P19.6-T4 AC-3 AC-5 shows every difference by code, the KPM’s words beside the template’s, before anything is written', async () => {
    const { stub } = render();
    await userEvent.click(await screen.findByRole('button', { name: 'Sync from template' }));
    const dialog = screen.getByRole('dialog', { name: 'Sync from template' });
    expect(dialog).toHaveTextContent('These names and descriptions differ from Prudential template’s.');
    const rows = within(dialog).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Skill · Name · PROSPECTING');
    expect(rows[0]).toHaveTextContent('NowPencarian prospek');
    expect(rows[0]).toHaveTextContent('In the templateLeads generation');
    expect(rows[1]).toHaveTextContent('Module · Short description · PROSPECT_LIST');
    expect(rows[1]).toHaveTextContent('Nownone');
    expect(rows[2]).toHaveTextContent('Capability item · Name · PERSONAL_SELLING:LEADS_GEN');
    // Nothing written by opening it.
    expect(stub.calls.filter((c) => c.init.method === 'POST')).toEqual([]);
  });

  it('P19.6-T4 AC-3 Apply sends what the preview read — the template versions and the revision — and reports what it did', async () => {
    const { stub, onApplied } = render();
    await userEvent.click(await screen.findByRole('button', { name: 'Sync from template' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    const post = stub.calls.find((c) => c.init.method === 'POST')!;
    expect(post.url).toContain(URL);
    expect(JSON.parse(String(post.init.body))).toEqual({
      templateVersions: { training_taxonomy: 7, capability_ladder: 4 }, expectedRevision: 'abc123def4567890',
    });
    await waitFor(() => expect(onApplied).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'published' })));
  });

  it('P19.6-T4 AC-3 a stale list refused 409 goes to the page’s error, and the list is read again', async () => {
    const { stub, onError } = render({
      apply: { status: 409, body: { error: { code: 'VERSION_CONFLICT', message: 'Template diterbitkan lagi', details: {} } } },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Sync from template' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(onError).toHaveBeenCalled());
    await waitFor(() => expect(stub.calls.filter((c) => c.url.includes(URL) && (c.init.method ?? 'GET') === 'GET')).toHaveLength(2));
  });

  it('P19.6-T4 AC-3 a reader who may not write — a view-as session — sees the list and no Apply', async () => {
    render({ canWrite: false });
    await userEvent.click(await screen.findByRole('button', { name: 'Sync from template' }));
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
    expect(screen.getByText('Only the Owner or an Admin of this KPM can apply these.')).toBeInTheDocument();
  });
});
