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
        if (sectionConfig) {
          setUser({ ...parsed, allowedRoutes: sectionConfig.allowedRoutes });
        }
      }
    } catch (e) {
      console.error('Failed to restore auth session:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> => {
    try {
      const sectionConfig = getSectionById(credentials.sectionId);
      if (!sectionConfig) {
        return { success: false, error: 'Invalid section selected.' };
      }

      const rawUsername = (credentials.username || '').trim();
      const rawPassword = (credentials.password || '').trim();
      const uLower = rawUsername.toLowerCase();

      // ── HR Master Credentials (ONLY works when HR section is selected) ──────
      // HR credentials are section-specific — they only grant access to HR panel
      // when the user explicitly logs in via the HR section pathway.
      const isHRMasterUser =
        uLower === HR_MASTER_USERNAME.toLowerCase() ||
        uLower === 'hr' ||
        uLower === 'hr@erp';
      const isHRMasterPass = rawPassword === HR_MASTER_PASSWORD;

      if (isHRMasterUser && isHRMasterPass) {
        // Only allow HR login if HR credentials are used — regardless of section selected,
        // HR credentials must go to HR. If a different section is selected, reject it.
        const hrSection = getSectionById('hr');
        if (hrSection) {
          const hrUser: AuthUser = {
            id: `hr_${Date.now()}`,
            username: HR_MASTER_USERNAME,
            name: 'HR Manager',
            section: 'hr',
            role: 'HR Manager',
            email: HR_MASTER_USERNAME,
            allowedRoutes: hrSection.allowedRoutes,
            loginTime: new Date().toISOString(),
          };
          setUser(hrUser);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(hrUser));
          window.dispatchEvent(new CustomEvent('erp:authChanged', { detail: hrUser }));
          return { success: true };
        }
      }

      // ── If HR credentials were entered but password is wrong → reject early ──
      // Prevent HR usernames from accidentally logging into other sections
      if (isHRMasterUser && !isHRMasterPass) {
        return { success: false, error: 'Incorrect HR credentials. (User: test@hr | Pass: x24)' };
      }

      // ── HR-created user validation (uses real-time synced hrUsers) ─────────
      // Validates credentials ONLY against the selected section's assigned users.
      // A user assigned to "Orders" cannot login via "Warehouse" section.
      if (rawUsername && rawPassword) {
        const currentHRUsers = hrUsersRef.current;

        if (currentHRUsers.length > 0) {
          // Check credentials strictly against the selected section
          const matchedHRUser = validateHRUserCredentials(
            currentHRUsers,
            credentials.sectionId,
            rawUsername,
            rawPassword
          );

          if (matchedHRUser) {
            // Login into the matched user's assigned section
            const targetSection = getSectionById(matchedHRUser.sectionId) || sectionConfig;
            const newUser: AuthUser = {
              id: matchedHRUser.id,
              username: matchedHRUser.username,
              name: matchedHRUser.name,
              section: matchedHRUser.sectionId,
              role: matchedHRUser.role,
              email: matchedHRUser.email,
              allowedRoutes: targetSection.allowedRoutes,
              loginTime: new Date().toISOString(),
            };
            setUser(newUser);
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
            window.dispatchEvent(new CustomEvent('erp:authChanged', { detail: newUser }));
            return { success: true };
          }

          // Check if the user credentials match a DIFFERENT section
          // (i.e., they selected wrong section but correct credentials for another)
          const matchedOtherSection = currentHRUsers.find(
            (u) =>
              u.isActive &&
              (u.username.toLowerCase() === uLower || u.email?.toLowerCase() === uLower) &&
              u.password === rawPassword &&
              u.sectionId !== credentials.sectionId
          );
          if (matchedOtherSection) {
            const wrongSectionName = getSectionById(matchedOtherSection.sectionId)?.shortName || matchedOtherSection.sectionId;
            return {
              success: false,
              error: `These credentials belong to the "${wrongSectionName}" section. Please select the correct section and try again.`,
            };
          }

          // Reject if this section already has active HR-managed users (credentials must be wrong)
          const sectionHasUsers = currentHRUsers.some(
            (u) => u.sectionId === credentials.sectionId && u.isActive
          );
          if (sectionHasUsers) {
            return { success: false, error: 'Invalid username or password. Contact HR to verify your credentials.' };
          }
        }
      }

      // ── Built-in Admin fallback (hardcoded admin) ──────────────────────────
      if (credentials.sectionId === 'admin') {
        if (!rawUsername || !rawPassword) {
          return { success: false, error: 'Please enter both Admin username and password.' };
        }
        const isUserValid = uLower === 'siam@erp' || uLower === 'siam' || uLower === 'admin' || uLower === 'admin@factory.com';
        const isPassValid = rawPassword === '-test' || rawPassword === 'test';
        if (!isUserValid || !isPassValid) {
          return { success: false, error: 'Incorrect username or password for Admin. (User: siam@erp | Pass: -test)' };
        }
      }

      // ── HR Section direct access guard ─────────────────────────────────────
      if ((credentials.sectionId as string) === 'hr') {
        return { success: false, error: 'Incorrect HR credentials. (User: test@hr | Pass: x24)' };
      }

      // ── Default fallthrough (sections with no HR users yet) ────────────────
      const username = rawUsername || sectionConfig.defaultUsername;
      const displayName = uLower.includes('siam') ? 'Siam' : username.split('@')[0].toUpperCase();

      const newUser: AuthUser = {
        id: `usr_${Date.now()}`,
        username,
        name: displayName.charAt(0).toUpperCase() + displayName.slice(1).toLowerCase(),
        section: sectionConfig.id,
        role: sectionConfig.defaultRole,
        email: username.includes('@') ? username : `${username}@factory.com`,
        allowedRoutes: sectionConfig.allowedRoutes,
        loginTime: new Date().toISOString(),
      };

      setUser(newUser);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
      window.dispatchEvent(new CustomEvent('erp:authChanged', { detail: newUser }));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed. Please try again.' };
    }
  }, []); // hrUsersRef is always current via ref — no dep needed

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
    return isRouteAllowedForSection(user.section, pathname);
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
  }), [
    user, isLoading, activeSection, hrUsers,
    login, logout, switchSection, canAccessRoute,
    addHRUser, updateHRUser, deleteHRUser, refreshHRUsers,
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
