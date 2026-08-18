import type { Metadata } from 'next';
import './globals.css';
import Shell from '@/components/Shell';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/context/AuthContext';
import { ModalProvider } from '@/context/ModalContext';
import { RealtimeProvider } from '@/context/RealtimeContext';

export const metadata: Metadata = {
  title: 'EasyCalc Factory ERP',
  description: 'A production-ready factory ERP experience built with Next.js and mock data.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <AuthProvider>
            <RealtimeProvider>
              <ModalProvider>
                <Shell>
                  <div className="w-full max-w-7xl mx-auto p-3 sm:p-5 lg:p-8">{children}</div>
                </Shell>
              </ModalProvider>
            </RealtimeProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
