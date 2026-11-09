import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { SUPER_ADMIN } from '@test/kpm-template-fixtures';
import type { TemplateOfficeStanding } from '@/lib/admin';
import { ApplyToOfficesDialog } from './apply-to-offices-dialog';

const OFFICES = '/admin/companies/c1/templates/t1/offices?kind=';
const APPLY = 'POST /admin/companies/c1/templates/t1/apply';

const office = (over: Partial<TemplateOfficeStanding>): TemplateOfficeStanding => ({
  id: 'k-0417', code: '0417', branchName: 'BSD City Branch', behind: ['training_taxonomy'], unrecorded: [],
  state: 'unchanged',
  kinds: [{ kind: 'training_taxonomy', state: 'unchanged', givenVersion: 1, newestVersion: 2, differences: [], ownMaterialModules: 0 }],
  ...over,
});

/** 0417 untouched, 0555 changed (a module retitled, its own material on 31), 0602 already current. */
const STANDINGS: TemplateOfficeStanding[] = [
  office({}),
  office({
    id: 'k-0555', code: '0555', branchName: 'Kelapa Gading', state: 'changed',
    kinds: [{
      kind: 'training_taxonomy', state: 'changed', givenVersion: 1, newestVersion: 2, ownMaterialModules: 31,
      differences: [
        { level: 'modules', code: 'PROSPECT_LIST', change: 'changed', fields: ['title'] },
        { level: 'modules', code: 'OWN_MODULE', change: 'added' },
        { level: 'modules', code: 'CLOSING', change: 'changed', fields: ['material'] },
      ],
    }],
  }),
  office({ id: 'k-0602', code: '0602', branchName: 'Bandung Dago', state: 'current', kinds: [] }),
];

