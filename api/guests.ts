import { createClient } from '@supabase/supabase-js';
import { Guest } from '../types';
import { getSessionFromRequest, RoleKey } from './_session';

type GuestRow = {
  id: string | number | null;
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
  updated_at?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  hasBreakfast?: boolean | null;
  usedToday?: boolean | null;
  consumptionDate?: string | null;
  createdAt?: string | null;
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

const toQueryParam = (value: unknown) => {
  if (Array.isArray(value)) return String(value[0] ?? '');
  if (value === undefined || value === null) return '';
  return String(value);
};

const getQueryParam = (req: any, key: string) => {
  const queryValue = req?.query?.[key];
  if (queryValue !== undefined) return toQueryParam(queryValue).trim();

  const requestUrl = new URL(req.url || '', 'http://localhost');
  return (requestUrl.searchParams.get(key) || '').trim();
};

const normalizeIdValue = (id: string | number) => {
  if (typeof id === 'number') return id;
  const trimmed = id.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
};

const normalizeGuestName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const rowToGuest = (row: GuestRow): Guest => ({
  id: String(row.id ?? ''),
  name: row.name || '',
  room: row.room || '',
  company: row.company || '',
  checkIn: row.check_in ?? row.checkIn ?? '',
  checkOut: row.check_out ?? row.checkOut ?? '',
  tariff: row.tariff ?? '',
  plan: row.plan ?? '',
  hasBreakfast: Boolean(row.has_breakfast ?? row.hasBreakfast ?? false),
  usedToday: Boolean(row.used_today ?? row.usedToday ?? false),
  consumptionDate: (row.consumption_date ?? row.consumptionDate ?? null) as
    | string
    | null,
  createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
});

const updatesToRow = (updates: Partial<Guest>) => {
  const row: Record<string, unknown> = {};

  if (updates.name !== undefined) row.name = updates.name;
  if (updates.room !== undefined) row.room = updates.room;
  if (updates.company !== undefined) row.company = updates.company;
  if (updates.checkIn !== undefined) row.check_in = updates.checkIn;
  if (updates.checkOut !== undefined) row.check_out = updates.checkOut;
  if (updates.tariff !== undefined) row.tariff = updates.tariff;
  if (updates.plan !== undefined) row.plan = updates.plan;
  if (updates.hasBreakfast !== undefined) row.has_breakfast = updates.hasBreakfast;
  if (updates.usedToday !== undefined) row.used_today = updates.usedToday;
  if (updates.consumptionDate !== undefined) row.consumption_date = updates.consumptionDate;
  if (updates.createdAt !== undefined) row.created_at = updates.createdAt;

  return row;
};

const guestToRow = (guest: Guest): GuestRow => ({
  id: normalizeIdValue(guest.id),
  name: guest.name,
  room: guest.room,
  company: guest.company,
  check_in: guest.checkIn,
  check_out: guest.checkOut,
  tariff: guest.tariff,
  plan: guest.plan,
  has_breakfast: guest.hasBreakfast,
  used_today: guest.usedToday,
  consumption_date: guest.consumptionDate,
  created_at: guest.createdAt,
});

const createServerClient = () => {
  const url = process.env.SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const table = process.env.SUPABASE_TABLE || 'cafe_manha';

  if (!url) {
    return {
      ok: false as const,
      error: 'SUPABASE_URL nao configurada no backend.',
    };
  }

  if (!serviceRoleKey) {
    return {
      ok: false as const,
      error: 'SUPABASE_SERVICE_ROLE_KEY nao configurada no backend.',
    };
  }

  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    ok: true as const,
    client,
    table,
  };
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

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, { ok: true });
    return;
  }

  const server = createServerClient();
  if (!server.ok) {
    sendJson(res, 500, { ok: false, error: server.error });
    return;
  }

  const { client, table } = server;

  try {
    const mode = getQueryParam(req, 'mode').toLowerCase();
    const id = getQueryParam(req, 'id');
    const room = getQueryParam(req, 'room');

    const isPublicRoomRead = req.method === 'GET' && !!room && !id;

    if (!isPublicRoomRead) {
      if (req.method === 'GET') {
        if (!requireSession(req, res, ['RECEPCAO', 'RESTAURANTE', 'VALIDAR'])) return;
      }

      if (req.method === 'POST' || req.method === 'DELETE') {
        if (!requireSession(req, res, ['RECEPCAO'])) return;
      }

      if (req.method === 'PATCH') {
        if (!requireSession(req, res, ['RECEPCAO', 'VALIDAR'])) return;
      }
    }

    if (req.method === 'GET') {
      const name = getQueryParam(req, 'name');

      if (id) {
        const { data, error } = await client
          .from(table)
          .select('*')
          .eq('id', normalizeIdValue(id))
          .maybeSingle();

        if (error) {
          sendJson(res, 400, { ok: false, error: error.message });
          return;
        }

        sendJson(res, 200, { ok: true, data: data ? rowToGuest(data as GuestRow) : null });
        return;
      }

      if (room && name) {
        const { data, error } = await client
          .from(table)
          .select('*')
          .eq('room', room);

        if (error) {
          sendJson(res, 400, { ok: false, error: error.message });
          return;
        }

        const normalizedName = normalizeGuestName(name);
        const found = ((data || []) as GuestRow[]).find(
          (g) => normalizeGuestName(g.name || '') === normalizedName
        );

        sendJson(res, 200, { ok: true, data: found ? rowToGuest(found) : null });
        return;
      }

      if (room) {
        const { data, error } = await client
          .from(table)
          .select('*')
          .eq('room', room)
          .order('name', { ascending: true });

        if (error) {
          sendJson(res, 400, { ok: false, error: error.message });
          return;
        }

        sendJson(res, 200, { ok: true, data: ((data || []) as GuestRow[]).map(rowToGuest) });
        return;
      }

      const { data, error } = await client
        .from(table)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        sendJson(res, 400, { ok: false, error: error.message });
        return;
      }

      sendJson(res, 200, { ok: true, data: ((data || []) as GuestRow[]).map(rowToGuest) });
      return;
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);
      if (!body) {
        sendJson(res, 400, { ok: false, error: 'Requisicao invalida.' });
        return;
      }

      const guests = Array.isArray(body.guests) ? body.guests : [];

      if (mode === 'upsert') {
        if (guests.length === 0) {
          sendJson(res, 200, { ok: true, data: [] });
          return;
        }

        const { data, error } = await client
          .from(table)
          .upsert((guests as Guest[]).map(guestToRow), { onConflict: 'id' })
          .select('*');

        if (error) {
          sendJson(res, 400, { ok: false, error: error.message });
          return;
        }

        sendJson(res, 200, { ok: true, data: ((data || []) as GuestRow[]).map(rowToGuest) });
        return;
      }

      if (guests.length === 0) {
        sendJson(res, 200, { ok: true, data: [] });
        return;
      }

      const payload = guests.map((g: any) => ({
        name: g.name,
        room: g.room,
        company: g.company,
        check_in: g.checkIn,
        check_out: g.checkOut,
        tariff: g.tariff,
        plan: g.plan,
        has_breakfast: g.hasBreakfast,
        used_today: g.usedToday,
        consumption_date: g.consumptionDate,
        created_at: new Date().toISOString(),
      }));

      const { data, error } = await client
        .from(table)
        .insert(payload)
        .select('*');

      if (error) {
        sendJson(res, 400, { ok: false, error: error.message });
        return;
      }

      sendJson(res, 200, { ok: true, data: ((data || []) as GuestRow[]).map(rowToGuest) });
      return;
    }

    if (req.method === 'PATCH') {
      if (!id) {
        sendJson(res, 400, { ok: false, error: 'Parametro id obrigatorio.' });
        return;
      }

      const body = await parseBody(req);
      if (!body) {
        sendJson(res, 400, { ok: false, error: 'Requisicao invalida.' });
        return;
      }

      const updates = (body.updates || body) as Partial<Guest>;

      const { data, error } = await client
        .from(table)
        .update(updatesToRow(updates))
        .eq('id', normalizeIdValue(id))
        .select('*')
        .maybeSingle();

      if (error) {
        sendJson(res, 400, { ok: false, error: error.message });
        return;
      }

      sendJson(res, 200, { ok: true, data: data ? rowToGuest(data as GuestRow) : null });
      return;
    }

    if (req.method === 'DELETE') {
      const { error } = await client
        .from(table)
        .delete()
        .not('id', 'is', null);

      if (error) {
        sendJson(res, 400, { ok: false, error: error.message });
        return;
      }

      sendJson(res, 200, { ok: true, data: null });
      return;
    }

    sendJson(res, 405, { ok: false, error: 'Metodo nao permitido.' });
  } catch (error: any) {
    sendJson(res, 500, {
      ok: false,
      error: error?.message || 'Erro interno ao processar requisicao.',
    });
  }
}
