"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Box,
  Users,
  Layers,
  Settings,
  Bell,
  Building,
  CalendarDays,
  PackageOpen,
  ArrowRightLeft,
  PackageCheck,
  Store,
  LogOut,
  SlidersHorizontal,
  UserCog,
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
  { key: 'receive', label: 'Goods Receive', href: '/goods-receive', enabled: true },
  { key: 'transfer', label: 'Inventory Transfer', href: '/inventory-transfer', enabled: true },
  { key: 'goods-store', label: 'Goods Store', href: '/goods-store', enabled: true },
  { key: 'departments', label: 'Departments', href: '/departments', enabled: true },
  { key: 'hr', label: 'Human Resource', href: '/hr', enabled: true },
  { key: 'notifications', label: 'Notifications', href: '/notifications', enabled: true },
  { key: 'settings', label: 'Settings', href: '/settings', enabled: true },
];

function mergeMenuItems(savedItems: MenuItemConfig[]) {
  const savedMap = new Map(savedItems.map((item) => [item.key, item]));
  return defaultMenuItems.map((item) => ({
    ...item,
    enabled: savedMap.has(item.key) ? savedMap.get(item.key)!.enabled : item.enabled,
  }));
}

export function Sidebar({
  open,
  onClose,
  onOpenCustomizer,
  onOpenProfile,
}: {
  open?: boolean;
  onClose?: () => void;
  onOpenCustomizer?: () => void;
  onOpenProfile?: () => void;
}) {
  const pathname = usePathname();
  const { user, activeSection, canAccessRoute, logout } = useAuth();
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
        setMenuItems(mergeMenuItems(parsed));
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

  // Build visible menu items
  const visibleMenuItems = menuItems.filter((item) => {
    // /hr item — EXCLUSIVE to HR section:
    //   - HR section: always show (ignore saved enabled state)
    //   - Everyone else (incl. admin): always hide
    if (item.href === '/hr') {
      return isHRSection;
    }

    // All other items: respect saved enabled state
    if (!item.enabled) return false;

    // Super admin and HR see all non-HR items
    if (isSuperAdmin || isHRSection) return true;

    // Other sections: only allowed routes
    return canAccessRoute(item.href);
  });

  return (
    <aside
      className={`sidebar fixed inset-y-0 left-0 z-50 flex h-full max-h-[100dvh] w-72 max-w-[85vw] transform flex-col gap-3 border-r border-[var(--ec-border)] bg-[var(--ec-card)] p-4 shadow-2xl transition-transform duration-300 ease-out lg:static lg:h-full lg:max-h-none lg:w-64 lg:shadow-none lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      {/* Brand Header */}
      <div className="mb-1 flex items-center gap-3 flex-shrink-0">
        <img src="/erpcalc-logo.png" alt="ERP Calc" className="brand-logo rounded-xl shadow-sm" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-[var(--ec-foreground)] truncate">EasyCalc ERP</div>
          <div className="text-[11px] text-[var(--ec-muted)] truncate">Factory Operations</div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden rounded-lg border border-[var(--ec-border)] bg-[var(--ec-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--ec-foreground)] hover:bg-[var(--ec-border)] active:scale-95 transition"
        >
          Close
        </button>
      </div>

      {/* Active Section Info Card */}
      {activeSection && (
        <div
          className="rounded-xl border p-2.5 flex items-center gap-2.5 transition flex-shrink-0"
          style={{
            backgroundColor: `${activeSection.color}10`,
            borderColor: `${activeSection.color}35`,
          }}
        >
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse"
            style={{ backgroundColor: activeSection.color }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase font-bold tracking-wider" style={{ color: activeSection.color }}>
              Active Section
            </div>
            <div className="text-xs font-semibold text-[var(--ec-foreground)] truncate">
              {activeSection.name}
            </div>
          </div>
        </div>
      )}

      {/* Navigation List */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto pr-1 overscroll-contain">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ec-muted)] px-3 pt-2 pb-1">
          {isSuperAdmin || isHRSection ? 'All Modules' : `${activeSection?.shortName || 'Section'} Modules`}
        </div>

        {visibleMenuItems.map((item) => {
          const iconMap: Record<string, any> = {
            '/': Home,
            '/orders': Box,
            '/buyers': Users,
            '/production': Layers,
            '/planning': CalendarDays,
            '/warehouse': Building,
            '/inventory': PackageOpen,
            '/goods-receive': PackageCheck,
            '/inventory-transfer': ArrowRightLeft,
            '/goods-store': Store,
            '/departments': Building,
            '/hr': UserCog,
            '/notifications': Bell,
            '/settings': Settings,
          };

          return (
            <NavItem
              key={item.key}
              href={item.href}
              icon={iconMap[item.href] ?? PackageOpen}
              label={item.label}
              pathname={pathname}
              onClick={onClose}
            />
          );
        })}
      </nav>

      {/* Footer Controls & User Card */}
      <div className="pt-2 border-t border-[var(--ec-border)] flex flex-col gap-2 flex-shrink-0">
        {(isSuperAdmin || isHRSection) && (
          <button
            type="button"
            onClick={onOpenCustomizer}
            className="flex items-center gap-2.5 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs font-medium text-[var(--ec-muted)] hover:border-cyan-500 hover:bg-[var(--ec-card)] hover:text-[var(--ec-foreground)] transition"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Customize Menu</span>
          </button>
        )}

        <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--ec-surface)] border border-[var(--ec-border)] hover:border-cyan-500/30 transition">
          <button
            type="button"
            onClick={() => {
              if (onClose) onClose();
              onOpenProfile?.();
            }}
            title="View User Profile"
            className="flex items-center gap-2.5 min-w-0 flex-1 text-left group hover:opacity-90 transition"
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="h-7 w-7 rounded-lg object-cover flex-shrink-0 group-hover:scale-105 transition-transform shadow-sm border border-[var(--ec-border)]"
              />
            ) : (
              <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 group-hover:scale-105 transition-transform shadow-sm">
                {user?.name?.charAt(0) || 'U'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-[var(--ec-foreground)] truncate group-hover:text-cyan-400 transition-colors">
                {user?.name}
              </div>
              <div className="text-[10px] text-[var(--ec-muted)] truncate">{user?.role}</div>
            </div>
          </button>

          <button
            type="button"
            onClick={logout}
            title="Logout / Switch Section"
            className="p-1.5 rounded-lg text-[var(--ec-muted)] hover:text-red-400 hover:bg-red-500/10 transition"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  pathname,
  onClick,
}: {
  href: string;
  icon: any;
  label: string;
  pathname: string;
  onClick?: () => void;
}) {
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-xl border px-3 py-2 text-xs sm:text-sm font-medium transition ${
        isActive
          ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-300 shadow-sm'
          : 'border-transparent text-[var(--ec-muted)] hover:border-[var(--ec-border)] hover:bg-[var(--ec-surface)] hover:text-[var(--ec-foreground)]'
      }`}
    >
      <Icon className={`h-4 w-4 ${isActive ? 'text-cyan-300' : 'text-[var(--ec-muted)] group-hover:text-cyan-300'}`} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export default Sidebar;
