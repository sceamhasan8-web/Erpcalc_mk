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
  const [settings, setSettings] = useState<ProductionUnitSettings>({
    defaultUnit: 'Pair',
    autoFormatOutputs: true,
    notes: '',
  });
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setSettings(getProductionUnitSettings());

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
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm text-slate-600">Settings / Production unit</p>
          <h1 className="mt-2 text-3xl font-bold text-black">Production unit settings</h1>
          <p className="mt-2 text-sm text-slate-600">Configure production-specific units and formatting across the entire application.</p>
        </div>

        <div className="grid gap-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <label className="block text-sm font-bold text-black" htmlFor="default-unit">
              Default production unit
            </label>
            <select
              id="default-unit"
              value={settings.defaultUnit}
              onChange={(event) => updateField('defaultUnit', event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-black outline-none font-bold text-base shadow-xs"
            >
              {DEFAULT_PRODUCTION_UNITS.map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <label className="block text-sm font-bold text-black" htmlFor="notes">
              Production Notes & Conversions
            </label>
            <textarea
              id="notes"
              rows={4}
              value={settings.notes ?? ''}
              onChange={(event) => updateField('notes', event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-black outline-none shadow-xs"
            />
            <p className="mt-2 text-sm text-slate-600">Describe how production values should be interpreted or converted.</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition"
            >
              Save production unit
            </button>
            <p className="text-sm font-semibold text-slate-600">{dirty ? 'Changes are ready to save.' : 'All settings are saved.'}</p>
          </div>

          {saved && <p className="text-sm font-bold text-emerald-700">Production unit settings saved.</p>}
        </div>

        <div className="mt-8 border-t border-slate-200 pt-6">
          <Link href="/settings" className="text-sm font-bold text-blue-700 hover:underline">
            ← Back to settings overview
          </Link>
        </div>
      </div>
    </main>
  );
}
