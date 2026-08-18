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

export default function BottomNav({
  onOpenCustomizer,
  onOpenProfile,
}: {
  onOpenCustomizer: () => void;
  onOpenProfile?: () => void;
}) {
  const pathname = usePathname();
  const { user, canAccessRoute, logout } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuItemConfig[]>(defaultMenuItems);

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
  const isHRSection = user?.section === 'hr';

  // Filter items based on user section permissions, limit to top 4 for mobile space
  const visibleItems = menuItems
    .filter((item) => item.enabled)
    .filter((item) => (isSuperAdmin || isHRSection ? true : canAccessRoute(item.href)))
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

  const navClass = (isActive: boolean) =>
    `relative flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-200 min-w-[52px] ${
      isActive
        ? 'text-cyan-500 dark:text-cyan-400 font-bold bg-cyan-500/10 dark:bg-cyan-500/15 shadow-sm'
        : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)] active:scale-95'
    }`;

  return (
    <nav className="mobile-nav lg:hidden z-30 shadow-xl border-t border-[var(--ec-border)]">
      {visibleItems.map((item) => {
        const Icon = iconMap[item.href] ?? Home;
        const isActive = pathname === item.href;
        return (
          <Link key={item.key} href={item.href} className={navClass(isActive)}>
            <Icon className={`h-4 w-4 mb-0.5 transition-transform ${isActive ? 'scale-110' : ''}`} />
            <span className="text-[10px] truncate max-w-[62px] leading-tight">{item.label}</span>
          </Link>
        );
      })}

      {onOpenProfile && (
        <button
          type="button"
          onClick={onOpenProfile}
          className="relative flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[var(--ec-muted)] hover:text-cyan-400 active:scale-95 transition-all min-w-[50px]"
        >
          <div className="h-4 w-4 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 text-[9px] font-bold text-white flex items-center justify-center mb-0.5 shadow-sm">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <span className="text-[10px] leading-tight">Profile</span>
        </button>
      )}

      {(isSuperAdmin || isHRSection) && (
        <button
          type="button"
          onClick={onOpenCustomizer}
          className="relative flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[var(--ec-muted)] hover:text-cyan-400 active:scale-95 transition-all min-w-[50px]"
        >
          <Settings2 className="h-4 w-4 mb-0.5" />
          <span className="text-[10px] leading-tight">Menu</span>
        </button>
      )}

      <button
        type="button"
        onClick={logout}
        className="relative flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[var(--ec-muted)] hover:text-red-400 active:scale-95 transition-all min-w-[50px]"
      >
        <LogOut className="h-4 w-4 mb-0.5" />
        <span className="text-[10px] leading-tight">Exit</span>
      </button>
    </nav>
  );
}
