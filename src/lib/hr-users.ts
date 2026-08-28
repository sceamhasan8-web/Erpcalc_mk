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
import { hashPassword, verifyPassword } from './crypto';
import { sanitizePayload } from './security';

const HR_USERS_COLLECTION = 'hr_users';

/**
 * Subscribe to HR users in real-time using Firestore onSnapshot.
 * Calls `onChange` with sanitized data without leaking raw credentials.
 */
export function subscribeToHRUsers(onChange: (users: HRUser[]) => void): Unsubscribe {
  const q = query(collection(db, HR_USERS_COLLECTION), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const users: HRUser[] = snapshot.docs.map((docSnap) => {
        const raw = docSnap.data() as any;
        return {
          id: docSnap.id,
          username: raw.username || '',
          name: raw.name || '',
          email: raw.email || '',
          sectionId: raw.sectionId || 'orders',
          role: raw.role || 'Staff',
          allowedRoutes: raw.allowedRoutes || [],
          isActive: raw.isActive ?? true,
          passwordHash: raw.passwordHash || (raw.password ? raw.password : undefined),
          passwordSalt: raw.passwordSalt || '',
          createdAt: raw.createdAt || new Date().toISOString(),
          updatedAt: raw.updatedAt || new Date().toISOString(),
        };
      });
      onChange(users);
    },
    (error) => {
      console.warn('HR users real-time listener note:', error?.message || error);
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
    return snapshot.docs.map((docSnap) => {
      const raw = docSnap.data() as any;
      return {
        id: docSnap.id,
        username: raw.username || '',
        name: raw.name || '',
        email: raw.email || '',
        sectionId: raw.sectionId || 'orders',
        role: raw.role || 'Staff',
        allowedRoutes: raw.allowedRoutes || [],
        isActive: raw.isActive ?? true,
        passwordHash: raw.passwordHash || (raw.password ? raw.password : undefined),
        passwordSalt: raw.passwordSalt || '',
        createdAt: raw.createdAt || new Date().toISOString(),
        updatedAt: raw.updatedAt || new Date().toISOString(),
      };
    });
  } catch (error) {
    console.warn('Failed to fetch HR users:', error);
    return [];
  }
}

/**
 * Create a new HR-managed user with cryptographic salted password hashing.
 * Plaintext passwords are NEVER stored in Firestore.
 */
export async function createHRUser(
  userData: Omit<HRUser, 'id' | 'createdAt' | 'updatedAt'>
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const sanitized = sanitizePayload(userData);
    const now = new Date().toISOString();

    let passwordHash = sanitized.passwordHash;
    let passwordSalt = sanitized.passwordSalt;

    // Hash the password if provided as plaintext
    if (sanitized.password) {
      const hashed = await hashPassword(sanitized.password);
      passwordHash = hashed.hash;
      passwordSalt = hashed.salt;
    }

    const payload: Record<string, any> = {
      name: sanitized.name,
      username: sanitized.username.toLowerCase().trim(),
      email: sanitized.email ? sanitized.email.toLowerCase().trim() : '',
      sectionId: sanitized.sectionId,
      role: sanitized.role,
      allowedRoutes: sanitized.allowedRoutes || [],
      isActive: sanitized.isActive ?? true,
      passwordHash: passwordHash || '',
      passwordSalt: passwordSalt || '',
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, HR_USERS_COLLECTION), payload);
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error('Failed to create HR user:', error);
    return { success: false, error: error.message || 'Failed to create user' };
  }
}

/**
 * Update an existing HR-managed user.
 * Re-hashes password if changed, and sanitizes payload.
 */
export async function updateHRUser(
  id: string,
  updates: Partial<Omit<HRUser, 'id' | 'createdAt'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const sanitized = sanitizePayload(updates);
    const ref = doc(db, HR_USERS_COLLECTION, id);

    const updatePayload: Record<string, any> = {
      ...sanitized,
      updatedAt: new Date().toISOString(),
    };

    // If a new plaintext password was entered, hash it with fresh salt
    if (sanitized.password && sanitized.password.trim() !== '') {
      const hashed = await hashPassword(sanitized.password.trim());
      updatePayload.passwordHash = hashed.hash;
      updatePayload.passwordSalt = hashed.salt;
      delete updatePayload.password; // Do not store plaintext
    } else {
      delete updatePayload.password;
    }

    if (sanitized.username) {
      updatePayload.username = sanitized.username.toLowerCase().trim();
    }
    if (sanitized.email !== undefined) {
      updatePayload.email = sanitized.email.toLowerCase().trim();
    }

    await updateDoc(ref, updatePayload);
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
 * Validate credentials against HR-managed users securely.
 * Checks salted SHA-256 hash and handles legacy password migration seamlessly.
 */
export async function validateHRUserCredentials(
  users: HRUser[],
  usernameOrEmail: string,
  candidatePassword: string
): Promise<HRUser | null> {
  const normalized = usernameOrEmail.trim().toLowerCase();

  const user = users.find(
    (u) =>
      u.isActive &&
      (u.username.trim().toLowerCase() === normalized ||
        (u.email && u.email.trim().toLowerCase() === normalized))
  );

  if (!user) return null;

  const storedHash = user.passwordHash || user.password || '';
  const salt = user.passwordSalt || '';

  const isValid = await verifyPassword(candidatePassword, storedHash, salt);

  if (!isValid) return null;

  // If user was using legacy unhashed password, upgrade to salted hash asynchronously
  if (!user.passwordSalt && user.id) {
    try {
      const { hash: newHash, salt: newSalt } = await hashPassword(candidatePassword);
      const ref = doc(db, HR_USERS_COLLECTION, user.id);
      await updateDoc(ref, {
        passwordHash: newHash,
        passwordSalt: newSalt,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // Non-blocking background upgrade
    }
  }

  return user;
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
