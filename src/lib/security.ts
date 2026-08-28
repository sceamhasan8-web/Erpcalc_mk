/**
 * Security & Sanitization Utilities
 * Protects against Prototype Pollution, Object Injection, XSS, and Oversized Payloads.
 */

// Dangerous object keys used in Prototype Pollution attacks
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Recursively sanitizes data payloads:
 * 1. Blocks prototype pollution attempts
 * 2. Strips HTML script tags to prevent stored XSS
 * 3. Trims strings and removes non-printable control characters
 */
export function sanitizePayload<T = any>(data: T, depth = 0): T {
  if (depth > 10) {
    // Prevent recursion bombs
    return null as any;
  }

  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Strip dangerous tags like <script> or javascript: URLs
    return data
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .trim() as unknown as T;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizePayload(item, depth + 1)) as unknown as T;
  }

  if (typeof data === 'object') {
    if (data instanceof Date) {
      return data;
    }

    const cleanObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      // Prototype pollution defense
      if (FORBIDDEN_KEYS.has(key)) {
        continue;
      }
      // Sanitize key name
      const cleanKey = key.replace(/[^a-zA-Z0-9_$-]/g, '');
      if (cleanKey) {
        cleanObj[cleanKey] = sanitizePayload(value, depth + 1);
      }
    }
    return cleanObj as T;
  }

  return data;
}

/**
 * Basic in-memory rate limiter for server endpoints
 */
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();

export function checkRateLimit(identifier: string, limit = 60, windowMs = 60000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry || entry.expiresAt <= now) {
    rateLimitMap.set(identifier, { count: 1, expiresAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count };
}
