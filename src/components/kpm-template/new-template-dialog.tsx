'use client';

import { useEffect, useId, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { Button, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { ChoicePill, ChoiceRows } from '@/components/ui/rows-and-sheets';
import {
  createTemplate, importTemplate, listOrgLevels, type NamedTemplate, type OrgLevel, type RungMap,
} from '@/lib/admin';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { TEMPLATE_NAME_MAX } from '@/lib/templates';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';
import { useMediaQuery } from '@/lib/use-media-query';
import { allSources, sourceValue, TemplateSourceSelect, useTemplateSources } from './template-sources';

/**
 * **Template baru** (ADR-0185 §5): a name and *Mulai dari* — **Kosong**, or **Salin dari…** any template the console
 * can read, grouped by whose it is: this company's, every other insurer's (what *Import from another company* was) and
 * *Template bawaan AgencyBoost*. *AgencyBoost defaults* is not a choice any more; the built-in templates hold them.
 *
 * One of this company's is copied by `POST …/templates` (`from: { templateId }`), anybody else's by `POST
 * …/templates/import` — a copy, never a link, the rung check made across companies (ADR-0115 §5, §6). *Duplikat* on a
 * template's ⋮ opens this with that template chosen (`copyOf`). Every refusal is the API's: a taken name under *Nama*,
 * the rest in the banner, the dialog left open so another source can be chosen.
 *
 * **A role this company's ladder lacks is mapped, not a dead end** (ADR-0213 §4; the 11-03 handover's B1-7, *"tidak
 * memiliki SBP"*): the copy refused `409 TEMPLATE_RUNG_UNKNOWN` names each missing code, and the dialog then asks, for
 * each, which of this company's active roles it becomes — one select a code, in the dialog's own field idiom — and sends
 * the copy again with that `rungMap`. Choosing another source starts over.
 *
 * **No native select below 1024px** (P19.2-T2 AC-4; UI-134): the source a pill opening the templates — each under whose
 * it is, as the select's groups say — and each role to map a set of choice rows (a ladder holds a few); the laptop keeps
 * its selects. *Kosong / Salin dari…* are 44px below 1024px (AC-5).
 */
export function NewTemplateDialog({
  open,
  companyId,
  copyOf,
  onClose,
  onCreated,
}: {
  open: boolean;
  companyId: string;
  /** *Duplikat*: this company's template to copy, chosen when the dialog opens. */
  copyOf?: NamedTemplate | null;
  onClose: () => void;
  onCreated: (template: NamedTemplate) => void;
}) {
  const words = useMessages(adminTemplateMessages);
  const t = words.create;
  const id = useId();
  const belowLaptop = useMediaQuery(['phone', 'tablet']);
  const [name, setName] = useState('');
  const [named, setNamed] = useState(false);
  const [from, setFrom] = useState<'empty' | 'copy'>('empty');
  const [source, setSource] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  /** The codes the last copy was refused for, and the roles this company has to map them to (ADR-0213 §4). */
  const [missing, setMissing] = useState<string[] | null>(null);
  const [ladder, setLadder] = useState<OrgLevel[] | null>(null);
  const [rungMap, setRungMap] = useState<RungMap>({});
  const sources = useTemplateSources(open, { companyId, others: true, archived: true });
  const options = allSources(sources.groups);
  const chosen = options.find((o) => o.value === source) ?? null;

  // Opened again, it starts over — or, for *Duplikat*, on the template to copy.
  useEffect(() => {
    if (!open) return;
    setName(copyOf ? t.copyName({ name: copyOf.name }) : '');
    setNamed(Boolean(copyOf));
    setFrom(copyOf ? 'copy' : 'empty');
    setSource(copyOf ? sourceValue(companyId, copyOf.id) : '');
    setNameError(undefined);
    setError(null);
    setMissing(null);
    setRungMap({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, copyOf, companyId]);

  // Another source names other roles: the map asked for the last one starts over.
  useEffect(() => {
    setMissing(null);
    setRungMap({});
  }, [from, source]);

  // *Salin dari…* with nothing picked yet: the first template offered, this company's default.
  useEffect(() => {
    if (from === 'copy' && !source && options[0]) setSource(options[0].value);
  }, [from, source, options]);

  // The name follows the source chosen until the reader writes one of their own.
  useEffect(() => {
    if (!named) setName(from === 'copy' && chosen ? t.copyName({ name: chosen.template.name }) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, chosen?.value, named]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setNameError(undefined);
    setError(null);
    if (!name.trim()) {
      setNameError(words.nameMissing);
      return;
    }
    if (from === 'copy' && !chosen) return;
    setSaving(true);
    const map = missing ? { rungMap } : {};
    try {
      const made = from === 'empty'
        ? await createTemplate(companyId, { name: name.trim(), from: 'empty' })
        : chosen!.companyId === companyId
          ? await createTemplate(companyId, { name: name.trim(), from: { templateId: chosen!.templateId, ...map } })
          : await importTemplate(companyId, {
            fromCompanyId: chosen!.companyId, templateId: chosen!.templateId, name: name.trim(), ...map,
          });
      onCreated(made);
    } catch (err) {
      if (err instanceof ApiRequestError && err.error.code === 'TEMPLATE_NAME_TAKEN') {
        setNameError(err.error.message);
      } else if (err instanceof ApiRequestError && err.error.code === 'TEMPLATE_RUNG_UNKNOWN') {
        // Each role the ladder lacks, to be mapped: the roles kept from an earlier map stay chosen.
        const codes = (err.error.details?.codes as string[] | undefined) ?? [];
        setMissing(codes);
        setRungMap((now) => Object.fromEntries(codes.map((code) => [code, now[code] ?? ''])));
        if (ladder === null) {
          setLadder(await listOrgLevels(companyId).then(
            (rows) => rows.filter((r) => r.companyId === companyId && r.status === 'active'),
            () => [],
          ));
        }
      } else {
        setError(toDisplayError(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={t.title}
      onClose={onClose}
      className="max-w-[32rem]"
      footer={(
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            form={`${id}-form`}
            disabled={saving || (from === 'copy' && !chosen) || (missing !== null && missing.some((code) => !rungMap[code]))}
          >
            {saving ? words.saving : t.submit}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>{words.cancel}</Button>
        </div>
      )}
    >
      <form id={`${id}-form`} onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error && <ErrorBanner {...error} />}
        <Field label={words.name} htmlFor={`${id}-name`} error={nameError}>
          <TextInput
            id={`${id}-name`}
            value={name}
            maxLength={TEMPLATE_NAME_MAX}
            invalid={Boolean(nameError)}
            onChange={(e) => { setNamed(true); setName(e.target.value); }}
          />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-navy">{t.startFrom}</legend>
          {([['empty', t.empty, t.emptyHint], ['copy', t.copyFrom, t.copyHint]] as const).map(([value, label, hint]) => (
            <label key={value} className="flex min-h-8 items-start gap-2 text-md text-navy max-lg:min-h-11">
              <input
                type="radio"
                name={`${id}-from`}
                value={value}
                checked={from === value}
                onChange={() => setFrom(value)}
                className="mt-1 accent-secondary"
                aria-describedby={`${id}-${value}-hint`}
              />
              <span>
                {label}
                <span id={`${id}-${value}-hint`} className="block text-sm text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {from === 'copy' && (
          <>
            {sources.error && (
              <div className="flex flex-col gap-2">
                <ErrorBanner {...sources.error} />
                <Button variant="inline" className="self-start" onClick={sources.retry}>{words.card.retry}</Button>
              </div>
            )}
            {!sources.error && sources.groups === null && (
              <Skeleton label={t.loadingSources}>
                <SkeletonBar className="w-24" />
                <SkeletonBar className="mt-2 h-10 w-full" />
              </Skeleton>
            )}
            {sources.groups !== null && options.length === 0 && <p className="text-md text-muted">{t.noSource}</p>}
            {sources.groups !== null && options.length > 0 && (
              <Field label={t.source} htmlFor={`${id}-source`}>
                {belowLaptop ? (
                  <ChoicePill
                    id={`${id}-source`}
                    name={t.source}
                    options={sources.groups.flatMap((g) => g.options.map((o) => ({ key: o.value, label: o.label, hint: g.label })))}
                    value={source}
                    onChange={setSource}
                    narrows={false}
                    shows="value"
                    className="self-start"
                  />
                ) : (
                  <TemplateSourceSelect id={`${id}-source`} groups={sources.groups} value={source} onChange={setSource} />
                )}
              </Field>
            )}
            {missing && (
              <fieldset className="flex flex-col gap-3" aria-describedby={`${id}-rung-hint`}>
                <legend className="mb-1 text-sm font-semibold text-navy">{t.rungMap}</legend>
                <p id={`${id}-rung-hint`} role="alert" className="text-sm text-muted">
                  {t.rungMapHint({ codes: missing.join(', ') })}
                </p>
                {ladder !== null && ladder.length === 0 && <p className="text-sm text-alert">{t.noRungs}</p>}
                {missing.map((code) => (belowLaptop ? (
                  <div key={code} className="flex flex-col gap-1">
                    <p id={`${id}-rung-${code}-label`} className="text-sm font-semibold text-navy">{t.rungTo({ code })}</p>
                    <ChoiceRows
                      labelledBy={`${id}-rung-${code}-label`}
                      value={rungMap[code] ?? ''}
                      disabled={ladder === null}
                      onChange={(rung) => setRungMap((now) => ({ ...now, [code]: rung }))}
                      options={(ladder ?? []).map((rung) => ({ key: rung.code, label: t.rungOption(rung) }))}
                    />
                  </div>
                ) : (
                  <Field key={code} label={t.rungTo({ code })} htmlFor={`${id}-rung-${code}`}>
                    <Select
                      id={`${id}-rung-${code}`}
                      value={rungMap[code] ?? ''}
                      disabled={ladder === null}
                      onChange={(e) => setRungMap((now) => ({ ...now, [code]: e.target.value }))}
                    >
                      <option value="">{t.chooseRung}</option>
                      {(ladder ?? []).map((rung) => (
                        <option key={rung.orgLevelId} value={rung.code}>{t.rungOption(rung)}</option>
                      ))}
                    </Select>
                  </Field>
                )))}
              </fieldset>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
