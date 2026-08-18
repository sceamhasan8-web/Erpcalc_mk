"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  X,
  Shield,
  User,
  Mail,
  Clock,
  Key,
  Building2,
  CheckCircle2,
  Copy,
  Check,
  LogOut,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  Layers,
  Box,
  Users,
  CalendarDays,
  PackageOpen,
  PackageCheck,
  ArrowRightLeft,
  Store,
  Building,
  UserCog,
  Bell,
  Settings,
  Home,
  Camera,
  Trash2,
  Upload,
  Image as ImageIcon,
  Smile,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const routeIconMap: Record<string, any> = {
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
  '/hr': UserCog,
  '/notifications': Bell,
  '/settings': Settings,
};

const routeNameMap: Record<string, string> = {
  '/': 'Dashboard Overview',
  '/orders': 'Orders & Merchandising',
  '/buyers': 'Buyer Accounts',
  '/production': 'Production Floor',
  '/planning': 'Planning & Scheduling',
  '/warehouse': 'Central Warehouse',
  '/inventory': 'Inventory Tracking',
  '/goods-receive': 'Goods Receive (GRN)',
  '/inventory-transfer': 'Stock Transfer',
  '/goods-store': 'Finished Goods Store',
  '/departments': 'Factory Departments',
  '/hr': 'HR User Management',
  '/notifications': 'System Alerts',
  '/settings': 'Factory Settings',
};

// Preset avatar options for quick selection
const PRESET_AVATARS = [
  { id: 'av1', label: 'Executive', bg: 'from-blue-600 to-indigo-700', icon: '👔' },
  { id: 'av2', label: 'Operations', bg: 'from-emerald-500 to-teal-700', icon: '🏭' },
  { id: 'av3', label: 'Planner', bg: 'from-amber-500 to-orange-600', icon: '📊' },
  { id: 'av4', label: 'Warehouse', bg: 'from-sky-500 to-blue-700', icon: '📦' },
  { id: 'av5', label: 'Security', bg: 'from-purple-600 to-pink-600', icon: '🛡️' },
  { id: 'av6', label: 'Specialist', bg: 'from-rose-500 to-red-700', icon: '💼' },
];

function generateSvgAvatar(emoji: string, gradientClass: string): string {
  // Generate a neat SVG data url
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <rect width="100" height="100" rx="30" fill="#0f172a"/>
    <text x="50%" y="55%" font-size="48" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCustomizer?: () => void;
}

