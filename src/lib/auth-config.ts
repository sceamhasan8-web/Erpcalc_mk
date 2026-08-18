import { SectionDefinition, SectionId } from '@/types/auth';

export const ERP_SECTIONS: SectionDefinition[] = [
  {
    id: 'admin',
    name: 'Super Admin / Management',
    shortName: 'Admin',
    icon: 'ShieldCheck',
    color: '#8b5cf6', // Violet
    badgeBg: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    description: 'Full administrative access to all modules, settings, reports, and factory controls.',
    allowedRoutes: ['*'],
    defaultPath: '/',
    defaultUsername: 'admin@factory.com',
    defaultRole: 'Super Administrator',
  },
  {
    id: 'orders',
    name: 'Orders & Merchandising',
    shortName: 'Orders',
    icon: 'Box',
    color: '#06b6d4', // Cyan
    badgeBg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    description: 'Manage buyer accounts, order booking, order status, and merchandising workflow.',
    allowedRoutes: ['/orders', '/buyers', '/notifications'],
    defaultPath: '/orders',
    defaultUsername: 'orders@factory.com',
    defaultRole: 'Merchandiser / Order Manager',
  },
  {
    id: 'production',
    name: 'Production Floor',
    shortName: 'Production',
    icon: 'Layers',
    color: '#10b981', // Emerald
    badgeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    description: 'Production tracking, cutting, sewing, finishing, line efficiency and output.',
    allowedRoutes: ['/production', '/notifications'],
    defaultPath: '/production',
    defaultUsername: 'production@factory.com',
    defaultRole: 'Production Manager',
  },
  {
    id: 'planning',
    name: 'Planning & Scheduling',
    shortName: 'Planning',
    icon: 'CalendarDays',
    color: '#f59e0b', // Amber
    badgeBg: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    description: 'Factory floor line planning, timeline allocation, targets, and scheduling.',
    allowedRoutes: ['/planning', '/notifications'],
    defaultPath: '/planning',
    defaultUsername: 'planning@factory.com',
    defaultRole: 'Planning Officer',
  },
  {
    id: 'warehouse',
    name: 'Central Warehouse',
    shortName: 'Warehouse',
    icon: 'Building2',
    color: '#3b82f6', // Blue
    badgeBg: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    description: 'Complete warehouse management, rack tracking, stock inventory, and transfers.',
    allowedRoutes: ['/warehouse', '/inventory', '/goods-receive', '/inventory-transfer', '/goods-store', '/notifications'],
    defaultPath: '/warehouse',
    defaultUsername: 'warehouse@factory.com',
    defaultRole: 'Warehouse Head',
  },
  {
    id: 'inventory',
    name: 'Inventory Management',
    shortName: 'Inventory',
    icon: 'PackageOpen',
    color: '#0ea5e9', // Sky
    badgeBg: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    description: 'Fabric & trims inventory, stock level tracking, min/max alerts, and valuation.',
    allowedRoutes: ['/inventory', '/goods-receive', '/inventory-transfer', '/notifications'],
    defaultPath: '/inventory',
    defaultUsername: 'inventory@factory.com',
    defaultRole: 'Inventory Officer',
  },
  {
    id: 'goods-receive',
    name: 'Goods Receive (GRN)',
    shortName: 'Receive',
    icon: 'PackageCheck',
    color: '#14b8a6', // Teal
    badgeBg: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
    description: 'Gate entry, raw material inspection, supplier challan, and receiving verification.',
    allowedRoutes: ['/goods-receive', '/notifications'],
    defaultPath: '/goods-receive',
    defaultUsername: 'receive@factory.com',
    defaultRole: 'Receiving Officer',
  },
  {
    id: 'inventory-transfer',
    name: 'Inventory Transfer',
    shortName: 'Transfer',
    icon: 'ArrowRightLeft',
    color: '#ec4899', // Pink
    badgeBg: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    description: 'Inter-department stock requisition, floor issue, and internal stock movements.',
    allowedRoutes: ['/inventory-transfer', '/notifications'],
    defaultPath: '/inventory-transfer',
    defaultUsername: 'transfer@factory.com',
    defaultRole: 'Transfer Incharge',
  },
  {
    id: 'goods-store',
    name: 'Goods Store (FG Store)',
    shortName: 'Goods Store',
    icon: 'Store',
    color: '#84cc16', // Lime
    badgeBg: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
    description: 'Finished goods storage, packing list verification, and shipment preparation.',
    allowedRoutes: ['/goods-store', '/notifications'],
    defaultPath: '/goods-store',
    defaultUsername: 'store@factory.com',
    defaultRole: 'Store Keeper',
  },
  {
    id: 'departments',
    name: 'Departments & HR',
    shortName: 'Departments',
    icon: 'Building',
    color: '#6366f1', // Indigo
    badgeBg: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    description: 'Factory departments overview, workforce allocation, and sectional metrics.',
    allowedRoutes: ['/departments', '/notifications'],
    defaultPath: '/departments',
    defaultUsername: 'departments@factory.com',
    defaultRole: 'Operations Lead',
  },
  {
    id: 'hr',
    name: 'Human Resource',
    shortName: 'HR',
    icon: 'UserCog',
    color: '#f97316', // Orange
    badgeBg: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    description: 'Human Resource management panel. Create and manage user credentials for all ERP sections.',
    allowedRoutes: ['*'],
    defaultPath: '/hr',
    defaultUsername: 'hr@factory.com',
    defaultRole: 'HR Manager',
    hidden: true, // Does NOT appear on login page section selector
  },
];

export function getSectionById(id: SectionId | string): SectionDefinition | undefined {
  return ERP_SECTIONS.find((s) => s.id === id);
}

export function isRouteAllowedForSection(sectionId: SectionId, pathname: string): boolean {
  const section = getSectionById(sectionId);
  if (!section) return false;

  // Super admin can access everything
  if (section.allowedRoutes.includes('*')) {
    return true;
  }

  // Exact or prefix match
  const normalizedPath = pathname === '' ? '/' : pathname;
  return section.allowedRoutes.some((route) => {
    if (route === normalizedPath) return true;
    if (route !== '/' && normalizedPath.startsWith(route)) return true;
    return false;
  });
}
