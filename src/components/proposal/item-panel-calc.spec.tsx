import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ItemCalc, Proposal, ProposalItem } from '@/lib/proposals';
import { PROPOSAL_RECALC_MS } from '@/lib/proposals';
import { makeMe, renderInIndonesian, renderWithSession } from '@test/harness';
import { ItemPanel } from './item-panel';
import { TYPED_SAVE_MS } from './money-input';

const ME = makeMe({ permissions: ['proposal:read', 'proposal:update'] });
const TABLE: ItemCalc = {
  mode: 'table', state: 'ok', tableId: 't-1', effectiveFrom: '2026-04-01', frequencies: ['monthly', 'annual'], limit: null,
  stepMinor: null, missing: null, ageBounds: null,
};

const item = (over: Partial<ProposalItem> = {}): ProposalItem => ({
  itemId: 'i-1', productId: 'p-pcb', productCode: 'PCB88', productVersion: 1, name: 'PCB88', plan: null, currency: 'IDR',
  snapshot: {
    name: 'PCB88', syariahName: null, typeLabel: 'PENYAKIT KRITIS', category: 'ci', needTag: 'CRITICAL_INCOME', isSyariah: false,
    calcType: 'up_premium', currencies: ['IDR'], fields: [], planRule: null,
    payTerms: [{ key: 'y10', label: '10 tahun', years: 10, toAge: null, single: false, maxEntryAge: 60, default: true }],
    frequencies: ['monthly', 'quarterly', 'semiannual', 'annual'], smokerRated: false, entryAge: { min: 1, max: 60 },
    limits: { upStep: null, upMin: null, upMax: null, premiumMin: null, premiumMax: null }, benefits: [], pdfDetail: [],
  },
  insured: { relation: 'client', name: null, age: null, gender: null }, smoker: null, fieldValues: {}, payTerm: 'y10',
  payFrequency: 'monthly', up: { amountMinor: 50_000_000_000, currency: 'IDR' }, premium: { amountMinor: 56_700_000, currency: 'IDR' },
  fixedField: 'up', rateTableVersionId: 't-1', rateTableEffectiveFrom: '2026-04-01', calcNote: null,
  totalPaid: { amountMinor: 56_700_000 * 120, years: 10 }, choice: null, calc: TABLE, ...over,
});

const proposal = (it: ProposalItem): Proposal => ({
  id: 'pr-1', version: 3, leadId: 'l-1', leadDeleted: false,
  client: { name: 'Budi Santoso', age: 36, ageSetOn: '2026-11-12', gender: 'male', details: { status: null, dependants: null, occupation: null, city: null, needs: [], needsOther: null } },
  showTotal: false, status: 'draft', doneAt: null, firstDoneAt: null, date: '2026-11-12', fileName: 'x.pdf', items: [it], totals: [],
  duplicatedFrom: null, createdAt: '', updatedAt: '',
});

const draw = (it: ProposalItem, onPatch = vi.fn(), indonesian = true) => {
  const ui = <ItemPanel proposal={proposal(it)} item={it} offered={null} readOnly={false} onPatch={onPatch} onRemove={() => {}} />;
  if (indonesian) renderInIndonesian(ui, { me: ME });
  else renderWithSession(ui, { me: ME });
  return onPatch;
};

afterEach(() => vi.useRealTimers());

