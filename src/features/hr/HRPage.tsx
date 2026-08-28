"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { HRUser, SectionId } from '@/types/auth';
import { DailyManpowerRecord, SectionManpowerCount } from '@/types';
import { getSectionById } from '@/lib/auth-config';
import { mockRepository } from '@/repositories/mockRepository';
import { firebaseService } from '@/services/firebaseService';
import {
  Users,
  UserPlus,
  Pencil,
  Trash2,
  X,
  Check,
  Eye,
  EyeOff,
  Search,
  UserCog,
  CheckCircle2,
  Building2,
  Box,
  Layers,
  CalendarDays,
  PackageOpen,
  PackageCheck,
  ArrowRightLeft,
  Store,
  Building,
  ShieldCheck,
  Home,
  Bell,
  Settings,
  CheckSquare,
  Square,
  Sparkles,
  UserCheck,
  Clock,
  Briefcase,
  ChevronRight,
  Calendar,
  Plus,
  BadgeCheck,
  TrendingUp,
  History,
  Copy,
  Save,
  FileSpreadsheet,
  ChevronLeft,
  Filter,
  ArrowUpDown,
  FileText,
  Percent,
} from 'lucide-react';

// Section theme definitions
export const SECTION_THEMES: Record<string, { color: string; bgDark: string; borderDark: string; icon: any }> = {
  'Cutting': { color: '#10b981', bgDark: 'rgba(16, 185, 129, 0.12)', borderDark: 'rgba(16, 185, 129, 0.3)', icon: Layers },
  'Sewing': { color: '#3b82f6', bgDark: 'rgba(59, 130, 246, 0.12)', borderDark: 'rgba(59, 130, 246, 0.3)', icon: Box },
  'Lasting & DIP': { color: '#f59e0b', bgDark: 'rgba(245, 158, 11, 0.12)', borderDark: 'rgba(245, 158, 11, 0.3)', icon: Building2 },
  'Warehouse': { color: '#0284c7', bgDark: 'rgba(2, 132, 199, 0.12)', borderDark: 'rgba(2, 132, 199, 0.3)', icon: Store },
  'Goods Store': { color: '#84cc16', bgDark: 'rgba(132, 204, 22, 0.12)', borderDark: 'rgba(132, 204, 22, 0.3)', icon: PackageCheck },
  'Packing': { color: '#8b5cf6', bgDark: 'rgba(139, 92, 246, 0.12)', borderDark: 'rgba(139, 92, 246, 0.3)', icon: PackageOpen },
  'Lamination & Preparation': { color: '#ec4899', bgDark: 'rgba(236, 72, 153, 0.12)', borderDark: 'rgba(236, 72, 153, 0.3)', icon: Sparkles },
  'Printing & Embossing': { color: '#6366f1', bgDark: 'rgba(99, 102, 241, 0.12)', borderDark: 'rgba(99, 102, 241, 0.3)', icon: ArrowRightLeft },
  'Quality Assurance': { color: '#14b8a6', bgDark: 'rgba(20, 184, 166, 0.12)', borderDark: 'rgba(20, 184, 166, 0.3)', icon: BadgeCheck },
  'Maintenance & Utility': { color: '#64748b', bgDark: 'rgba(100, 116, 139, 0.12)', borderDark: 'rgba(100, 116, 139, 0.3)', icon: Building },
};

export const FACTORY_MANPOWER_SECTIONS = Object.keys(SECTION_THEMES);

export const ASSIGNABLE_SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'admin', label: 'Super Admin / Management' },
  { id: 'orders', label: 'Orders & Merchandising' },
  { id: 'production', label: 'Production Floor' },
  { id: 'planning', label: 'Planning & Scheduling' },
  { id: 'warehouse', label: 'Central Warehouse' },
  { id: 'inventory', label: 'Inventory Management' },
  { id: 'goods-receive', label: 'Goods Receive (GRN)' },
  { id: 'inventory-transfer', label: 'Inventory Transfer' },
  { id: 'goods-store', label: 'Goods Store (FG Store)' },
  { id: 'departments', label: 'Departments & HR' },
];

export const ERP_MODULE_OPTIONS = [
  { route: '/', label: 'Dashboard', icon: Home, color: '#3b82f6' },
  { route: '/orders', label: 'Orders', icon: Box, color: '#06b6d4' },
  { route: '/buyers', label: 'Buyers', icon: Users, color: '#0ea5e9' },
  { route: '/production', label: 'Production', icon: Layers, color: '#10b981' },
  { route: '/planning', label: 'Planning', icon: CalendarDays, color: '#f59e0b' },
  { route: '/warehouse', label: 'Warehouse', icon: Building2, color: '#3b82f6' },
  { route: '/inventory', label: 'Inventory', icon: PackageOpen, color: '#0ea5e9' },
  { route: '/goods-receive', label: 'Goods Receive', icon: PackageCheck, color: '#14b8a6' },
  { route: '/inventory-transfer', label: 'Inventory Transfer', icon: ArrowRightLeft, color: '#ec4899' },
  { route: '/goods-store', label: 'Goods Store', icon: Store, color: '#84cc16' },
  { route: '/departments', label: 'Departments', icon: Building, color: '#6366f1' },
  { route: '/notifications', label: 'Notifications', icon: Bell, color: '#f97316' },
  { route: '/settings', label: 'Settings', icon: Settings, color: '#8b5cf6' },
];

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDaysAgoString = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getStartOfMonthString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

const getDefaultEmptySections = (): Record<string, SectionManpowerCount> => {
  const map: Record<string, SectionManpowerCount> = {};
  FACTORY_MANPOWER_SECTIONS.forEach((sec) => {
    map[sec] = {
      section: sec,
      managers: 0,
      incharges: 0,
      supervisors: 0,
      workers: 0,
      total: 0,
    };
  });
  return map;
};

