"use client";

import Link from 'next/link';

export function SettingsPage() {
  return (
    <main className="min-h-screen p-4 lg:p-8">
      <div className="mx-auto max-w-5xl rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-6 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/settings/production-unit"
            className="inline-flex items-center justify-center rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-4 py-4 text-sm font-semibold text-[var(--ec-foreground)] transition hover:border-[var(--ec-primary)] hover:bg-[var(--ec-card)]"
          >
            Production unit
          </Link>
          <Link
            href="/settings/dynamic-unit"
            className="inline-flex items-center justify-center rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-4 py-4 text-sm font-semibold text-[var(--ec-foreground)] transition hover:border-[var(--ec-primary)] hover:bg-[var(--ec-card)]"
          >
            Dynamic unit
          </Link>
          <Link
            href="/settings/material-unit"
            className="inline-flex items-center justify-center rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-4 py-4 text-sm font-semibold text-[var(--ec-foreground)] transition hover:border-[var(--ec-primary)] hover:bg-[var(--ec-card)]"
          >
            Material unit
          </Link>
        </div>
      </div>
    </main>
  );
}