export function UserProfileModal({ isOpen, onClose, onOpenCustomizer }: UserProfileModalProps) {
  const { user, activeSection, logout, updateUserAvatar } = useAuth();
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [avatarSuccessMessage, setAvatarSuccessMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  const sectionColor = activeSection?.color || '#0b69ff';
  const hasFullAccess = user.allowedRoutes?.includes('*') || user.section === 'admin' || user.section === 'hr';

  const handleCopy = (text: string, type: 'key' | 'email') => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  // Handle image upload from device like WhatsApp / Facebook
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Square crop & resize to optimized max 360x360
        const canvas = document.createElement('canvas');
        const targetSize = 360;
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const minDim = Math.min(img.width, img.height);
          const startX = (img.width - minDim) / 2;
          const startY = (img.height - minDim) / 2;
          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, targetSize, targetSize);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          updateUserAvatar(dataUrl);
          setShowAvatarMenu(false);
          setAvatarSuccessMessage('Profile photo updated successfully!');
          setTimeout(() => setAvatarSuccessMessage(''), 3500);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be chosen again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSelectPreset = (preset: typeof PRESET_AVATARS[0]) => {
    const dataUrl = generateSvgAvatar(preset.icon, preset.bg);
    updateUserAvatar(dataUrl);
    setShowAvatarMenu(false);
    setAvatarSuccessMessage(`Avatar changed to ${preset.label}!`);
    setTimeout(() => setAvatarSuccessMessage(''), 3500);
  };

  const handleRemovePhoto = () => {
    updateUserAvatar(null);
    setShowAvatarMenu(false);
    setAvatarSuccessMessage('Profile photo reset to default initials.');
    setTimeout(() => setAvatarSuccessMessage(''), 3500);
  };

  const formattedLoginTime = user.loginTime
    ? new Date(user.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) +
      ', ' +
      new Date(user.loginTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Active Session';

  const authorizedModules = hasFullAccess
    ? Object.keys(routeNameMap)
    : (user.allowedRoutes || []).filter((r) => r !== '*');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/jpg"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Backdrop */}
      <div
        onClick={() => {
          setShowAvatarMenu(false);
          onClose();
        }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity animate-fade-in"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] shadow-2xl overflow-hidden z-10 animate-scale-up my-auto max-h-[92vh] flex flex-col">
        {/* Banner Header with Section Accent */}
        <div
          className="relative px-6 pt-6 pb-16 text-white overflow-hidden flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${sectionColor} 0%, #0a58e6 100%)`,
          }}
        >
          {/* Subtle Ambient Glow Shapes */}
          <div className="absolute -top-12 -right-12 w-44 h-44 bg-white/15 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 -left-12 w-36 h-36 bg-black/20 rounded-full blur-xl pointer-events-none" />

          <div className="relative z-10 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-md border border-white/25 shadow-sm">
                <Sparkles className="h-3 w-3 text-cyan-200" />
                <span>EasyCalc Verified Profile</span>
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition backdrop-blur-sm active:scale-95"
              title="Close (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* User Identity Avatar Row with WhatsApp/Facebook Style Photo Edit Badge */}
        <div className="relative px-6 -mt-12 flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              {/* Avatar Box with Camera Overlay */}
              <div className="relative group">
                <div
                  className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl p-1 bg-[var(--ec-card)] shadow-2xl border-2 overflow-hidden cursor-pointer relative"
                  style={{ borderColor: sectionColor }}
                  onClick={() => setShowAvatarMenu(!showAvatarMenu)}
                  title="Click to change profile picture"
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="h-full w-full rounded-xl object-cover"
                    />
                  ) : (
                    <div
                      className="h-full w-full rounded-xl flex items-center justify-center text-white text-2xl sm:text-3xl font-black shadow-inner"
                      style={{
                        background: `linear-gradient(135deg, ${sectionColor} 0%, #0284c7 100%)`,
                      }}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Dark hover overlay with Camera */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex flex-col items-center justify-center text-white gap-0.5">
                    <Camera className="h-5 w-5" />
                    <span className="text-[9px] font-semibold">Change</span>
                  </div>
                </div>

                {/* Facebook/WhatsApp style Camera Badge Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAvatarMenu(!showAvatarMenu);
                  }}
                  title="Change Profile Photo"
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-cyan-500 hover:bg-cyan-400 text-white border-2 border-[var(--ec-card)] flex items-center justify-center shadow-lg transition-transform active:scale-95 group-hover:scale-110"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>

                {/* Photo Options Dropdown Menu */}
                {showAvatarMenu && (
                  <div className="absolute left-0 top-full mt-2 w-56 rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] shadow-2xl p-2 z-30 animate-scale-up text-[var(--ec-foreground)]">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--ec-muted)]">
                      Profile Photo
                    </div>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium hover:bg-cyan-500/10 hover:text-cyan-400 transition text-left"
                    >
                      <Upload className="h-4 w-4 text-cyan-400" />
                      <span>Upload from Device</span>
                    </button>

                    <div className="my-1 border-t border-[var(--ec-border)]" />

                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--ec-muted)]">
                      Choose Preset Avatar
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 p-1">
                      {PRESET_AVATARS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectPreset(preset)}
                          className="flex flex-col items-center justify-center p-1.5 rounded-lg border border-[var(--ec-border)] hover:border-cyan-500 hover:bg-cyan-500/10 transition text-center group"
                          title={preset.label}
                        >
                          <span className="text-base group-hover:scale-110 transition-transform">
                            {preset.icon}
                          </span>
                          <span className="text-[9px] text-[var(--ec-muted)] group-hover:text-cyan-400 truncate w-full mt-0.5">
                            {preset.label}
                          </span>
                        </button>
                      ))}
                    </div>

                    {user.avatar && (
                      <>
                        <div className="my-1 border-t border-[var(--ec-border)]" />
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 transition text-left"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Remove Photo</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Names & Role */}
              <div className="min-w-0 pb-1">
                <h3 className="text-xl sm:text-2xl font-bold text-[var(--ec-foreground)] truncate leading-tight">
                  {user.name}
                </h3>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--ec-muted)]">
                  <span className="font-medium truncate">{user.role}</span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 font-semibold" style={{ color: sectionColor }}>
                    <Building2 className="h-3 w-3" />
                    {activeSection?.shortName || user.section.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Action Badges */}
            <div className="flex items-center gap-2 pb-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Authorized</span>
              </span>
            </div>
          </div>
        </div>

        {/* Success Alert Banner for Avatar Updates */}
        {avatarSuccessMessage && (
          <div className="mx-6 mt-4 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-medium flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <span>{avatarSuccessMessage}</span>
          </div>
        )}

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Information Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Username / Key */}
            <div className="p-3.5 rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)]/60 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-[var(--ec-muted)] uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="h-3 w-3 text-cyan-500" />
                  <span>User Login Key</span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-[var(--ec-foreground)] font-mono truncate mt-0.5">
                  {user.username}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(user.username, 'key')}
                className="p-2 rounded-xl text-[var(--ec-muted)] hover:text-cyan-400 hover:bg-cyan-500/10 transition"
                title="Copy Login Key"
              >
                {copiedKey ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>

            {/* Email */}
            <div className="p-3.5 rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)]/60 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-[var(--ec-muted)] uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="h-3 w-3 text-blue-500" />
                  <span>Email Account</span>
                </div>
                <div className="text-xs sm:text-sm font-semibold text-[var(--ec-foreground)] truncate mt-0.5">
                  {user.email || `${user.username}@factory.com`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(user.email || `${user.username}@factory.com`, 'email')}
                className="p-2 rounded-xl text-[var(--ec-muted)] hover:text-blue-400 hover:bg-blue-500/10 transition"
                title="Copy Email"
              >
                {copiedEmail ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>

            {/* Active Department */}
            <div className="p-3.5 rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)]/60">
              <div className="text-[11px] font-semibold text-[var(--ec-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="h-3 w-3 text-purple-500" />
                <span>Assigned Department</span>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-[var(--ec-foreground)] truncate mt-0.5">
                {activeSection?.name || 'General Factory Staff'}
              </div>
            </div>

            {/* Login Session Time */}
            <div className="p-3.5 rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)]/60">
              <div className="text-[11px] font-semibold text-[var(--ec-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-amber-500" />
                <span>Session Started</span>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-[var(--ec-foreground)] truncate mt-0.5">
                {formattedLoginTime}
              </div>
            </div>
          </div>

          {/* Section Capability / Access Matrix Card */}
          <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)]/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--ec-foreground)]">
                  Authorized Modules & Permissions
                </span>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {hasFullAccess ? 'Full System Access' : `${authorizedModules.length} Modules`}
              </span>
            </div>

            <p className="text-xs text-[var(--ec-muted)] mb-3 leading-relaxed">
              {hasFullAccess
                ? 'Your account has administrator privileges to access all factory ERP sections, workflow managers, and reports.'
                : `Your credentials grant access to specific workflow modules for the ${activeSection?.name || 'assigned'} section.`}
            </p>

            {/* Modules Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {authorizedModules.map((route) => {
                const Icon = routeIconMap[route] || PackageOpen;
                const name = routeNameMap[route] || route;
                return (
                  <Link
                    key={route}
                    href={route}
                    onClick={onClose}
                    className="flex items-center gap-2 p-2.5 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] hover:border-cyan-500/40 hover:bg-cyan-500/5 text-[var(--ec-foreground)] transition group text-xs"
                  >
                    <Icon className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
                    <span className="truncate font-medium">{name}</span>
                    <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 ml-auto flex-shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* System & Security Footer Note */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-500/5 border border-blue-500/15 text-[11px] text-[var(--ec-muted)]">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-400" />
              <span>EasyCalc Enterprise Security Protocol • Live Synchronized</span>
            </div>
            <span className="font-mono text-cyan-400 font-semibold">v1.0.0</span>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 border-t border-[var(--ec-border)] bg-[var(--ec-surface)]/80 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            {(user.section === 'admin' || user.section === 'hr') && onOpenCustomizer && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCustomizer();
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-3.5 py-2 text-xs font-semibold text-[var(--ec-foreground)] hover:border-cyan-500 transition"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-400" />
                <span>Customize Menu</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--ec-border)] px-4 py-2 text-xs font-semibold text-[var(--ec-foreground)] hover:bg-[var(--ec-border)] transition"
            >
              Close
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                logout();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2 text-xs font-semibold transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserProfileModal;
