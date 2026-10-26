'use client';

import { Button, Select } from '@/components/ui/field';
import {
  BINDING_ROLE_LABEL, BINDING_ROLES, rolesByCode, type ActivityBinding, type BindableType, type BindingRole,
} from '@/lib/activity-binding';

/**
 * **The three cascade roles, each a list of activity types** (ADR-0163) — one editor for the Super Admin's two
 * places: an office's *Activity binding* card and a template's *Activity types* tab.
 *
 * Each role lists what it counts, every type removable, and a select adds another. A type sits in one role only,
 * so the select offers the types no role holds. An archived type is offered and marked — its history still
 * counts — and the server is what refuses a role left empty, an unknown code, or a code in two roles.
 */
export function ActivityBindingFields({
  value,
  types,
  onChange,
  disabled,
  idPrefix,
}: {
  value: ActivityBinding;
  /** What may be bound, in the office's order: its activity types, or the template's. */
  types: readonly Pick<BindableType, 'code' | 'label' | 'status'>[];
  onChange: (next: ActivityBinding) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  const byCode = new Map(types.map((type) => [type.code, type]));
  const taken = rolesByCode(value);
  const name = (code: string) => {
    const type = byCode.get(code);
    return type ? `${type.label}${type.status === 'archived' ? ' (archived)' : ''}` : code;
  };
  const set = (role: BindingRole, codes: string[]) => onChange({ ...value, [role]: codes });

  return (
    <div className="flex flex-col gap-3">
      {BINDING_ROLES.map((role) => {
        const codes = value[role] ?? [];
        const offered = types.filter((type) => !taken.has(type.code));
        const selectId = `${idPrefix}-${role}`;
        return (
          <fieldset key={role} className="flex flex-col gap-1.5">
            <legend className="text-sm font-semibold text-navy">{BINDING_ROLE_LABEL[role]}</legend>
            <ul className="flex flex-wrap gap-1.5" aria-label={`${BINDING_ROLE_LABEL[role]} counts`}>
              {codes.length === 0 && <li className="text-sm text-alert">Counts nothing yet.</li>}
              {codes.map((code) => (
                <li
                  key={code}
                  className="inline-flex items-center gap-1 rounded-full border border-hairline bg-canvas px-2.5 py-0.5 text-sm text-navy"
                >
                  {name(code)}
                  <Button
                    variant="icon"
                    tone="alert"
                    className="h-6 w-6"
                    disabled={disabled}
                    aria-label={`Remove ${name(code)} from ${BINDING_ROLE_LABEL[role]}`}
                    title={`Remove from ${BINDING_ROLE_LABEL[role]}`}
                    onClick={() => set(role, codes.filter((c) => c !== code))}
                  >
                    ×
                  </Button>
                </li>
              ))}
            </ul>
            <label htmlFor={selectId} className="sr-only">{`Add an activity to ${BINDING_ROLE_LABEL[role]}`}</label>
            <Select
              id={selectId}
              className="max-w-xs"
              value=""
              disabled={disabled || offered.length === 0}
              onChange={(e) => {
                if (e.target.value) set(role, [...codes, e.target.value]);
              }}
            >
              <option value="">Add an activity…</option>
              {offered.map((type) => (
                <option key={type.code} value={type.code}>{name(type.code)}</option>
              ))}
            </Select>
          </fieldset>
        );
      })}
    </div>
  );
}
