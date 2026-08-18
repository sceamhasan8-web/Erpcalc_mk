"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  DEFAULT_PRODUCTION_UNITS,
  getProductionUnitSettings,
  ProductionUnitSettings,
  saveProductionUnitSettings,
} from '@/lib/unitSettings';

export default function ProductionUnitPage() {
  const [settings, setSettings] = useState<ProductionUnitSettings>({ defaultUnit: 'pcs', batchSize: 1, conversionNotes: '' });
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setSettings(getProductionUnitSettings());

    // Fetch latest from server
    fetch('/api/settings?key=productionUnit', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.defaultUnit) {
          setSettings(data);
        }
      })
      .catch(() => {});

    const handleUpdate = () => {
      setSettings(getProductionUnitSettings());
    };

    window.addEventListener('erp:productionUnitUpdated', handleUpdate);
    return () => {
      window.removeEventListener('erp:productionUnitUpdated', handleUpdate);
    };
  }, []);

  function updateField<K extends keyof ProductionUnitSettings>(key: K, value: ProductionUnitSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  function handleSave() {
    try {
      saveProductionUnitSettings(settings);
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
          <p className="text-sm text-[var(--ec-muted)]">Settings / Production unit</p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--ec-foreground)]">Production unit settings</h1>
          <p className="mt-2 text-sm text-[var(--ec-muted)]">Configure production-specific units and batch sizing across the entire application.</p>
        </div>

        <div className="grid gap-6">
          <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-5">
            <label className="block text-sm font-medium text-[var(--ec-foreground)]" htmlFor="default-unit">
              Default production unit
            </label>
            <select
              id="default-unit"
              value={settings.defaultUnit}
              onChange={(event) => updateField('defaultUnit', event.target.value)}
              className="mt-2 w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-[var(--ec-foreground)] outline-none font-semibold text-base"
            >
              {DEFAULT_PRODUCTION_UNITS.map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-5">
            <label className="block text-sm font-medium text-[var(--ec-foreground)]" htmlFor="batch-size">
              Default batch size
            </label>
            <input
              id="batch-size"
              type="number"
              min={1}
              value={settings.batchSize ?? ''}
              onChange={(event) => updateField('batchSize', Number(event.target.value) || 0)}
              className="mt-2 w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-[var(--ec-foreground)] outline-none"
            />
            <p className="mt-2 text-sm text-[var(--ec-muted)]">Use this value to prefill quantity settings for production orders.</p>
          </div>

          <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-5">
            <label className="block text-sm font-medium text-[var(--ec-foreground)]" htmlFor="conversion-notes">
              Conversion notes
            </label>
            <textarea
              id="conversion-notes"
              rows={4}
              value={settings.conversionNotes ?? ''}
              onChange={(event) => updateField('conversionNotes', event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-3 text-[var(--ec-foreground)] outline-none"
            />
            <p className="mt-2 text-sm text-[var(--ec-muted)]">Describe how production values should be interpreted or converted.</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center justify-center rounded-full bg-[var(--ec-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--ec-primary-600)]"
            >
              Save production unit
            </button>
            <p className="text-sm text-[var(--ec-muted)]">{dirty ? 'Changes are ready to save.' : 'All settings are saved.'}</p>
          </div>

          {saved && <p className="text-sm text-emerald-500">Production unit settings saved.</p>}
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
