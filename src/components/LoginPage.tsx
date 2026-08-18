"use client";

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { SectionDefinition, SectionId } from '@/types/auth';
import { useTheme } from './ThemeProvider';
import {
  ShieldCheck,
  Box,
  Layers,
  CalendarDays,
  Building2,
  PackageOpen,
  PackageCheck,
  ArrowRightLeft,
  Store,
  Building,
  Lock,
  User,
  Eye,
  EyeOff,
  Sun,
  Moon,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  ChevronDown,
} from 'lucide-react';

const iconMap: Record<string, any> = {
  ShieldCheck,
  Box,
  Layers,
  CalendarDays,
  Building2,
  PackageOpen,
  PackageCheck,
  ArrowRightLeft,
  Store,
  Building,
};

export function LoginPage() {
  const { allSections, login } = useAuth();
  const { dark, toggleDark } = useTheme();

  // Filter out hidden sections (e.g., HR — accessible via special credentials only)
  const visibleSections = allSections.filter((s) => !s.hidden);

  const [selectedSectionId, setSelectedSectionId] = useState<SectionId>('admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const selectedSection = visibleSections.find((s) => s.id === selectedSectionId) || visibleSections[0];

  const handleSectionSelect = (section: SectionDefinition) => {
    setSelectedSectionId(section.id);
    setUsername('');
    setPassword('');
    setShowPassword(false);
    setErrorMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await login({
        sectionId: selectedSectionId,
        username: username.trim() || selectedSection.defaultUsername,
        password: password,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to authenticate');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const SectionIcon = iconMap[selectedSection.icon] || Box;

  return (
    <div className="min-h-screen bg-[var(--ec-bg)] text-[var(--ec-foreground)] flex flex-col justify-between relative overflow-hidden transition-colors">
      {/* Background Decorative Gradient Orbs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-cyan-600/15 dark:bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-purple-600/15 dark:bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 py-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/erpcalc-logo.png" alt="EasyCalc Logo" className="brand-logo shadow-md rounded-xl" />
          <div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              EasyCalc ERP
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
              Factory Portal
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleDark}
          title="Toggle Theme"
          className="p-2.5 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] hover:border-cyan-500 transition shadow-sm"
        >
          {dark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-[var(--ec-muted)]" />}
        </button>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 py-6 sm:px-6 flex flex-col justify-center">
        {/* Title Header (Only on Desktop: hidden lg:block) */}
        <div className="hidden lg:block text-center max-w-2xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-500/10 to-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-3 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>Section-Wise Access Control Enabled</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--ec-foreground)]">
            Select Your Section & Login
          </h1>
          <p className="mt-2 text-sm sm:text-base text-[var(--ec-muted)]">
            Log in directly to your assigned factory section. Your access will be isolated to authorized modules.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Mobile View: Compact Section Dropdown (lg:hidden) */}
          <div className="lg:hidden col-span-1 flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--ec-muted)]">
              Choose Factory Section
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <div
                  className="w-3 h-3 rounded-full shadow-sm"
                  style={{ backgroundColor: selectedSection.color }}
                />
              </div>
              <select
                value={selectedSectionId}
                onChange={(e) => {
                  const sec = visibleSections.find((s) => s.id === e.target.value);
                  if (sec) handleSectionSelect(sec);
                }}
                className="w-full pl-9 pr-10 py-3 text-sm font-semibold rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] text-[var(--ec-foreground)] shadow-sm focus:outline-none focus:border-cyan-500 transition appearance-none cursor-pointer"
              >
                {visibleSections.map((sec) => (
                  <option key={sec.id} value={sec.id} className="bg-[var(--ec-surface)] text-[var(--ec-foreground)] py-1.5">
                    {sec.name} &bull; ({sec.defaultRole})
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[var(--ec-muted)]">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* Desktop View: Interactive Section Cards Grid (hidden lg:flex) */}
          <div className="hidden lg:flex lg:col-span-7 flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--ec-muted)]">
                1. Choose Factory Section ({visibleSections.length})
              </span>
              <span className="text-xs text-cyan-400 font-medium">Click to select section</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {visibleSections.map((sec) => {
                const Icon = iconMap[sec.icon] || Box;
                const isSelected = sec.id === selectedSectionId;

                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => handleSectionSelect(sec)}
                    className={`relative text-left p-3.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between group ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/10 ring-2 ring-cyan-500/30'
                        : 'border-[var(--ec-border)] bg-[var(--ec-card)] hover:border-cyan-500/40 hover:bg-[var(--ec-surface)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className="p-2 rounded-xl border flex items-center justify-center transition group-hover:scale-105"
                        style={{
                          backgroundColor: `${sec.color}15`,
                          borderColor: `${sec.color}40`,
                          color: sec.color,
                        }}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-cyan-400" />}
                    </div>

                    <div>
                      <div className="font-semibold text-sm text-[var(--ec-foreground)] line-clamp-1">{sec.shortName}</div>
                      <div className="text-xs text-[var(--ec-muted)] line-clamp-1 mt-0.5">{sec.defaultRole}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Section Info & Login Form */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="ec-card p-6 sm:p-7 shadow-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] relative overflow-hidden">
              {/* Selected Section Header Badge */}
              <div className="flex items-center gap-3.5 pb-5 border-b border-[var(--ec-border)] mb-5">
                <div
                  className="p-3 rounded-2xl border shadow-inner flex items-center justify-center"
                  style={{
                    backgroundColor: `${selectedSection.color}20`,
                    borderColor: `${selectedSection.color}50`,
                    color: selectedSection.color,
                  }}
                >
                  <SectionIcon className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-[var(--ec-foreground)] truncate">
                      {selectedSection.name}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--ec-muted)] mt-0.5">{selectedSection.defaultRole}</div>
                </div>
              </div>

              {/* Authorized Scope Summary */}
              <div className="mb-5 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)]/60 p-3.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ec-muted)] mb-1.5">
                  Section Description & Scope
                </div>
                <p className="text-xs text-[var(--ec-foreground)] leading-relaxed">{selectedSection.description}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  <span className="text-[10px] text-[var(--ec-muted)] font-medium mr-1 self-center">Allowed:</span>
                  {selectedSection.allowedRoutes.map((r) => (
                    <span
                      key={r}
                      className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                    >
                      {r === '*' ? 'Full Factory (*)' : r}
                    </span>
                  ))}
                </div>
              </div>

              {/* Error Box */}
              {errorMessage && (
                <div className="mb-4 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-medium">
                  {errorMessage}
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ec-muted)] mb-1.5">
                    User Email / Username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--ec-muted)]">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. user@factory.com or ID"
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500 transition"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-[var(--ec-muted)]">Password</label>
                    <span className="text-[11px] text-[var(--ec-muted)]">Required</span>
                  </div>
                  <div className="relative flex items-center">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--ec-muted)]">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full pl-9 pr-11 py-2.5 text-sm rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500 transition"
                      required
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowPassword((prev) => !prev);
                      }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--ec-muted)] hover:text-cyan-400 transition cursor-pointer z-10"
                      title={showPassword ? 'Hide password' : 'Show password'}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4 text-cyan-400" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 py-3 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-cyan-400 transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Sign In to {selectedSection.shortName}</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 py-4 sm:px-6 text-center text-xs text-[var(--ec-muted)]">
        EasyCalc Factory ERP &copy; {new Date().getFullYear()} &bull; Section-Based Access Control System
      </footer>
    </div>
  );
}

export default LoginPage;
