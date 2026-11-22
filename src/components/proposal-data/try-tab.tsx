'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ItemPanel } from '@/components/proposal/item-panel';
import { ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { useMessages } from '@/i18n/language-provider';
import { productDataMessages } from '@/i18n/messages/product-data';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { LEAD_AGE_MAX, LEAD_AGE_MIN } from '@/lib/leads';
import { tryProduct, type PdfBox, type ProductDataDetail, type TryBody } from '@/lib/product-data';
import type { Proposal, ProposalItem, ProposalItemPatch } from '@/lib/proposals';
import { useSession } from '@/lib/session';

const CARD = 'rounded-lg border border-hairline bg-card p-4';

/**
 * ***Uji coba*: the agent's card, tried** (P19.15-T1 AC-7; ADR-0258 §5; the P1b spec's *Tab "Uji coba"*): the client's
 * age and gender, the premium table (the one in force, or any version — a draft or a scheduled one too), then **the very
 * card the agent sees** (`ItemPanel`), each change sent with the card's last state to `POST …/try`, which runs the item's
 * own patch and the same calculation — so the premium, the UP rounding and the limits' messages are the agent's. Under
 * it, **the product's PDF box**, as the PDF draws it. Nothing is stored. Not in a view-only session, whose `POST`s the
 * server refuses.
 */
export function TryTab({ companyId, detail }: { companyId: string; detail: ProductDataDetail }) {
  const t = useMessages(productDataMessages);
  const { me } = useSession();
  const product = detail.product;
  const [age, setAge] = useState('35');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [version, setVersion] = useState('');
  const [item, setItem] = useState<ProposalItem | null>(null);
  const [box, setBox] = useState<PdfBox | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const last = useRef<ProposalItem | null>(null);
  const viewOnly = me?.isImpersonating === true;
  const ageNumber = Number(age);
  const ageOk = Number.isInteger(ageNumber) && ageNumber >= LEAD_AGE_MIN && ageNumber <= LEAD_AGE_MAX;

  const send = useCallback(async (patch: ProposalItemPatch | null, fresh: boolean) => {
    if (!ageOk || viewOnly) return;
    const state = fresh || !last.current ? null : {
      fieldValues: last.current.fieldValues, smoker: last.current.smoker, payTerm: last.current.payTerm,
      payFrequency: last.current.payFrequency, up: last.current.up, premium: last.current.premium,
      fixedField: last.current.fixedField,
    };
    const body: TryBody = { age: ageNumber, gender, rateTableId: version || null, state, patch: (patch ?? null) as TryBody['patch'] };
    try {
      const answer = await tryProduct(companyId, product.id, body);
      last.current = answer.item;
      setItem(answer.item);
      setBox(answer.box);
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [ageOk, ageNumber, companyId, gender, product.id, version, viewOnly]);

  // The client, or the table, changed: the card again, keeping what was typed.
  useEffect(() => { void send(null, false); }, [send]);

  const proposal: Proposal | null = item && {
    id: 'try', version: 1, leadId: '', leadDeleted: false,
    client: {
      name: t.try.clientName, age: ageOk ? ageNumber : null, ageSetOn: null, gender,
      details: { status: null, dependants: null, occupation: null, city: null, needs: [], needsOther: null },
    },
    showTotal: false, status: 'draft', doneAt: null, firstDoneAt: null, date: '', fileName: '', items: [item], totals: [],
    duplicatedFrom: null, createdAt: '', updatedAt: '',
  };

  return (
    <div data-try-tab="" className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t.try.lead}</p>
      {viewOnly && <p role="status" className="text-sm text-alert">{t.try.viewOnly}</p>}
      <div className="flex max-w-form flex-wrap items-end gap-3">
        <Field label={t.try.age} htmlFor="try-age" className="w-48">
          <TextInput id="try-age" inputMode="numeric" value={age} maxLength={3} invalid={!ageOk}
            onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label={t.try.gender} htmlFor="try-gender" className="w-40">
          <Select id="try-gender" value={gender} onChange={(e) => setGender(e.target.value as 'male' | 'female')}>
            <option value="male">{t.try.genders.male}</option>
            <option value="female">{t.try.genders.female}</option>
          </Select>
        </Field>
        <Field label={t.try.version} htmlFor="try-version" className="min-w-56">
          <Select id="try-version" value={version} onChange={(e) => setVersion(e.target.value)}>
            <option value="">{t.try.inForce}</option>
            {detail.versions.filter((v) => v.status !== 'off' && (v.status !== 'draft' || v.mapped)).map((v) => (
              <option key={v.id} value={v.id}>{t.try.versionOf({ n: v.version, status: t.table.statuses[v.status] })}</option>
            ))}
          </Select>
        </Field>
      </div>
      {error && <ErrorBanner {...error} />}
      {proposal && item && (
        <div className="max-w-form">
          <ItemPanel
            proposal={proposal}
            item={item}
            offered={null}
            readOnly={viewOnly}
            removable={false}
            onPatch={(patch) => { void send(patch, false); }}
            onRemove={() => {}}
          />
        </div>
      )}
      {box && (
        <section aria-labelledby="try-box" data-pdf-box="" className={`max-w-form ${CARD}`}>
          <h4 id="try-box" className="text-xs font-bold uppercase tracking-wide text-muted">{t.try.box}</h4>
          <p className="mt-1 text-xs font-bold uppercase text-muted">{box.typeLabel}</p>
          <p className="text-lg font-bold text-navy">{box.title}</p>
          <p className="text-sm text-navy">{box.who}</p>
          {box.premium && <p className="mt-2 text-xl font-bold text-navy">{box.premium} <span className="text-sm font-semibold">{box.pill}</span></p>}
          <p className="text-sm text-muted">{box.source}</p>
          {box.protection.length > 0 && (
            <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {box.protection.map((p) => (
                <div key={p.label} className="rounded-md bg-secondary-50 p-2">
                  <dt className="text-xs text-muted">{p.label}</dt><dd className="font-bold text-navy">{p.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {box.rows.length > 0 && (
            <dl className="mt-3 flex flex-col gap-1 text-sm">
              {box.rows.map((row, i) => (
                <div key={i} className="flex justify-between gap-3 border-b border-divider py-1">
                  <dt className="text-navy">{row.label}</dt><dd className="text-right font-semibold text-navy">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {box.facts.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 text-sm text-navy">
              {box.facts.map((f) => <li key={f.title}><span className="font-semibold">{f.title}</span>{f.text ? ` — ${f.text}` : ''}</li>)}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
