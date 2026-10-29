import { createElement, Fragment, type ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/** Words with an element among them — a term in bold — as one message, its parts in the language's own order. */
const words = (...parts: ReactNode[]) => createElement(Fragment, null, ...parts);

/**
 * **Settings › Lead statuses** (`/kpm/settings/lead-statuses`, P4-T3; P18.98-T4): the two ladders a lead moves through,
 * one stage a row. The frame and the controls every settings screen shares are `settings.ts`'.
 *
 * **Content, shown as typed** (ADR-0179 §5): a stage's label, which an office types. **Kept English** (§A): the title
 * (§A.1), the tabs *Sales* and *Recruitment* (§A.3), *Expected to close* (a metric, §A.4), *lead*, *pipeline* and
 * *closing* (§A.6), *KPM* and *Overview* (§A.1, §A.5). *Stage* is *tahap* and *Open*, a stage's badge, *Terbuka* (for
 * approval, the glossary for approval's §B.10).
 *
 * @moved app/(tenant)/kpm/settings/lead-statuses/
 */
const en = {
  subtitle: 'The stages a lead moves through. One ladder for sales, one for recruitment.',
  /** The ladder tabs' row, by what it selects. */
  pipelineTabs: 'Lead pipeline',
  /** The toolbar's count, the prototype's own sentence per tab. */
  count: ({ n }: { n: number }) => `${n} statuses — order determines the pipeline stage sequence`,
  /** What *Expected to close* does, named once per card and pointed at by every switch; `expected` is the term, bold. */
  lateHint: ({ expected }: { expected: ReactNode }) => words(
    'Switch on the stages a lead is usually close to converting from. Leads at those stages will count as ',
    expected,
    ' on the KPM Overview.',
  ),
  none: 'No stages yet.',
  /** Why a stage's code cannot change, in its edit. */
  codeReason: 'Every lead that reached this stage points at it.',
  /** The two badges every stage wears one of. */
  closesPipeline: 'Closes the pipeline',
  open: 'Open',
  makeClose: 'Make this close the pipeline',
  /** Why the stage that closes a pipeline cannot be archived: *Archive*'s tooltip, and its reason behind ⋮. */
  closingKept: 'Make another stage close the pipeline first.',
  /** A stage's ⋮ on a phone moves it too (P18.97-T8 F3), in `ReorderArrows`' words (§B.1). */
  moveUp: 'Move up',
  moveDown: 'Move down',
  /** The switch's save status, named for its stage. */
  expectedFor: ({ name }: { name: string }) => `Expected to close, ${name}`,
  codeHint: 'Permanent. Every lead holds it.',
  addStage: ({ pipeline }: { pipeline: 'sales' | 'recruitment' }): string =>
    (pipeline === 'sales' ? 'Add a sales stage' : 'Add a recruitment stage'),
};

const id: MessagesOf<typeof en> = {
  subtitle: `Tahap-tahap yang dilalui sebuah ${kept('lead')}. Satu urutan untuk sales, satu untuk `
    + `${kept('recruitment')}.`,
  pipelineTabs: `${kept('Pipeline')} ${kept('lead')}`,
  count: ({ n }) => `${n} status — urutannya menentukan alur tahap dalam ${kept('pipeline')}`,
  lateHint: ({ expected }) => words(
    `Aktifkan pada tahap yang biasanya sudah dekat dengan ${kept('closing')}. ${kept('Leads')} di tahap itu akan `
      + 'dihitung sebagai ',
    expected,
    ` di ${kept('KPM')} ${kept('Overview')}.`,
  ),
  none: 'Belum ada tahap.',
  codeReason: `Setiap ${kept('lead')} yang pernah mencapai tahap ini merujuk ke kode ini.`,
  closesPipeline: `Menutup ${kept('pipeline')}`,
  open: 'Terbuka',
  makeClose: `Jadikan penutup ${kept('pipeline')}`,
  closingKept: `Jadikan tahap lain penutup ${kept('pipeline')} terlebih dahulu.`,
  moveUp: 'Naikkan',
  moveDown: 'Turunkan',
  expectedFor: ({ name }) => `${kept('Expected to close')}, ${name}`,
  codeHint: `Permanen. Setiap ${kept('lead')} menyimpannya.`,
  addStage: ({ pipeline }) => `Tambah tahap ${pipeline === 'sales' ? kept('Sales') : kept('Recruitment')}`,
};

export const leadStatusesMessages = defineMessages({ en, id });
