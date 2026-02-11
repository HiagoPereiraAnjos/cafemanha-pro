import { generateQrToken } from './lib/qrToken.js';
import { getTodaySaoPaulo } from './lib/date.js';
import { createSupabaseAdminClient, normalizeIdValue } from './lib/supabaseAdmin.js';

type GuestStatusRow = {
  id: string | number;
  has_breakfast: boolean | null;
  consumption_date: string | null;
};

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

const normalizeConsumptionDate = (value: unknown) => {
  if (value === null || value === undefined) return null;

  const normalized = String(value).trim();
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;

  return normalized;
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

  const guestId = String(body?.guestId || '').trim();
  if (!guestId) {
    sendJson(res, 400, { ok: false, error: 'guestId obrigatorio.' });
    return;
  }

  const server = createSupabaseAdminClient();
  if (!server.ok) {
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
      sendJson(res, 404, { ok: false, error: 'Hospede nao encontrado.' });
      return;
    }

    if (!guest.has_breakfast) {
      sendJson(res, 400, { ok: false, error: 'Hospede sem direito ao cafe da manha.' });
      return;
    }

    const today = getTodaySaoPaulo();
    const alreadyUsedToday = normalizeConsumptionDate(guest.consumption_date) === today;
    if (alreadyUsedToday) {
      sendJson(res, 409, { ok: false, error: 'Cafe da manha ja utilizado hoje.' });
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
