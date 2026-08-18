"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Box,
  Users,
  Layers,
  CalendarDays,
  Building2,
  PackageOpen,
  PackageCheck,
  ArrowRightLeft,
  Store,
  Building,
  Settings2,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface MenuItemConfig {
  key: string;
  label: string;
  href: string;
  enabled: boolean;
}

const defaultMenuItems: MenuItemConfig[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/', enabled: true },
  { key: 'orders', label: 'Orders', href: '/orders', enabled: true },
  { key: 'buyers', label: 'Buyers', href: '/buyers', enabled: true },
  { key: 'production', label: 'Production', href: '/production', enabled: true },
  { key: 'planning', label: 'Planning', href: '/planning', enabled: true },
  { key: 'warehouse', label: 'Warehouse', href: '/warehouse', enabled: true },
  { key: 'inventory', label: 'Inventory', href: '/inventory', enabled: true },
  { key: 'receive', label: 'Receive', href: '/goods-receive', enabled: true },
  { key: 'transfer', label: 'Transfer', href: '/inventory-transfer', enabled: true },
  { key: 'goods-store', label: 'Store', href: '/goods-store', enabled: true },
  { key: 'departments', label: 'Dept', href: '/departments', enabled: true },
];

function mergeMenuItems(savedItems: MenuItemConfig[]) {
  const savedMap = new Map(savedItems.map((item) => [item.key, item]));
  return defaultMenuItems.map((item) => ({
    ...item,
    enabled: savedMap.has(item.key) ? savedMap.get(item.key)!.enabled : item.enabled,
  }));
}

export default function BottomNav({ onOpenCustomizer }: { onOpenCustomizer: () => void }) {
  const pathname = usePathname();
  const { user, canAccessRoute, logout } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuItemConfig[]>(defaultMenuItems);

  const navClass = (href: string) =>
    `flex flex-col items-center text-[10px] font-medium transition ${
      pathname === href ? 'text-cyan-400 font-bold' : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
    }`;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadConfig = () => {
      const saved = window.localStorage.getItem('erp-menu-config');
      if (!saved) {
        setMenuItems(defaultMenuItems);
        return;
      }
      try {
        const parsed = JSON.parse(saved) as MenuItemConfig[];
        setMenuItems(mergeMenuItems(parsed).filter((item) => item.enabled));
      } catch {
        setMenuItems(defaultMenuItems);
      }
    };

    loadConfig();

    const handleMenuConfigUpdate = () => {
      loadConfig();
    };

    window.addEventListener('erp:menuConfigUpdated', handleMenuConfigUpdate);
    return () => window.removeEventListener('erp:menuConfigUpdated', handleMenuConfigUpdate);
  }, []);

  const isSuperAdmin = user?.section === 'admin';

  // Filter items based on user section permissions, limit to top 4 for mobile space
  const visibleItems = menuItems
    .filter((item) => item.enabled)
    .filter((item) => (isSuperAdmin ? true : canAccessRoute(item.href)))
    .slice(0, 4);

  const iconMap: Record<string, any> = {
    '/': Home,
    '/orders': Box,
    '/buyers': Users,
    '/production': Layers,
    '/planning': CalendarDays,
    '/warehouse': Building2,
    '/inventory': PackageOpen,
    '/goods-receive': PackageCheck,
    '/inventory-transfer': ArrowRightLeft,
    '/goods-store': Store,
    '/departments': Building,
  };

  return (
    <nav className="mobile-nav lg:hidden z-30 shadow-lg">
      {visibleItems.map((item) => {
        const Icon = iconMap[item.href] ?? Home;
        return (
          <Link key={item.key} href={item.href} className={navClass(item.href)}>
            <Icon className="h-4 w-4 mb-0.5" />
            <span className="truncate max-w-[64px]">{item.label}</span>
          </Link>
        );
      })}

      {isSuperAdmin && (
        <button
          type="button"
          onClick={onOpenCustomizer}
          className="flex flex-col items-center text-[10px] font-medium text-[var(--ec-muted)] hover:text-cyan-400"
        >
          <Settings2 className="h-4 w-4 mb-0.5" />
          <span>Menu</span>
        </button>
      )}

      <button
        type="button"
        onClick={logout}
        className="flex flex-col items-center text-[10px] font-medium text-[var(--ec-muted)] hover:text-red-400"
      >
        <LogOut className="h-4 w-4 mb-0.5" />
        <span>Exit</span>
      </button>
    </nav>
  );
}
