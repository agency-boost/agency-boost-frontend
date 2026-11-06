import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TrainingEditor, type TrainingTaxonomyPayload } from '@/components/template-editor';
import { CONFIG_CODE_MAX_LENGTH, suggestCode } from '@/lib/config-code';

const TRAINING: TrainingTaxonomyPayload = {
  categories: [{ code: 'SALES', label: 'Sales', description: null }],
  skills: [{ code: 'CLOSING', categoryCode: 'SALES', label: 'Closing' }],
  modules: [],
};

function Editor({ onChange = vi.fn() }: { onChange?: (next: TrainingTaxonomyPayload) => void }) {
  const [payload, setPayload] = useState(TRAINING);
  return <TrainingEditor payload={payload} section="modules" onChange={(next) => { setPayload(next); onChange(next); }} />;
}

/**
 * **P19.4-T4 AC-14 — a module code's limit, in the field** (the 11-03 handover's B1-9): the template's *Training*
 * section says the 40-character limit as the code is typed and takes no more there, where the server used to refuse it
 * at publish. The same add row serves every code of the template, each bound by the same `CODE_PATTERN`.
 */
describe('P19.4-T4 AC-14 a module code’s 40-character limit', () => {
  it('P19.4-T4 AC-14 is the server’s own bound: CODE_PATTERN takes 3 to 40 characters', () => {
    const fields = readFileSync(join(__dirname, '..', '..', '..', 'backend', 'src', 'common', 'validation', 'fields.ts'), 'utf8');
    expect(fields).toContain(`export const CODE_PATTERN = /^[A-Za-z][A-Za-z0-9_]{2,${CONFIG_CODE_MAX_LENGTH - 1}}$/;`);
    expect(suggestCode('Conducting a financial needs analysis for young families and their parents').length)
      .toBeLessThanOrEqual(CONFIG_CODE_MAX_LENGTH);
  });

  it('P19.4-T4 AC-14 counts the code as it is typed, and refuses more than 40 in the field', async () => {
    render(<Editor />);
    await userEvent.selectOptions(screen.getByLabelText('Skill'), 'CLOSING');
    await userEvent.click(screen.getByRole('button', { name: 'Add a module' }));
    const code = screen.getByLabelText('Code');
    expect(code).toHaveAttribute('maxLength', String(CONFIG_CODE_MAX_LENGTH));
    expect(code).toHaveAccessibleDescription(/0 of 40 characters\./);

    await userEvent.type(code, 'A'.repeat(45));
    expect(code).toHaveValue('A'.repeat(40));
    expect(code).toHaveAccessibleDescription(/40 of 40 characters\./);
  });
});
