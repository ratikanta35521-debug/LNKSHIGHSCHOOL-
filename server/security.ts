import crypto from 'crypto';

const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.startsWith('scrypt:')) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 3) return false;
  const [, salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedKey = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedKey.length) return false;
  return crypto.timingSafeEqual(derived, storedKey);
}

export function generateSessionToken(): { rawToken: string; tokenHash: string } {
  const nonce = crypto.randomBytes(32).toString('hex');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(nonce).digest('hex');
  const rawToken = `${nonce}.${sig}`;
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

export function verifyTokenSignature(rawToken: string): boolean {
  const parts = rawToken.split('.');
  if (parts.length !== 2) return false;
  const [nonce, sig] = parts;
  if (!nonce || !sig || nonce.length !== 64 || sig.length !== 64) return false;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(nonce).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function isValidHttpUrl(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  try {
    const parsed = new URL(input.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function sanitizeCsvCell(value: string | number | null | undefined): string {
  let str = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function cleanText(input: unknown, maxLen = 2000): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, maxLen);
}
