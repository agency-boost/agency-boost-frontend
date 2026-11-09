import { apiBlob } from './api-client';
import type { Me } from './session';
import type { ViewKind } from './views';

/**
 * **📘 *Panduan* — which guide a person opens** (P19.6-T5 AC-2; ADR-0219 §5; `functional/guides.md`; the guide spec's
 * *Which guide each role opens*, rewritten for one shell and by role, ADR-0189, ADR-0197, ADR-0198).
 *
 * **From the view and the role, never from the data**: no row asks whether somebody leads anyone, and none names the
 * owner console or *Buka tampilan …*, which Phase 19.2 removed.
 *
 * | Signed in as, in the view | Opens |
 * |---|---|
 * | Agent, *Akun saya* | `/panduan/agent-leader.html#agent` |
 * | AB or AAB, *Akun saya*, whether or not they lead anyone | `/panduan/agent-leader.html#leader` |
 * | KPM Owner, *KPM Owner · <nama KPM>* | `/panduan/kpm-owner-admin.html#owner` |
 * | KPM Admin, *KPM Admin · <nama KPM>* | `/panduan/kpm-owner-admin.html#admin` |
 * | An Owner or an Admin in *Akun saya* | their field rung's row |
 * | Somebody in no office yet | `/panduan/agent-leader.html#agent` |
 * | Super Admin, *Superadmin* | `/admin/panduan` |
 * | Super Admin in a view-as session | the row of the view being shown (`me` is the member's) |
 * | A linked login's view (ADR-0199) | that view's row (`me` is that login's once switched) |
 *
 * **The app's *ID | EN* changes neither the address nor the guide**, which is in Bahasa (acceptance 5): the language is
 * not an input here.
 */

/** The two public guides, at fixed paths with no date (ADR-0219 §1), and the Super Admin's page. */
export const PANDUAN = {
  agentLeader: '/panduan/agent-leader.html',
  kpmOwnerAdmin: '/panduan/kpm-owner-admin.html',
  superAdmin: '/admin/panduan',
} as const;

/** The item's mark, as the guide spec writes the item: *📘 Panduan*. Drawn `aria-hidden`; the name is the catalogue's. */
export const PANDUAN_GLYPH = '📘';

/** Each guide opens on one role from its fragment: the ids its role buttons carry (`ROLES`, in each file). */
export const PANDUAN_ROLE = { agent: 'agent', leader: 'leader', owner: 'owner', admin: 'admin' } as const;

export function panduanHref(me: Me | null | undefined, view: ViewKind): string {
  if (view === 'super_admin') return PANDUAN.superAdmin;
  if (view === 'kpm_owner') return `${PANDUAN.kpmOwnerAdmin}#${PANDUAN_ROLE.owner}`;
  if (view === 'kpm_admin') return `${PANDUAN.kpmOwnerAdmin}#${PANDUAN_ROLE.admin}`;
  // *Akun saya*: the rung's class (ADR-0156 §3), whatever the company names it and whoever reports to them.
  const role = me?.membership?.hierarchyRole;
  const leader = role === 'ab' || role === 'aab';
  return `${PANDUAN.agentLeader}#${leader ? PANDUAN_ROLE.leader : PANDUAN_ROLE.agent}`;
}

/**
 * **The Super Admin's guide** (P19.6-T5 AC-4; ADR-0219 §4): its HTML from `GET /admin/panduan`, with the session, as
 * text for the page's `srcdoc` frame. Never a link: the access token lives in memory, and no address serves the guide
 * without it. Every other role is refused `403 PERM_DENIED` by the API.
 */
export async function readSuperAdminGuide(): Promise<string> {
  // The literal address, so `check-api-consumers.py` sees the call.
  const file = await apiBlob('/admin/panduan');
  return textOf(file);
}

/** A blob's words as UTF-8: `Blob.text`, or a `FileReader` where it is missing (jsdom's, as `pdf-pages.tsx` notes). */
function textOf(file: Blob): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'utf-8');
  });
}

/** **The Super Admin's guide as a PDF** (`GET /admin/panduan/pdf`), for the page's *PDF* control to save. */
export function superAdminGuidePdf(): Promise<Blob> {
  return apiBlob('/admin/panduan/pdf');
}

/**
 * **The Super Admin guide's frame** (ADR-0219 §4): `sandbox="allow-scripts allow-modals"` and nothing else — the guide's
 * own scripts run, and *Simpan PDF / Cetak* may print, with an opaque origin, so nothing of the app's page, cookie or
 * storage is in its reach; no same origin, no top navigation, no popups, no forms. `allow=""`: no device feature.
 */
export const GUIDE_FRAME = { sandbox: 'allow-scripts allow-modals', allow: '', referrerPolicy: 'no-referrer' } as const;

/** The name the PDF is saved under — the API's `Content-Disposition` names it the same. */
export const SUPER_ADMIN_GUIDE_PDF_NAME = 'panduan-super-admin.pdf';
