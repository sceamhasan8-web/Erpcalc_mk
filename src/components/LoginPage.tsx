"use client";

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from './ThemeProvider';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Sun,
  Moon,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const { dark, toggleDark } = useTheme();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please enter both username/email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await login({
        username: username.trim(),
        password: password.trim(),
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Invalid credentials. Please contact HR.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during sign-in.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--ec-bg)] text-[var(--ec-foreground)] flex flex-col justify-between relative overflow-hidden transition-colors selection:bg-cyan-500 selection:text-white">
      {/* Background Decorative Ambient Orbs */}
      <div className="absolute -top-40 -left-40 w-[30rem] h-[30rem] bg-blue-600/15 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute top-1/2 -right-40 w-[28rem] h-[28rem] bg-cyan-600/15 dark:bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-[32rem] h-[32rem] bg-purple-600/15 dark:bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navigation Bar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 py-5 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/erpcalc-logo.png"
            alt="EasyCalc Logo"
            className="brand-logo shadow-md rounded-2xl w-10 h-10 object-contain"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-400 bg-clip-text text-transparent">
                EasyCalc ERP
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                v2.0
              </span>
            </div>
            <p className="text-[11px] text-[var(--ec-muted)] font-medium">Factory Operations & Management</p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleDark}
          title="Toggle Dark / Light Theme"
          className="p-2.5 rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] text-[var(--ec-foreground)] hover:border-cyan-500/60 hover:bg-[var(--ec-surface)] transition shadow-sm"
        >
          {dark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-[var(--ec-muted)]" />}
        </button>
      </header>

      {/* Main Login Card Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-md">
          {/* Card Container */}
          <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)]/90 backdrop-blur-xl shadow-2xl p-7 sm:p-9 relative overflow-hidden transition-all">
            {/* Header Badge */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-3">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Centralized Access Portal</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ec-foreground)]">
                Welcome Back
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-[var(--ec-muted)]">
                Enter your assigned credentials to access your ERP workspace
              </p>
            </div>

            {/* Error Message Box */}
            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-medium flex items-start gap-2.5 animate-shake">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* Sign In Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username / Email Field */}
              <div>
                <label className="block text-xs font-semibold text-[var(--ec-muted)] mb-1.5">
                  Username or Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--ec-muted)]">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. user@factory.com or username"
                    autoComplete="username"
                    autoFocus
                    required
                    className="w-full pl-10 pr-4 py-3 text-sm rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] placeholder:text-[var(--ec-muted)]/60 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition shadow-inner"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[var(--ec-muted)]">
                    Password
                  </label>
                </div>
                <div className="relative flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--ec-muted)]">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className="w-full pl-10 pr-11 py-3 text-sm rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] placeholder:text-[var(--ec-muted)]/60 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition shadow-inner"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.preventDefault();
                      setShowPassword((prev) => !prev);
                    }}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[var(--ec-muted)] hover:text-cyan-400 transition cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4 text-cyan-400" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 py-3.5 px-4 text-sm font-semibold text-white shadow-xl shadow-cyan-500/20 hover:from-blue-500 hover:via-cyan-500 hover:to-teal-400 active:scale-[0.99] transition-all duration-200 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In to ERP</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Access Note */}
            <div className="mt-6 pt-5 border-t border-[var(--ec-border)]/60 flex items-center justify-center gap-2 text-center text-xs text-[var(--ec-muted)]">
              <ShieldCheck className="h-4 w-4 text-cyan-400 flex-shrink-0" />
              <span>Section permissions configured via HR Panel</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 py-4 sm:px-6 text-center text-xs text-[var(--ec-muted)]">
        EasyCalc Factory ERP &copy; {new Date().getFullYear()} &bull; Role-Based Access Control
      </footer>
    </div>
  );
}

export default LoginPage;
