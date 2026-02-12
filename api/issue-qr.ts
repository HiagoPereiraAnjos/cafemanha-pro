import { generateQrToken } from './lib/qrToken.js';
import { getTodaySaoPaulo, isQrIssuanceWindowOpen } from './lib/date.js';
import { checkRateLimit } from './lib/rateLimit.js';
import { createSupabaseAdminClient, normalizeIdValue } from './lib/supabaseAdmin.js';
import { parseJsonBody } from './lib/request.js';

type GuestStatusRow = {
  id: string | number;
  has_breakfast: boolean | null;
  consumption_date: string | null;
};

type IssueQrRequestBody = {
  guestId?: unknown;
};

const sendJson = (res: any, statusCode: number, payload: unknown) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const normalizeConsumptionDate = (value: unknown) => {
  if (value === null || value === undefined) return null;

  const normalized = String(value).trim();
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;

  return normalized;
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

  const rateLimit = checkRateLimit(getClientIp(req));
  if (!rateLimit.allowed) {
    if (rateLimit.retryAfterSeconds) {
      res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    }
    sendJson(res, 429, {
      ok: false,
      error: 'Muitas tentativas. Tente novamente em alguns segundos.',
    });
    return;
  }

  const parsedBody = await parseJsonBody<IssueQrRequestBody>(req);
  if (parsedBody.ok === false) {
    sendJson(res, parsedBody.statusCode, { ok: false, error: parsedBody.error });
    return;
  }
  const body = parsedBody.data;

  const guestId = String(body?.guestId || '').trim();
  if (!guestId) {
    sendJson(res, 400, { ok: false, error: 'guestId obrigatorio.' });
    return;
  }

  if (!isQrIssuanceWindowOpen()) {
    sendJson(res, 403, {
      ok: false,
      error:
        'Geracao de QR disponivel de segunda a sabado das 06:00 as 10:00 e aos domingos das 07:00 as 10:00 (America/Sao_Paulo).',
    });
    return;
  }

  const server = createSupabaseAdminClient();
  if (server.ok === false) {
    sendJson(res, 500, { ok: false, error: server.error });
    return;
  }

  try {
    const { client, table } = server;
    const { data, error } = await client
      .from(table)
      .select('id, has_breakfast, consumption_date')
      .eq('id', normalizeIdValue(guestId))
      .maybeSingle();

    if (error) {
      sendJson(res, 400, { ok: false, error: error.message });
      return;
    }

    const guest = data as GuestStatusRow | null;
    if (!guest) {
      sendJson(res, 404, { ok: false, error: 'Nao disponivel' });
      return;
    }

    if (!guest.has_breakfast) {
      sendJson(res, 404, { ok: false, error: 'Nao disponivel' });
      return;
    }

    const today = getTodaySaoPaulo();
    const alreadyUsedToday = normalizeConsumptionDate(guest.consumption_date) === today;
    if (alreadyUsedToday) {
      sendJson(res, 404, { ok: false, error: 'Nao disponivel' });
      return;
    }

    const token = generateQrToken(String(guest.id));
    sendJson(res, 200, { ok: true, token });
  } catch (error: any) {
    sendJson(res, 500, {
      ok: false,
      error: error?.message || 'Erro interno ao emitir token de QR.',
    });
  }
}