// ─── Executive KPI Card ──────────────────────────────────────────────────────
function ExecutiveKPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  badgeText,
  accentColor = '#2563eb',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: any;
  badgeText?: string;
  accentColor?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-5 shadow-sm hover:shadow-md transition-all group">
      <div
        className="absolute top-0 left-0 right-0 h-1 transition-all group-hover:h-1.5"
        style={{ backgroundColor: accentColor }}
      />
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="space-y-1">
          <span className="text-xs font-bold text-[var(--ec-muted)] uppercase tracking-wider block">
            {title}
          </span>
          <div className="text-3xl font-black text-[var(--ec-foreground)] tracking-tight">
            {value}
          </div>
        </div>
        <div
          className="p-3 rounded-xl border flex-shrink-0"
          style={{
            backgroundColor: `${accentColor}12`,
            borderColor: `${accentColor}25`,
            color: accentColor,
          }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-[var(--ec-border)] text-xs">
        <span className="text-[var(--ec-muted)] font-medium truncate">{subtitle}</span>
        {badgeText && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── All-Sections High-Speed Bulk Entry Modal ────────────────────────────────
interface BulkEntryModalProps {
  initialDate: string;
  initialRecord?: DailyManpowerRecord | null;
  onClose: () => void;
  onSave: (record: DailyManpowerRecord) => Promise<void>;
  onCopyPrevious: (date: string) => DailyManpowerRecord | undefined;
}

function BulkManpowerEntryModal({
  initialDate,
  initialRecord,
  onClose,
  onSave,
  onCopyPrevious,
}: BulkEntryModalProps) {
  const [entryDate, setEntryDate] = useState(initialDate);
  const [sectionData, setSectionData] = useState<Record<string, SectionManpowerCount>>(() => {
    if (initialRecord?.sections) {
      return JSON.parse(JSON.stringify(initialRecord.sections));
    }
    return getDefaultEmptySections();
  });
  const [generalNotes, setGeneralNotes] = useState(initialRecord?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCountChange = (
    sectionName: string,
    field: 'managers' | 'incharges' | 'supervisors' | 'workers',
    valStr: string
  ) => {
    const val = Math.max(0, parseInt(valStr, 10) || 0);
    setSectionData((prev) => {
      const currentSec = prev[sectionName] || {
        section: sectionName,
        managers: 0,
        incharges: 0,
        supervisors: 0,
        workers: 0,
        total: 0,
      };
      const updatedSec = { ...currentSec, [field]: val };
      updatedSec.total =
        updatedSec.managers + updatedSec.incharges + updatedSec.supervisors + updatedSec.workers;

      return {
        ...prev,
        [sectionName]: updatedSec,
      };
    });
  };

  const grandTotals = useMemo(() => {
    let mgr = 0;
    let inch = 0;
    let supv = 0;
    let work = 0;
    let total = 0;

    FACTORY_MANPOWER_SECTIONS.forEach((sec) => {
      const d = sectionData[sec];
      if (d) {
        mgr += d.managers || 0;
        inch += d.incharges || 0;
        supv += d.supervisors || 0;
        work += d.workers || 0;
        total += d.total || 0;
      }
    });

    return { mgr, inch, supv, work, total };
  }, [sectionData]);

  const handleCopyYesterday = () => {
    const prev = onCopyPrevious(entryDate);
    if (prev && prev.sections) {
      setSectionData(JSON.parse(JSON.stringify(prev.sections)));
    } else {
      setError('No previous day record found to copy from.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryDate) {
      setError('Please select a valid attendance date.');
      return;
    }
    setError('');
    setSaving(true);

    try {
      const record: DailyManpowerRecord = {
        id: entryDate,
        date: entryDate,
        sections: sectionData,
        totalManagers: grandTotals.mgr,
        totalIncharges: grandTotals.inch,
        totalSupervisors: grandTotals.supv,
        totalWorkers: grandTotals.work,
        totalManpower: grandTotals.total,
        notes: generalNotes.trim() || undefined,
        updatedAt: new Date().toISOString(),
      };

      await onSave(record);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save daily manpower.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] shadow-2xl p-5 sm:p-6 space-y-5 max-h-[92vh] flex flex-col justify-between">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--ec-border)] pb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/50">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-black text-lg text-[var(--ec-foreground)]">
                Daily Section Manpower Roll-Call Sheet
              </h3>
              <p className="text-xs text-[var(--ec-muted)] font-medium">
                Enter headcount of present Managers, Incharges, Supervisors & Workers for each section.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--ec-muted)] hover:text-[var(--ec-foreground)] hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex-shrink-0">
            {error}
          </div>
        )}

        {/* Date Selector & Copy Shortcut Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-[var(--ec-border)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-bold text-[var(--ec-foreground)]">Entry Date:</span>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] text-xs font-bold text-[var(--ec-foreground)] outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleCopyYesterday}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-[var(--ec-border)] hover:bg-slate-100 text-xs font-bold text-slate-700 dark:text-slate-300 transition shadow-xs"
          >
            <Copy className="h-3.5 w-3.5 text-blue-600" />
            <span>Copy Yesterday's Figures</span>
          </button>
        </div>

        {/* Scrollable Spreadsheet Table */}
        <div className="overflow-y-auto overflow-x-auto border border-[var(--ec-border)] rounded-2xl flex-1 max-h-[50vh]">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10 border-b border-[var(--ec-border)] text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3 min-w-[180px]">Factory Section</th>
                <th className="px-3 py-3 text-center w-24">👔 Managers</th>
                <th className="px-3 py-3 text-center w-24">📋 Incharges</th>
                <th className="px-3 py-3 text-center w-24">👷 Supervisors</th>
                <th className="px-3 py-3 text-center w-28">👥 Workers</th>
                <th className="px-4 py-3 text-right w-28">Section Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ec-border)] bg-[var(--ec-card)]">
              {FACTORY_MANPOWER_SECTIONS.map((secName) => {
                const sec = sectionData[secName] || {
                  section: secName,
                  managers: 0,
                  incharges: 0,
                  supervisors: 0,
                  workers: 0,
                  total: 0,
                };
                const theme = SECTION_THEMES[secName] || SECTION_THEMES['Cutting'];
                const Icon = theme.icon;

                return (
                  <tr key={secName} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: theme.bgDark,
                            borderColor: theme.borderDark,
                            color: theme.color,
                          }}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="font-bold text-sm text-[var(--ec-foreground)]">{secName}</span>
                      </div>
                    </td>

                    {/* Manager Input */}
                    <td className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        value={sec.managers || ''}
                        placeholder="0"
                        onChange={(e) => handleCountChange(secName, 'managers', e.target.value)}
                        className="w-16 px-2 py-1.5 text-center font-bold rounded-lg border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    {/* Incharge Input */}
                    <td className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        value={sec.incharges || ''}
                        placeholder="0"
                        onChange={(e) => handleCountChange(secName, 'incharges', e.target.value)}
                        className="w-16 px-2 py-1.5 text-center font-bold rounded-lg border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    {/* Supervisor Input */}
                    <td className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        value={sec.supervisors || ''}
                        placeholder="0"
                        onChange={(e) => handleCountChange(secName, 'supervisors', e.target.value)}
                        className="w-16 px-2 py-1.5 text-center font-bold rounded-lg border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    {/* Worker Input */}
                    <td className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        value={sec.workers || ''}
                        placeholder="0"
                        onChange={(e) => handleCountChange(secName, 'workers', e.target.value)}
                        className="w-20 px-2.5 py-1.5 text-center font-bold text-blue-600 dark:text-blue-400 rounded-lg border border-[var(--ec-border)] bg-[var(--ec-surface)] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    {/* Auto Total */}
                    <td className="px-4 py-2.5 text-right font-black text-sm text-[var(--ec-foreground)]">
                      {sec.total || 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Live Grand Total Footer */}
            <tfoot className="bg-slate-100 dark:bg-slate-800 border-t-2 border-[var(--ec-border)] font-black">
              <tr>
                <td className="px-4 py-3 text-slate-800 dark:text-slate-100 uppercase tracking-wider text-xs">
                  Factory Grand Total:
                </td>
                <td className="px-2 py-3 text-center text-sm text-purple-700 dark:text-purple-300">
                  {grandTotals.mgr}
                </td>
                <td className="px-2 py-3 text-center text-sm text-blue-700 dark:text-blue-300">
                  {grandTotals.inch}
                </td>
                <td className="px-2 py-3 text-center text-sm text-amber-700 dark:text-amber-300">
                  {grandTotals.supv}
                </td>
                <td className="px-2 py-3 text-center text-sm text-emerald-700 dark:text-emerald-300">
                  {grandTotals.work}
                </td>
                <td className="px-4 py-3 text-right text-base text-blue-600 dark:text-blue-400">
                  {grandTotals.total} Staff
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Remarks Input & Action Footer */}
        <div className="space-y-3 pt-2 border-t border-[var(--ec-border)] flex-shrink-0">
          <input
            type="text"
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            placeholder="Daily remarks (e.g. Overtime shift running in sewing & lasting, heavy rainfall attendance drop)..."
            className="w-full px-3.5 py-2 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-xs text-[var(--ec-foreground)] font-medium outline-none focus:border-blue-500 shadow-xs"
          />

          <div className="flex items-center justify-between">
            <div className="text-xs text-[var(--ec-muted)] font-bold">
              Total Present Today: <span className="text-[var(--ec-foreground)] font-black text-sm">{grandTotals.total} Personnel</span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[var(--ec-border)] text-[var(--ec-muted)] hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFormSubmit}
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 disabled:opacity-50 transition"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'Saving...' : 'Save All Sections Manpower'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── User Form Modal (Access Control) ─────────────────────────────────────────
interface UserFormProps {
  mode: 'add' | 'edit';
  initial?: HRUser | null;
  onClose: () => void;
  onSave: (data: Omit<HRUser, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

function UserFormModal({ mode, initial, onClose, onSave }: UserFormProps) {
  const [name, setName] = useState(initial?.name || '');
  const [username, setUsername] = useState(initial?.username || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [password, setPassword] = useState('');
  const [sectionId, setSectionId] = useState<SectionId>(initial?.sectionId || 'orders');
  const [role, setRole] = useState(initial?.role || '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [allowedRoutes, setAllowedRoutes] = useState<string[]>(() => {
    if (initial?.allowedRoutes && initial.allowedRoutes.length > 0) {
      return initial.allowedRoutes;
    }
    const defaultSection = getSectionById(initial?.sectionId || 'orders');
    return defaultSection ? defaultSection.allowedRoutes : ['/orders'];
  });

  const isFullAccess = allowedRoutes.includes('*');

  const handleSectionChange = (newSecId: SectionId) => {
    setSectionId(newSecId);
    const sec = getSectionById(newSecId);
    if (sec) {
      if (!role || role === ASSIGNABLE_SECTIONS.find((s) => s.id === sectionId)?.label) {
        setRole(sec.defaultRole);
      }
      setAllowedRoutes(sec.allowedRoutes);
    }
  };

  const toggleRoute = (route: string) => {
    if (isFullAccess) {
      const allExceptThis = ERP_MODULE_OPTIONS.map((m) => m.route).filter((r) => r !== route);
      setAllowedRoutes(allExceptThis);
      return;
    }

    if (allowedRoutes.includes(route)) {
      setAllowedRoutes(allowedRoutes.filter((r) => r !== route));
    } else {
      setAllowedRoutes([...allowedRoutes, route]);
    }
  };

  const handleToggleFullAccess = () => {
    if (isFullAccess) {
      const sec = getSectionById(sectionId);
      setAllowedRoutes(sec ? sec.allowedRoutes : ['/']);
    } else {
      setAllowedRoutes(['*']);
    }
  };

  const handleResetToSectionDefaults = () => {
    const sec = getSectionById(sectionId);
    if (sec) {
      setAllowedRoutes(sec.allowedRoutes);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim()) {
      setError('Please fill in Name and Username.');
      return;
    }
    if (mode === 'add' && !password.trim()) {
      setError('Please set a secure password for the new user.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        sectionId,
        role: role.trim() || getSectionById(sectionId)?.defaultRole || 'Staff',
        isActive,
        allowedRoutes,
      };

      if (password.trim()) {
        payload.password = password.trim();
      }

      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save user.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[var(--ec-border)] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[var(--ec-foreground)]">
                {mode === 'add' ? 'Create User Sign-In Account' : 'Edit User Login & Access'}
              </h3>
              <p className="text-xs text-[var(--ec-muted)]">Configure sign-in credentials and module access control.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--ec-muted)] hover:text-[var(--ec-foreground)] hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-bold text-[var(--ec-foreground)] mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Siam Hossain"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] font-medium outline-none focus:border-blue-500 shadow-xs"
              />
            </div>

            <div>
              <label className="block font-bold text-[var(--ec-foreground)] mb-1">
                Username / Login ID *
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. siam@erp"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] font-mono font-bold outline-none focus:border-blue-500 shadow-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-bold text-[var(--ec-foreground)] mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. siam@company.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] font-medium outline-none focus:border-blue-500 shadow-xs"
              />
            </div>

            <div>
              <label className="block font-bold text-[var(--ec-foreground)] mb-1">
                {mode === 'add' ? 'Password *' : 'New Password (leave blank to keep current)'}
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'add' ? 'Create password' : 'Enter new password'}
                  required={mode === 'add'}
                  className="w-full px-3.5 py-2.5 pr-9 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] font-medium outline-none focus:border-blue-500 shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]"
                >
                  {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-bold text-[var(--ec-foreground)] mb-1">
                Primary Section Assignment *
              </label>
              <select
                value={sectionId}
                onChange={(e) => handleSectionChange(e.target.value as SectionId)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] font-bold outline-none focus:border-blue-500 shadow-xs"
              >
                {ASSIGNABLE_SECTIONS.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-[var(--ec-foreground)] mb-1">
                Display Role / Title
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Warehouse Incharge"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] font-medium outline-none focus:border-blue-500 shadow-xs"
              />
            </div>
          </div>

          {/* Module-level Permissions Selector */}
          <div className="space-y-2 pt-2 border-t border-[var(--ec-border)]">
            <div className="flex items-center justify-between">
              <label className="font-bold text-[var(--ec-foreground)]">
                Module Access Permissions
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleResetToSectionDefaults}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
                >
                  Section Defaults
                </button>
                <button
                  type="button"
                  onClick={handleToggleFullAccess}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                    isFullAccess ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {isFullAccess ? 'Full Access (*)' : 'Grant Full'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-[var(--ec-border)]">
              {ERP_MODULE_OPTIONS.map((mod) => {
                const isChecked = isFullAccess || allowedRoutes.includes(mod.route);
                return (
                  <button
                    key={mod.route}
                    type="button"
                    onClick={() => toggleRoute(mod.route)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left transition ${
                      isChecked
                        ? 'border-blue-500/40 bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 font-bold shadow-xs'
                        : 'border-transparent text-slate-500 hover:bg-white/60 dark:hover:bg-slate-800/60 font-medium'
                    }`}
                  >
                    {isChecked ? (
                      <CheckSquare className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    )}
                    <span className="truncate text-xs">{mod.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-[var(--ec-foreground)]">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-[var(--ec-border)] text-blue-600"
              />
              <span>Account is Active & Allowed to Sign In</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--ec-border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[var(--ec-border)] text-[var(--ec-muted)] hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : mode === 'add' ? 'Create Account' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main HR Page Component ──────────────────────────────────────────────────
export function HRPage() {
  const { user, hrUsers, addHRUser, updateHRUser, deleteHRUser } = useAuth();

  // Top Tab Switcher: 'manpower' | 'history' | 'users'
  const [activeTab, setActiveTab] = useState<'manpower' | 'history' | 'users'>('manpower');

  // Selected Date for Single-Day Overview
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString);

  // Date Range & Section Filter State for History / Reports Tab
  const [reportStartDate, setReportStartDate] = useState<string>(() => getDaysAgoString(30));
  const [reportEndDate, setReportEndDate] = useState<string>(getTodayDateString);
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('all');
  const [searchFilterQuery, setSearchFilterQuery] = useState('');

  // Daily Manpower Records State
  const [dailyRecords, setDailyRecords] = useState<DailyManpowerRecord[]>(() =>
    mockRepository.getDailyManpowerRecords()
  );

  // Modal State
  const [isBulkEntryOpen, setIsBulkEntryOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DailyManpowerRecord | null>(null);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<HRUser | null>(null);

  // Real-time Firestore Subscriptions for Daily Manpower
  useEffect(() => {
    const unsub = firebaseService.subscribeDailyManpower((live) => {
      if (live && Array.isArray(live) && live.length > 0) {
        setDailyRecords(live);
        mockRepository.setDailyManpowerRecords(live);
      }
    });

    return () => unsub();
  }, []);

  // Find record for currently selected single date
  const currentRecord = useMemo(() => {
    return dailyRecords.find((r) => r.date === selectedDate);
  }, [dailyRecords, selectedDate]);

  // Handle saving daily manpower
  const handleSaveDailyManpower = async (record: DailyManpowerRecord) => {
    mockRepository.saveDailyManpower(record);
    setDailyRecords(mockRepository.getDailyManpowerRecords());
    setSelectedDate(record.date);

    try {
      await firebaseService.saveDailyManpower(record);
    } catch (e) {
      console.warn('Firestore save note:', e);
    }
  };

  // Helper to find previous record to copy
  const getPreviousRecord = (dateStr: string) => {
    const sorted = [...dailyRecords].sort((a, b) => b.date.localeCompare(a.date));
    return sorted.find((r) => r.date < dateStr) || sorted[0];
  };

  // Date stepper
  const handleStepDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${day}`);
  };

  // Quick Preset Date Ranges
  const handleApplyDatePreset = (preset: 'today' | '7days' | 'month' | '30days' | 'all') => {
    const today = getTodayDateString();
    if (preset === 'today') {
      setReportStartDate(today);
      setReportEndDate(today);
    } else if (preset === '7days') {
      setReportStartDate(getDaysAgoString(7));
      setReportEndDate(today);
    } else if (preset === 'month') {
      setReportStartDate(getStartOfMonthString());
      setReportEndDate(today);
    } else if (preset === '30days') {
      setReportStartDate(getDaysAgoString(30));
      setReportEndDate(today);
    } else if (preset === 'all') {
      setReportStartDate('2020-01-01');
      setReportEndDate(today);
    }
  };

  // Filtered Historical Records based on Date Range and Search Query
  const filteredHistoryRecords = useMemo(() => {
    let list = dailyRecords.filter((r) => {
      const matchStart = reportStartDate ? r.date >= reportStartDate : true;
      const matchEnd = reportEndDate ? r.date <= reportEndDate : true;
      return matchStart && matchEnd;
    });

    if (searchFilterQuery.trim()) {
      const q = searchFilterQuery.toLowerCase();
      list = list.filter((r) => {
        return (
          r.date.includes(q) ||
          (r.notes && r.notes.toLowerCase().includes(q))
        );
      });
    }

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [dailyRecords, reportStartDate, reportEndDate, searchFilterQuery]);

  // Aggregate Metrics over the Selected Range for the Selected Section
  const rangeAggregates = useMemo(() => {
    const totalDays = filteredHistoryRecords.length;
    if (totalDays === 0) {
      return { totalDays: 0, totalManpower: 0, avgManpower: 0, avgMgr: 0, avgInch: 0, avgSupv: 0, avgWork: 0 };
    }

    let sumTotal = 0;
    let sumMgr = 0;
    let sumInch = 0;
    let sumSupv = 0;
    let sumWork = 0;

    filteredHistoryRecords.forEach((r) => {
      if (selectedSectionFilter === 'all') {
        sumTotal += r.totalManpower || 0;
        sumMgr += r.totalManagers || 0;
        sumInch += r.totalIncharges || 0;
        sumSupv += r.totalSupervisors || 0;
        sumWork += r.totalWorkers || 0;
      } else {
        const sec = r.sections?.[selectedSectionFilter];
        if (sec) {
          sumTotal += sec.total || 0;
          sumMgr += sec.managers || 0;
          sumInch += sec.incharges || 0;
          sumSupv += sec.supervisors || 0;
          sumWork += sec.workers || 0;
        }
      }
    });

    return {
      totalDays,
      totalManpower: sumTotal,
      avgManpower: Math.round((sumTotal / totalDays) * 10) / 10,
      avgMgr: Math.round((sumMgr / totalDays) * 10) / 10,
      avgInch: Math.round((sumInch / totalDays) * 10) / 10,
      avgSupv: Math.round((sumSupv / totalDays) * 10) / 10,
      avgWork: Math.round((sumWork / totalDays) * 10) / 10,
    };
  }, [filteredHistoryRecords, selectedSectionFilter]);

  // Quick action from section cards to open section report
  const handleOpenSectionReport = (secName: string) => {
    setSelectedSectionFilter(secName);
    setActiveTab('history');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ── Executive Top Header ────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 flex-shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-[var(--ec-foreground)] tracking-tight">
                Factory Manpower & Attendance Hub
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300">
                Enterprise
              </span>
            </div>
            <p className="text-xs text-[var(--ec-muted)] font-medium mt-0.5">
              Section roll-call, date-range analytics, and custom section attendance logs.
            </p>
          </div>
        </div>

        {/* Master Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-[var(--ec-border)] self-start lg:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('manpower')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'manpower'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Briefcase className="h-4 w-4" />
            <span>Daily Manpower</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'history'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Attendance Log & Section Reports</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'users'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>User Accounts ({hrUsers.length})</span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: DAILY SECTION MANPOWER OVERVIEW ───────────────────────────── */}
      {activeTab === 'manpower' && (
        <div className="space-y-6">
          {/* Executive KPI Summary Bar for Selected Date */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div className="col-span-2 sm:col-span-1 lg:col-span-1">
              <ExecutiveKPICard
                title="Total Factory Manpower"
                value={currentRecord?.totalManpower || 0}
                subtitle={`Present on ${selectedDate}`}
                icon={Users}
                badgeText={currentRecord ? 'Recorded' : 'Not Entered'}
                accentColor="#2563eb"
              />
            </div>
            <ExecutiveKPICard
              title="Managers"
              value={currentRecord?.totalManagers || 0}
              subtitle="Floor In-Charge Heads"
              icon={Briefcase}
              badgeText="👔 Managers"
              accentColor="#9333ea"
            />
            <ExecutiveKPICard
              title="Incharges"
              value={currentRecord?.totalIncharges || 0}
              subtitle="Section Controllers"
              icon={Building2}
              badgeText="📋 Incharges"
              accentColor="#2563eb"
            />
            <ExecutiveKPICard
              title="Supervisors"
              value={currentRecord?.totalSupervisors || 0}
              subtitle="Line Leaders"
              icon={BadgeCheck}
              badgeText="👷 Supervisors"
              accentColor="#f59e0b"
            />
            <ExecutiveKPICard
              title="Workers"
              value={currentRecord?.totalWorkers || 0}
              subtitle="Factory Machine Operators"
              icon={Users}
              badgeText="👥 Workers"
              accentColor="#10b981"
            />
          </div>

          {/* Date Stepper & Bulk Entry Trigger */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4 rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] shadow-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-[var(--ec-border)]">
                <button
                  type="button"
                  onClick={() => handleStepDate(-1)}
                  className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-[var(--ec-foreground)]"
                  title="Previous Day"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-2 px-2">
                  <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-[var(--ec-foreground)] outline-none cursor-pointer"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleStepDate(1)}
                  className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-[var(--ec-foreground)]"
                  title="Next Day"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {selectedDate !== getTodayDateString() && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(getTodayDateString())}
                  className="text-xs font-bold text-blue-600 hover:underline px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800"
                >
                  ⚡ Jump to Today
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setEditingRecord(currentRecord || null);
                  setIsBulkEntryOpen(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-500/20"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>
                  {currentRecord ? `Edit ${selectedDate} Roll-Call Sheet` : `Enter All Sections Manpower for ${selectedDate}`}
                </span>
              </button>
            </div>
          </div>

          {/* 10 Factory Section Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-black text-[var(--ec-foreground)] tracking-tight">
                  Factory Section Manpower Breakdown ({selectedDate})
                </h2>
                <p className="text-xs text-[var(--ec-muted)] font-medium">
                  Number of managers, incharges, supervisors, and workers present on floor.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {FACTORY_MANPOWER_SECTIONS.map((secName) => {
                const theme = SECTION_THEMES[secName] || SECTION_THEMES['Cutting'];
                const Icon = theme.icon;
                const sec = currentRecord?.sections?.[secName] || {
                  section: secName,
                  managers: 0,
                  incharges: 0,
                  supervisors: 0,
                  workers: 0,
                  total: 0,
                };
                const totalManpower = currentRecord?.totalManpower || 1;
                const sectionShare = Math.round((sec.total / totalManpower) * 100);

                return (
                  <div
                    key={secName}
                    className="group rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-5 space-y-4 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3.5">
                      {/* Section Title & Total */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-11 h-11 rounded-2xl border flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                            style={{
                              backgroundColor: theme.bgDark,
                              borderColor: theme.borderDark,
                              color: theme.color,
                            }}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm sm:text-base text-[var(--ec-foreground)] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {secName}
                            </h3>
                            <p className="text-xs text-[var(--ec-muted)] font-medium">
                              Total: <strong className="text-[var(--ec-foreground)]">{sec.total} Present</strong>
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className="text-lg font-black block"
                            style={{ color: theme.color }}
                          >
                            {sec.total}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {sectionShare}% of factory
                          </span>
                        </div>
                      </div>

                      {/* Four Numerical Counters */}
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="p-2.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-800/40">
                          <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase block">
                            Manager
                          </span>
                          <span className="font-black text-base text-purple-900 dark:text-purple-100">
                            {sec.managers || 0}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/40">
                          <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase block">
                            Incharge
                          </span>
                          <span className="font-black text-base text-blue-900 dark:text-blue-100">
                            {sec.incharges || 0}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/40">
                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase block">
                            Supv
                          </span>
                          <span className="font-black text-base text-amber-900 dark:text-amber-100">
                            {sec.supervisors || 0}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/40">
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase block">
                            Worker
                          </span>
                          <span className="font-black text-base text-emerald-900 dark:text-emerald-100">
                            {sec.workers || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Section History Action */}
                    <div className="pt-3 border-t border-[var(--ec-border)] flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => handleOpenSectionReport(secName)}
                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <History className="h-3.5 w-3.5" />
                        <span>View {secName} History Report →</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingRecord(currentRecord || null);
                          setIsBulkEntryOpen(true);
                        }}
                        className="text-[11px] text-[var(--ec-muted)] hover:text-[var(--ec-foreground)] font-semibold"
                      >
                        Edit Count
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: DATE RANGE ATTENDANCE LOG & SECTION REPORTS ────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Master Date-Range & Section Filter Control Bar */}
          <div className="p-5 rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-[var(--ec-foreground)] tracking-tight flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <span>Attendance History & Section-Wise Report</span>
                </h2>
                <p className="text-xs text-[var(--ec-muted)] font-medium mt-0.5">
                  Filter historical attendance by date range and select specific factory section.
                </p>
              </div>

              {/* Action: Enter New Record */}
              <button
                type="button"
                onClick={() => {
                  setEditingRecord(null);
                  setIsBulkEntryOpen(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm self-start lg:self-auto"
              >
                <Plus className="h-4 w-4" />
                <span>Enter Roll-Call Sheet</span>
              </button>
            </div>

            {/* Filter Controls Row */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 pt-3 border-t border-[var(--ec-border)]">
              {/* Section Select Dropdown */}
              <div className="md:col-span-4 space-y-1">
                <label className="text-xs font-bold text-[var(--ec-foreground)] flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-blue-600" />
                  <span>Filter Factory Section:</span>
                </label>
                <select
                  value={selectedSectionFilter}
                  onChange={(e) => setSelectedSectionFilter(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-xs font-bold text-[var(--ec-foreground)] outline-none focus:border-blue-500 shadow-xs"
                >
                  <option value="all">🏭 All Factory Sections (Grand Total)</option>
                  {FACTORY_MANPOWER_SECTIONS.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec} Section
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date */}
              <div className="md:col-span-3 space-y-1">
                <label className="text-xs font-bold text-[var(--ec-foreground)] flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>From Date:</span>
                </label>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-xs font-bold text-[var(--ec-foreground)] outline-none focus:border-blue-500 shadow-xs"
                />
              </div>

              {/* End Date */}
              <div className="md:col-span-3 space-y-1">
                <label className="text-xs font-bold text-[var(--ec-foreground)] flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>To Date:</span>
                </label>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-xs font-bold text-[var(--ec-foreground)] outline-none focus:border-blue-500 shadow-xs"
                />
              </div>

              {/* Search text filter */}
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-[var(--ec-foreground)] flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-slate-400" />
                  <span>Search:</span>
                </label>
                <input
                  type="text"
                  value={searchFilterQuery}
                  onChange={(e) => setSearchFilterQuery(e.target.value)}
                  placeholder="Date/Notes..."
                  className="w-full px-3 py-2 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-xs font-medium text-[var(--ec-foreground)] outline-none focus:border-blue-500 shadow-xs"
                />
              </div>
            </div>

            {/* Quick Preset Range Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-slate-400 font-semibold mr-1">Presets:</span>
              <button
                type="button"
                onClick={() => handleApplyDatePreset('today')}
                className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold transition"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleApplyDatePreset('7days')}
                className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold transition"
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => handleApplyDatePreset('month')}
                className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold transition"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => handleApplyDatePreset('30days')}
                className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 font-bold transition"
              >
                Last 30 Days
              </button>
              <button
                type="button"
                onClick={() => handleApplyDatePreset('all')}
                className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold transition"
              >
                All Records
              </button>
            </div>
          </div>

          {/* Range Summary KPI Bar for Selected Section */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
            <ExecutiveKPICard
              title={selectedSectionFilter === 'all' ? 'Total Days in Range' : `${selectedSectionFilter} Logged Days`}
              value={`${rangeAggregates.totalDays} Days`}
              subtitle={`From ${reportStartDate} to ${reportEndDate}`}
              icon={CalendarDays}
              badgeText={selectedSectionFilter === 'all' ? 'Factory Total' : selectedSectionFilter}
              accentColor="#2563eb"
            />
            <ExecutiveKPICard
              title="Daily Avg Manpower"
              value={`${rangeAggregates.avgManpower} / Day`}
              subtitle={`Total: ${rangeAggregates.totalManpower} Man-Days`}
              icon={TrendingUp}
              badgeText="Floor Average"
              accentColor="#10b981"
            />
            <ExecutiveKPICard
              title="Daily Avg Workers"
              value={`${rangeAggregates.avgWork} / Day`}
              subtitle="Machine / Line Operators"
              icon={Users}
              badgeText="👥 Workers"
              accentColor="#0284c7"
            />
            <ExecutiveKPICard
              title="Daily Avg Supervisors"
              value={`${rangeAggregates.avgSupv} / Day`}
              subtitle="Floor Line Supervisors"
              icon={BadgeCheck}
              badgeText="👷 Supervisors"
              accentColor="#f59e0b"
            />
            <ExecutiveKPICard
              title="Daily Avg Incharges"
              value={`${rangeAggregates.avgInch} / Day`}
              subtitle="Section In-Charge"
              icon={Building2}
              badgeText="📋 Incharges"
              accentColor="#9333ea"
            />
          </div>

          {/* Filtered Attendance Report Table */}
          <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] shadow-sm overflow-hidden space-y-0">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-[var(--ec-border)] flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-[var(--ec-foreground)]">
                  {selectedSectionFilter === 'all'
                    ? `All Sections Attendance Log (${filteredHistoryRecords.length} Records)`
                    : `${selectedSectionFilter} Section Attendance Report (${filteredHistoryRecords.length} Days)`}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                  {reportStartDate} → {reportEndDate}
                </span>
              </div>

              {selectedSectionFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedSectionFilter('all')}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <span>Reset to All Sections</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 border-b border-[var(--ec-border)] text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Roll-Call Date</th>
                    {selectedSectionFilter !== 'all' && <th className="px-5 py-3.5">Section</th>}
                    <th className="px-4 py-3.5 text-center w-24">👔 Managers</th>
                    <th className="px-4 py-3.5 text-center w-24">📋 Incharges</th>
                    <th className="px-4 py-3.5 text-center w-24">👷 Supervisors</th>
                    <th className="px-4 py-3.5 text-center w-28">👥 Workers</th>
                    <th className="px-5 py-3.5 text-right w-36">
                      {selectedSectionFilter === 'all' ? 'Factory Total' : `${selectedSectionFilter} Total`}
                    </th>
                    <th className="px-5 py-3.5">Shift Notes / Remarks</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ec-border)]">
                  {filteredHistoryRecords.length === 0 ? (
                    <tr>
                      <td
                        colSpan={selectedSectionFilter !== 'all' ? 9 : 8}
                        className="px-5 py-12 text-center text-slate-500 font-medium"
                      >
                        No attendance records found within the selected date range ({reportStartDate} to {reportEndDate}).
                      </td>
                    </tr>
                  ) : (
                    filteredHistoryRecords.map((rec) => {
                      if (selectedSectionFilter === 'all') {
                        // Grand Total Row
                        return (
                          <tr key={rec.id || rec.date} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                            <td className="px-5 py-4 font-bold text-sm text-[var(--ec-foreground)] flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-blue-600" />
                              <span>{rec.date}</span>
                              {rec.date === getTodayDateString() && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  Today
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-4 text-center font-bold text-purple-700 dark:text-purple-300">
                              {rec.totalManagers}
                            </td>

                            <td className="px-4 py-4 text-center font-bold text-blue-700 dark:text-blue-300">
                              {rec.totalIncharges}
                            </td>

                            <td className="px-4 py-4 text-center font-bold text-amber-700 dark:text-amber-300">
                              {rec.totalSupervisors}
                            </td>

                            <td className="px-4 py-4 text-center font-bold text-emerald-700 dark:text-emerald-300">
                              {rec.totalWorkers}
                            </td>

                            <td className="px-5 py-4 text-right font-black text-sm text-blue-600 dark:text-blue-400">
                              {rec.totalManpower} Staff
                            </td>

                            <td className="px-5 py-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                              {rec.notes || '—'}
                            </td>

                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedDate(rec.date);
                                    setActiveTab('manpower');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition"
                                >
                                  View Sections
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingRecord(rec);
                                    setIsBulkEntryOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg text-[var(--ec-muted)] hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                  title="Edit Record"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      } else {
                        // Section-Specific Row
                        const sec = rec.sections?.[selectedSectionFilter] || {
                          section: selectedSectionFilter,
                          managers: 0,
                          incharges: 0,
                          supervisors: 0,
                          workers: 0,
                          total: 0,
                        };
                        const factoryTotal = rec.totalManpower || 1;
                        const share = Math.round((sec.total / factoryTotal) * 100);

                        return (
                          <tr key={rec.id || rec.date} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                            <td className="px-5 py-4 font-bold text-sm text-[var(--ec-foreground)] flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-blue-600" />
                              <span>{rec.date}</span>
                              {rec.date === getTodayDateString() && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  Today
                                </span>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {selectedSectionFilter}
                              </span>
                            </td>

                            <td className="px-4 py-4 text-center font-bold text-purple-700 dark:text-purple-300">
                              {sec.managers || 0}
                            </td>

                            <td className="px-4 py-4 text-center font-bold text-blue-700 dark:text-blue-300">
                              {sec.incharges || 0}
                            </td>

                            <td className="px-4 py-4 text-center font-bold text-amber-700 dark:text-amber-300">
                              {sec.supervisors || 0}
                            </td>

                            <td className="px-4 py-4 text-center font-bold text-emerald-700 dark:text-emerald-300">
                              {sec.workers || 0}
                            </td>

                            <td className="px-5 py-4 text-right">
                              <span className="font-black text-sm text-[var(--ec-foreground)] block">
                                {sec.total} Present
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold">
                                ({share}% of {rec.totalManpower})
                              </span>
                            </td>

                            <td className="px-5 py-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                              {rec.notes || '—'}
                            </td>

                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingRecord(rec);
                                    setIsBulkEntryOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg text-[var(--ec-muted)] hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                  title="Edit Day Record"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: USER LOGIN & ACCESS CONTROL ─────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] shadow-xs">
            <div>
              <h2 className="text-lg font-black text-[var(--ec-foreground)] tracking-tight">
                User Sign-In Credentials & Module Access Permissions
              </h2>
              <p className="text-xs text-[var(--ec-muted)] font-medium mt-0.5">
                Create login accounts for section heads and configure module authorization.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingUser(null);
                setUserModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm"
            >
              <UserPlus className="h-4 w-4" />
              <span>Create User Login Account</span>
            </button>
          </div>

          {/* User Accounts Table */}
          <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-[var(--ec-border)] text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">User Profile</th>
                    <th className="px-5 py-3.5">Sign-In Username</th>
                    <th className="px-5 py-3.5">Factory Section</th>
                    <th className="px-5 py-3.5">Module Permissions</th>
                    <th className="px-5 py-3.5">Account Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ec-border)]">
                  {hrUsers.map((u) => {
                    const isAll = u.allowedRoutes?.includes('*');
                    const routeCount = u.allowedRoutes?.length || 0;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-900 to-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 font-black flex items-center justify-center text-xs shadow-xs">
                              {u.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-sm text-[var(--ec-foreground)]">{u.name}</div>
                              <div className="text-[11px] text-[var(--ec-muted)] font-medium">{u.role}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {u.username}
                        </td>

                        <td className="px-5 py-4">
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {ASSIGNABLE_SECTIONS.find((s) => s.id === u.sectionId)?.label || u.sectionId}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                            isAll
                              ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {isAll ? 'Full Access (*)' : `${routeCount} modules authorized`}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                            u.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}>
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUser(u);
                                setUserModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-[var(--ec-muted)] hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              title="Edit User Login"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteHRUser(u.id)}
                              className="p-1.5 rounded-lg text-[var(--ec-muted)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                              title="Delete User"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── High-Speed Bulk Manpower Entry Modal ────────────────────────────── */}
      {isBulkEntryOpen && (
        <BulkManpowerEntryModal
          initialDate={selectedDate}
          initialRecord={editingRecord}
          onClose={() => {
            setIsBulkEntryOpen(false);
            setEditingRecord(null);
          }}
          onSave={handleSaveDailyManpower}
          onCopyPrevious={getPreviousRecord}
        />
      )}

      {/* ── User Form Modal ────────────────────────────────────────────────── */}
      {userModalOpen && (
        <UserFormModal
          mode={editingUser ? 'edit' : 'add'}
          initial={editingUser}
          onClose={() => {
            setUserModalOpen(false);
            setEditingUser(null);
          }}
          onSave={async (userData) => {
            if (editingUser) {
              await updateHRUser(editingUser.id, userData);
            } else {
              await addHRUser(userData);
            }
          }}
        />
      )}
    </div>
  );
}

export default HRPage;
