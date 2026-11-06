import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { TrainingEditor, type TrainingTaxonomyPayload } from '@/components/template-editor';

const TRAINING: TrainingTaxonomyPayload = {
  categories: [{ code: 'SALES', label: 'Sales', description: null }],
  skills: [
    { code: 'LEADS_GEN', categoryCode: 'SALES', label: 'Leads generation', description: '8 cara mendapat calon nasabah' },
    { code: 'CLOSING', categoryCode: 'SALES', label: 'Closing' },
  ],
  modules: [
    { code: 'SOCIAL', skillCode: 'LEADS_GEN', title: 'Media sosial', description: 'Dari konten ke janji temu', publishState: 'published' },
  ],
};

function Editor({ section, sent }: { section: 'skills' | 'modules'; sent: TrainingTaxonomyPayload[] }) {
  const [payload, setPayload] = useState(TRAINING);
  return <TrainingEditor payload={payload} section={section} onChange={(next) => { sent.push(next); setPayload(next); }} />;
}

const rowOf = (text: string) => screen.getByText(text).closest('li') as HTMLElement;

/**
 * **A template's skills and modules take *Nama* and *Deskripsi singkat*** (P19.6-T4 AC-1; UI-161, ADR-0220 §1): the
 * Training section draws the description under the name, and its add row and edit panel write it into the draft.
 */
describe('P19.6-T4 short names in the template’s Training section', () => {
  it('P19.6-T4 AC-1 draws a skill’s description under its name, and edits it into the draft', async () => {
    const sent: TrainingTaxonomyPayload[] = [];
    render(<Editor section="skills" sent={sent} />);
    expect(within(rowOf('Leads generation')).getByText('8 cara mendapat calon nasabah')).toHaveClass('text-muted');
    await userEvent.click(within(rowOf('Closing')).getByRole('button', { name: 'Edit' }));
    const field = screen.getByRole('textbox', { name: 'Short description' });
    expect(field).toHaveAttribute('maxLength', '160');
    await userEvent.type(field, 'Ajak nasabah memutuskan');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(sent.at(-1)!.skills.find((s) => s.code === 'CLOSING')).toEqual({
      code: 'CLOSING', categoryCode: 'SALES', label: 'Closing', description: 'Ajak nasabah memutuskan',
    });
  });

  it('P19.6-T4 AC-1 draws a module’s description under its title, and clearing it saves none', async () => {
    const sent: TrainingTaxonomyPayload[] = [];
    render(<Editor section="modules" sent={sent} />);
    expect(within(rowOf('Media sosial')).getByText('Dari konten ke janji temu')).toHaveClass('text-muted');
    await userEvent.click(within(rowOf('Media sosial')).getByRole('button', { name: 'Edit' }));
    await userEvent.clear(screen.getByRole('textbox', { name: 'Short description' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(sent.at(-1)!.modules[0]).toMatchObject({ code: 'SOCIAL', title: 'Media sosial', description: null });
  });
});
