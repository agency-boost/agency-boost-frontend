import type { Metadata } from 'next';
import { ImpersonationBanner } from '@/components/impersonation-banner';
import { SessionProvider } from '@/components/session-provider';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'AgencyBoost',
  description: 'Activity, leads and coaching for insurance agency offices',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <SessionProvider>
          <ImpersonationBanner />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
