'use client';

import { useEffect, useId, useState } from 'react';
import { Button, ErrorBanner, Switch } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useMessages } from '@/i18n/language-provider';
import { productDataAccessMessages } from '@/i18n/messages/product-data-access';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  revokeProductDataGrant, setProductDataGrant, type GrantCompany, type ProductDataGrantRow,
} from '@/lib/product-data-grants';
import { useMediaQuery } from '@/lib/use-media-query';

/**
 * ***Kelola data produk* for one KPM Owner or KPM Admin** (P19.15-T4 AC-2; ADR-0260 §4; the P1b spec's *Giving access*:
 * *"Kelola data produk switch, then tick one or more insurer companies"*): opened from the row's key on *KPM Owners &
 * Admins*. The switch, then the insurers to tick under it, and *Simpan*. On with ticks is `PUT`, off is `DELETE`; on
 * with nothing ticked is refused here and by the API. A centred dialog from 768px, a sheet below it.
 *
 * **What it says is the server's answer**: the row comes back from the save, and an error is shown inline, as the
 * server wrote it, in the dialog that caused it.
 */
export function ProductDataGrantDialog({
  open,
  person,
  grant,
  insurers,
  onClose,
  onSaved,
}: {
  open: boolean;
  person: { userId: string; fullName: string };
  /** Their live grant, or `null`. */
  grant: ProductDataGrantRow | null;
  /** Every insurer company, to tick from — the Template library never among them. */
  insurers: GrantCompany[] | null;
  onClose: () => void;
  /** The grant after the save: the row the server answered, or `null` once removed. */
  onSaved: (row: ProductDataGrantRow | null, message: string) => void;
}) {
  const t = useMessages(productDataAccessMessages).grants;
  const ui = useMessages(uiV1Messages);
  const phone = useMediaQuery('phone');
  const switchId = useId();
  const hintId = useId();
  const [on, setOn] = useState(grant !== null);
  const [ticked, setTicked] = useState<string[]>(grant?.companies.map((c) => c.companyId) ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [tried, setTried] = useState(false);

  // Each opening starts from the grant as it is now.
  useEffect(() => {
    if (!open) return;
    setOn(grant !== null);
    setTicked(grant?.companies.map((c) => c.companyId) ?? []);
    setError(null);
    setTried(false);
  }, [open, grant]);

  const missing = on && ticked.length === 0;

  const save = async () => {
    setTried(true);
    if (missing) return;
    setSaving(true);
    setError(null);
    try {
      if (on) {
        onSaved(await setProductDataGrant(person.userId, ticked), t.given({ name: person.fullName }));
      } else if (grant) {
        await revokeProductDataGrant(person.userId);
        onSaved(null, t.removed({ name: person.fullName }));
      } else {
        onClose();
      }
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setSaving(false);
    }
  };

  const toggle = (companyId: string) => setTicked((now) => (now.includes(companyId)
    ? now.filter((id) => id !== companyId)
    : [...now, companyId]));

  return (
    <Modal
      open={open}
      title={t.title}
      description={person.fullName}
      onClose={onClose}
      placement={phone ? 'sheet' : 'center'}
      handle={phone}
      closeLabel={ui.close}
      footer={(
        <div className="flex justify-end gap-2 max-md:[&>button]:flex-1">
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t.cancel}</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? t.saving : t.save}</Button>
        </div>
      )}
    >
      <div className="flex flex-col gap-4 pb-2">
        {error && <ErrorBanner {...error} />}
        <Switch id={switchId} label={t.switchLabel} checked={on} onChange={setOn} describedBy={hintId} phoneTarget tabletTarget />
        <p id={hintId} className="text-sm text-muted">{t.hint}</p>
        {on && (
          <fieldset aria-describedby={tried && missing ? `${hintId}-need` : undefined}>
            <legend className="mb-2 text-sm font-semibold text-muted">{t.insurers}</legend>
            {insurers === null ? (
              <p className="text-sm text-muted">{t.loadingInsurers}</p>
            ) : (
              <div className="flex flex-col gap-1">
                {insurers.map((company) => (
                  <label key={company.companyId} className="flex min-h-11 items-center gap-3 text-md text-navy lg:min-h-9">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={ticked.includes(company.companyId)}
                      onChange={() => toggle(company.companyId)}
                    />
                    {company.name}
                  </label>
                ))}
              </div>
            )}
            {tried && missing && (
              <p id={`${hintId}-need`} role="alert" className="mt-1 text-sm font-semibold text-alert">{t.needOne}</p>
            )}
          </fieldset>
        )}
      </div>
    </Modal>
  );
}
