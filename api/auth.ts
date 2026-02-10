import { createSessionToken, serializeSessionCookie } from './_session.js';
import type { RoleKey } from './_session.js';

type RolePasswords = Record<RoleKey, string>;

const ROLE_KEYS: RoleKey[] = ['RECEPCAO', 'RESTAURANTE', 'VALIDAR'];

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

const readRawBody = (req: any): Promise<string> =>
  new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk: Buffer | string) => {
      body += chunk.toString();
    });

    req.on('end', () => resolve(body));
    req.on('error', reject);
  });

const parseBody = async (req: any) => {
  if (req.body && typeof req.body === 'object') return req.body;

  const rawBody = typeof req.body === 'string' ? req.body : await readRawBody(req);
  if (!rawBody) return {};

  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
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

  const body = await parseBody(req);
  if (!body) {
    sendJson(res, 400, { ok: false, error: 'Requisicao invalida.' });
    return;
  }

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