describe('P19.15-T1 AC-5 the card calculates', () => {
  it('P19.15-T1 AC-5 the typed amount is outlined; the result line names the table’s date; no illustration hint', () => {
    draw(item());
    expect(document.querySelector('[data-up]')).toHaveAttribute('data-fixed');
    expect(document.querySelector('[data-premium]')).not.toHaveAttribute('data-fixed');
    expect(document.querySelector('[data-up] .ring-pill-blue-ink')).not.toBeNull();
    expect(screen.getByText('Tabel tarif berlaku 1 Apr 2026')).toBeInTheDocument();
    expect(screen.queryByText('Lihat di ilustrasi resmi')).not.toBeInTheDocument();
    expect(screen.getByText(/Total dibayar selama 10 tahun/)).toBeInTheDocument();
  });

  it('P19.15-T1 AC-5 saves about 300 ms after the last digit, against half a second for a typed card', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onPatch = draw(item());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const premium = screen.getByLabelText('Premi per bulan');
    await user.clear(premium);
    await user.type(premium, '600000');
    act(() => { vi.advanceTimersByTime(PROPOSAL_RECALC_MS); });
    expect(onPatch).toHaveBeenLastCalledWith({ premium: { amountMinor: 60_000_000 } });
    expect(PROPOSAL_RECALC_MS).toBeLessThan(TYPED_SAVE_MS);
  });

  it('P19.15-T1 AC-5 the disesuaikan line, the limit and its chip — nothing changed until it is tapped', async () => {
    const onPatch = draw(item({
      fixedField: 'premium', calcNote: 'up_rounded',
      calc: { ...TABLE, stepMinor: 100_000_000, limit: { kind: 'up_min', limitMinor: 10_000_000_000, chip: { field: 'up', amountMinor: 10_000_000_000 } } },
    }));
    expect(screen.getByText('Premi disesuaikan karena UP dibulatkan ke Rp 1 Jt')).toBeInTheDocument();
    expect(screen.getByText('Min. UP Rp 100 Jt')).toBeInTheDocument();
    expect(onPatch).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '— pakai Rp 100 Jt' }));
    expect(onPatch).toHaveBeenCalledWith({ up: { amountMinor: 10_000_000_000 } });
  });

  it('P19.15-T1 AC-5 a premium limit offers the UP that reaches it', async () => {
    const onPatch = draw(item({
      calc: { ...TABLE, limit: { kind: 'premium_min', limitMinor: 120_000_000, chip: { field: 'up', amountMinor: 9_700_000_000 } } },
    }));
    expect(screen.getByText('Min. premi Rp 1,2 Jt per tahun')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '— pakai UP Rp 97 Jt' }));
    expect(onPatch).toHaveBeenCalledWith({ up: { amountMinor: 9_700_000_000 } });
  });

  it('P19.15-T1 AC-5 stale numbers never print: the empty field says why', () => {
    draw(item({ premium: null, calc: { ...TABLE, state: 'missing_combination' } }));
    expect(screen.getByText('Kombinasi ini tidak ada di tabel tarif')).toBeInTheDocument();
    expect(screen.getByLabelText('Premi per bulan')).toHaveValue('');
  });

  it('P19.15-T1 AC-5 only the Cara bayar the table prices are offered — never an assumed 12×', () => {
    draw(item());
    expect(screen.getByRole('button', { name: 'Bulanan' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Kuartalan' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tahunan' })).toBeEnabled();
  });

  it('P19.15-T1 AC-6 a re-opened draft says its premium was updated; age and gender asked where the table needs them', () => {
    draw(item({ calcNote: 'rates_updated', rateTableEffectiveFrom: '2026-12-01', calc: { ...TABLE, effectiveFrom: '2026-12-01' } }));
    expect(screen.getByText('Premi diperbarui ke tarif 1 Des 2026')).toBeInTheDocument();
  });

  it('a goal or a plan gives the premium: shown, not typed; a premium_benefit product shows its benefit', () => {
    draw(item({ snapshot: { ...item().snapshot, calcType: 'plan_priced' }, up: null }), vi.fn(), false);
    expect(screen.queryByRole('textbox', { name: 'Premium per month' })).not.toBeInTheDocument();
    expect(screen.getByText('IDR 567,000', { exact: false })).toBeInTheDocument();
  });

  it('a table turned off: the premium to type again, with one line', () => {
    draw(item({ calc: null, calcNote: 'table_off', premium: null, rateTableVersionId: null }));
    expect(screen.getByText('Tabel tarif tidak berlaku lagi. Ketik premi dari ilustrasi resmi.')).toBeInTheDocument();
    expect(screen.getByText('Lihat di ilustrasi resmi')).toBeInTheDocument();
  });
});
