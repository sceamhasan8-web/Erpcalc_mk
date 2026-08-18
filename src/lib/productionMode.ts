export type ProductionMode = 'normal' | 'footwear';

const STORAGE_KEY = 'ec-production-mode';

export function getProductionMode(): ProductionMode {
  if (typeof window === 'undefined') {
    return 'normal';
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'footwear' ? 'footwear' : 'normal';
}

export function setProductionMode(mode: ProductionMode): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent('productionModeChange', { detail: mode }));
}
