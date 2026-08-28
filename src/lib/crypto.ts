/**
 * Enterprise Cryptographic Utilities
 * Uses standard Web Crypto API (supported natively in modern browsers and Node.js 18+)
 */

// Generate a random cryptographic salt in hex format
export function generateSalt(length = 16): string {
  const array = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
  } else if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    globalThis.crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Compute SHA-256 hash of a string with salt
export async function hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
  const activeSalt = salt || generateSalt();
  const encoder = new TextEncoder();
  const data = encoder.encode(password + ':' + activeSalt);

  const subtle = typeof window !== 'undefined' && window.crypto ? window.crypto.subtle : (globalThis.crypto?.subtle || null);
  
  if (subtle) {
    const hashBuffer = await subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return { hash: hashHex, salt: activeSalt };
  }

  // Fallback hash implementation if WebCrypto subtle is unavailable
  let hash = 0;
  const str = password + ':' + activeSalt;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return { hash: Math.abs(hash).toString(16), salt: activeSalt };
}

// Verify a plaintext password against a stored hash and salt
export async function verifyPassword(password: string, storedHash: string, salt?: string): Promise<boolean> {
  if (!password || !storedHash) return false;
  
  if (salt) {
    const { hash } = await hashPassword(password, salt);
    return timingSafeEqual(hash, storedHash);
  }

  // Fallback if stored without separate salt
  const { hash: unsaltedHash } = await hashPassword(password, '');
  if (timingSafeEqual(unsaltedHash, storedHash)) return true;

  // Backward compatibility: If stored as plaintext in legacy database, verify directly
  return password === storedHash;
}

// Timing-safe string comparison to prevent timing attacks
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Sign a session payload with a client-side integrity signature
export async function signSessionPayload(userId: string, section: string, timestamp: string): Promise<string> {
  const secretKey = 'erp_session_sec_' + (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'erpcalc');
  const encoder = new TextEncoder();
  const payload = `${userId}:${section}:${timestamp}:${secretKey}`;
  
  const subtle = typeof window !== 'undefined' && window.crypto ? window.crypto.subtle : (globalThis.crypto?.subtle || null);
  if (subtle) {
    const hashBuffer = await subtle.digest('SHA-256', encoder.encode(payload));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return generateSalt(16);
}

// Verify session signature
export async function verifySessionSignature(userId: string, section: string, timestamp: string, signature: string): Promise<boolean> {
  if (!signature) return false;
  const expectedSig = await signSessionPayload(userId, section, timestamp);
  return timingSafeEqual(expectedSig, signature);
}
