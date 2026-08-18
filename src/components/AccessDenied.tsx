"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ShieldAlert, ArrowLeft, LogOut, ArrowRight, KeyRound } from 'lucide-react';

export function AccessDenied() {
  const pathname = usePathname();
  const { user, activeSection, logout, allSections, switchSection } = useAuth();

  return (
    <div className="flex min-h-[75vh] flex-col items-center justify-center p-4">
      <div className="ec-card w-full max-w-xl p-6 sm:p-8 text-center relative overflow-hidden shadow-2xl border border-red-500/20 bg-[var(--ec-card)]">
        {/* Glow accent */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 shadow-inner">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 mb-3">
          Section Access Restricted
        </span>

        <h2 className="text-2xl font-bold text-[var(--ec-foreground)]">
          Access Denied for this Section
        </h2>

        <p className="mt-2 text-sm text-[var(--ec-muted)] leading-relaxed">
          You are currently logged in as <strong className="text-[var(--ec-foreground)]">{user?.name}</strong> under the{' '}
          <span className="font-semibold text-cyan-400">{activeSection?.name || user?.section}</span> section.
          Your section role does not have permission to view <code className="rounded bg-black/20 dark:bg-white/10 px-1.5 py-0.5 text-xs text-red-300">{pathname}</code>.
        </p>

        {/* Section info box */}
        <div className="my-6 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)]/60 p-4 text-left">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ec-muted)] mb-2">
            Your Authorized Modules
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeSection?.allowedRoutes.map((route) => (
              <span
                key={route}
                className="inline-flex items-center text-xs px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono"
              >
                {route === '*' ? 'All Modules (*)' : route}
              </span>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          {activeSection && (
            <Link
              href={activeSection.defaultPath}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-cyan-500 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Go to {activeSection.shortName} Section
            </Link>
          )}

          <button
            onClick={logout}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-4 py-2.5 text-sm font-medium text-[var(--ec-foreground)] hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400 transition"
          >
            <LogOut className="h-4 w-4" />
            Switch Login / Logout
          </button>
        </div>

        {/* Quick Section Switch list for convenience */}
        <div className="mt-8 pt-6 border-t border-[var(--ec-border)] text-left">
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--ec-muted)] mb-3">
            <KeyRound className="h-3.5 w-3.5" />
            <span>Or switch directly to authorized section:</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {allSections.slice(0, 6).map((sec) => (
              <button
                key={sec.id}
                onClick={() => switchSection(sec.id)}
                className={`flex items-center justify-between p-2 rounded-lg border text-left text-xs transition ${
                  sec.id === activeSection?.id
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300 font-semibold'
                    : 'border-[var(--ec-border)] bg-[var(--ec-surface)]/50 text-[var(--ec-foreground)] hover:border-cyan-500/40 hover:bg-[var(--ec-surface)]'
                }`}
              >
                <span className="truncate">{sec.shortName}</span>
                <ArrowRight className="h-3 w-3 opacity-60 flex-shrink-0 ml-1" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AccessDenied;
