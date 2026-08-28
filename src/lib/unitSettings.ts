"use client";

import { useEffect, useState } from 'react';
import { saveDocument, subscribeToDocument } from '@/services/firebaseService';

export const PRODUCTION_UNIT_KEY = 'erp_production_unit';
export const PRODUCTION_UNIT_SETTINGS_KEY = 'erp_production_unit_settings';

export const MATERIAL_UNIT_KEY = 'erp_material_unit';
export const MATERIAL_UNIT_SETTINGS_KEY = 'erp_material_unit_settings';

export const DEFAULT_PRODUCTION_UNITS = ['Pair', 'Pcs', 'Dzn', 'Set'];
export const DEFAULT_MATERIAL_UNITS = ['pcs', 'meter', 'yard', 'kg', 'ltr', 'roll', 'sheet', 'box', 'cone', 'pack'];

export interface ProductionUnitSettings {
  defaultUnit: string;
  autoFormatOutputs: boolean;
  notes?: string;
}

export interface MaterialUnitSettings {
  defaultMaterialUnit: string;
  reorderThreshold?: number;
  notes?: string;
}

export function getProductionUnit(): string {
  if (typeof window === 'undefined') return 'Pair';
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
  return 'Pair';
}

export function getProductionUnitSettings(): ProductionUnitSettings {
  const defaultSettings: ProductionUnitSettings = { defaultUnit: 'Pair', autoFormatOutputs: true, notes: '' };
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

    // Subscribe to Firestore Real-time Multi-Device Sync
    const unsubscribeFirestore = subscribeToDocument<ProductionUnitSettings>(
      'settings',
      'productionUnit',
      (data) => {
        applyNewUnit(data);
      }
    );

    window.addEventListener('erp:productionUnitUpdated', handleLocalUpdate);
    window.addEventListener('erp:unitSettingsUpdated', handleLocalUpdate);
    window.addEventListener('storage', handleLocalUpdate);

    return () => {
      unsubscribeFirestore();
      window.removeEventListener('erp:productionUnitUpdated', handleLocalUpdate);
      window.removeEventListener('erp:unitSettingsUpdated', handleLocalUpdate);
      window.removeEventListener('storage', handleLocalUpdate);
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

    // Subscribe to Firestore Real-time Multi-Device Sync
    const unsubscribeFirestore = subscribeToDocument<MaterialUnitSettings>(
      'settings',
      'materialUnit',
      (data) => {
        applyNewUnit(data);
      }
    );

    window.addEventListener('erp:materialUnitUpdated', handleLocalUpdate);
    window.addEventListener('erp:unitSettingsUpdated', handleLocalUpdate);
    window.addEventListener('storage', handleLocalUpdate);

    return () => {
      unsubscribeFirestore();
      window.removeEventListener('erp:materialUnitUpdated', handleLocalUpdate);
      window.removeEventListener('erp:unitSettingsUpdated', handleLocalUpdate);
      window.removeEventListener('storage', handleLocalUpdate);
    };
  }, []);

  return unit;
}
