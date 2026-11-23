/**
 * **The two dialogs that save a PDF, for a real Chrome** (`downloads.browser.spec.ts`; the P19.30 browser walk,
 * 2026-11-23). Bundled by that spec with Vite into one script and run in Chrome against a stubbed `fetch`: the *Akun &
 * password* dialog (`TemporaryPasswordsDialog`) and the KPM report's (`KpmReportDialog`), each mounted on its own page —
 * the components themselves, not a copy of what they do.
 */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { KpmReportDialog } from '@/components/admin/kpm-report-dialog';
import { TemporaryPasswordsDialog } from '@/components/temporary-passwords-dialog';

declare global {
  interface Window { mountDialog: (which: 'temporary' | 'report') => void }
}

window.mountDialog = (which) => {
  const root = createRoot(document.getElementById('root')!);
  const closed = () => document.body.setAttribute('data-closed', '');
  root.render(which === 'temporary'
    ? createElement(TemporaryPasswordsDialog, { onClose: closed })
    : createElement(KpmReportDialog, { kpmId: 'kpm-0417', kpmName: 'BSD City Branch', companyName: 'Prudential', ownerCount: 1, onClose: closed }));
};
