"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContextType, AuthUser, HRUser, LoginCredentials, SectionId } from '@/types/auth';
import { ERP_SECTIONS, getSectionById, isRouteAllowedForSection } from '@/lib/auth-config';
import {
  subscribeToHRUsers,
  createHRUser,
  updateHRUser as updateHRUserInDB,
  deleteHRUser as deleteHRUserFromDB,
  validateHRUserCredentials,
} from '@/lib/hr-users';

const AUTH_STORAGE_KEY = 'erp-auth-session';

// Hidden HR Section master credentials
// These work regardless of which section is selected on the login page
const HR_MASTER_USERNAME = 'test@hr';
const HR_MASTER_PASSWORD = 'x24';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hrUsers, setHRUsers] = useState<HRUser[]>([]);

  // Ref to always have the latest hrUsers inside stale closures
  const hrUsersRef = useRef<HRUser[]>([]);
  hrUsersRef.current = hrUsers;

  // ── Real-time Firestore subscription for HR users ──────────────────────────
  // Fires immediately with current data, then on every Firestore change.
  // Any device running the app will see HR user changes instantly.
  useEffect(() => {
    const unsubscribe = subscribeToHRUsers((users) => {
      setHRUsers(users);
    });
    return () => unsubscribe();
  }, []);

  // ── Restore session from localStorage (fast, synchronous) ──────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AuthUser;
        const sectionConfig = getSectionById(parsed.section);
        const routes = (parsed.allowedRoutes && parsed.allowedRoutes.length > 0)
          ? parsed.allowedRoutes
          : (sectionConfig?.allowedRoutes || ['/']);
        setUser({ ...parsed, allowedRoutes: routes });
      }
    } catch (e) {
      console.error('Failed to restore auth session:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (credentials: LoginCredentials): Promise<{ success: boolean; error?: string; defaultPath?: string }> => {
    try {
      const rawUsername = (credentials.username || '').trim();
      const rawPassword = (credentials.password || '').trim();
      const uLower = rawUsername.toLowerCase();

      if (!rawUsername || !rawPassword) {
        return { success: false, error: 'Please enter both username/email and password.' };
      }

      // ── 1. HR Master Credentials ──────────────────────────────────────────
      const isHRMasterUser =
        uLower === HR_MASTER_USERNAME.toLowerCase() ||
        uLower === 'hr' ||
        uLower === 'hr@erp';
      const isHRMasterPass = rawPassword === HR_MASTER_PASSWORD;

      if (isHRMasterUser && isHRMasterPass) {
        const hrSection = getSectionById('hr');
        const hrUser: AuthUser = {
          id: `hr_${Date.now()}`,
          username: HR_MASTER_USERNAME,
          name: 'HR Manager',
          section: 'hr',
          role: 'HR Manager',
          email: HR_MASTER_USERNAME,
          allowedRoutes: hrSection?.allowedRoutes || ['*'],
          loginTime: new Date().toISOString(),
        };
        setUser(hrUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(hrUser));
        window.dispatchEvent(new CustomEvent('erp:authChanged', { detail: hrUser }));
        return { success: true, defaultPath: '/hr' };
      }

      // ── 2. Built-in Admin fallback ────────────────────────────────────────
      const isAdminUser =
        uLower === 'siam@erp' ||
        uLower === 'siam' ||
        uLower === 'admin' ||
        uLower === 'admin@factory.com';
      const isAdminPass = rawPassword === '-test' || rawPassword === 'test';

      if (isAdminUser && isAdminPass) {
        const adminSection = getSectionById('admin');
        const adminUser: AuthUser = {
          id: `usr_admin_${Date.now()}`,
          username: rawUsername,
          name: 'Siam',
          section: 'admin',
          role: adminSection?.defaultRole || 'Super Administrator',
          email: rawUsername.includes('@') ? rawUsername : `${rawUsername}@factory.com`,
          allowedRoutes: ['*'],
          loginTime: new Date().toISOString(),
        };
        setUser(adminUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(adminUser));
        window.dispatchEvent(new CustomEvent('erp:authChanged', { detail: adminUser }));
        return { success: true, defaultPath: '/' };
      }

      // ── 3. HR-created user validation (from Firestore hr_users) ────────────
      const currentHRUsers = hrUsersRef.current;
      const matchedUser = currentHRUsers.find(
        (u) =>
          u.username.trim().toLowerCase() === uLower ||
          (u.email && u.email.trim().toLowerCase() === uLower)
      );

      if (matchedUser) {
        if (matchedUser.password !== rawPassword) {
          return { success: false, error: 'Incorrect password. Please try again.' };
        }
        if (!matchedUser.isActive) {
          return { success: false, error: 'This account has been deactivated. Please contact HR.' };
        }

        const targetSection = getSectionById(matchedUser.sectionId) || ERP_SECTIONS[0];
        const allowedRoutes = (matchedUser.allowedRoutes && matchedUser.allowedRoutes.length > 0)
          ? matchedUser.allowedRoutes
          : targetSection.allowedRoutes;

        const newUser: AuthUser = {
          id: matchedUser.id,
          username: matchedUser.username,
          name: matchedUser.name,
          section: matchedUser.sectionId,
          role: matchedUser.role || targetSection.defaultRole,
          email: matchedUser.email,
          allowedRoutes: allowedRoutes,
          loginTime: new Date().toISOString(),
        };

        setUser(newUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
        window.dispatchEvent(new CustomEvent('erp:authChanged', { detail: newUser }));
        return { success: true, defaultPath: targetSection.defaultPath || '/' };
      }

      // ── 4. No matching credentials ─────────────────────────────────────────
      return {
        success: false,
        error: 'Invalid username or password. Please contact HR to create or verify your credentials.',
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed. Please try again.' };
    }
  }, []); // hrUsersRef is always current via ref

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('erp:authChanged', { detail: null }));
  }, []);

  const switchSection = useCallback((sectionId: SectionId) => {
    const sectionConfig = getSectionById(sectionId);
    if (!sectionConfig) return;
    setUser((prev) => {
      if (!prev) return prev;
      const updated: AuthUser = {
        ...prev,
        section: sectionConfig.id,
        role: sectionConfig.defaultRole,
        allowedRoutes: sectionConfig.allowedRoutes,
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('erp:authChanged', { detail: updated }));
      return updated;
    });
  }, []);

  const canAccessRoute = useCallback((pathname: string): boolean => {
    if (!user) return false;
    if (user.section === 'admin') return true;
    if (user.allowedRoutes.includes('*')) return true;
    const normalizedPath = pathname === '' ? '/' : pathname;
    return user.allowedRoutes.some((route) => {
      if (route === normalizedPath) return true;
      if (route !== '/' && normalizedPath.startsWith(route)) return true;
      return false;
    });
  }, [user]);

  // ── HR User Management ─────────────────────────────────────────────────────
  // Note: No need to manually refresh after mutations — onSnapshot auto-updates

  const refreshHRUsers = useCallback(async () => {
    // onSnapshot keeps hrUsers live — this is a no-op kept for API compatibility
    // but can force-resubscribe if needed in the future
  }, []);

  const addHRUser = useCallback(async (
    userData: Omit<HRUser, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<{ success: boolean; error?: string }> => {
    return await createHRUser(userData);
    // onSnapshot will auto-update hrUsers on all devices
  }, []);

  const updateHRUser = useCallback(async (
    id: string,
    updates: Partial<HRUser>
  ): Promise<{ success: boolean; error?: string }> => {
    return await updateHRUserInDB(id, updates);
    // onSnapshot will auto-update hrUsers on all devices
  }, []);

  const deleteHRUser = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    return await deleteHRUserFromDB(id);
    // onSnapshot will auto-update hrUsers on all devices
  }, []);

  const updateUserAvatar = useCallback((avatarDataUrl: string | null) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated: AuthUser = { ...prev, avatar: avatarDataUrl || undefined };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('erp:authChanged', { detail: updated }));
      return updated;
    });
  }, []);

  const updateUserProfile = useCallback((updates: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated: AuthUser = { ...prev, ...updates };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('erp:authChanged', { detail: updated }));
      return updated;
    });
  }, []);

  const activeSection = useMemo(
    () => (user ? getSectionById(user.section) || null : null),
    [user]
  );

  const contextValue = useMemo(() => ({
    user,
    isAuthenticated: !!user,
    isLoading,
    activeSection,
    allSections: ERP_SECTIONS,
    hrUsers,
    login,
    logout,
    switchSection,
    canAccessRoute,
    addHRUser,
    updateHRUser,
    deleteHRUser,
    refreshHRUsers,
    updateUserAvatar,
    updateUserProfile,
  }), [
    user, isLoading, activeSection, hrUsers,
    login, logout, switchSection, canAccessRoute,
    addHRUser, updateHRUser, deleteHRUser, refreshHRUsers,
    updateUserAvatar, updateUserProfile,
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
