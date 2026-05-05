import * as crypto from 'crypto';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 100_000, 32, 'sha256')
    .toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPasswordStored(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) {
    return false;
  }
  const [salt, hash] = parts;
  const verify = crypto
    .pbkdf2Sync(password, salt, 100_000, 32, 'sha256')
    .toString('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(verify, 'hex')
    );
  } catch {
    return false;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
