'use client';

import { useEffect, useState } from 'react';
import { Select } from '@/components/ui/field';
import {
  insurersOf, isTemplateLibrary, listCompanies, listTemplates, type Company, type NamedTemplate,
} from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';

/** One template a new template or a new office may start from. */
export interface SourceOption {
  /** `companyId:templateId` — one select's value for a template of any company. */
  value: string;
  label: string;
  companyId: string;
  templateId: string;
  template: NamedTemplate;
}

/** The templates of one company, under its name — or the library's, under *Template bawaan AgencyBoost*. */
export interface SourceGroup {
  label: string;
  companyId: string;
  library: boolean;
  options: SourceOption[];
}

export const sourceValue = (companyId: string, templateId: string) => `${companyId}:${templateId}`;

/**
 * **What a template can start from, grouped by whose it is** (ADR-0185 §5): this company's templates first, the
 * default first; then — for *Template baru* — every other insurer's active ones, under each company's name; then the
 * platform's own, under *Template bawaan AgencyBoost*. A new office (`others: false`) is offered its own company's and
 * the platform's only, as `POST /admin/tenants` accepts.
 *
 * Read when `enabled` turns true: the companies, then each one's templates at once. An archived template is offered
 * only from this company — a copy is how it comes back into use (ADR-0115 §5) — and never for a new office. Another
 * company's that cannot be read is left out, and this company's own still offered. `groups` is `null` while it is
 * read; `error` this company's read that failed, with `retry` to read again. A company's default is marked, but the
 * built-in one's on another company's page — its default is named *Default template* already.
 */
export function useTemplateSources(
  enabled: boolean,
  { companyId, others, archived }: { companyId: string; others: boolean; archived: boolean },
): { groups: SourceGroup[] | null; error: ApiError | null; retry: () => void } {
  const words = useMessages(adminTemplateMessages);
  const [read, setRead] = useState<{ companies: Company[]; templates: Map<string, NamedTemplate[]> } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !companyId) return;
    let live = true;
    setRead(null);
    setError(null);
    void (async () => {
      try {
        const companies = await listCompanies();
        const own = companies.find((c) => c._id === companyId);
        const library = companies.find(isTemplateLibrary);
        const wanted = [
          ...(own ? [own] : []),
          ...(others ? insurersOf(companies).filter((c) => c._id !== companyId) : []),
          ...(library && library._id !== companyId ? [library] : []),
        ];
        // This company's templates must be read; another's that cannot be is simply not offered (P18.6-T3 AC-5).
        const lists = await Promise.all(wanted.map((c) => (c._id === companyId
          ? listTemplates(c._id)
          : listTemplates(c._id).catch(() => [] as NamedTemplate[]))));
        if (live) setRead({ companies: wanted, templates: new Map(wanted.map((c, i) => [c._id, lists[i]])) });
      } catch (err) {
        if (live) setError(toDisplayError(err));
      }
    })();
    return () => { live = false; };
  }, [enabled, companyId, others, attempt]);

  const groups = read && read.companies.map((company): SourceGroup => {
    const mine = company._id === companyId;
    const offered = (read.templates.get(company._id) ?? [])
      .filter((t) => t.status === 'active' || (mine && archived))
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || Number(a.status === 'archived') - Number(b.status === 'archived'));
    return {
      label: isTemplateLibrary(company) ? words.companyPage.library : company.name,
      companyId: company._id,
      library: isTemplateLibrary(company),
      options: offered.map((template) => ({
        value: sourceValue(company._id, template.id),
        label: template.status === 'archived'
          ? words.create.archivedOption({ name: template.name })
          : template.isDefault && (mine || !isTemplateLibrary(company))
            ? words.create.defaultOption({ name: template.name }) : template.name,
        companyId: company._id,
        templateId: template.id,
        template,
      })),
    };
  }).filter((group) => group.options.length > 0);

  return { groups, error, retry: () => setAttempt((n) => n + 1) };
}

/** Every option of every group, for finding the one a value names. */
export const allSources = (groups: SourceGroup[] | null): SourceOption[] => (groups ?? []).flatMap((g) => g.options);

/**
 * **The one *Mulai dari* picker** (ADR-0185 §5): a select of templates grouped by whose they are, with whatever the
 * caller adds after them — a new office's *Kosong*. One shape on *Template baru* and on a new office, so a reader
 * learns it once.
 */
export function TemplateSourceSelect({
  id,
  groups,
  value,
  onChange,
  disabled,
  invalid,
  'aria-describedby': describedBy,
  children,
}: {
  id: string;
  groups: SourceGroup[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** Given by the `Field` it sits in: its hint and its error. */
  'aria-describedby'?: string;
  /** Options after the groups — *Kosong* on a new office. */
  children?: React.ReactNode;
}) {
  return (
    <Select
      id={id}
      value={value}
      disabled={disabled}
      invalid={invalid}
      aria-describedby={describedBy}
      onChange={(e) => onChange(e.target.value)}
    >
      {groups.map((group) => (
        <optgroup key={group.companyId} label={group.label}>
          {group.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </optgroup>
      ))}
      {children}
    </Select>
  );
}
