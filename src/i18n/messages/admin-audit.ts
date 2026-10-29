import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The audit log** — `/admin/audit`, *Audit / Role Change Log* (P18.98-T6; `nfr/security-and-privacy.md`, *Audit*;
 * `functional/tenant-provisioning.md`, *The module's own strings*): its line, the scope, the table's frame and its empty
 * states.
 *
 * **English is the source**, byte for byte what the console wrote before; the Indonesian is the approved glossary's
 * (*Kapan* §B.4, *KPM* for an office §B.9, *sesi dukungan* §A.2). **Kept** (§A): the title, *KPM*, *Target*.
 * **What a row records is shown as recorded, in both languages**: the action and the collection are the log's codes
 * (`kpm.created`, `company_template.published`, `memberships`) — evidence, never relabelled (ADR-0023's note) — and the
 * target's and the actors' names are as stored. A row's moment is a figure, written by the page.
 *
 * @moved app/(admin)/admin/audit/
 */
const en = {
  title: kept('Audit / Role Change Log'),
  subtitle: 'Append-only. Provisioning, ownership changes and impersonation are recorded without exception.',
  scope: 'Scope',
  platformLevel: 'Platform level (no KPM)',
  columns: { when: 'When', action: 'Action', target: kept('Target'), actor: 'Actor' },
  caption: 'Audit entries, newest first',
  emptyOffice: 'Nothing recorded for this office yet.',
  emptyPlatform: 'Nothing recorded at platform level yet — create an office and it will appear here.',
  showPlatform: 'Show platform level',
  /** Under impersonation, the member the action was taken as (`name` as stored, or their id). */
  actingAs: ({ name }: { name: string }) => `as ${name}`,
};

const id: MessagesOf<typeof en> = {
  title: kept('Audit / Role Change Log'),
  subtitle: `Hanya bisa ditambah. Penyiapan ${kept('KPM')}, perubahan kepemilikan, dan sesi dukungan dicatat tanpa kecuali.`,
  scope: 'Cakupan',
  platformLevel: `Tingkat platform (tanpa ${kept('KPM')})`,
  columns: { when: 'Kapan', action: 'Tindakan', target: kept('Target'), actor: 'Pelaku' },
  caption: 'Entri audit, terbaru lebih dulu',
  emptyOffice: `Belum ada yang dicatat untuk ${kept('KPM')} ini.`,
  emptyPlatform: `Belum ada yang dicatat di tingkat platform — buat ${kept('KPM')} dan catatannya akan muncul di sini.`,
  showPlatform: 'Tampilkan tingkat platform',
  actingAs: ({ name }) => `sebagai ${name}`,
};

export const adminAuditMessages = defineMessages({ en, id });
