"use client";
import { useEffect, useMemo, useState } from 'react';
import { Check, Settings2, X } from 'lucide-react';

export interface MenuItemConfig {
  key: string;
  label: string;
  href: string;
  enabled: boolean;
}

const defaultMenuItems: MenuItemConfig[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/', enabled: true },
  { key: 'inventory', label: 'Inventory', href: '/inventory', enabled: true },
  { key: 'receive', label: 'Receive', href: '/goods-receive', enabled: true },
  { key: 'transfer', label: 'Transfer', href: '/inventory-transfer', enabled: true },
  { key: 'orders', label: 'Orders', href: '/orders', enabled: true },
  { key: 'buyers', label: 'Buyers', href: '/buyers', enabled: true },
  { key: 'production', label: 'Production', href: '/production', enabled: true },
  { key: 'planning', label: 'Planning', href: '/planning', enabled: true },
  { key: 'warehouse', label: 'Warehouse', href: '/warehouse', enabled: true },
  { key: 'goods-store', label: 'Goods Store', href: '/goods-store', enabled: true },
  { key: 'departments', label: 'Departments', href: '/departments', enabled: true },
  { key: 'settings', label: 'Settings', href: '/settings', enabled: true },
];

function mergeMenuItems(savedItems: MenuItemConfig[]) {
  const saved = new Map(savedItems.map((item) => [item.key, item]));
  return defaultMenuItems.map((item) => ({
    ...item,
    enabled: saved.has(item.key) ? saved.get(item.key)!.enabled : item.enabled,
  }));
}

export function MenuCustomizer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<MenuItemConfig[]>(defaultMenuItems);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('erp-menu-config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as MenuItemConfig[];
        setItems(mergeMenuItems(parsed));
      } catch {
        setItems(defaultMenuItems);
      }
      return;
    }
    setItems(defaultMenuItems);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('erp-menu-config', JSON.stringify(items));
    try {
      window.dispatchEvent(new CustomEvent('erp:menuConfigUpdated', { detail: items }));
    } catch {
      // ignore
    }
  }, [items]);

  const enabledCount = useMemo(() => items.filter((item) => item.enabled).length, [items]);

  if (!open) return null;

  const toggleItem = (key: string) => {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, enabled: !item.enabled } : item)));
  };

  const setAll = (enabled: boolean) => {
    setItems((current) => current.map((item) => ({ ...item, enabled })));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4 shadow-2xl">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-[var(--ec-foreground)]">Customize menu</div>
            <div className="text-sm text-[var(--ec-muted)]">Show or hide items from the navigation.</div>
          </div>
          <button onClick={onClose} className="rounded-full border border-[var(--ec-border)] p-2 text-[var(--ec-foreground)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="rounded-2xl bg-[var(--ec-surface)] px-3 py-2 text-sm text-[var(--ec-muted)]">
            {enabledCount} visible items
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAll(true)}
              className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-sm font-semibold text-[var(--ec-foreground)] hover:border-cyan-500"
            >
              Show all
            </button>
            <button
              type="button"
              onClick={() => setAll(false)}
              className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-sm font-semibold text-[var(--ec-foreground)] hover:border-red-500"
            >
              Hide all
            </button>
          </div>
        </div>

        <div className="max-h-72 space-y-2 overflow-auto">
          {items.map((item) => (
            <button
              key={item.key}
              onClick={() => toggleItem(item.key)}
              className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left text-sm transition ${
                item.enabled
                  ? 'border-cyan-400/30 bg-cyan-500/10 text-[var(--ec-foreground)]'
                  : 'border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-muted)]'
              }`}
            >
              <span>{item.label}</span>
              {item.enabled ? <Check className="h-4 w-4 text-cyan-300" /> : null}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-white"
        >
          Done
        </button>
      </div>
    </div>
  );
}

export default MenuCustomizer;
