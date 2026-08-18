"use client";

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { HRUser, SectionId } from '@/types/auth';
import {
  Users,
  UserPlus,
  Pencil,
  Trash2,
  X,
  Check,
  Eye,
  EyeOff,
  Shield,
  Search,
  RefreshCw,
  ChevronDown,
  UserCog,
  KeyRound,
  AlertTriangle,
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
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
} from 'lucide-react';

// Section icon map (matching login page)
const SECTION_ICON_MAP: Record<string, any> = {
  admin: ShieldCheck,
  orders: Box,
  production: Layers,
  planning: CalendarDays,
  warehouse: Building2,
  inventory: PackageOpen,
  'goods-receive': PackageCheck,
  'inventory-transfer': ArrowRightLeft,
  'goods-store': Store,
  departments: Building,
};

const SECTION_COLOR_MAP: Record<string, string> = {
  admin: '#8b5cf6',
  orders: '#06b6d4',
  production: '#10b981',
  planning: '#f59e0b',
  warehouse: '#3b82f6',
  inventory: '#0ea5e9',
  'goods-receive': '#14b8a6',
  'inventory-transfer': '#ec4899',
  'goods-store': '#84cc16',
  departments: '#6366f1',
};

const ASSIGNABLE_SECTIONS: { id: SectionId; label: string }[] = [
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

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: any;
}) {
  return (
    <div
      className="rounded-2xl border p-4 flex items-center gap-3 transition hover:scale-[1.01]"
      style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}
    >
      <div
        className="p-2.5 rounded-xl"
        style={{ backgroundColor: `${color}20`, color }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-bold text-[var(--ec-foreground)]">{value}</div>
        <div className="text-xs text-[var(--ec-muted)]">{label}</div>
      </div>
    </div>
  );
}

