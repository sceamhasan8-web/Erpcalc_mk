"use client";

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import MenuCustomizer from './MenuCustomizer';
import { useTheme } from './ThemeProvider';
import { useAuth } from '@/context/AuthContext';
import LoginPage from './LoginPage';
import AccessDenied from './AccessDenied';

export default function Shell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const { dark, toggleDark } = useTheme();
  const { isAuthenticated, isLoading, canAccessRoute, user } = useAuth();
  const pathname = usePathname();

  // If auth is still checking storage
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--ec-bg)] text-[var(--ec-foreground)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500/20 border-t-cyan-500" />
          <span className="text-sm font-medium text-[var(--ec-muted)]">Verifying session...</span>
        </div>
      </div>
    );
  }

  // If not logged in, render LoginPage
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // /hr route is EXCLUSIVELY for 'hr' section — blocked for everyone else, even super admin
  const isHRRoute = pathname.startsWith('/hr');
  const isHRSection = user?.section === 'hr';
  if (isHRRoute && !isHRSection) {
    return (
      <div className="flex min-h-screen bg-[var(--ec-bg)] text-foreground">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onOpenCustomizer={() => setCustomizerOpen(true)} />
        <div className="flex flex-1 flex-col min-w-0">
          <Topbar onOpenMenu={() => setSidebarOpen(true)} dark={dark} onToggleDark={toggleDark} />
          <main className="flex-1 pb-24 lg:pb-8">
            <AccessDenied />
          </main>
        </div>
      </div>
    );
  }

  // Check if current route is allowed for user's section
  const isAllowed = canAccessRoute(pathname);

  return (
    <div className="flex min-h-screen bg-[var(--ec-bg)] text-foreground">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onOpenCustomizer={() => setCustomizerOpen(true)} />

      <div className="flex flex-1 flex-col min-w-0">
        <Topbar onOpenMenu={() => setSidebarOpen(true)} dark={dark} onToggleDark={toggleDark} />
        <main className="flex-1 pb-24 lg:pb-8">
          {isAllowed ? children : <AccessDenied />}
        </main>
        <div className="lg:hidden">
          <BottomNav onOpenCustomizer={() => setCustomizerOpen(true)} />
        </div>
      </div>

      <MenuCustomizer open={customizerOpen} onClose={() => setCustomizerOpen(false)} />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-black/50 lg:hidden" />
      )}
    </div>
  );
}