const clean = async () =>
  expect((await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations ?? [])
    .toHaveLength(0);

function render(extra: Parameters<typeof stubFetch>[0] = {}) {
  const onClose = vi.fn();
  const stub = stubFetch({ [OFFICES]: { body: STANDINGS }, ...extra });
  renderWithSession(
    <ApplyToOfficesDialog open companyId="c1" templateId="t1" kinds={['training_taxonomy']} onClose={onClose} />,
    { me: SUPER_ADMIN },
  );
  return { stub, onClose };
}

/**
 * ***Terapkan juga ke KPM yang sudah ada?*** (P19.4-T1 AC-6 to AC-8; ADR-0208 §4; SA UI-012, SA R3).
 */
describe('P19.4-T1 the push to existing offices', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.4-T1 AC-6 lists untouched offices ticked and changed ones unticked, each saying what differs', async () => {
    const { stub } = render();
    const dialog = within(await screen.findByRole('dialog', { name: 'Apply to existing offices too?' }));
    expect(stub.calls[0].url).toContain('/offices?kind=training_taxonomy');
    const untouched = within(dialog.getByRole('group', { name: 'Not changed by the office' }));
    expect(untouched.getByRole('checkbox', { name: /KPM 0417/ })).toBeChecked();
    const changed = within(dialog.getByRole('group', { name: 'Changed by the office' }));
    expect(changed.getByRole('checkbox', { name: /KPM 0555/ })).not.toBeChecked();
    expect(changed.getByText('Added: OWN_MODULE')).toBeInTheDocument();
    expect(changed.getByText('Changed: PROSPECT_LIST')).toBeInTheDocument();
    // AC-8: KaiZen's case, said as a count.
    expect(changed.getByText('31 modules use their own material')).toBeInTheDocument();
    // An office already on the newest version is counted, not offered.
    expect(dialog.getByText('1 office already uses the newest version.')).toBeInTheDocument();
    expect(dialog.queryByRole('checkbox', { name: /0602/ })).toBeNull();
    await clean();
  });

  it('P19.4-T1 AC-6 Tidak sekarang sends nothing', async () => {
    const { stub, onClose } = render();
    await userEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(onClose).toHaveBeenCalled();
    expect(stub.calls.some((c) => c.init.method === 'POST')).toBe(false);
  });

  it('P19.4-T1 AC-6 applies the ticked offices only, with no second question for an untouched one', async () => {
    const { stub } = render({
      [APPLY]: {
        body: { templateId: 't1', offices: [{ id: 'k-0417', code: '0417', branchName: 'BSD City Branch', awaitingPublish: false, results: [{ kind: 'training_taxonomy', outcome: 'applied', version: 2, replaced: false }] }] },
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Apply to 1 office' }));
    const sent = stub.calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(String(sent.init.body))).toEqual({ kinds: ['training_taxonomy'], kpmIds: ['k-0417'], replaceChanged: [] });
    expect(await screen.findByRole('status')).toHaveTextContent('Applied to 1 office.');
  });

  it('P19.4-T1 AC-8 ticking a changed office asks a second time, naming what is replaced, then confirms it', async () => {
    const { stub } = render({
      [APPLY]: {
        body: {
          templateId: 't1',
          offices: [
            { id: 'k-0417', code: '0417', branchName: 'BSD City Branch', awaitingPublish: false, results: [{ kind: 'training_taxonomy', outcome: 'applied', version: 2, replaced: false }] },
            { id: 'k-0555', code: '0555', branchName: 'Kelapa Gading', awaitingPublish: true, results: [{ kind: 'training_taxonomy', outcome: 'applied', version: 2, replaced: true }] },
          ],
        },
      },
    });
    await userEvent.click(await screen.findByRole('checkbox', { name: /KPM 0555/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply to 2 offices' }));
    expect(stub.calls.some((c) => c.init.method === 'POST')).toBe(false);
    const confirm = within(screen.getByRole('dialog', { name: 'Replace the offices’ own changes?' }));
    expect(confirm.getByText('KPM 0555 · Kelapa Gading')).toBeInTheDocument();
    expect(confirm.getByText('31 modules use their own material')).toBeInTheDocument();
    expect(confirm.queryByText(/0417/)).toBeNull();
    await clean();
    await userEvent.click(confirm.getByRole('button', { name: 'Yes, replace' }));
    const sent = stub.calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(String(sent.init.body))).toEqual({
      kinds: ['training_taxonomy'], kpmIds: ['k-0417', 'k-0555'], replaceChanged: ['k-0555'],
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Applied to 2 offices.');
    expect(screen.getByText(/KPM 0555 had changes of its own waiting/)).toBeInTheDocument();
  });

  it('P19.4-T1 AC-8 Back from the second question changes nothing', async () => {
    const { stub } = render();
    await userEvent.click(await screen.findByRole('checkbox', { name: /KPM 0555/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply to 2 offices' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('dialog', { name: 'Apply to existing offices too?' })).toBeInTheDocument();
    expect(stub.calls.some((c) => c.init.method === 'POST')).toBe(false);
  });

  it('P19.4-T1 AC-8 says an office the server refused, in the API’s words', async () => {
    render({
      [APPLY]: {
        body: { templateId: 't1', offices: [{ id: 'k-0417', code: '0417', branchName: 'BSD', awaitingPublish: false, results: [{ kind: 'training_taxonomy', outcome: 'refused', error: { code: 'TEMPLATE_APPLY_UNCONFIRMED', message: 'KPM 0417 changed this section itself.' } }] }] },
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Apply to 1 office' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('KPM 0417: KPM 0417 changed this section itself.');
    expect(screen.getByRole('status')).toHaveTextContent('Applied to 0 offices.');
  });

  it('P19.4-T1 AC-6 says when no office was made from the template, and offers nothing to apply', async () => {
    render({ [OFFICES]: { body: [] } });
    expect(await screen.findByText('No office has been made from this template yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply to 0 offices' })).toBeDisabled();
  });

  it('P19.4-T1 AC-6 in Indonesian: the question, the two groups and Tidak sekarang', async () => {
    stubFetch({ [OFFICES]: { body: STANDINGS } });
    renderInIndonesian(
      <ApplyToOfficesDialog open companyId="c1" templateId="t1" kinds={['training_taxonomy']} onClose={() => undefined} />,
      { me: SUPER_ADMIN },
    );
    const dialog = within(await screen.findByRole('dialog', { name: 'Terapkan juga ke KPM yang sudah ada?' }));
    expect(await dialog.findByRole('group', { name: 'Belum diubah KPM' })).toBeInTheDocument();
    expect(dialog.getByRole('group', { name: 'Sudah diubah KPM' })).toBeInTheDocument();
    expect(dialog.getByText('31 modul memakai materi sendiri')).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Tidak sekarang' })).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Terapkan ke 1 KPM' })).toBeInTheDocument();
  });
});
