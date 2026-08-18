"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Search, Bell, Menu, LogOut, ChevronDown, Check, Shield, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function Topbar({
  onOpenMenu,
  dark,
  onToggleDark,
  onOpenProfile,
}: {
  onOpenMenu?: () => void;
  dark?: boolean;
  onToggleDark?: () => void;
  onOpenProfile?: () => void;
}) {
  const _dark = Boolean(dark);
  const { user, activeSection, allSections, switchSection, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="app-header flex w-full items-center justify-between gap-3 relative z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMenu}
          className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 p-2 text-white hover:bg-white/20 transition lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <img src="/erpcalc-logo.png" alt="logo" className="brand-logo lg:hidden rounded-lg shadow-sm" />

        <div className="hidden items-center gap-2 rounded-xl border border-white/20 bg-white/10 backdrop-blur-md px-3 py-1.5 shadow-sm sm:flex">
          <Search className="h-4 w-4 text-white/70" />
          <input
            placeholder="Search orders, buyers, inventory..."
            className="bg-transparent text-xs text-white placeholder:text-white/60 outline-none border-0 p-0 focus:ring-0 w-48 md:w-64"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Active Section Pill */}
        {activeSection && (
          <div className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-semibold text-white shadow-sm">
            <span
              className="w-2 h-2 rounded-full shadow-sm"
              style={{ backgroundColor: activeSection.color || '#38bdf8' }}
            />
            <span>{activeSection.shortName} Section</span>
          </div>
        )}

        {/* Theme toggle */}
        <button
          title="Toggle dark mode"
          onClick={() => onToggleDark?.()}
          className="rounded-xl border border-white/20 bg-white/10 p-2 text-white hover:bg-white/20 transition backdrop-blur-sm"
        >
          {_dark ? <Moon className="h-4 w-4 text-cyan-200" /> : <Sun className="h-4 w-4 text-amber-300" />}
        </button>

        {/* Notifications */}
        <button
          title="Notifications"
          className="rounded-xl border border-white/20 bg-white/10 p-2 text-white hover:bg-white/20 transition backdrop-blur-sm relative"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400" />
        </button>

        {/* User Account & Section Switcher Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 px-2.5 py-1.5 text-white transition backdrop-blur-sm"
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="h-6 w-6 rounded-lg object-cover shadow-sm border border-white/30 flex-shrink-0"
              />
            ) : (
              <div className="h-6 w-6 rounded-lg bg-gradient-to-tr from-cyan-400 to-blue-300 text-slate-900 font-bold text-xs flex items-center justify-center shadow-sm flex-shrink-0">
                {user?.name?.charAt(0) || 'U'}
              </div>
            )}
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold leading-tight">{user?.name || 'User'}</div>
              <div className="text-[10px] text-white/80 leading-tight">{activeSection?.shortName || 'Staff'}</div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 opacity-80" />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] shadow-2xl p-2 z-50 text-[var(--ec-foreground)] animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 border-b border-[var(--ec-border)] mb-1">
                <div className="flex items-center gap-2.5 mb-2">
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="h-9 w-9 rounded-xl object-cover border border-[var(--ec-border)] shadow-sm flex-shrink-0"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white font-bold text-sm flex items-center justify-center shadow-sm flex-shrink-0">
                      {user?.name?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-xs text-[var(--ec-foreground)] truncate">{user?.name}</div>
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          onOpenProfile?.();
                        }}
                        className="text-[10px] font-semibold text-cyan-500 hover:text-cyan-400 underline underline-offset-2 transition"
                      >
                        Profile
                      </button>
                    </div>
                    <div className="text-[11px] text-[var(--ec-muted)] truncate">{user?.email}</div>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Shield className="h-3 w-3" />
                  <span>{user?.role}</span>
                </div>
              </div>

              {/* View Full Profile action item */}
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  onOpenProfile?.();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--ec-foreground)] hover:bg-cyan-500/10 hover:text-cyan-400 transition mb-1 border border-transparent hover:border-cyan-500/20"
              >
                <User className="h-3.5 w-3.5 text-cyan-400" />
                <span>View Full Profile & Access</span>
              </button>

              {user?.section !== 'hr' && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--ec-muted)]">
                    Switch Section Login
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                    {allSections.map((sec) => {
                      const isCurrent = sec.id === user?.section;
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => {
                            switchSection(sec.id);
                            setDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                            isCurrent
                              ? 'bg-cyan-500/10 text-cyan-400 font-semibold border border-cyan-500/20'
                              : 'hover:bg-[var(--ec-surface)] text-[var(--ec-foreground)]'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: sec.color }}
                            />
                            <span className="truncate">{sec.shortName}</span>
                          </div>
                          {isCurrent && <Check className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="mt-2 pt-1.5 border-t border-[var(--ec-border)]">
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out / Lock Panel</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Topbar;
