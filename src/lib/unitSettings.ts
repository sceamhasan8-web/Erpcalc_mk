"use client";

import { useEffect, useState } from 'react';
import { saveDocument, subscribeToDocument } from '@/services/firebaseService';

export interface ProductionUnitSettings {
  defaultUnit: string;
  batchSize?: number;
  conversionNotes?: string;
}

export interface MaterialUnitSettings {
  defaultMaterialUnit: string;
  reorderThreshold?: number;
  notes?: string;
}

export const PRODUCTION_UNIT_SETTINGS_KEY = 'ec-production-unit-settings';
export const PRODUCTION_UNIT_KEY = 'ec-production-unit';
export const MATERIAL_UNIT_SETTINGS_KEY = 'ec-material-unit-settings';
export const MATERIAL_UNIT_KEY = 'ec-material-unit';

export const DEFAULT_PRODUCTION_UNITS = ['pcs', 'pair', 'kg', 'm', 'liters', 'dozen', 'box', 'set'];
export const DEFAULT_MATERIAL_UNITS = ['pcs', 'kg', 'meter', 'liters', 'rolls', 'yards', 'cones'];

export function getProductionUnit(): string {
  if (typeof window === 'undefined') return 'pcs';
  try {
    const rawSettings = localStorage.getItem(PRODUCTION_UNIT_SETTINGS_KEY);
    if (rawSettings) {
      const parsed = JSON.parse(rawSettings) as ProductionUnitSettings;
      if (parsed?.defaultUnit) return parsed.defaultUnit;
    }
    const directUnit = localStorage.getItem(PRODUCTION_UNIT_KEY);
    if (directUnit) return directUnit;
  } catch {
    // fallback
  }
  return 'pcs';
}

export function getProductionUnitSettings(): ProductionUnitSettings {
  const defaultSettings: ProductionUnitSettings = { defaultUnit: 'pcs', batchSize: 1, conversionNotes: '' };
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const raw = localStorage.getItem(PRODUCTION_UNIT_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultSettings, ...parsed };
    }
    const direct = localStorage.getItem(PRODUCTION_UNIT_KEY);
    if (direct) {
      return { ...defaultSettings, defaultUnit: direct };
    }
  } catch {
    // fallback
  }
  return defaultSettings;
}

export function saveProductionUnitSettings(settings: ProductionUnitSettings): void {
  if (typeof window === 'undefined') return;
  try {
    // 1. Immediate Local Cache for zero-delay UI update
    localStorage.setItem(PRODUCTION_UNIT_SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem(PRODUCTION_UNIT_KEY, settings.defaultUnit);
    window.dispatchEvent(new CustomEvent('erp:productionUnitUpdated', { detail: settings }));
    window.dispatchEvent(new CustomEvent('erp:unitSettingsUpdated', { detail: settings }));
    window.dispatchEvent(new Event('storage'));

    // 2. Cloud Database Sync (Firestore Real-time)
    saveDocument('settings', 'productionUnit', settings).catch((err) => {
      console.warn('Firestore sync note:', err);
    });

    // 3. Central REST API Sync (MongoDB / Server Sync for all networks and devices)
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'productionUnit', value: settings }),
    }).catch(() => {});
  } catch (e) {
    console.error('Failed to save production unit settings', e);
  }
}

export function getMaterialUnit(): string {
  if (typeof window === 'undefined') return 'pcs';
  try {
    const rawSettings = localStorage.getItem(MATERIAL_UNIT_SETTINGS_KEY);
    if (rawSettings) {
      const parsed = JSON.parse(rawSettings) as MaterialUnitSettings;
      if (parsed?.defaultMaterialUnit) return parsed.defaultMaterialUnit;
    }
    const directUnit = localStorage.getItem(MATERIAL_UNIT_KEY);
    if (directUnit) return directUnit;
  } catch {
    // fallback
  }
  return 'pcs';
}

export function getMaterialUnitSettings(): MaterialUnitSettings {
  const defaultSettings: MaterialUnitSettings = { defaultMaterialUnit: 'pcs', reorderThreshold: 0, notes: '' };
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const raw = localStorage.getItem(MATERIAL_UNIT_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultSettings, ...parsed };
    }
    const direct = localStorage.getItem(MATERIAL_UNIT_KEY);
    if (direct) {
      return { ...defaultSettings, defaultMaterialUnit: direct };
    }
  } catch {
    // fallback
  }
  return defaultSettings;
}

