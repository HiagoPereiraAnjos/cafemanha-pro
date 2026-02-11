import { createHmac, timingSafeEqual } from 'crypto';

export type RoleKey = 'RECEPCAO' | 'RESTAURANTE' | 'VALIDAR';

type SessionPayload = {
  role: RoleKey;
  exp: number;
};

const SESSION_COOKIE_NAME = 'hbcp_auth';
const ROLE_KEYS: RoleKey[] = ['RECEPCAO', 'RESTAURANTE', 'VALIDAR'];

const toBase64Url = (value: string) =>
  Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const fromBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4 || 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
};

const sign = (payloadBase64: string, secret: string) =>
  createHmac('sha256', secret).update(payloadBase64).digest('base64url');

const splitSignedToken = (token: string): [string, string] | null => {
  const dotIndex = token.indexOf('.');
  if (dotIndex <= 0) return null;
  if (dotIndex !== token.lastIndexOf('.')) return null;
  if (dotIndex >= token.length - 1) return null;

  const payloadBase64 = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  if (!payloadBase64 || !signature) return null;

  return [payloadBase64, signature];
};

export const createSessionToken = (
  payload: SessionPayload,
  secret: string
): string => {
  const payloadBase64 = toBase64Url(JSON.stringify(payload));
  const signature = sign(payloadBase64, secret);
  return `${payloadBase64}.${signature}`;
};

export const verifySessionToken = (
  token: string,
  secret: string
): SessionPayload | null => {
  const parts = splitSignedToken(token);
  if (!parts) return null;
  const [payloadBase64, signature] = parts;

  const expected = sign(payloadBase64, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(fromBase64Url(payloadBase64)) as SessionPayload;
    if (!payload || typeof payload.exp !== 'number' || typeof payload.role !== 'string') {
      return null;
    }
    if (!ROLE_KEYS.includes(payload.role as RoleKey)) return null;
    if (!Number.isFinite(payload.exp)) return null;
    if (Date.now() >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
};

export const parseCookies = (cookieHeader: string | undefined) => {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;

  for (const pair of cookieHeader.split(';')) {
    const index = pair.indexOf('=');
    if (index <= 0) continue;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }

  return result;
};

export const getSessionFromRequest = (
  req: any,
  secret: string
): SessionPayload | null => {
  const cookieHeader = req?.headers?.cookie as string | undefined;
  const cookies = parseCookies(cookieHeader);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  return verifySessionToken(token, secret);
};

export const serializeSessionCookie = (
  token: string,
  maxAgeSeconds: number
): string => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
};

export const serializeClearedSessionCookie = (): string => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
};