// ─── User Form Modal ─────────────────────────────────────────────────────────
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
  const [password, setPassword] = useState(initial?.password || '');
  const [sectionId, setSectionId] = useState<SectionId>(initial?.sectionId || 'orders');
  const [role, setRole] = useState(initial?.role || '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !password.trim()) {
      setError('Name, username, and password are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        name: name.trim(),
        username: username.trim(),
        email: email.trim() || `${username.trim()}@factory.com`,
        password: password,
        sectionId,
        role: role.trim() || ASSIGNABLE_SECTIONS.find((s) => s.id === sectionId)?.label || sectionId,
        isActive,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save user.');
    } finally {
      setSaving(false);
    }
  };

  const color = SECTION_COLOR_MAP[sectionId] || '#06b6d4';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[var(--ec-card)] border border-[var(--ec-border)] rounded-3xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div
          className="px-6 py-5 border-b border-[var(--ec-border)] flex items-center justify-between"
          style={{ background: `linear-gradient(135deg, ${color}15, transparent)` }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${color}20`, color }}>
              {mode === 'add' ? <UserPlus className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="font-bold text-base text-[var(--ec-foreground)]">
                {mode === 'add' ? 'Create New User' : 'Edit User'}
              </h2>
              <p className="text-xs text-[var(--ec-muted)]">
                {mode === 'add' ? 'Set credentials for a section' : 'Update user credentials'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--ec-muted)] hover:text-[var(--ec-foreground)] hover:bg-[var(--ec-surface)] transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Section Select */}
          <div>
            <label className="block text-xs font-semibold text-[var(--ec-muted)] mb-1.5">
              Assign to Section *
            </label>
            <div className="relative">
              <div
                className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
                style={{ color }}
              >
                {React.createElement(SECTION_ICON_MAP[sectionId] || Building, { className: 'h-4 w-4' })}
              </div>
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value as SectionId)}
                className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500 transition appearance-none"
              >
                {ASSIGNABLE_SECTIONS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[var(--ec-muted)]">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* Two-col: Name + Role */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--ec-muted)] mb-1.5">Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500 transition"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--ec-muted)] mb-1.5">Role / Designation</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Floor Manager"
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500 transition"
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-[var(--ec-muted)] mb-1.5">Username *</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. john.doe or john@factory.com"
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500 transition"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-[var(--ec-muted)] mb-1.5">Email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. john@factory.com"
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500 transition"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-[var(--ec-muted)] mb-1.5">Password *</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--ec-muted)]">
                <KeyRound className="h-4 w-4" />
              </div>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Set a secure password"
                className="w-full pl-9 pr-11 py-2.5 text-sm rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500 transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass((p) => !p)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--ec-muted)] hover:text-cyan-400 transition"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)]">
            <div>
              <div className="text-sm font-semibold text-[var(--ec-foreground)]">Account Active</div>
              <div className="text-xs text-[var(--ec-muted)]">Inactive users cannot login</div>
            </div>
            <button
              type="button"
              onClick={() => setIsActive((a) => !a)}
              className="transition"
            >
              {isActive ? (
                <ToggleRight className="h-8 w-8 text-emerald-400" />
              ) : (
                <ToggleLeft className="h-8 w-8 text-[var(--ec-muted)]" />
              )}
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-sm font-medium text-[var(--ec-muted)] hover:text-[var(--ec-foreground)] hover:border-[var(--ec-foreground)]/20 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 hover:from-orange-400 hover:to-amber-400 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {mode === 'add' ? 'Create User' : 'Save Changes'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteConfirmModal({
  user,
  onClose,
  onConfirm,
}: {
  user: HRUser;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[var(--ec-card)] border border-red-500/30 rounded-3xl shadow-2xl p-6">
        <div className="flex flex-col items-center gap-3 text-center mb-6">
          <div className="p-3 rounded-2xl bg-red-500/15 border border-red-500/30">
            <Trash2 className="h-6 w-6 text-red-400" />
          </div>
          <h3 className="font-bold text-base text-[var(--ec-foreground)]">Delete User?</h3>
          <p className="text-sm text-[var(--ec-muted)]">
            Are you sure you want to delete <span className="font-semibold text-[var(--ec-foreground)]">{user.name}</span>?
            This action cannot be undone.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-sm font-medium text-[var(--ec-muted)] hover:text-[var(--ec-foreground)] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-sm font-semibold text-white shadow-lg shadow-red-500/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {deleting ? (
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main HR Page ─────────────────────────────────────────────────────────────
export function HRPage() {
  const { hrUsers, addHRUser, updateHRUser, deleteHRUser, refreshHRUsers } = useAuth();

  const [search, setSearch] = useState('');
  const [filterSection, setFilterSection] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState<HRUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<HRUser | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshHRUsers();
    setRefreshing(false);
    showToast('User list refreshed');
  };

  // Stats
  const totalUsers = hrUsers.length;
  const activeUsers = hrUsers.filter((u) => u.isActive).length;
  const inactiveUsers = totalUsers - activeUsers;
  const sectionsCovered = new Set(hrUsers.map((u) => u.sectionId)).size;

  // Filtered list
  const filteredUsers = useMemo(() => {
    return hrUsers
      .filter((u) => filterSection === 'all' || u.sectionId === filterSection)
      .filter((u) => {
        const q = search.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.sectionId.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
        );
      });
  }, [hrUsers, search, filterSection]);

  const handleAddUser = async (data: Omit<HRUser, 'id' | 'createdAt' | 'updatedAt'>) => {
    const result = await addHRUser(data);
    if (result.success) {
      showToast(`User "${data.name}" created successfully`);
    } else {
      showToast(result.error || 'Failed to create user', 'error');
      throw new Error(result.error);
    }
  };

  const handleEditUser = async (data: Omit<HRUser, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!editUser) return;
    const result = await updateHRUser(editUser.id, data);
    if (result.success) {
      showToast(`User "${data.name}" updated successfully`);
    } else {
      showToast(result.error || 'Failed to update user', 'error');
      throw new Error(result.error);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    const result = await deleteHRUser(deleteUser.id);
    if (result.success) {
      showToast(`User "${deleteUser.name}" deleted`);
    } else {
      showToast(result.error || 'Failed to delete user', 'error');
    }
  };

  const handleToggleActive = async (u: HRUser) => {
    const result = await updateHRUser(u.id, { isActive: !u.isActive });
    if (result.success) {
      showToast(`${u.name} ${!u.isActive ? 'activated' : 'deactivated'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-2xl text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/15 border-red-500/30 text-red-300'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          {toast.msg}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-orange-500/15 border border-orange-500/30">
            <UserCog className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--ec-foreground)]">Human Resource Panel</h1>
            <p className="text-sm text-[var(--ec-muted)]">Manage user accounts and access credentials</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-2.5 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-muted)] hover:text-[var(--ec-foreground)] hover:border-cyan-500 transition"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 hover:from-orange-400 hover:to-amber-400 transition"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Users" value={totalUsers} color="#f97316" icon={Users} />
        <StatCard label="Active" value={activeUsers} color="#10b981" icon={CheckCircle2} />
        <StatCard label="Inactive" value={inactiveUsers} color="#ef4444" icon={AlertTriangle} />
        <StatCard label="Sections Covered" value={sectionsCovered} color="#8b5cf6" icon={Shield} />
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--ec-muted)]">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by name, username, section..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] focus:outline-none focus:border-orange-500 transition"
          />
        </div>
        <div className="relative">
          <select
            value={filterSection}
            onChange={(e) => setFilterSection(e.target.value)}
            className="pl-4 pr-10 py-2.5 text-sm rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] focus:outline-none focus:border-orange-500 transition appearance-none min-w-[180px]"
          >
            <option value="all">All Sections</option>
            {ASSIGNABLE_SECTIONS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[var(--ec-muted)]">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* User Table / Cards */}
      {filteredUsers.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-[var(--ec-border)] rounded-2xl">
          <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 inline-block mb-3">
            <Users className="h-8 w-8 text-orange-400" />
          </div>
          <p className="text-[var(--ec-muted)] text-sm">
            {search || filterSection !== 'all'
              ? 'No users match your search.'
              : 'No users created yet. Add your first user!'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] overflow-hidden">
          {/* Table Header — desktop */}
          <div className="hidden md:grid grid-cols-[2fr_2fr_2fr_1.5fr_1fr_auto] gap-4 px-4 py-3 border-b border-[var(--ec-border)] bg-[var(--ec-surface)]">
            {['Name', 'Username', 'Section', 'Role', 'Status', 'Actions'].map((h) => (
              <div key={h} className="text-[10px] font-bold uppercase tracking-wider text-[var(--ec-muted)]">{h}</div>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y divide-[var(--ec-border)]">
            {filteredUsers.map((u) => {
              const color = SECTION_COLOR_MAP[u.sectionId] || '#06b6d4';
              const SectionIcon = SECTION_ICON_MAP[u.sectionId] || Building;
              const sectionLabel = ASSIGNABLE_SECTIONS.find((s) => s.id === u.sectionId)?.label || u.sectionId;

              return (
                <div
                  key={u.id}
                  className="group px-4 py-3 hover:bg-[var(--ec-surface)] transition grid grid-cols-1 md:grid-cols-[2fr_2fr_2fr_1.5fr_1fr_auto] gap-3 md:gap-4 items-center"
                >
                  {/* Name */}
                  <div className="flex items-center gap-2.5">
                    <div
                      className="h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[var(--ec-foreground)]">{u.name}</div>
                      <div className="text-xs text-[var(--ec-muted)]">{u.email}</div>
                    </div>
                  </div>

                  {/* Username */}
                  <div className="font-mono text-xs text-[var(--ec-foreground)] bg-[var(--ec-surface)] px-2.5 py-1.5 rounded-lg border border-[var(--ec-border)] inline-block md:block w-fit">
                    {u.username}
                  </div>

                  {/* Section */}
                  <div className="flex items-center gap-1.5">
                    <div
                      className="p-1.5 rounded-lg"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      <SectionIcon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs text-[var(--ec-foreground)] line-clamp-1">{sectionLabel}</span>
                  </div>

                  {/* Role */}
                  <div className="text-xs text-[var(--ec-muted)] line-clamp-1">{u.role}</div>

                  {/* Status toggle */}
                  <div>
                    <button
                      onClick={() => handleToggleActive(u)}
                      title={u.isActive ? 'Click to deactivate' : 'Click to activate'}
                      className="transition"
                    >
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400">
                          <X className="h-3 w-3" /> Inactive
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setEditUser(u)}
                      className="p-1.5 rounded-lg text-[var(--ec-muted)] hover:text-cyan-400 hover:bg-cyan-500/10 transition"
                      title="Edit user"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteUser(u)}
                      className="p-1.5 rounded-lg text-[var(--ec-muted)] hover:text-red-400 hover:bg-red-500/10 transition"
                      title="Delete user"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section Summary */}
      {hrUsers.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ec-muted)]">
            Users by Section
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {ASSIGNABLE_SECTIONS.map((sec) => {
              const count = hrUsers.filter((u) => u.sectionId === sec.id).length;
              if (count === 0) return null;
              const color = SECTION_COLOR_MAP[sec.id] || '#06b6d4';
              const Icon = SECTION_ICON_MAP[sec.id] || Building;
              return (
                <div
                  key={sec.id}
                  className="flex items-center gap-2 p-2.5 rounded-xl border transition cursor-pointer hover:scale-[1.02]"
                  style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}
                  onClick={() => setFilterSection(sec.id === filterSection ? 'all' : sec.id)}
                >
                  <div style={{ color }}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-[var(--ec-foreground)] truncate">{sec.id}</div>
                    <div className="text-xs" style={{ color }}>{count} user{count !== 1 ? 's' : ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <UserFormModal
          mode="add"
          onClose={() => setShowAddModal(false)}
          onSave={handleAddUser}
        />
      )}
      {editUser && (
        <UserFormModal
          mode="edit"
          initial={editUser}
          onClose={() => setEditUser(null)}
          onSave={handleEditUser}
        />
      )}
      {deleteUser && (
        <DeleteConfirmModal
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onConfirm={handleDeleteUser}
        />
      )}
    </div>
  );
}

export default HRPage;
