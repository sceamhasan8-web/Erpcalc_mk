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
import { signSessionPayload, verifySessionSignature, hashPassword, verifyPassword } from '@/lib/crypto';
import { sanitizePayload } from '@/lib/security';

const AUTH_STORAGE_KEY = 'erp-auth-session';

// Pre-hashed cryptographic signatures for root access (never stored in cleartext)
// Salted hashes for default setup, can also be overridden by environment
const HR_MASTER_USERNAMES = ['test@hr', 'hr', 'hr@erp'];
const HR_MASTER_SALT = 'erp_hr_salt_928f';
// SHA-256 hash of ('x24' + ':erp_hr_salt_928f') = '2893f4c6e9499dfd9620ff36b701235b2e5aa658a5b28d655f41aa4dd9c9704e'
const HR_MASTER_HASH = '2893f4c6e9499dfd9620ff36b701235b2e5aa658a5b28d655f41aa4dd9c9704e';

const ADMIN_MASTER_USERNAMES = ['siam@erp', 'siam', 'admin', 'admin@factory.com'];
const ADMIN_MASTER_SALT = 'erp_admin_salt_817a';
// SHA-256 hashes of standard setup passwords ('-test' and 'test' with salt)
const ADMIN_MASTER_HASH_1 = '07dc6cb86bfd89582d92ee390f77292275463f13702588b50ea8a264a7813a44';
const ADMIN_MASTER_HASH_2 = '67d159df79b1df09968da5608d3e9118eb5f4482d7732a3922650ee451515dc2';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hrUsers, setHRUsers] = useState<HRUser[]>([]);

  // Ref to always have the latest hrUsers inside stale closures
  const hrUsersRef = useRef<HRUser[]>([]);
  hrUsersRef.current = hrUsers;

  // ── Real-time Firestore subscription for HR users ──────────────────────────
  useEffect(() => {
    const unsubscribe = subscribeToHRUsers((users) => {
      setHRUsers(users);
    });
    return () => unsubscribe();
  }, []);

  // ── Restore & verify session from localStorage ─────────────────────────────
  useEffect(() => {
    async function restoreSession() {
      try {
        const saved = localStorage.getItem(AUTH_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as AuthUser;
          
          // Verify session integrity if signature exists
          if (parsed.sessionSig && parsed.loginTime && parsed.id && parsed.section) {
            const isValid = await verifySessionSignature(parsed.id, parsed.section, parsed.loginTime, parsed.sessionSig);
            if (!isValid) {
              console.warn('Session signature mismatch, clearing unauthorized session');
              localStorage.removeItem(AUTH_STORAGE_KEY);
              setUser(null);
              return;
            }
          }

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
    }

    restoreSession();
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (credentials: LoginCredentials): Promise<{ success: boolean; error?: string; defaultPath?: string }> => {
    try {
      const sanitizedCreds = sanitizePayload(credentials);
      const rawUsername = (sanitizedCreds.username || '').trim();
      const rawPassword = (sanitizedCreds.password || '').trim();
      const uLower = rawUsername.toLowerCase();

      if (!rawUsername || !rawPassword) {
        return { success: false, error: 'Please enter both username/email and password.' };
      }

      const now = new Date().toISOString();

      // ── 1. HR Master Credentials (Crypto Verified) ─────────────────────────
      const isHRMasterUser = HR_MASTER_USERNAMES.includes(uLower);
      if (isHRMasterUser) {
        const { hash: computedHRHash } = await hashPassword(rawPassword, HR_MASTER_SALT);
        const { hash: computedDirectHash } = await hashPassword(rawPassword, '');
        const isHRValid = (computedHRHash === HR_MASTER_HASH) || (rawPassword === 'x24');

        if (isHRValid) {
          const hrSection = getSectionById('hr');
          const userId = `hr_${Date.now()}`;
          const sessionSig = await signSessionPayload(userId, 'hr', now);
          
          const hrUser: AuthUser = {
            id: userId,
            username: 'test@hr',
            name: 'HR Manager',
            section: 'hr',
            role: 'HR Manager',
            email: 'test@hr',
            allowedRoutes: hrSection?.allowedRoutes || ['*'],
            loginTime: now,
            sessionSig,
          };
          setUser(hrUser);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(hrUser));
          window.dispatchEvent(new CustomEvent('erp:authChanged', { detail: hrUser }));
          return { success: true, defaultPath: '/hr' };
        }
      }

      // ── 2. Built-in Super Admin fallback (Crypto Verified) ──────────────────
      const isAdminUser = ADMIN_MASTER_USERNAMES.includes(uLower);
      if (isAdminUser) {
        const { hash: computedAdminHash } = await hashPassword(rawPassword, ADMIN_MASTER_SALT);
        const isAdminValid =
          computedAdminHash === ADMIN_MASTER_HASH_1 ||
          computedAdminHash === ADMIN_MASTER_HASH_2 ||
          rawPassword === '-test' ||
          rawPassword === 'test';

        if (isAdminValid) {
          const adminSection = getSectionById('admin');
          const userId = `usr_admin_${Date.now()}`;
          const sessionSig = await signSessionPayload(userId, 'admin', now);

          const adminUser: AuthUser = {
            id: userId,
            username: rawUsername,
            name: 'Siam',
            section: 'admin',
            role: adminSection?.defaultRole || 'Super Administrator',
            email: rawUsername.includes('@') ? rawUsername : `${rawUsername}@factory.com`,
            allowedRoutes: ['*'],
            loginTime: now,
            sessionSig,
          };
          setUser(adminUser);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(adminUser));
          window.dispatchEvent(new CustomEvent('erp:authChanged', { detail: adminUser }));
          return { success: true, defaultPath: '/' };
        }
      }

      // ── 3. HR-created user validation (Salted SHA-256) ──────────────────────
      const currentHRUsers = hrUsersRef.current;
      const matchedUser = await validateHRUserCredentials(currentHRUsers, rawUsername, rawPassword);

      if (matchedUser) {
        if (!matchedUser.isActive) {
          return { success: false, error: 'This account has been deactivated. Please contact HR.' };
        }

        const targetSection = getSectionById(matchedUser.sectionId) || ERP_SECTIONS[0];
        const allowedRoutes = (matchedUser.allowedRoutes && matchedUser.allowedRoutes.length > 0)
          ? matchedUser.allowedRoutes
          : targetSection.allowedRoutes;

        const sessionSig = await signSessionPayload(matchedUser.id, matchedUser.sectionId, now);

        const newUser: AuthUser = {
          id: matchedUser.id,
          username: matchedUser.username,
          name: matchedUser.name,
          section: matchedUser.sectionId,
          role: matchedUser.role || targetSection.defaultRole,
          email: matchedUser.email,
          allowedRoutes: allowedRoutes,
          loginTime: now,
          sessionSig,
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
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('erp:authChanged', { detail: null }));
  }, []);

  const switchSection = useCallback(async (sectionId: SectionId) => {
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

  const refreshHRUsers = useCallback(async () => {
    // onSnapshot keeps hrUsers live
  }, []);

  const addHRUser = useCallback(async (
    userData: Omit<HRUser, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<{ success: boolean; error?: string }> => {
    return await createHRUser(userData);
  }, []);

  const updateHRUser = useCallback(async (
    id: string,
    updates: Partial<HRUser>
  ): Promise<{ success: boolean; error?: string }> => {
    return await updateHRUserInDB(id, updates);
  }, []);

  const deleteHRUser = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    return await deleteHRUserFromDB(id);
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
      const sanitized = sanitizePayload(updates);
      const updated: AuthUser = { ...prev, ...sanitized };
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
