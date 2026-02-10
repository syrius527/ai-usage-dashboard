import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';

const SESSION_COOKIE_NAME = 'dashboard_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000;
const SALT_ROUNDS = 12;

const sessions = new Map<string, { createdAt: number }>();

function getPasswordHash(): string {
  const hash = process.env.DASHBOARD_PASSWORD_HASH;
  if (!hash) {
    throw new Error('DASHBOARD_PASSWORD_HASH environment variable is required');
  }
  return hash;
}

export function createSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function registerSession(token: string): void {
  sessions.set(token, { createdAt: Date.now() });
}

export function validateSession(token: string): boolean {
  const session = sessions.get(token);
  if (!session) return false;

  const isExpired = Date.now() - session.createdAt > SESSION_DURATION;
  if (isExpired) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function invalidateSession(token: string): void {
  sessions.delete(token);
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_DURATION / 1000,
    path: '/',
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    invalidateSession(token);
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getSessionToken();
  if (!token) return false;
  return validateSession(token);
}

export async function verifyPassword(password: string): Promise<boolean> {
  try {
    const hash = getPasswordHash();
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}
