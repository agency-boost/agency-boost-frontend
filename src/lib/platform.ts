import { api } from './api-client';

/**
 * **The console's *Platform*** (P19.23-T6; ADR-0279): its four sections' addresses, and the reads and writes of *Tim
 * Super Admin*, *Pengaturan platform* and *Pengumuman*. The audit log's own read is `readAudit` in `lib/admin.ts`.
 * Every route is the Super Admin's alone; the API refuses anybody else whatever this page draws.
 */

/** The four sections, in the tab row's order (frames f52–f55). */
export const PLATFORM_SECTIONS = ['audit', 'team', 'settings', 'announcements'] as const;
export type PlatformSection = (typeof PLATFORM_SECTIONS)[number];

export const PLATFORM_HREF = '/admin/platform';
export const platformHref = (section: PlatformSection) => `${PLATFORM_HREF}/${section}`;

// ---- Tim Super Admin (AC-2).

/** One Super Admin (`SuperAdminRowDto`). */
export interface SuperAdmin {
  userId: string;
  fullName: string;
  email: string;
  status: 'invited' | 'active' | 'deactivated';
  /** *Anda*: the reader — whose row has no *Cabut*. */
  isYou: boolean;
}

/** `GET /admin/platform/team`. */
export const listSuperAdmins = () => api<SuperAdmin[]>('/admin/platform/team');

/** *Tambah Super Admin*: an existing, verified account in no KPM. Answers the team. */
export const addSuperAdmin = (email: string) =>
  api<SuperAdmin[]>('/admin/platform/team', { method: 'POST', body: { email } });

/** *Cabut*: never your own, never the last. Answers the team. */
export const revokeSuperAdmin = (userId: string) =>
  api<SuperAdmin[]>(`/admin/platform/team/${encodeURIComponent(userId)}`, { method: 'DELETE' });

// ---- Pengaturan platform (AC-3).

/** `GET` / `PUT /admin/platform/settings` (`PlatformSettingsDto`). */
export interface PlatformSettings {
  /** `+62…`, or `null` while none is saved. */
  whatsappNumber: string | null;
  /** The AI reading key's **state** — from the environment; the key itself never reaches the browser (OD-358). */
  aiReadingKey: 'set' | 'not_set';
  /** *Tampilan bawaan*: shown, not changed here (OD-426). */
  defaultLook: { systemName: string; editable: boolean };
  updatedAt: string | null;
}

export const readPlatformSettings = () => api<PlatformSettings>('/admin/platform/settings');

/** *Simpan*: the number as typed — the server stores it as `+62…`; empty clears it. */
export const savePlatformSettings = (body: { whatsappNumber: string | null }) =>
  api<PlatformSettings>('/admin/platform/settings', { method: 'PUT', body });

/** `+628112000300` as the page writes it, `0811 2000 300`: the trunk 0 and groups of four from the start. */
export function nationalNumber(stored: string | null): string {
  if (!stored) return '';
  const digits = `0${stored.replace(/^\+62/, '')}`;
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

// ---- Pengumuman (AC-4).

/** Who an announcement goes to (`ANNOUNCEMENT.AUDIENCES` in the backend's `domain/constants/platform-console.ts`). */
export type AnnouncementAudience = 'owners' | 'members' | 'selected';

/**
 * The longest message — **mirrors `ANNOUNCEMENT.MESSAGE_MAX_LENGTH`** in the backend's
 * `domain/constants/platform-console.ts`, for the counter alone; the server's refusal is the one that counts.
 */
export const ANNOUNCEMENT_MESSAGE_MAX = 500;

export interface AudienceChoice {
  audience: AnnouncementAudience;
  companyIds: string[];
  kpmIds: string[];
}

/** One sent announcement (`AnnouncementDto`). */
export interface Announcement {
  announcementId: string;
  message: string;
  audience: AnnouncementAudience;
  /** With `selected`: the names chosen, companies first. */
  chosen: string[];
  recipientCount: number;
  sentBy: { userId: string; fullName: string | null };
  sentAt: string;
}

const audienceBody = (choice: AudienceChoice) => (choice.audience === 'selected'
  ? { audience: choice.audience, companyIds: choice.companyIds, kpmIds: choice.kpmIds }
  : { audience: choice.audience });

export const listAnnouncements = () => api<Announcement[]>('/admin/platform/announcements');

/** *Pratinjau* and *Kirim ke n …*: how many people it reaches now. Writes nothing. */
export const previewAnnouncement = (choice: AudienceChoice) =>
  api<{ audience: AnnouncementAudience; recipients: number }>('/admin/platform/announcements/preview', {
    method: 'POST', body: audienceBody(choice),
  });

/** *Kirim*: in the app, each person once. */
export const sendAnnouncement = (choice: AudienceChoice, message: string) =>
  api<Announcement>('/admin/platform/announcements', { method: 'POST', body: { ...audienceBody(choice), message } });
