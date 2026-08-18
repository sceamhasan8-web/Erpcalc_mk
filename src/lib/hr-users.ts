import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { HRUser, SectionId } from '@/types/auth';

const HR_USERS_COLLECTION = 'hr_users';

/**
 * Subscribe to HR users in real-time using Firestore onSnapshot.
 * Calls `onChange` immediately with the current data, then on every update.
 * Returns an unsubscribe function.
 */
export function subscribeToHRUsers(onChange: (users: HRUser[]) => void): Unsubscribe {
  const q = query(collection(db, HR_USERS_COLLECTION), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const users: HRUser[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<HRUser, 'id'>),
      }));
      onChange(users);
    },
    (error) => {
      console.error('HR users real-time listener error:', error);
    }
  );
}

/**
 * One-time fetch of all HR-managed users from Firestore (fallback / initial load).
 */
export async function getHRUsers(): Promise<HRUser[]> {
  try {
    const q = query(collection(db, HR_USERS_COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<HRUser, 'id'>),
    }));
  } catch (error) {
    console.error('Failed to fetch HR users:', error);
    return [];
  }
}

/**
 * Create a new HR-managed user.
 */
export async function createHRUser(
  userData: Omit<HRUser, 'id' | 'createdAt' | 'updatedAt'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const now = new Date().toISOString();
    const docRef = await addDoc(collection(db, HR_USERS_COLLECTION), {
      ...userData,
      createdAt: now,
      updatedAt: now,
    });
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error('Failed to create HR user:', error);
    return { success: false, error: error.message || 'Failed to create user' };
  }
}

/**
 * Update an existing HR-managed user.
 */
export async function updateHRUser(
  id: string,
  updates: Partial<Omit<HRUser, 'id' | 'createdAt'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const ref = doc(db, HR_USERS_COLLECTION, id);
    await updateDoc(ref, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error: any) {
    console.error('Failed to update HR user:', error);
    return { success: false, error: error.message || 'Failed to update user' };
  }
}

/**
 * Delete an HR-managed user.
 */
export async function deleteHRUser(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteDoc(doc(db, HR_USERS_COLLECTION, id));
    return { success: true };
  } catch (error: any) {
    console.error('Failed to delete HR user:', error);
    return { success: false, error: error.message || 'Failed to delete user' };
  }
}

/**
 * Validate credentials against HR-managed users.
 * Returns the matching HRUser if valid, otherwise null.
 */
export function validateHRUserCredentials(
  users: HRUser[],
  sectionId: SectionId | string,
  username: string,
  password: string
): HRUser | null {
  const normalized = (s: string) => s.trim().toLowerCase();
  return (
    users.find(
      (u) =>
        u.isActive &&
        u.sectionId === sectionId &&
        normalized(u.username) === normalized(username) &&
        u.password === password
    ) || null
  );
}

/**
 * Check if a username already exists (across all sections).
 */
export function isUsernameUnique(users: HRUser[], username: string, excludeId?: string): boolean {
  const normalized = username.trim().toLowerCase();
  return !users.some(
    (u) => u.username.trim().toLowerCase() === normalized && u.id !== excludeId
  );
}
