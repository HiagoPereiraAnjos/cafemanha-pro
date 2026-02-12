import { createSessionToken, serializeSessionCookie } from './_session.js';
import type { RoleKey } from './_session.js';
import { checkRateLimit } from './lib/rateLimit.js';
import { parseJsonBody } from './lib/request.js';

type RolePasswords = Record<RoleKey, string>;

const ROLE_KEYS: RoleKey[] = ['RECEPCAO', 'RESTAURANTE', 'VALIDAR'];
const AUTH_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const AUTH_RATE_LIMIT_MAX_REQUESTS = 8;

const isRoleKey = (value: string): value is RoleKey =>
  ROLE_KEYS.includes(value as RoleKey);

const resolveRolePasswords = (env: Record<string, string | undefined>): RolePasswords => ({
  RECEPCAO: env.AUTH_PASSWORD_RECEPCAO || '',
  RESTAURANTE: env.AUTH_PASSWORD_RESTAURANTE || '',
  VALIDAR: env.AUTH_PASSWORD_VALIDAR || '',
});

const sendJson = (res: any, statusCode: number, payload: unknown) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const getClientIp = (req: any) => {
  const forwardedFor = req?.headers?.['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;

  if (typeof forwardedValue === 'string' && forwardedValue.trim().length > 0) {
    const firstIp = forwardedValue.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }

  return String(req?.socket?.remoteAddress || req?.connection?.remoteAddress || 'unknown');
};

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, { ok: true });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Metodo nao permitido.' });
    return;
  }

  const rateLimit = checkRateLimit(getClientIp(req), {
    namespace: 'auth',
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxRequests: AUTH_RATE_LIMIT_MAX_REQUESTS,
  });

  if (!rateLimit.allowed) {
    if (rateLimit.retryAfterSeconds) {
      res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    }
    sendJson(res, 429, {
      ok: false,
      error: 'Muitas tentativas de login. Tente novamente em alguns segundos.',
    });
    return;
  }

  const parsedBody = await parseJsonBody(req);
  if (parsedBody.ok === false) {
    sendJson(res, parsedBody.statusCode, { ok: false, error: parsedBody.error });
    return;
  }
  const body = parsedBody.data;

  const roleRaw = String(body?.role || '').trim().toUpperCase();
  const password = String(body?.password || '');

  if (!isRoleKey(roleRaw)) {
    sendJson(res, 400, { ok: false, error: 'Perfil invalido.' });
    return;
  }

  const rolePasswords = resolveRolePasswords(process.env as Record<string, string | undefined>);
  const expectedPassword = rolePasswords[roleRaw];

  if (!expectedPassword) {
    sendJson(res, 500, {
      ok: false,
      error: `Senha do perfil ${roleRaw} nao configurada no servidor.`,
    });
    return;
  }

  const sessionSecret = process.env.AUTH_SESSION_SECRET || '';
  if (!sessionSecret) {
    sendJson(res, 500, {
      ok: false,
      error: 'AUTH_SESSION_SECRET nao configurada no backend.',
    });
    return;
  }

  if (password !== expectedPassword) {
    sendJson(res, 401, { ok: false, error: 'Senha incorreta.' });
    return;
  }

  const maxAgeSeconds = 8 * 60 * 60;
  const token = createSessionToken(
    {
      role: roleRaw,
      exp: Date.now() + maxAgeSeconds * 1000,
    },
    sessionSecret
  );

  res.setHeader('Set-Cookie', serializeSessionCookie(token, maxAgeSeconds));
  sendJson(res, 200, { ok: true });
}
