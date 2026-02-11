import { createClient } from '@supabase/supabase-js';
import type { Guest, PublicGuest } from '../types';
import { getSessionFromRequest } from './_session.js';
import type { RoleKey } from './_session.js';
import { getTodaySaoPaulo } from './lib/date.js';
import { parseJsonBody } from './lib/request.js';

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

type PublicGuestRow = {
  id: string | number | null;
  name: string;
  has_breakfast: boolean | null;
  consumption_date: string | null;
};

const sendJson = (res: any, statusCode: number, payload: unknown) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
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

const toInFilterValue = (value: string | number | null) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  const normalized = String(value).trim();
  if (/^\d+$/.test(normalized)) return normalized;
  return `"${normalized.replace(/"/g, '\\"')}"`;
};

const normalizeGuestName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const normalizeConsumptionDate = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;

  const normalized = String(value).trim();
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;

  return normalized;
};

const isConsumedToday = (consumptionDate: string | null | undefined) =>
  normalizeConsumptionDate(consumptionDate) === getTodaySaoPaulo();

const rowToGuest = (row: GuestRow): Guest => {
  const consumptionDate = normalizeConsumptionDate(
    row.consumption_date ?? row.consumptionDate ?? null
  );

  return {
    id: String(row.id ?? ''),
    name: row.name || '',
    room: row.room || '',
    company: row.company || '',
    checkIn: row.check_in ?? row.checkIn ?? '',
    checkOut: row.check_out ?? row.checkOut ?? '',
    tariff: row.tariff ?? '',
    plan: row.plan ?? '',
    hasBreakfast: Boolean(row.has_breakfast ?? row.hasBreakfast ?? false),
    usedToday: isConsumedToday(consumptionDate),
    consumptionDate,
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
  };
};

const rowToPublicGuest = (row: PublicGuestRow): PublicGuest => {
  const consumptionDate = normalizeConsumptionDate(row.consumption_date);
  return {
    id: String(row.id ?? ''),
    name: row.name || '',
    hasBreakfast: Boolean(row.has_breakfast ?? false),
    usedToday: isConsumedToday(consumptionDate),
  };
};

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

  let nextConsumptionDate: string | null | undefined;
  if (updates.consumptionDate !== undefined) {
    nextConsumptionDate = normalizeConsumptionDate(updates.consumptionDate);
  } else if (updates.usedToday !== undefined) {
    nextConsumptionDate = updates.usedToday ? getTodaySaoPaulo() : null;
  }

  if (nextConsumptionDate !== undefined) {
    row.consumption_date = nextConsumptionDate;
    row.used_today = isConsumedToday(nextConsumptionDate);
  }

  if (updates.createdAt !== undefined) row.created_at = updates.createdAt;

  return row;
};

const guestToRow = (guest: Guest): GuestRow => {
  const consumptionDate = normalizeConsumptionDate(guest.consumptionDate);

  return {
    id: normalizeIdValue(guest.id),
    name: guest.name,
    room: guest.room,
    company: guest.company,
    check_in: guest.checkIn,
    check_out: guest.checkOut,
    tariff: guest.tariff,
    plan: guest.plan,
    has_breakfast: guest.hasBreakfast,
    used_today: isConsumedToday(consumptionDate),
    consumption_date: consumptionDate,
    created_at: guest.createdAt,
  };
};

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
          .select('id, name, has_breakfast, consumption_date')
          .eq('room', room);

        if (error) {
          sendJson(res, 400, { ok: false, error: error.message });
          return;
        }

        const normalizedName = normalizeGuestName(name);
        const found = ((data || []) as PublicGuestRow[]).find(
          (g) => normalizeGuestName(g.name || '') === normalizedName
        );

        sendJson(res, 200, { ok: true, data: found ? rowToPublicGuest(found) : null });
        return;
      }

      if (room) {
        const { data, error } = await client
          .from(table)
          .select('id, name, has_breakfast, consumption_date')
          .eq('room', room)
          .order('name', { ascending: true });

        if (error) {
          sendJson(res, 400, { ok: false, error: error.message });
          return;
        }

        sendJson(res, 200, { ok: true, data: ((data || []) as PublicGuestRow[]).map(rowToPublicGuest) });
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
      const parsedBody = await parseJsonBody(req);
      if (!parsedBody.ok) {
        sendJson(res, parsedBody.statusCode, { ok: false, error: parsedBody.error });
        return;
      }
      const body = parsedBody.data;

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

      if (mode === 'replace') {
        if (guests.length === 0) {
          const { error: clearError } = await client
            .from(table)
            .delete()
            .not('id', 'is', null);

          if (clearError) {
            sendJson(res, 400, { ok: false, error: clearError.message });
            return;
          }

          sendJson(res, 200, { ok: true, data: [] });
          return;
        }

        const nowIso = new Date().toISOString();
        const payload = guests.map((g: any) => {
          const consumptionDate = normalizeConsumptionDate(g.consumptionDate);
          return {
            name: g.name,
            room: g.room,
            company: g.company,
            check_in: g.checkIn,
            check_out: g.checkOut,
            tariff: g.tariff,
            plan: g.plan,
            has_breakfast: g.hasBreakfast,
            used_today: isConsumedToday(consumptionDate),
            consumption_date: consumptionDate,
            created_at: nowIso,
          };
        });

        const { data: insertedData, error: insertError } = await client
          .from(table)
          .insert(payload)
          .select('*');

        if (insertError) {
          sendJson(res, 400, { ok: false, error: insertError.message });
          return;
        }

        const insertedRows = (insertedData || []) as GuestRow[];
        const insertedIds = insertedRows
          .map((row) => row.id)
          .filter((id): id is string | number => id !== null && id !== undefined);

        if (insertedIds.length === 0) {
          sendJson(res, 500, {
            ok: false,
            error: 'Falha ao substituir dados: nenhum ID retornado na insercao.',
          });
          return;
        }

        const inValues = insertedIds.map(toInFilterValue).filter(Boolean).join(',');
        const { error: removeOldError } = await client
          .from(table)
          .delete()
          .not('id', 'in', `(${inValues})`);

        if (removeOldError) {
          // Rollback compensatorio para evitar manter dados duplicados em caso de falha parcial.
          await client.from(table).delete().in('id', insertedIds.map(normalizeIdValue));
          sendJson(res, 400, {
            ok: false,
            error: `Falha ao concluir substituicao dos dados: ${removeOldError.message}`,
          });
          return;
        }

        sendJson(res, 200, { ok: true, data: insertedRows.map(rowToGuest) });
        return;
      }

      if (guests.length === 0) {
        sendJson(res, 200, { ok: true, data: [] });
        return;
      }

      const payload = guests.map((g: any) => {
        const consumptionDate = normalizeConsumptionDate(g.consumptionDate);
        return {
          name: g.name,
          room: g.room,
          company: g.company,
          check_in: g.checkIn,
          check_out: g.checkOut,
          tariff: g.tariff,
          plan: g.plan,
          has_breakfast: g.hasBreakfast,
          used_today: isConsumedToday(consumptionDate),
          consumption_date: consumptionDate,
          created_at: new Date().toISOString(),
        };
      });

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

      const parsedBody = await parseJsonBody(req);
      if (!parsedBody.ok) {
        sendJson(res, parsedBody.statusCode, { ok: false, error: parsedBody.error });
        return;
      }
      const body = parsedBody.data;

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