export function saveMaterialUnitSettings(settings: MaterialUnitSettings): void {
  if (typeof window === 'undefined') return;
  try {
    // 1. Immediate Local Cache for zero-delay UI update
    localStorage.setItem(MATERIAL_UNIT_SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem(MATERIAL_UNIT_KEY, settings.defaultMaterialUnit);
    window.dispatchEvent(new CustomEvent('erp:materialUnitUpdated', { detail: settings }));
    window.dispatchEvent(new CustomEvent('erp:unitSettingsUpdated', { detail: settings }));
    window.dispatchEvent(new Event('storage'));

    // 2. Cloud Database Sync (Firestore Real-time)
    saveDocument('settings', 'materialUnit', settings).catch((err) => {
      console.warn('Firestore sync note:', err);
    });

    // 3. Central REST API Sync (MongoDB / Server Sync for all networks and devices)
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'materialUnit', value: settings }),
    }).catch(() => {});
  } catch (e) {
    console.error('Failed to save material unit settings', e);
  }
}

export function useProductionUnit(): string {
  const [unit, setUnit] = useState<string>(getProductionUnit());

  useEffect(() => {
    setUnit(getProductionUnit());

    function applyNewUnit(newSettings: ProductionUnitSettings | null) {
      if (newSettings && newSettings.defaultUnit) {
        try {
          localStorage.setItem(PRODUCTION_UNIT_SETTINGS_KEY, JSON.stringify(newSettings));
          localStorage.setItem(PRODUCTION_UNIT_KEY, newSettings.defaultUnit);
        } catch {}
        setUnit(newSettings.defaultUnit);
      }
    }

    function handleLocalUpdate() {
      setUnit(getProductionUnit());
    }

    // 1. Subscribe to Firestore Real-time Multi-Device Sync
    const unsubscribeFirestore = subscribeToDocument<ProductionUnitSettings>(
      'settings',
      'productionUnit',
      (data) => {
        applyNewUnit(data);
      }
    );

    // 2. Polling / Fetch from Central Server API for all cross-device clients
    async function syncFromServer() {
      try {
        const res = await fetch('/api/settings?key=productionUnit', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.defaultUnit) {
            applyNewUnit(data);
          }
        }
      } catch {}
    }

    syncFromServer();
    const interval = setInterval(syncFromServer, 3000);

    window.addEventListener('erp:productionUnitUpdated', handleLocalUpdate);
    window.addEventListener('erp:unitSettingsUpdated', handleLocalUpdate);
    window.addEventListener('storage', handleLocalUpdate);
    window.addEventListener('focus', syncFromServer);

    return () => {
      clearInterval(interval);
      unsubscribeFirestore();
      window.removeEventListener('erp:productionUnitUpdated', handleLocalUpdate);
      window.removeEventListener('erp:unitSettingsUpdated', handleLocalUpdate);
      window.removeEventListener('storage', handleLocalUpdate);
      window.removeEventListener('focus', syncFromServer);
    };
  }, []);

  return unit;
}

export function useMaterialUnit(): string {
  const [unit, setUnit] = useState<string>(getMaterialUnit());

  useEffect(() => {
    setUnit(getMaterialUnit());

    function applyNewUnit(newSettings: MaterialUnitSettings | null) {
      if (newSettings && newSettings.defaultMaterialUnit) {
        try {
          localStorage.setItem(MATERIAL_UNIT_SETTINGS_KEY, JSON.stringify(newSettings));
          localStorage.setItem(MATERIAL_UNIT_KEY, newSettings.defaultMaterialUnit);
        } catch {}
        setUnit(newSettings.defaultMaterialUnit);
      }
    }

    function handleLocalUpdate() {
      setUnit(getMaterialUnit());
    }

    // 1. Subscribe to Firestore Real-time Multi-Device Sync
    const unsubscribeFirestore = subscribeToDocument<MaterialUnitSettings>(
      'settings',
      'materialUnit',
      (data) => {
        applyNewUnit(data);
      }
    );

    // 2. Polling / Fetch from Central Server API for all cross-device clients
    async function syncFromServer() {
      try {
        const res = await fetch('/api/settings?key=materialUnit', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.defaultMaterialUnit) {
            applyNewUnit(data);
          }
        }
      } catch {}
    }

    syncFromServer();
    const interval = setInterval(syncFromServer, 3000);

    window.addEventListener('erp:materialUnitUpdated', handleLocalUpdate);
    window.addEventListener('erp:unitSettingsUpdated', handleLocalUpdate);
    window.addEventListener('storage', handleLocalUpdate);
    window.addEventListener('focus', syncFromServer);

    return () => {
      clearInterval(interval);
      unsubscribeFirestore();
      window.removeEventListener('erp:materialUnitUpdated', handleLocalUpdate);
      window.removeEventListener('erp:unitSettingsUpdated', handleLocalUpdate);
      window.removeEventListener('storage', handleLocalUpdate);
      window.removeEventListener('focus', syncFromServer);
    };
  }, []);

  return unit;
}
