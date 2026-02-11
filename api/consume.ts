import type { Guest } from '../types';
import { getSessionFromRequest } from './_session.js';
import type { RoleKey } from './_session.js';
import { verifyQrToken } from './lib/qrToken.js';
import { getTodaySaoPaulo } from './lib/date.js';
import { createSupabaseAdminClient, normalizeIdValue } from './lib/supabaseAdmin.js';
import { parseJsonBody } from './lib/request.js';

type GuestRow = {
  id: string | number;
  name: string;
  room: string;
  company: string;
  check_in: string | null;
  check_out: string | null;
  tariff: string | null;
  plan: string | null;
  has_breakfast: boolean | null;
  used_today: boolean | null;
  consumption_date: string | null;
  created_at: string | null;
};

type ConsumeRequestBody = {
  token?: unknown;
  confirm?: unknown;
};

const sendJson = (res: any, statusCode: number, payload: unknown) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const requireSession = (
  req: any,
  res: any,
  allowedRoles: RoleKey[]
): { role: RoleKey } | null => {
  const sessionSecret = process.env.AUTH_SESSION_SECRET || '';
  if (!sessionSecret) {
    sendJson(res, 500, {
      ok: false,
      error: 'AUTH_SESSION_SECRET nao configurada no backend.',
    });
    return null;
  }

  const session = getSessionFromRequest(req, sessionSecret);
  if (!session) {
    sendJson(res, 401, { ok: false, error: 'Sessao invalida ou expirada.' });
    return null;
  }

  if (!allowedRoles.includes(session.role)) {
    sendJson(res, 403, { ok: false, error: 'Perfil sem permissao para esta operacao.' });
    return null;
  }

  return { role: session.role };
};

const normalizeConsumptionDate = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;

  const normalized = String(value).trim();
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;

  return normalized;
};

const rowToGuest = (row: GuestRow): Guest => {
  const consumptionDate = normalizeConsumptionDate(row.consumption_date);

  return {
    id: String(row.id ?? ''),
    name: row.name || '',
    room: row.room || '',
    company: row.company || '',
    checkIn: row.check_in ?? '',
    checkOut: row.check_out ?? '',
    tariff: row.tariff ?? '',
    plan: row.plan ?? '',
    hasBreakfast: Boolean(row.has_breakfast ?? false),
    usedToday: consumptionDate === getTodaySaoPaulo(),
    consumptionDate,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
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

  if (!requireSession(req, res, ['VALIDAR'])) return;

  const parsedBody = await parseJsonBody<ConsumeRequestBody>(req);
  if (parsedBody.ok === false) {
    sendJson(res, parsedBody.statusCode, { ok: false, error: parsedBody.error });
    return;
  }
  const body = parsedBody.data;

  const token = String(body?.token || '').trim();
  if (!token) {
    sendJson(res, 400, { ok: false, error: 'token obrigatorio.' });
    return;
  }

  const confirmed = body?.confirm === true;
  if (!confirmed) {
    sendJson(res, 400, {
      ok: false,
      error: 'Confirmacao obrigatoria para validar consumo.',
    });
    return;
  }

  const decoded = verifyQrToken(token);
  if (decoded === 'expired') {
    sendJson(res, 401, { ok: false, error: 'Token expirado' });
    return;
  }

  if (!decoded) {
    sendJson(res, 400, { ok: false, error: 'Token invalido' });
    return;
  }

  const server = createSupabaseAdminClient();
  if (server.ok === false) {
    sendJson(res, 500, { ok: false, error: server.error });
    return;
  }

  try {
    const { client, table } = server;
    const fromTable = () => (client as any).from(table);
    const guestId = normalizeIdValue(decoded.guestId);
    const today = getTodaySaoPaulo();

    // Atualizacao atomica para evitar dupla validacao em chamadas concorrentes.
    const { data: updatedRows, error: updateError } = await fromTable()
      .update({
        used_today: true,
        consumption_date: today,
      })
      .eq('id', guestId)
      .eq('has_breakfast', true)
      .or(`consumption_date.is.null,consumption_date.neq.${today}`)
      .select('*');

    if (updateError) {
      sendJson(res, 400, { ok: false, error: updateError.message });
      return;
    }

    const updatedGuest = ((updatedRows || []) as GuestRow[])[0] || null;
    if (!updatedGuest) {
      const { data: existing, error: existingError } = await fromTable()
        .select('*')
        .eq('id', guestId)
        .maybeSingle();

      if (existingError) {
        sendJson(res, 400, { ok: false, error: existingError.message });
        return;
      }

      const guest = existing as GuestRow | null;
      if (!guest) {
        sendJson(res, 404, { ok: false, error: 'Hospede nao encontrado.' });
        return;
      }

      if (!guest.has_breakfast) {
        sendJson(res, 400, { ok: false, error: 'Hospede sem direito ao cafe da manha.' });
        return;
      }

      const alreadyUsedToday = normalizeConsumptionDate(guest.consumption_date) === today;
      if (alreadyUsedToday) {
        sendJson(res, 409, { ok: false, error: 'Cafe da manha ja utilizado hoje.' });
        return;
      }

      sendJson(res, 409, {
        ok: false,
        error: 'Nao foi possivel registrar consumo neste momento.',
      });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      success: true,
      data: updatedGuest ? rowToGuest(updatedGuest) : null,
    });
  } catch (error: any) {
    sendJson(res, 500, {
      ok: false,
      error: error?.message || 'Erro interno ao consumir QR.',
    });
  }
}
