"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  DEFAULT_MATERIAL_UNITS,
  getMaterialUnitSettings,
  MaterialUnitSettings,
  saveMaterialUnitSettings,
} from '@/lib/unitSettings';

export default function MaterialUnitPage() {
  const [settings, setSettings] = useState<MaterialUnitSettings>({ defaultMaterialUnit: 'pcs', reorderThreshold: 0, notes: '' });
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setSettings(getMaterialUnitSettings());

    // Fetch latest from server
    fetch('/api/settings?key=materialUnit', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.defaultMaterialUnit) {
          setSettings(data);
        }
      })
      .catch(() => {});

    const handleUpdate = () => {
      setSettings(getMaterialUnitSettings());
    };

    window.addEventListener('erp:materialUnitUpdated', handleUpdate);
    return () => {
      window.removeEventListener('erp:materialUnitUpdated', handleUpdate);
    };
  }, []);

  function updateField<K extends keyof MaterialUnitSettings>(key: K, value: MaterialUnitSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  function handleSave() {
    try {
      saveMaterialUnitSettings(settings);
      setSaved(true);
      setDirty(false);
      window.setTimeout(() => setSaved(false), 1800);
    } catch {
      setSaved(false);
    }
  }

  return (
    <main className="min-h-screen p-4 lg:p-8">
      <div className="mx-auto max-w-4xl rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm text-[var(--ec-muted)]">Settings / Material unit</p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--ec-foreground)]">Material unit settings</h1>
          <p className="mt-2 text-sm text-[var(--ec-muted)]">Define the default material unit and related inventory preferences across the entire application.</p>
        </div>

        <div className="grid gap-6">
          <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-5">
            <label className="block text-sm font-medium text-[var(--ec-foreground)]" htmlFor="default-material-unit">
              Default material unit
            </label>
            <select
              id="default-material-unit"
              value={settings.defaultMaterialUnit}
              onChange={(event) => updateField('defaultMaterialUnit', event.target.value)}
              className="mt-2 w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-[var(--ec-foreground)] outline-none font-semibold text-base"
            >
              {DEFAULT_MATERIAL_UNITS.map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-5">
            <label className="block text-sm font-medium text-[var(--ec-foreground)]" htmlFor="reorder-threshold">
              Reorder threshold
            </label>
            <input
              id="reorder-threshold"
              type="number"
              min={0}
              value={settings.reorderThreshold ?? ''}
              onChange={(event) => updateField('reorderThreshold', Number(event.target.value) || 0)}
              className="mt-2 w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-[var(--ec-foreground)] outline-none"
            />
            <p className="mt-2 text-sm text-[var(--ec-muted)]">Define the default material reorder threshold for inventory alerts.</p>
          </div>

          <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-5">
            <label className="block text-sm font-medium text-[var(--ec-foreground)]" htmlFor="notes">
              Notes
            </label>
            <textarea
              id="notes"
              rows={4}
              value={settings.notes ?? ''}
              onChange={(event) => updateField('notes', event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-3 text-[var(--ec-foreground)] outline-none"
            />
            <p className="mt-2 text-sm text-[var(--ec-muted)]">Describe any material-specific unit handling rules.</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center justify-center rounded-full bg-[var(--ec-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--ec-primary-600)]"
            >
              Save material unit
            </button>
            <p className="text-sm text-[var(--ec-muted)]">{dirty ? 'Changes are ready to save.' : 'All settings are saved.'}</p>
          </div>

          {saved && <p className="text-sm text-emerald-500">Material unit settings saved.</p>}
        </div>

        <div className="mt-8 border-t border-[var(--ec-border)] pt-6">
          <Link href="/settings" className="text-sm font-medium text-[var(--ec-primary)] hover:underline">
            ← Back to settings overview
          </Link>
        </div>
      </div>
    </main>
  );
}
